from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Zone, WeatherSnapshot, SensorReading, SituationSummary, Evidence
from backend.app.schemas import ZoneResponse, ZoneDetailResponse, FirmsHotspot
from backend.app.services.firms_client import fetch_firms_hotspots
from backend.app.fusion import run_fusion_for_zone

router = APIRouter(prefix="/zones", tags=["zones"])

@router.get("", response_model=List[ZoneResponse])
@router.get("/", response_model=List[ZoneResponse])
def get_zones(
    disaster_type: Optional[str] = None,
    country: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Zone)
    if disaster_type:
        query = query.filter(Zone.disaster_type == disaster_type)
    if country:
        query = query.filter(Zone.country == country)
    if status:
        query = query.filter(Zone.status == status)
    return query.order_by(Zone.current_severity.desc()).all()

@router.get("/firms-hotspots", response_model=List[FirmsHotspot])
def get_firms_hotspots(country: Optional[str] = "USA"):
    """Returns NASA FIRMS wildfire thermal anomaly hotspots worldwide."""
    return fetch_firms_hotspots(country_code=country or "USA")

@router.get("/{zone_id}", response_model=ZoneDetailResponse)
def get_zone_detail(zone_id: int, db: Session = Depends(get_db)):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    latest_weather = db.query(WeatherSnapshot).filter(
        WeatherSnapshot.zone_id == zone_id
    ).order_by(WeatherSnapshot.recorded_at.desc()).first()

    recent_sensors = db.query(SensorReading).filter(
        SensorReading.zone_id == zone_id
    ).order_by(SensorReading.recorded_at.desc()).limit(15).all()

    active_summary = db.query(SituationSummary).filter(
        SituationSummary.zone_id == zone_id
    ).order_by(SituationSummary.created_at.desc()).first()

    evidences = db.query(Evidence).filter(
        Evidence.zone_id == zone_id
    ).order_by(Evidence.created_at.desc()).limit(20).all()

    return ZoneDetailResponse(
        id=zone.id,
        name=zone.name,
        disaster_type=zone.disaster_type,
        current_severity=zone.current_severity,
        current_confidence=zone.current_confidence,
        status=zone.status,
        lat=zone.lat,
        lon=zone.lon,
        radius_km=zone.radius_km,
        country=zone.country,
        region=zone.region,
        geom_geojson=zone.geom_geojson,
        updated_at=zone.updated_at,
        incidents=zone.incidents,
        evidence_items=evidences,
        latest_weather=latest_weather,
        recent_sensors=recent_sensors,
        active_summary=active_summary
    )

@router.post("/{zone_id}/trigger-fusion", response_model=ZoneResponse)
def trigger_fusion(zone_id: int, db: Session = Depends(get_db)):
    """Manually triggers deterministic multi-modal fusion and summary re-draft for a zone."""
    zone = run_fusion_for_zone(zone_id, db)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    return zone
