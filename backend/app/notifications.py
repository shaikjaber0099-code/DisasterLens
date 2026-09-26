import os
import json
import math
from datetime import datetime
from typing import Dict, Any, List, Optional, Union
from pathlib import Path

from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from sqlalchemy.orm import Session

from backend.app.config import settings, BASE_DIR
from backend.app.models import Zone, NotificationLog, ResidentReply, AlertDispatch

# Emergency rescue services mapping by country for 2-way "HELP" routing
LOCAL_EMERGENCY_ROUTING = {
    "Spain": {
        "agency": "Emergencias 112 Comunitat Valenciana",
        "emergency_number": "112",
        "guidance": "Flash flood warning: Move immediately to upper floors or high ground. Do not enter moving water or drive through underpasses."
    },
    "United States": {
        "agency": "CAL FIRE / Butte County Sheriff & 911 Emergency Dispatch",
        "emergency_number": "911",
        "guidance": "Wildfire red-flag alert: Evacuate along designated arterial routes. Close windows, shut gas lines, and stay in contact with dispatch."
    },
    "Canada": {
        "agency": "Parks Canada Fire Management & Alberta RCMP Emergency",
        "emergency_number": "911",
        "guidance": "Crown wildfire hazard: Muster at Highway 16 west staging corridor. Keep emergency radio on 101.1 FM."
    },
    "Brazil": {
        "agency": "Corpo de Bombeiros Militar do Pantanal & Defesa Civil 193",
        "emergency_number": "193",
        "guidance": "Alerta de incêndio florestal: Desloque-se contra a direção do vento em direção a zonas úmidas e aguarde a brigada."
    },
    "Greece": {
        "agency": "General Secretariat for Civil Protection & 112 Emergency",
        "emergency_number": "112",
        "guidance": "Severe river inundation: Evacuate low-lying agricultural plains towards designated elevated shelters."
    },
    "India": {
        "agency": "Kerala State Disaster Management Authority (KSDMA) & NDRF",
        "emergency_number": "112 / 108",
        "guidance": "Monsoon landslide / river surge alert: Vacate steep slope hamlets immediately. Proceed to local panchayat relief camps."
    },
    "Australia": {
        "agency": "Department of Fire and Emergency Services (DFES) WA",
        "emergency_number": "000",
        "guidance": "Bushfire emergency: Act immediately for your survival. If path is clear, leave now to community safe refuge."
    }
}

DEFAULT_EMERGENCY_ROUTING = {
    "agency": "International Civil Protection Emergency Rescue",
    "emergency_number": "112",
    "guidance": "Disaster threat detected. Seek elevated shelter and await local first responder extraction."
}

def get_twilio_from_numbers() -> tuple[str, str]:
    """Reads TWILIO_SMS_FROM_NUMBER and TWILIO_WHATSAPP_FROM_NUMBER from environment."""
    sms_from = (
        os.getenv("TWILIO_SMS_FROM_NUMBER") or 
        os.getenv("TWILIO_FROM_NUMBER") or 
        settings.TWILIO_SMS_FROM_NUMBER or 
        settings.TWILIO_FROM_NUMBER or 
        ""
    ).strip()
    
    wa_from = (
        os.getenv("TWILIO_WHATSAPP_FROM_NUMBER") or 
        os.getenv("TWILIO_WHATSAPP_FROM") or 
        settings.TWILIO_WHATSAPP_FROM_NUMBER or 
        settings.TWILIO_WHATSAPP_FROM or 
        "whatsapp:+14155238886"
    ).strip()
    
    if wa_from and not wa_from.startswith("whatsapp:"):
        wa_from = f"whatsapp:{wa_from}"
        
    return sms_from, wa_from

