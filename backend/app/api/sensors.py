from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import SensorReading, Zone
from backend.app.schemas import SensorReadingResponse
from backend.app.sensor_simulator import run_sensor_tick

router = APIRouter(prefix="/sensors", tags=["sensors"])

@router.get("/{zone_id}", response_model=List[SensorReadingResponse])
def get_sensor_readings(
    zone_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    readings = db.query(SensorReading).filter(
        SensorReading.zone_id == zone_id
    ).order_by(SensorReading.recorded_at.desc()).limit(limit).all()
    # Return chronological order for charts
    return sorted(readings, key=lambda x: x.recorded_at)

@router.post("/tick")
def trigger_sensor_tick(db: Session = Depends(get_db)):
    """Simulates instant IoT sensor reading update across all zones."""
    run_sensor_tick(db)
    return {"status": "ok", "message": "Sensor readings updated across all monitored zones."}
