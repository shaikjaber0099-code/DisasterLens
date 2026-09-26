from datetime import datetime, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from backend.app.models import Zone, Evidence, Incident, SensorReading, WeatherSnapshot, SituationSummary
from backend.app.services.groq_client import generate_situation_summary_with_groq

def calculate_zone_severity_and_confidence(zone: Zone, db: Session) -> Dict[str, Any]:
    """
    Pure Python deterministic multi-modal fusion engine.
    Calculates auditable severity [0.0 - 1.0] and confidence [0.0 - 1.0].
    No LLM is used for the numeric calculation, adhering strictly to the safety mandate.
    """
    cutoff = datetime.utcnow() - timedelta(hours=48)

    # 1. Image Evidence Score (Weight: 0.35)
    image_evidences = db.query(Evidence).filter(
        Evidence.zone_id == zone.id,
        Evidence.type == "image",
        Evidence.status.in_(["approved", "pending_review"]),
        Evidence.created_at >= cutoff
    ).all()

    image_score = 0.0
    image_conf = 0.0
    has_image = len(image_evidences) > 0
    if has_image:
        scores = [e.payload.get("severity_score", 0.5) for e in image_evidences]
        confs = [e.confidence for e in image_evidences]
        image_score = sum(scores) / len(scores)
        image_conf = sum(confs) / len(confs)

    # 2. Sensor Readings Score (Weight: 0.30)
    recent_sensors = db.query(SensorReading).filter(
        SensorReading.zone_id == zone.id,
        SensorReading.recorded_at >= cutoff
    ).order_by(SensorReading.recorded_at.desc()).limit(15).all()

    sensor_score = 0.0
    has_sensors = len(recent_sensors) > 0
    if has_sensors:
        s_scores = []
        for s in recent_sensors:
            if s.sensor_type == "water_level":
                # Normalize 0m - 5m to 0 - 1
                norm = min(1.0, max(0.0, s.value / 4.5))
                s_scores.append(norm)
            elif s.sensor_type == "air_quality_pm25":
                # Normalize 0 - 300 ug/m3
                norm = min(1.0, max(0.0, s.value / 250.0))
                s_scores.append(norm)
            elif s.sensor_type == "smoke_density":
                # Normalize 0 - 200 ppm
                norm = min(1.0, max(0.0, s.value / 180.0))
                s_scores.append(norm)
            elif s.sensor_type == "soil_moisture":
                norm = min(1.0, max(0.0, (s.value - 40) / 60.0))
                s_scores.append(norm)
        if s_scores:
            sensor_score = sum(s_scores) / len(s_scores)

    # 3. Weather Hazard Index (Weight: 0.20)
    latest_weather = db.query(WeatherSnapshot).filter(
        WeatherSnapshot.zone_id == zone.id
    ).order_by(WeatherSnapshot.recorded_at.desc()).first()

    weather_score = 0.0
    has_weather = latest_weather is not None
    if latest_weather:
        if zone.disaster_type in ["flood", "severe_storm"]:
            precip_norm = min(1.0, latest_weather.precipitation / 30.0)
            hum_norm = min(1.0, max(0.0, (latest_weather.humidity - 60) / 40.0))
            weather_score = (precip_norm * 0.75) + (hum_norm * 0.25)
        else: # Wildfire
            wind_norm = min(1.0, latest_weather.wind_speed / 60.0)
            dry_norm = min(1.0, max(0.0, (70.0 - latest_weather.humidity) / 60.0))
            weather_score = (wind_norm * 0.6) + (dry_norm * 0.4)

    # 4. Incident Reports Score (Weight: 0.15)
    incidents = db.query(Incident).filter(
        Incident.zone_id == zone.id,
        Incident.status == "active"
    ).all()

    incident_score = 0.0
    has_incidents = len(incidents) > 0
    if has_incidents:
        inc_sevs = [inc.severity / 5.0 for inc in incidents]
        incident_score = sum(inc_sevs) / len(inc_sevs)

    # Compute weighted severity based on active modalities
    weights = []
    values = []
    if has_image:
        weights.append(0.35)
        values.append(image_score)
    if has_sensors:
        weights.append(0.30)
        values.append(sensor_score)
    if has_weather:
        weights.append(0.20)
        values.append(weather_score)
    if has_incidents:
        weights.append(0.15)
        values.append(incident_score)

    if weights:
        total_w = sum(weights)
        fused_severity = sum(w * v for w, v in zip(weights, values)) / total_w
    else:
        fused_severity = zone.current_severity or 0.1

    # Confidence calculation:
    # Modality completeness (up to 4 modalities) + individual signal confidences
    modality_coverage = len(weights) / 4.0 # e.g. 0.25, 0.50, 0.75, 1.00
    base_confidence = modality_coverage * 0.65

    if has_image:
        base_confidence += (image_conf * 0.20)
    if has_sensors:
        base_confidence += 0.15

    fused_confidence = min(0.98, max(0.20, base_confidence))

    # Low-confidence out-of-distribution flagging (§10)
    status = zone.status
    if fused_confidence < 0.40:
        status = "review_needed"
    elif fused_severity >= 0.75:
        status = "critical"
    elif status not in ["approved", "archived"]:
        status = "monitoring"

    return {
        "severity": round(float(fused_severity), 2),
        "confidence": round(float(fused_confidence), 2),
        "status": status,
        "modality_flags": {
            "has_image": has_image,
            "has_sensors": has_sensors,
            "has_weather": has_weather,
            "has_incidents": has_incidents,
        },
        "component_scores": {
            "image": round(image_score, 2),
            "sensor": round(sensor_score, 2),
            "weather": round(weather_score, 2),
            "incidents": round(incident_score, 2)
        }
    }