def get_twilio_client() -> Optional[Client]:
    """
    Initializes Twilio client using environment variables.
    Returns None if credentials are unset or placeholder.
    """
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", settings.TWILIO_ACCOUNT_SID)
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", settings.TWILIO_AUTH_TOKEN)
    
    if not account_sid or not auth_token or account_sid.startswith("ACxxx") or auth_token == "your_auth_token_here":
        return None
    try:
        return Client(account_sid, auth_token)
    except Exception as e:
        print(f"[Twilio Init Warning] Could not instantiate client: {e}")
        return None

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two coordinates in kilometers."""
    R = 6371.0 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def point_in_polygon(lon: float, lat: float, polygon_coords: List[List[float]]) -> bool:
    """Ray casting algorithm to determine if a point is inside a polygon."""
    inside = False
    n = len(polygon_coords)
    if n < 3:
        return False
    p1x, p1y = polygon_coords[0][0], polygon_coords[0][1]
    for i in range(1, n + 1):
        p2x, p2y = polygon_coords[i % n][0], polygon_coords[i % n][1]
        if lat > min(p1y, p2y):
            if lat <= max(p1y, p2y):
                if lon <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (lat - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or lon <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def load_residents_file() -> List[Dict[str, Any]]:
    """Loads the mock residents data file."""
    residents_path = BASE_DIR / "backend" / "app" / "data" / "residents.json"
    if not residents_path.exists():
        return []
    try:
        with open(residents_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[Notifications] Error loading residents file: {e}")
        return []

def find_residents_in_zone(zone_polygon_or_radius: Union[Zone, Dict[str, Any]], residents_list: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    """
    Finds residents located within a disaster zone using either:
    1. GeoJSON polygon if available
    2. Centroid coordinates (lat, lon) and radius_km
    """
    if residents_list is None:
        residents_list = load_residents_file()
        
    matched = []
    
    # Extract geometry properties
    if isinstance(zone_polygon_or_radius, Zone):
        z_lat = zone_polygon_or_radius.lat
        z_lon = zone_polygon_or_radius.lon
        z_radius = zone_polygon_or_radius.radius_km or 25.0
        z_geojson = zone_polygon_or_radius.geom_geojson
    elif isinstance(zone_polygon_or_radius, dict):
        z_lat = zone_polygon_or_radius.get("lat", 0.0)
        z_lon = zone_polygon_or_radius.get("lon", 0.0)
        z_radius = zone_polygon_or_radius.get("radius_km", 25.0)
        z_geojson = zone_polygon_or_radius.get("geom_geojson")
    else:
        return []

    polygon_ring = None
    if z_geojson and isinstance(z_geojson, dict):
        coords = z_geojson.get("coordinates")
        if coords and len(coords) > 0:
            polygon_ring = coords[0] # outer linear ring [[lon, lat], ...]

    for r in residents_list:
        r_lat = r.get("latitude")
        r_lon = r.get("longitude")
        if r_lat is None or r_lon is None:
            continue
            
        is_inside = False
        # Try polygon first if available
        if polygon_ring:
            is_inside = point_in_polygon(r_lon, r_lat, polygon_ring)
        
        # Fallback to radius check
        if not is_inside:
            dist = haversine_distance_km(z_lat, z_lon, r_lat, r_lon)
            if dist <= z_radius:
                is_inside = True
                
        if is_inside:
            matched.append(r)
            
    return matched

def send_alert(
    recipient_phone: str,
    zone_id: str,
    confidence_score: float,
    status: str,
    rationale: str,
    channel: str = "whatsapp",
    custom_from: Optional[str] = None,
    custom_whatsapp_from: Optional[str] = None
) -> Dict[str, Any]:
    """
    Formats and sends an emergency alert via Twilio.
    Includes fallback: tries WhatsApp first; if the Twilio API call fails,
    automatically retries via plain SMS to the same number.
    """
    # Clean phone numbers
    recipient_clean = recipient_phone.strip()
    conf_pct = int(confidence_score * 100) if confidence_score <= 1.0 else int(confidence_score)
    
    # Clean rationale text
    clean_rationale = rationale.strip() if rationale else "Severe environmental anomaly detected."
    if len(clean_rationale) > 280:
        clean_rationale = clean_rationale[:277] + "..."

    message_body = (
        f"🚨 [AEGIS DISASTER ALERT]\n"
        f"Zone: {zone_id} | Status: {status.upper()} (Confidence: {conf_pct}%)\n"
        f"Evidence: {clean_rationale}\n\n"
        f"👉 Reply SAFE if you are secure.\n"
        f"👉 Reply HELP to connect with local rescue authorities."
    )

    client = get_twilio_client()
    default_from = custom_from or os.getenv("TWILIO_FROM_NUMBER", settings.TWILIO_FROM_NUMBER)
    default_wa_from = custom_whatsapp_from or os.getenv("TWILIO_WHATSAPP_FROM", settings.TWILIO_WHATSAPP_FROM)

    # If no live Twilio credentials, record simulated dispatch for auditing
    if not client:
        return {
            "success": True,
            "simulated": True,
            "channel": channel,
            "recipient": recipient_clean,
            "message_body": message_body,
            "sid": f"SM_simulated_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "note": "Alert logged via simulation pipeline (provide real Twilio SID/Auth Token for live cellular dispatch)"
        }

    # Attempt WhatsApp first if requested
    if channel.lower() == "whatsapp":
        wa_recipient = f"whatsapp:{recipient_clean}" if not recipient_clean.startswith("whatsapp:") else recipient_clean
        wa_from = default_wa_from if default_wa_from.startswith("whatsapp:") else f"whatsapp:{default_wa_from}"
        try:
            msg = client.messages.create(
                body=message_body,
                from_=wa_from,
                to=wa_recipient
            )
            return {
                "success": True,
                "simulated": False,
                "channel": "whatsapp",
                "recipient": wa_recipient,
                "sid": msg.sid,
                "status": msg.status,
                "message_body": message_body
            }
        except TwilioRestException as we:
            print(f"[Twilio Warning] WhatsApp dispatch failed ({we.msg}). Retrying via SMS fallback...")
            # Fallback to SMS
            try:
                sms_recipient = recipient_clean.replace("whatsapp:", "")
                msg = client.messages.create(
                    body=message_body,
                    from_=default_from,
                    to=sms_recipient
                )
                return {
                    "success": True,
                    "simulated": False,
                    "channel": "sms_fallback",
                    "recipient": sms_recipient,
                    "sid": msg.sid,
                    "status": msg.status,
                    "message_body": message_body,
                    "whatsapp_error": str(we.msg)
                }
            except Exception as se:
                return {
                    "success": False,
                    "simulated": False,
                    "channel": "failed_all",
                    "recipient": recipient_clean,
                    "error": f"WhatsApp failed: {we.msg}; SMS fallback failed: {str(se)}",
                    "message_body": message_body
                }
    else:
        # Standard SMS
        try:
            sms_recipient = recipient_clean.replace("whatsapp:", "")
            msg = client.messages.create(
                body=message_body,
                from_=default_from,
                to=sms_recipient
            )
            return {
                "success": True,
                "simulated": False,
                "channel": "sms",
                "recipient": sms_recipient,
                "sid": msg.sid,
                "status": msg.status,
                "message_body": message_body
            }
        except Exception as e:
            return {
                "success": False,
                "simulated": False,
                "channel": "sms",
                "recipient": recipient_clean,
                "error": str(e),
                "message_body": message_body
            }

def trigger_post_validation_alerts(
    zone_id: int,
    validated_status: str,
    confidence_score: float,
    rationale: str,
    db: Session,
    override_recipient: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Hook called AFTER validation/fusion returns its result.
    - Only triggers if validated_status is CRITICAL (or >= 90% threat auto-approved)
    - Finds residents in the affected zone
    - Dispatches alerts and logs every send attempt to NotificationLog table
    """
    status_normalized = (validated_status or "").strip().upper()
    if status_normalized not in ["CRITICAL", "APPROVED"]:
        return []

    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    zone_label = zone.name if zone else f"Zone-{zone_id}"
    
    results = []
    
    # 1. If override recipient was provided directly
    if override_recipient:
        res = send_alert(
            recipient_phone=override_recipient,
            zone_id=zone_label,
            confidence_score=confidence_score,
            status=status_normalized,
            rationale=rationale,
            channel="whatsapp"
        )
        # Log to DB
        log_entry = NotificationLog(
            resident_name="Manual Dispatch",
            phone_number=override_recipient,
            zone_id=zone_id,
            channel=res.get("channel", "whatsapp"),
            status="success" if res.get("success") else "failed",
            message_body=res.get("message_body"),
            error_message=res.get("error"),
            created_at=datetime.utcnow()
        )
        db.add(log_entry)
        db.commit()
        results.append(res)
        return results

    # 2. Automated Zone Residents Matching
    if zone:
        residents = find_residents_in_zone(zone)
        for r in residents:
            phone = r.get("phone_number")
            if not phone:
                continue
            res = send_alert(
                recipient_phone=phone,
                zone_id=zone_label,
                confidence_score=confidence_score,
                status=status_normalized,
                rationale=rationale,
                channel="whatsapp"
            )
            
            log_entry = NotificationLog(
                resident_name=r.get("name", "Zone Resident"),
                phone_number=phone,
                zone_id=zone_id,
                channel=res.get("channel", "whatsapp"),
                status="success" if res.get("success") else "failed",
                message_body=res.get("message_body"),
                error_message=res.get("error"),
                created_at=datetime.utcnow()
            )
            db.add(log_entry)
            results.append(res)
            
        db.commit()
        
    return results


