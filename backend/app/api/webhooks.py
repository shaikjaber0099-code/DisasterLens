from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Form, Depends, HTTPException, Response, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import ResidentReply, NotificationLog, Zone, AlertDispatch
from backend.app.notifications import (
    LOCAL_EMERGENCY_ROUTING, 
    DEFAULT_EMERGENCY_ROUTING, 
    send_alert, 
    load_residents_file,
    find_residents_in_zone,
    dispatch_emergency_alert,
    get_twilio_from_numbers
)

router = APIRouter(tags=["webhooks_and_notifications"])

class ManualAlertRequest(BaseModel):
    recipient_phone: str
    zone_id: int
    confidence_score: Optional[float] = 0.95
    status: Optional[str] = "CRITICAL"
    rationale: Optional[str] = "Severe operational anomaly verified by emergency dispatch desk."
    channel: Optional[str] = "whatsapp"
    custom_from: Optional[str] = None
    custom_whatsapp_from: Optional[str] = None

class DispatchAlertPayload(BaseModel):
    recipient_number: str
    channel: Optional[str] = "whatsapp" # "whatsapp" or "sms"
    zone_id: int
    rationale: str

class ResidentReplyResponse(BaseModel):
    id: int
    phone_number: str
    zone_id: Optional[int]
    reply_text: str
    status: str
    timestamp: str

    class Config:
        from_attributes = True


# ============================================================================
# NEW SIMPLIFIED DISPATCH ENDPOINT: POST /api/alerts/dispatch
# ============================================================================
@router.post("/alerts/dispatch")
@router.post("/api/alerts/dispatch")
def api_dispatch_alert(payload: DispatchAlertPayload, db: Session = Depends(get_db)):
    """
    POST /api/alerts/dispatch body: { recipient_number, channel, zone_id, rationale }.
    Backend logic:
      - Look up TWILIO_SMS_FROM_NUMBER / TWILIO_WHATSAPP_FROM_NUMBER from env.
      - If channel == "whatsapp": attempt Twilio WhatsApp send from env WhatsApp sender to whatsapp:{recipient_number}.
      - On WhatsApp failure, automatically retry as plain SMS from TWILIO_SMS_FROM_NUMBER.
      - Append standard two-way instruction footer: "Reply SAFE if you are secure, or reply HELP for local rescue routing."
      - Log the dispatch (channel used, Twilio SID, timestamp, zone_id, recipient) to alert_dispatches table.
      - If credentials are not set, run in simulation mode (SM_simulated_{timestamp}) and log it.
    """
    return dispatch_emergency_alert(
        recipient_number=payload.recipient_number,
        channel=payload.channel or "whatsapp",
        zone_id=payload.zone_id,
        rationale=payload.rationale,
        db=db
    )


