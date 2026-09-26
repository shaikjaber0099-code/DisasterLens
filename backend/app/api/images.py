import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from backend.app.config import UPLOAD_DIR
from backend.app.database import get_db, haversine_distance_km
from backend.app.models import Evidence, Zone
from backend.app.schemas import ImageAnalysisResult
from backend.app.analyze_image import analyze_disaster_image

router = APIRouter(prefix="/analyze-image", tags=["vision"])

@router.post("", response_model=ImageAnalysisResult)
@router.post("/", response_model=ImageAnalysisResult)
async def analyze_image_endpoint(
    file: UploadFile = File(...),
    zone_id: Optional[int] = Form(None),
    lat: Optional[float] = Form(None),
    lon: Optional[float] = Form(None),
    db: Session = Depends(get_db)
):
    # Read file content
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    # Save to uploads folder
    file_ext = Path(file.filename or "image.jpg").suffix or ".jpg"
    filename = f"disaster_{uuid.uuid4().hex[:12]}{file_ext}"
    filepath = UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        f.write(contents)

    image_url = f"/uploads/{filename}"
    mime_type = file.content_type or "image/jpeg"

    # Analyze with multimodal pipeline
    analysis = analyze_disaster_image(contents, mime_type)

    # Determine assigned zone
    assigned_zone = None
    if zone_id is not None:
        assigned_zone = db.query(Zone).filter(Zone.id == zone_id).first()
    elif lat is not None and lon is not None:
        # Nearest zone
        zones = db.query(Zone).all()
        min_dist = float('inf')
        for z in zones:
            d = haversine_distance_km(lat, lon, z.lat, z.lon)
            if d < min_dist:
                min_dist = d
                assigned_zone = z
    else:
        # Default to first active zone if any
        assigned_zone = db.query(Zone).first()

    evidence_id = None
    if assigned_zone:
        # Auto-approve if confidence > 90% (0.90), keep for manual approval otherwise
        is_auto_approved = (analysis.get("confidence_0_to_1") or 0) > 0.90
        evidence = Evidence(
            zone_id=assigned_zone.id,
            type="image",
            payload={
                "image_url": image_url,
                "condition": analysis["condition"],
                "severity_score": analysis["severity_0_to_1"],
                "detected_features": analysis["detected_features"],
                "rationale": analysis["rationale"],
                "model_used": analysis["model_used"]
            },
            confidence=analysis["confidence_0_to_1"],
            model_used=analysis["model_used"],
            status="approved" if is_auto_approved else "pending_review",
            reviewed_at=datetime.utcnow() if is_auto_approved else None,
            operator_notes="Auto-approved: High confidence (>90%)" if is_auto_approved else None
        )
        db.add(evidence)
        db.commit()
        db.refresh(evidence)
        evidence_id = evidence.id

        # Trigger fusion recalculation
        try:
            from backend.app.fusion import run_fusion_for_zone
            run_fusion_for_zone(assigned_zone.id, db)
        except Exception as e:
            print(f"Fusion trigger error: {e}")

    return ImageAnalysisResult(
        condition=analysis["condition"],
        severity_0_to_1=analysis["severity_0_to_1"],
        confidence_0_to_1=analysis["confidence_0_to_1"],
        rationale=analysis["rationale"],
        detected_features=analysis.get("detected_features", []),
        model_used=analysis["model_used"],
        zone_id=assigned_zone.id if assigned_zone else None,
        evidence_id=evidence_id,
        image_url=image_url
    )
