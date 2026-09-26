import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from backend.app.models import Zone, SensorReading, Evidence

def generate_sensor_readings_for_zone(zone: Zone, db: Session, backfill_hours: int = 0):
    """
    Generates realistic IoT sensor telemetry for a given zone based on its disaster type.
    If backfill_hours > 0, generates historical readings for sparkline charts.
    """
    now = datetime.utcnow()
    timestamps = [now]
    if backfill_hours > 0:
        # Generate 1 reading every 2 hours over the last 24h
        timestamps = [now - timedelta(hours=h) for h in range(backfill_hours, -1, -2)]

    for ts in timestamps:
        if zone.disaster_type in ["flood", "severe_storm"]:
            # Flood sensors: water level (m), soil moisture (%), flow rate (m/s)
            base_water = 1.2 + (zone.current_severity * 3.5) # e.g. 1.5m to 4.7m
            water_val = round(max(0.2, base_water + random.uniform(-0.25, 0.25)), 2)
            soil_val = round(min(100.0, 75.0 + (zone.current_severity * 22.0) + random.uniform(-3, 3)), 1)
            flow_val = round(1.5 + (zone.current_severity * 4.0) + random.uniform(-0.5, 0.5), 2)

            r1 = SensorReading(zone_id=zone.id, sensor_type="water_level", value=water_val, unit="m", recorded_at=ts)
            r2 = SensorReading(zone_id=zone.id, sensor_type="soil_moisture", value=soil_val, unit="%", recorded_at=ts)
            r3 = SensorReading(zone_id=zone.id, sensor_type="flow_rate", value=flow_val, unit="m/s", recorded_at=ts)
            db.add_all([r1, r2, r3])

            # If recent and critical threshold exceeded, create sensor evidence row
            if ts == now and water_val > 2.8:
                evidence = Evidence(
                    zone_id=zone.id,
                    type="sensor",
                    payload={
                        "sensor_type": "water_level",
                        "value": water_val,
                        "unit": "m",
                        "threshold_critical": 2.8,
                        "status": "critical_flood_crest",
                        "details": f"Ultrasonic water level gauge recorded flood crest of {water_val}m exceeding stage 3 danger limit."
                    },
                    confidence=0.92,
                    model_used="iot_gauge_telemetry",
                    status="pending_review"
                )
                db.add(evidence)

        elif zone.disaster_type in ["wildfire", "smoke"]:
            # Wildfire sensors: smoke density (ppm), PM2.5 (ug/m3), ambient thermal sensor (C)
            base_smoke = 20.0 + (zone.current_severity * 180.0) # ppm
            smoke_val = round(max(5.0, base_smoke + random.uniform(-10, 10)), 1)
            base_pm25 = 35.0 + (zone.current_severity * 280.0) # ug/m3
            pm25_val = round(max(10.0, base_pm25 + random.uniform(-15, 15)), 1)
            ir_val = round(32.0 + (zone.current_severity * 25.0) + random.uniform(-2, 2), 1)

            r1 = SensorReading(zone_id=zone.id, sensor_type="smoke_density", value=smoke_val, unit="ppm", recorded_at=ts)
            r2 = SensorReading(zone_id=zone.id, sensor_type="air_quality_pm25", value=pm25_val, unit="ug/m3", recorded_at=ts)
            r3 = SensorReading(zone_id=zone.id, sensor_type="thermal_sensor", value=ir_val, unit="C", recorded_at=ts)
            db.add_all([r1, r2, r3])

            if ts == now and (smoke_val > 120.0 or pm25_val > 200.0):
                evidence = Evidence(
                    zone_id=zone.id,
                    type="sensor",
                    payload={
                        "sensor_type": "air_quality_pm25",
                        "value": pm25_val,
                        "unit": "ug/m3",
                        "smoke_density_ppm": smoke_val,
                        "threshold_critical": 200.0,
                        "status": "hazardous_particulate_spike",
                        "details": f"IoT particulate matter sensor detected hazardous PM2.5 spike to {pm25_val} ug/m3."
                    },
                    confidence=0.89,
                    model_used="iot_gauge_telemetry",
                    status="pending_review"
                )
                db.add(evidence)
        else:
            # General / storm sensors: wind speed, barometric dip
            wind_val = round(30.0 + (zone.current_severity * 60.0) + random.uniform(-5, 5), 1)
            r1 = SensorReading(zone_id=zone.id, sensor_type="wind_gust", value=wind_val, unit="km/h", recorded_at=ts)
            db.add(r1)

    db.commit()

def run_sensor_tick(db: Session):
    """Called on scheduled intervals to simulate live IoT streams across all active zones."""
    zones = db.query(Zone).all()
    for zone in zones:
        generate_sensor_readings_for_zone(zone, db, backfill_hours=0)