# ============================================================================
# NEW TWO-WAY REPLIES WEBHOOK ENDPOINT: POST /api/alerts/webhook
# ============================================================================
@router.post("/alerts/webhook")
@router.post("/api/alerts/webhook")
async def alerts_inbound_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Receives inbound SMS/WhatsApp replies from Twilio webhook, matches by recipient
    number to the open alert_dispatches row, and stores the reply text + timestamp
    for display under the "Citizen Replies" tab.
    Supports both Twilio form-urlencoded and JSON test payloads.
    """
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body_data = await request.json()
        except Exception:
            body_data = {}
        raw_from = str(body_data.get("From") or body_data.get("recipient_number") or body_data.get("phone_number") or "")
        raw_body = str(body_data.get("Body") or body_data.get("reply_text") or body_data.get("text") or "")
    else:
        try:
            form_data = await request.form()
        except Exception:
            form_data = {}
        raw_from = str(form_data.get("From", ""))
        raw_body = str(form_data.get("Body", ""))

    clean_from = raw_from.replace("whatsapp:", "").strip()
    clean_body = raw_body.strip()
    body_upper = clean_body.upper()

    # Determine status & classification
    if "SAFE" in body_upper:
        reply_status = "SAFE"
    elif "HELP" in body_upper:
        reply_status = "HELP"
    else:
        reply_status = "UNKNOWN"

    digits_from = "".join(c for c in clean_from if c.isdigit())
    now = datetime.utcnow()

    # Match by recipient number to the open alert_dispatches row (where reply_text is None)
    open_dispatches = db.query(AlertDispatch).filter(
        AlertDispatch.reply_text == None
    ).order_by(AlertDispatch.created_at.desc()).all()

    matched_dispatch = None
    for d in open_dispatches:
        d_clean = (d.recipient_number or "").replace("whatsapp:", "").strip()
        d_digits = "".join(c for c in d_clean if c.isdigit())
        if clean_from and (clean_from == d_clean or clean_from.endswith(d_clean) or d_clean.endswith(clean_from)):
            matched_dispatch = d
            break
        if len(digits_from) >= 7 and len(d_digits) >= 7 and (digits_from.endswith(d_digits[-7:]) or d_digits.endswith(digits_from[-7:])):
            matched_dispatch = d
            break

    # If no open dispatch found, fallback to most recent dispatch for this number
    if not matched_dispatch:
        all_dispatches = db.query(AlertDispatch).order_by(AlertDispatch.created_at.desc()).all()
        for d in all_dispatches:
            d_clean = (d.recipient_number or "").replace("whatsapp:", "").strip()
            d_digits = "".join(c for c in d_clean if c.isdigit())
            if clean_from and (clean_from == d_clean or clean_from.endswith(d_clean) or d_clean.endswith(clean_from)):
                matched_dispatch = d
                break
            if len(digits_from) >= 7 and len(d_digits) >= 7 and (digits_from.endswith(d_digits[-7:]) or d_digits.endswith(digits_from[-7:])):
                matched_dispatch = d
                break

    matched_zone_id = None
    matched_country = "Global"

    if matched_dispatch:
        matched_dispatch.reply_text = clean_body
        matched_dispatch.reply_status = reply_status
        matched_dispatch.replied_at = now
        matched_zone_id = matched_dispatch.zone_id
        db.commit()
        db.refresh(matched_dispatch)

    # Resolve country for emergency rescue routing if HELP requested
    if matched_zone_id:
        z = db.query(Zone).filter(Zone.id == matched_zone_id).first()
        if z and z.country:
            matched_country = z.country
    else:
        # Match from mock residents
        residents = load_residents_file()
        for r in residents:
            r_phone = r.get("phone_number", "").replace("whatsapp:", "").strip()
            r_digits = "".join(c for c in r_phone if c.isdigit())
            if digits_from and (digits_from.endswith(r_digits[-7:]) or r_digits.endswith(digits_from[-7:])):
                z_name = r.get("zone_name")
                if z_name:
                    z = db.query(Zone).filter(Zone.name == z_name).first()
                    if z:
                        matched_zone_id = z.id
                        matched_country = z.country
                break
        if not matched_zone_id:
            crit = db.query(Zone).filter(Zone.status == "critical").order_by(Zone.updated_at.desc()).first()
            if crit:
                matched_zone_id = crit.id
                matched_country = crit.country

    # Also log to ResidentReply table for unified display across all components
    reply_record = ResidentReply(
        phone_number=clean_from or "Unknown",
        zone_id=matched_zone_id,
        reply_text=clean_body,
        status=reply_status,
        timestamp=now
    )
    db.add(reply_record)
    db.commit()

    # Formulate two-way response guidance
    if reply_status == "SAFE":
        response_msg = (
            "✅ [AEGIS MISSION DESK] Status registered as SAFE. "
            "Stay indoors and continue monitoring local emergency advisories."
        )
    elif reply_status == "HELP":
        auth = LOCAL_EMERGENCY_ROUTING.get(matched_country, DEFAULT_EMERGENCY_ROUTING)
        response_msg = (
            f"🚨 [AEGIS RESCUE ROUTING ACTIVATED]\n"
            f"Direct assistance routed to: {auth['agency']}\n"
            f"Immediate Emergency Hotline: {auth['emergency_number']}\n"
            f"Instructions: {auth['guidance']}"
        )
    else:
        response_msg = (
            f"Received: '{clean_body}'. Please reply SAFE if you are uninjured, "
            f"or reply HELP for emergency rescue coordination."
        )

    # Return JSON for API/Test clients, or TwiML XML for Twilio Webhook
    if "application/json" in content_type:
        return {
            "success": True,
            "matched_dispatch_id": matched_dispatch.id if matched_dispatch else None,
            "recipient_number": clean_from,
            "reply_text": clean_body,
            "reply_status": reply_status,
            "zone_id": matched_zone_id,
            "response_message": response_msg,
            "timestamp": now.isoformat()
        }

    twiml_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{response_msg}</Message>
</Response>"""
    return Response(content=twiml_xml, media_type="application/xml")