def run_fusion_for_zone(zone_id: int, db: Session) -> Zone:
    """
    Executes full multi-modal fusion for a zone:
    1. Deterministic severity & confidence calculation
    2. Updates Zone record
    3. Drafts Groq llama-3.3-70b situation summary from fused data
    """
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        return None

    fusion_res = calculate_zone_severity_and_confidence(zone, db)
    zone.current_severity = fusion_res["severity"]
    zone.current_confidence = fusion_res["confidence"]
    zone.status = fusion_res["status"]
    zone.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(zone)

    # Gather data package for Groq summary
    evidences = db.query(Evidence).filter(Evidence.zone_id == zone.id).order_by(Evidence.created_at.desc()).limit(10).all()
    ev_dicts = [{
        "id": e.id,
        "type": e.type,
        "payload": e.payload,
        "confidence": e.confidence,
        "model_used": e.model_used,
        "status": e.status
    } for e in evidences]

    latest_weather = db.query(WeatherSnapshot).filter(WeatherSnapshot.zone_id == zone.id).order_by(WeatherSnapshot.recorded_at.desc()).first()
    weather_dict = {
        "temperature": latest_weather.temperature,
        "humidity": latest_weather.humidity,
        "wind_speed": latest_weather.wind_speed,
        "precipitation": latest_weather.precipitation,
        "weather_condition": latest_weather.weather_condition,
        "source": "Live Meteorological Observation"
    } if latest_weather else {}

    sensors = db.query(SensorReading).filter(SensorReading.zone_id == zone.id).order_by(SensorReading.recorded_at.desc()).limit(6).all()
    sensor_dict = {s.sensor_type: {"value": s.value, "unit": s.unit} for s in sensors}

    inc_count = db.query(Incident).filter(Incident.zone_id == zone.id).count()

    payload = {
        "zone_id": zone.id,
        "name": zone.name,
        "disaster_type": zone.disaster_type,
        "country": zone.country,
        "region": zone.region,
        "current_severity": zone.current_severity,
        "current_confidence": zone.current_confidence,
        "status": zone.status,
        "incident_count": inc_count,
        "evidence": ev_dicts,
        "weather": weather_dict,
        "sensors": sensor_dict,
        "fusion_breakdown": fusion_res["component_scores"]
    }

    # Generate situation summary with Groq llama-3.3-70b (with fallback)
    summary_text = generate_situation_summary_with_groq(payload)

    # Record situation summary: automatically approve if confidence > 90% (0.90), keep for manual approval otherwise
    is_auto_approved = (zone.current_confidence or 0) > 0.90
    summary = SituationSummary(
        zone_id=zone.id,
        summary_text=summary_text,
        generated_by="groq_llama-3.3-70b",
        confidence=zone.current_confidence,
        status="approved" if is_auto_approved else "pending",
        approved_at=datetime.utcnow() if is_auto_approved else None,
        created_at=datetime.utcnow()
    )
    db.add(summary)

    # Auto-approve any pending evidence in this zone if confidence > 0.90
    if is_auto_approved:
        pending_evidence = db.query(Evidence).filter(
            Evidence.zone_id == zone.id,
            Evidence.status == "pending_review",
            Evidence.confidence > 0.90
        ).all()
        for ev in pending_evidence:
            ev.status = "approved"
            ev.reviewed_at = datetime.utcnow()
            ev.operator_notes = "Auto-approved: High confidence (>90%) safety threshold met."

    db.commit()

    # Post-validation alert hook: Auto-approve >= 90% threat rate and trigger Twilio alerts
    try:
        from backend.app.notifications import trigger_post_validation_alerts
        # If threat rate >= 90% (0.90) with high confidence, auto-approve directly and send alerts
        if zone.current_severity >= 0.90 and zone.current_confidence >= 0.70:
            zone.status = "approved"
            db.commit()
            trigger_post_validation_alerts(
                zone_id=zone.id,
                validated_status="CRITICAL",
                confidence_score=zone.current_confidence,
                rationale=summary_text[:250],
                db=db
            )
        elif str(fusion_res.get("status", "")).upper() == "CRITICAL":
            trigger_post_validation_alerts(
                zone_id=zone.id,
                validated_status="CRITICAL",
                confidence_score=zone.current_confidence,
                rationale=summary_text[:250],
                db=db
            )
    except Exception as hook_err:
        print(f"[Notifications Hook Error] {hook_err}")

    return zone
