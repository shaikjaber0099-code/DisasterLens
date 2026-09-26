from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Evidence, Zone, SituationSummary
from backend.app.schemas import EvidenceResponse, EvidenceReviewAction, SituationSummaryResponse, SummaryReviewAction
from backend.app.services.groq_client import rerank_review_queue_with_groq

router = APIRouter(prefix="/review", tags=["human_in_the_loop"])

@router.get("/queue")
def get_review_queue(db: Session = Depends(get_db)):
    """
    Returns prioritized review queue.
    Items are sorted by urgency (severity * confidence-gap) and re-ranked with Groq llama-3.1-8b-instant.
    """
    # Auto-approve any items with confidence > 90% (0.90); only keep others in manual approval
    high_conf_evidence = db.query(Evidence).filter(
        Evidence.status == "pending_review",
        Evidence.confidence > 0.90
    ).all()
    for ev in high_conf_evidence:
        ev.status = "approved"
        ev.reviewed_at = datetime.utcnow()
        ev.operator_notes = "Auto-approved: High confidence (>90%) safety threshold met."

    high_conf_summaries = db.query(SituationSummary).filter(
        SituationSummary.status == "pending",
        SituationSummary.confidence > 0.90
    ).all()
    for s in high_conf_summaries:
        s.status = "approved"
        s.approved_at = datetime.utcnow()

    if high_conf_evidence or high_conf_summaries:
        db.commit()

    # Manual approval queue: strictly only items with confidence <= 0.90
    pending_evidence = db.query(Evidence).filter(
        Evidence.status.in_(["pending_review", "needs_more_data"]),
        Evidence.confidence <= 0.90
    ).order_by(Evidence.created_at.desc()).all()

    queue_items = []
    for ev in pending_evidence:
        zone = db.query(Zone).filter(Zone.id == ev.zone_id).first()
        queue_items.append({
            "id": ev.id,
            "zone_id": ev.zone_id,
            "zone_name": zone.name if zone else "Unknown Zone",
            "country": zone.country if zone else "Global",
            "disaster_type": zone.disaster_type if zone else "Unknown",
            "type": ev.type,
            "payload": ev.payload,
            "confidence": ev.confidence,
            "model_used": ev.model_used,
            "status": ev.status,
            "created_at": ev.created_at.isoformat(),
            "operator_notes": ev.operator_notes,
            "severity": zone.current_severity if zone else 0.5,
            # Urgency score: high severity + high uncertainty (1 - confidence)
            "urgency_score": round((zone.current_severity if zone else 0.5) * (1.2 - ev.confidence), 3)
        })

    # Re-rank using Groq fast triage
    ranked_queue = rerank_review_queue_with_groq(queue_items)

    # Manual summaries queue: strictly only summaries with confidence <= 0.90
    pending_summaries = db.query(SituationSummary).filter(
        SituationSummary.status == "pending",
        SituationSummary.confidence <= 0.90
    ).order_by(SituationSummary.created_at.desc()).limit(10).all()

    summaries_out = []
    for s in pending_summaries:
        zone = db.query(Zone).filter(Zone.id == s.zone_id).first()
        summaries_out.append({
            "id": s.id,
            "zone_id": s.zone_id,
            "zone_name": zone.name if zone else "Unknown Zone",
            "summary_text": s.summary_text,
            "generated_by": s.generated_by,
            "confidence": s.confidence,
            "status": s.status,
            "created_at": s.created_at.isoformat()
        })

    return {
        "count": len(ranked_queue),
        "items": ranked_queue,
        "pending_summaries": summaries_out
    }

@router.post("/evidence/{evidence_id}", response_model=EvidenceResponse)
def review_evidence(
    evidence_id: int,
    action_in: EvidenceReviewAction,
    db: Session = Depends(get_db)
):
    """
    Operator action: approve, reject, or request_more_data.
    Audited human decision gate.
    """
    ev = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence item not found")

    action = action_in.action.lower()
    if action not in ["approve", "reject", "request_more_data"]:
        raise HTTPException(status_code=400, detail="Action must be 'approve', 'reject', or 'request_more_data'")

    if action == "approve":
        ev.status = "approved"
    elif action == "reject":
        ev.status = "rejected"
    elif action == "request_more_data":
        ev.status = "needs_more_data"

    ev.reviewed_at = datetime.utcnow()
    ev.operator_notes = action_in.notes
    db.commit()
    db.refresh(ev)

    # If approved and zone was in review_needed, verify if zone can be set to approved/monitoring
    zone = db.query(Zone).filter(Zone.id == ev.zone_id).first()
    if zone and action == "approve":
        # Check if there are other pending items
        pending_count = db.query(Evidence).filter(
            Evidence.zone_id == zone.id,
            Evidence.status == "pending_review"
        ).count()
        if pending_count == 0:
            zone.status = "approved"
            db.commit()

        # Trigger Twilio two-way alerting hook if zone is critical or threat >= 90%
        try:
            from backend.app.notifications import trigger_post_validation_alerts
            rationale_text = (ev.payload.get("rationale") if isinstance(ev.payload, dict) else "") or ev.operator_notes or "Critical evidence verified and approved by operator."
            if (zone.current_severity or 0) >= 0.75 or zone.status in ["critical", "approved"]:
                trigger_post_validation_alerts(
                    zone_id=zone.id,
                    validated_status="CRITICAL",
                    confidence_score=ev.confidence or zone.current_confidence or 0.85,
                    rationale=rationale_text[:250],
                    db=db
                )
        except Exception as hook_err:
            print(f"[Review Hook Error] {hook_err}")

    return ev

@router.post("/summary/{summary_id}", response_model=SituationSummaryResponse)
def review_summary(
    summary_id: int,
    action_in: SummaryReviewAction,
    db: Session = Depends(get_db)
):
    """Operator action on drafted situation summary."""
    summary = db.query(SituationSummary).filter(SituationSummary.id == summary_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    if action_in.action == "approve":
        summary.status = "approved"
        summary.approved_at = datetime.utcnow()
    elif action_in.action == "reject":
        summary.status = "rejected"
    elif action_in.action == "edit" and action_in.edited_text:
        summary.summary_text = action_in.edited_text
        summary.status = "approved"
        summary.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(summary)
    return summary