# Backward compatibility with existing endpoint
@router.post("/webhooks/twilio/inbound")
def twilio_inbound_webhook(
    From: str = Form(...),
    Body: str = Form(...),
    db: Session = Depends(get_db)
):
    raw_from = From.strip()
    raw_body = Body.strip()
    clean_body = raw_body.upper()
    phone_clean = raw_from.replace("whatsapp:", "")

    residents = load_residents_file()
    matched_zone_id = None
    matched_country = "Global"
    for r in residents:
        r_phone = r.get("phone_number", "").replace("whatsapp:", "")
        if r_phone and (r_phone in phone_clean or phone_clean in r_phone):
            z_name = r.get("zone_name")
            if z_name:
                zone = db.query(Zone).filter(Zone.name == z_name).first()
                if zone:
                    matched_zone_id = zone.id
                    matched_country = zone.country
            break

    if not matched_zone_id:
        latest_critical = db.query(Zone).filter(Zone.status == "critical").order_by(Zone.updated_at.desc()).first()
        if latest_critical:
            matched_zone_id = latest_critical.id
            matched_country = latest_critical.country

    if "SAFE" in clean_body:
        status = "SAFE"
        response_msg = (
            f"✅ [AEGIS MISSION DESK] Status registered as SAFE. "
            f"Stay indoors and monitor local emergency advisories."
        )
    elif "HELP" in clean_body:
        status = "HELP"
        auth = LOCAL_EMERGENCY_ROUTING.get(matched_country, DEFAULT_EMERGENCY_ROUTING)
        response_msg = (
            f"🚨 [AEGIS RESCUE ROUTING ACTIVATED]\n"
            f"Direct assistance routed to: {auth['agency']}\n"
            f"Immediate Emergency Hotline: {auth['emergency_number']}\n"
            f"Instructions: {auth['guidance']}"
        )
    else:
        status = "UNKNOWN"
        response_msg = (
            f"Received: '{raw_body}'. Please reply SAFE if you are uninjured, "
            f"or reply HELP for emergency rescue coordination."
        )

    reply_record = ResidentReply(
        phone_number=phone_clean,
        zone_id=matched_zone_id,
        reply_text=raw_body,
        status=status,
        timestamp=datetime.utcnow()
    )
    db.add(reply_record)
    db.commit()

    twiml_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{response_msg}</Message>