def dispatch_emergency_alert(
    recipient_number: str,
    channel: str,
    zone_id: int,
    rationale: str,
    db: Session
) -> Dict[str, Any]:
    """
    POST /api/alerts/dispatch backend logic:
    - Look up TWILIO_SMS_FROM_NUMBER / TWILIO_WHATSAPP_FROM_NUMBER from env.
    - If channel == 'whatsapp': attempt Twilio WhatsApp send from the env
      WhatsApp sender to `whatsapp:{recipient_number}`.
    - On WhatsApp failure (undelivered/error webhook or immediate API error),
      automatically retry as plain SMS from TWILIO_SMS_FROM_NUMBER.
    - Append standard two-way instruction footer:
      'Reply SAFE if you are secure, or reply HELP for local rescue routing.'
    - Log the dispatch (channel used, Twilio SID, timestamp, zone_id, recipient)
      to an alert_dispatches table.
    - If credentials are unset/invalid, run in simulation mode:
      generate a fake SID like SM_simulated_{timestamp} and log it.
    """
    clean_recipient = recipient_number.strip().replace("whatsapp:", "").strip()
    sms_from, wa_from = get_twilio_from_numbers()
    now = datetime.utcnow()

    # Append standard two-way instruction footer
    footer = "Reply SAFE if you are secure, or reply HELP for local rescue routing."
    clean_rationale = rationale.strip() if rationale else "Severe environmental anomaly detected."
    if footer.lower() not in clean_rationale.lower():
        message_body = f"{clean_rationale}\n\n{footer}"
    else:
        message_body = clean_rationale

    client = get_twilio_client()

    # 1. Simulation mode if live Twilio credentials are missing or invalid
    if not client:
        simulated_sid = f"SM_simulated_{now.strftime('%Y%m%d%H%M%S')}"
        dispatch_record = AlertDispatch(
            zone_id=zone_id,
            recipient_number=clean_recipient,
            channel_used=channel,
            twilio_sid=simulated_sid,
            rationale=clean_rationale,
            message_body=message_body,
            status="simulated",
            created_at=now
        )
        db.add(dispatch_record)
        db.commit()
        db.refresh(dispatch_record)
        return {
            "success": True,
            "simulated": True,
            "id": dispatch_record.id,
            "channel": channel,
            "recipient": clean_recipient,
            "sid": simulated_sid,
            "status": "simulated",
            "message_body": message_body,
            "note": "Alert logged via simulation pipeline (Twilio credentials not configured; simulated SID generated)"
        }

    # 2. Live dispatch mode
    if channel.lower() == "whatsapp":
        wa_recipient = f"whatsapp:{clean_recipient}"
        try:
            msg = client.messages.create(
                body=message_body,
                from_=wa_from,
                to=wa_recipient
            )
            dispatch_record = AlertDispatch(
                zone_id=zone_id,
                recipient_number=clean_recipient,
                channel_used="whatsapp",
                twilio_sid=msg.sid,
                rationale=clean_rationale,
                message_body=message_body,
                status=msg.status or "sent",
                created_at=now
            )
            db.add(dispatch_record)
            db.commit()
            db.refresh(dispatch_record)
            return {
                "success": True,
                "simulated": False,
                "id": dispatch_record.id,
                "channel": "whatsapp",
                "recipient": wa_recipient,
                "sid": msg.sid,
                "status": msg.status,
                "message_body": message_body
            }
        except Exception as we:
            print(f"[Twilio Alert] WhatsApp delivery error: {we}. Triggering automatic retry via plain SMS from {sms_from}...")
            # Automatic retry as plain SMS from TWILIO_SMS_FROM_NUMBER
            try:
                sms_msg = client.messages.create(
                    body=message_body,
                    from_=sms_from,
                    to=clean_recipient
                )
                dispatch_record = AlertDispatch(
                    zone_id=zone_id,
                    recipient_number=clean_recipient,
                    channel_used="sms_fallback",
                    twilio_sid=sms_msg.sid,
                    rationale=clean_rationale,
                    message_body=message_body,
                    status=sms_msg.status or "sent",
                    created_at=now
                )
                db.add(dispatch_record)
                db.commit()
                db.refresh(dispatch_record)
                return {
                    "success": True,
                    "simulated": False,
                    "id": dispatch_record.id,
                    "channel": "sms_fallback",
                    "recipient": clean_recipient,
                    "sid": sms_msg.sid,
                    "status": sms_msg.status,
                    "message_body": message_body,
                    "whatsapp_error": str(we)
                }
            except Exception as se:
                print(f"[Twilio Alert] SMS fallback also failed: {se}")
                # Log dispatch record as failed
                dispatch_record = AlertDispatch(
                    zone_id=zone_id,
                    recipient_number=clean_recipient,
                    channel_used="failed",
                    twilio_sid=None,
                    rationale=clean_rationale,
                    message_body=message_body,
                    status="failed",
                    created_at=now
                )
                db.add(dispatch_record)
                db.commit()
                db.refresh(dispatch_record)
                return {
                    "success": False,
                    "simulated": False,
                    "id": dispatch_record.id,
                    "channel": "failed",
                    "recipient": clean_recipient,
                    "error": f"WhatsApp failed: {str(we)}; SMS fallback failed: {str(se)}",
                    "message_body": message_body
                }
    else:
        # Standard SMS
        try:
            sms_msg = client.messages.create(
                body=message_body,
                from_=sms_from,
                to=clean_recipient
            )
            dispatch_record = AlertDispatch(
                zone_id=zone_id,
                recipient_number=clean_recipient,
                channel_used="sms",
                twilio_sid=sms_msg.sid,
                rationale=clean_rationale,
                message_body=message_body,
                status=sms_msg.status or "sent",
                created_at=now
            )
            db.add(dispatch_record)
            db.commit()
            db.refresh(dispatch_record)
            return {
                "success": True,
                "simulated": False,
                "id": dispatch_record.id,
                "channel": "sms",
                "recipient": clean_recipient,
                "sid": sms_msg.sid,
                "status": sms_msg.status,
                "message_body": message_body
            }
        except Exception as se:
            print(f"[Twilio Alert] SMS send error: {se}")
            dispatch_record = AlertDispatch(
                zone_id=zone_id,
                recipient_number=clean_recipient,
                channel_used="sms",
                twilio_sid=None,
                rationale=clean_rationale,
                message_body=message_body,
                status="failed",
                created_at=now
            )
            db.add(dispatch_record)
            db.commit()
            db.refresh(dispatch_record)
            return {
                "success": False,
                "simulated": False,
                "id": dispatch_record.id,
                "channel": "sms",
                "recipient": clean_recipient,
                "error": str(se),
                "message_body": message_body
            }

