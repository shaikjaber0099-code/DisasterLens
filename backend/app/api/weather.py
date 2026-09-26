from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import WeatherSnapshot, Zone
from backend.app.schemas import WeatherSnapshotResponse
from backend.app.weather_poller import poll_weather_for_zone, run_weather_poll_all

router = APIRouter(prefix="/weather", tags=["weather"])

@router.get("/{zone_id}", response_model=List[WeatherSnapshotResponse])
def get_weather_history(
    zone_id: int,
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db)
):
    snapshots = db.query(WeatherSnapshot).filter(
        WeatherSnapshot.zone_id == zone_id
    ).order_by(WeatherSnapshot.recorded_at.desc()).limit(limit).all()
    return sorted(snapshots, key=lambda x: x.recorded_at)

@router.post("/poll")
def trigger_weather_poll(zone_id: int = Query(None), db: Session = Depends(get_db)):
    """Fetches real-time worldwide weather for one or all zones."""
    if zone_id:
        zone = db.query(Zone).filter(Zone.id == zone_id).first()
        if not zone:
            raise HTTPException(status_code=404, detail="Zone not found")
        poll_weather_for_zone(zone, db, backfill_hours=0)
        return {"status": "ok", "message": f"Polled live global weather for zone {zone.name}."}
    else:
        run_weather_poll_all(db)
        return {"status": "ok", "message": "Polled live global weather across all active zones."}
