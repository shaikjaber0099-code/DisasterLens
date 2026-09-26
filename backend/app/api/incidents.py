from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db, haversine_distance_km
from backend.app.models import Incident, Zone, Evidence
from backend.app.schemas import IncidentCreate, IncidentResponse

router = APIRouter(prefix="/incidents", tags=["incidents"])

@router.get("", response_model=List[IncidentResponse])
@router.get("/", response_model=List[IncidentResponse])
def get_incidents(
    zone_id: Optional[int] = Query(None, description="Filter by zone ID"),
    disaster_type: Optional[str] = Query(None, description="Filter by disaster type"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Incident)
    if zone_id is not None:
        query = query.filter(Incident.zone_id == zone_id)
    if disaster_type:
        query = query.filter(Incident.disaster_type == disaster_type)
    return query.order_by(Incident.reported_at.desc()).limit(limit).all()

@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@router.post("", response_model=IncidentResponse, status_code=201)
@router.post("/", response_model=IncidentResponse, status_code=201)
def create_incident(incident_in: IncidentCreate, db: Session = Depends(get_db)):
    # 1. Spatial lookup: Find nearest zone within its radius, or default to nearest
    zones = db.query(Zone).all()
    assigned_zone = None
    min_dist = float('inf')

    for zone in zones:
        dist = haversine_distance_km(incident_in.lat, incident_in.lon, zone.lat, zone.lon)
        if dist <= zone.radius_km and dist < min_dist:
            min_dist = dist
            assigned_zone = zone

    # If no zone is within radius, check if there's any close zone within 100km or create a new dynamic zone
    if not assigned_zone:
        for zone in zones:
            dist = haversine_distance_km(incident_in.lat, incident_in.lon, zone.lat, zone.lon)
            if dist < min_dist:
                min_dist = dist
                assigned_zone = zone

        if min_dist > 150.0:
            # Create a new dynamic zone at this global location
            zone_name = f"Zone-{incident_in.disaster_type.capitalize()} ({incident_in.lat:.2f}, {incident_in.lon:.2f})"
            # Generate bounding polygon
            delta = 0.15 # approx 16km
            poly = {
                "type": "Polygon",
                "coordinates": [[
                    [incident_in.lon - delta, incident_in.lat - delta],
                    [incident_in.lon + delta, incident_in.lat - delta],
                    [incident_in.lon + delta, incident_in.lat + delta],
                    [incident_in.lon - delta, incident_in.lat + delta],
                    [incident_in.lon - delta, incident_in.lat - delta]
                ]]
            }
            assigned_zone = Zone(
                name=zone_name,
                disaster_type=incident_in.disaster_type,
                lat=incident_in.lat,
                lon=incident_in.lon,
                radius_km=25.0,
                country="Dynamic Incident Zone",
                region="Reported Area",
                status="review_needed",
                current_severity=incident_in.severity / 5.0,
                current_confidence=0.6,
                geom_geojson=poly
            )
            db.add(assigned_zone)
            db.commit()
            db.refresh(assigned_zone)

    # 2. Create incident record
    incident = Incident(
        zone_id=assigned_zone.id if assigned_zone else None,
        lat=incident_in.lat,
        lon=incident_in.lon,
        disaster_type=incident_in.disaster_type,
        severity=incident_in.severity,
        description=incident_in.description,
        image_url=incident_in.image_url,
        reported_at=incident_in.reported_at or datetime.utcnow(),
        source=incident_in.source or "citizen_report",
        status="active"
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    # 3. Create Evidence entry linked to the zone
    if assigned_zone:
        evidence_item = Evidence(
            zone_id=assigned_zone.id,
            type="report",
            payload={
                "incident_id": incident.id,
                "lat": incident.lat,
                "lon": incident.lon,
                "severity_reported": incident.severity,
                "description": incident.description,
                "image_url": incident.image_url,
                "source": incident.source,
                "reported_at": incident.reported_at.isoformat()
            },
            confidence=0.70, # User reported initial confidence
            model_used="citizen_entry_validation",
            status="pending_review"
        )
        db.add(evidence_item)
        db.commit()

        # 4. Trigger fusion engine update for this zone
        try:
            from backend.app.fusion import run_fusion_for_zone
            run_fusion_for_zone(assigned_zone.id, db)
        except Exception as e:
            print(f"Fusion trigger error: {e}")

    return incident