</Response>"""
    return Response(content=twiml_xml, media_type="application/xml")


@router.get("/zones/{zone_id}/replies")
@router.get("/api/zones/{zone_id}/replies")
def get_zone_replies(zone_id: int, db: Session = Depends(get_db)):
    """
    Returns all two-way citizen replies for a zone.
    Combines ResidentReply records and any AlertDispatch replies for seamless live review.
    """
    replies = db.query(ResidentReply).filter(
        ResidentReply.zone_id == zone_id
    ).order_by(ResidentReply.timestamp.desc()).all()

    result = []
    seen_keys = set()

    for r in replies:
        key = (r.phone_number, r.reply_text, r.timestamp.strftime("%Y-%m-%d %H:%M:%S"))
        seen_keys.add(key)
        result.append({
            "id": r.id,
            "phone_number": r.phone_number,
            "zone_id": r.zone_id,
            "reply_text": r.reply_text,
            "status": r.status,
            "timestamp": r.timestamp.isoformat()
        })

    # Also include any AlertDispatch with replies not already listed
    dispatches = db.query(AlertDispatch).filter(
        AlertDispatch.zone_id == zone_id,
        AlertDispatch.reply_text != None
    ).order_by(AlertDispatch.replied_at.desc()).all()

    for d in dispatches:
        ts = d.replied_at or d.created_at
        ts_str = ts.strftime("%Y-%m-%d %H:%M:%S") if ts else ""
        key = (d.recipient_number, d.reply_text, ts_str)
        if key not in seen_keys:
            seen_keys.add(key)
            result.append({
                "id": 100000 + d.id,
                "phone_number": d.recipient_number,
                "zone_id": d.zone_id,
                "reply_text": d.reply_text,
                "status": d.reply_status or "UNKNOWN",
                "timestamp": ts.isoformat() if ts else datetime.utcnow().isoformat()
            })

    # Sort descending by timestamp
    result.sort(key=lambda x: x["timestamp"], reverse=True)
    return result


@router.get("/alerts/dispatches")
@router.get("/api/alerts/dispatches")
def get_alert_dispatches(zone_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Returns audit log of all alert dispatches with delivery status and citizen replies."""
    query = db.query(AlertDispatch)
    if zone_id:
        query = query.filter(AlertDispatch.zone_id == zone_id)
    dispatches = query.order_by(AlertDispatch.created_at.desc()).limit(100).all()
    return [
        {
            "id": d.id,
            "zone_id": d.zone_id,
            "recipient_number": d.recipient_number,
            "channel_used": d.channel_used,
            "twilio_sid": d.twilio_sid,
            "rationale": d.rationale,
            "message_body": d.message_body,
            "status": d.status,
            "reply_text": d.reply_text,
            "reply_status": d.reply_status,
            "replied_at": d.replied_at.isoformat() if d.replied_at else None,
            "created_at": d.created_at.isoformat() if d.created_at else None
        }
        for d in dispatches
    ]


@router.get("/api/zones/{zone_id}/residents")
def get_zone_residents(zone_id: int, db: Session = Depends(get_db)):
    """Returns all residents located inside the specified disaster zone."""
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
        
    matched = find_residents_in_zone(zone)
    return {
        "zone_id": zone.id,
        "zone_name": zone.name,
        "country": zone.country,
        "count": len(matched),
        "residents": matched
    }


@router.post("/api/notifications/dispatch")
def dispatch_manual_alert(payload: ManualAlertRequest, db: Session = Depends(get_db)):
    """Legacy manual dispatch endpoint preserved for backwards compatibility."""
    zone = db.query(Zone).filter(Zone.id == payload.zone_id).first()
    zone_label = zone.name if zone else f"Zone-{payload.zone_id}"

    res = send_alert(
        recipient_phone=payload.recipient_phone,
        zone_id=zone_label,
        confidence_score=payload.confidence_score or 0.95,
        status=payload.status or "CRITICAL",
        rationale=payload.rationale or "High-severity hazard confirmed by mission desk.",
        channel=payload.channel or "whatsapp",
        custom_from=payload.custom_from,
        custom_whatsapp_from=payload.custom_whatsapp_from
    )

    log_entry = NotificationLog(
        resident_name="Manual Dispatch",
        phone_number=payload.recipient_phone,
        zone_id=payload.zone_id,
        channel=res.get("channel", "whatsapp"),
        status="success" if res.get("success") else "failed",
        message_body=res.get("message_body"),
        error_message=res.get("error"),
        created_at=datetime.utcnow()
    )
    db.add(log_entry)
    db.commit()

    return res


@router.get("/api/notifications/logs")
def get_notification_logs(zone_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Returns audit log of all send attempts."""
    query = db.query(NotificationLog)
    if zone_id:
        query = query.filter(NotificationLog.zone_id == zone_id)
    logs = query.order_by(NotificationLog.created_at.desc()).limit(50).all()
    return [
        {
            "id": l.id,
            "resident_name": l.resident_name,
            "phone_number": l.phone_number,
            "zone_id": l.zone_id,
            "channel": l.channel,
            "status": l.status,
            "message_body": l.message_body,
            "error_message": l.error_message,
            "created_at": l.created_at.isoformat()
        }
        for l in logs
    ]
