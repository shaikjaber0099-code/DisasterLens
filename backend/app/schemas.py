from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

# --- Incident Schemas ---
class IncidentCreate(BaseModel):
    lat: float = Field(..., description="Latitude of the incident")
    lon: float = Field(..., description="Longitude of the incident")
    disaster_type: str = Field(..., description="flood, wildfire, severe_storm, etc.")
    severity: int = Field(..., ge=1, le=5, description="Self-reported severity 1-5")
    description: str = Field(..., min_length=10, description="Description must be >= 10 characters")
    image_url: Optional[str] = None
    reported_at: Optional[datetime] = None
    source: Optional[str] = "citizen_report"

class IncidentResponse(BaseModel):
    id: int
    zone_id: Optional[int]
    lat: float
    lon: float
    disaster_type: str
    severity: int
    description: str
    image_url: Optional[str]
    reported_at: datetime
    source: str
    status: str

    class Config:
        from_attributes = True


# --- Evidence Schemas ---
class EvidenceReviewAction(BaseModel):
    action: str = Field(..., description="approve, reject, or request_more_data")
    notes: Optional[str] = None

class EvidenceResponse(BaseModel):
    id: int
    zone_id: int
    type: str # image, sensor, weather, report, satellite_firms
    payload: Dict[str, Any]
    confidence: float
    model_used: str
    status: str # pending_review, approved, rejected, needs_more_data
    created_at: datetime
    reviewed_at: Optional[datetime]
    operator_notes: Optional[str]

    class Config:
        from_attributes = True


# --- Sensor & Weather Schemas ---
class SensorReadingCreate(BaseModel):
    zone_id: int
    sensor_type: str
    value: float
    unit: str

class SensorReadingResponse(BaseModel):
    id: int
    zone_id: int
    sensor_type: str
    value: float
    unit: str
    recorded_at: datetime

    class Config:
        from_attributes = True

class WeatherSnapshotResponse(BaseModel):
    id: int
    zone_id: int
    temperature: float
    humidity: float
    pressure: float
    wind_speed: float
    precipitation: float
    weather_condition: str
    recorded_at: datetime

    class Config:
        from_attributes = True


# --- Situation Summary Schemas ---
class SituationSummaryResponse(BaseModel):
    id: int
    zone_id: int
    summary_text: str
    generated_by: str
    confidence: float
    status: str # pending, approved, rejected
    priority_rank: int
    created_at: datetime
    approved_at: Optional[datetime]

    class Config:
        from_attributes = True

class SummaryReviewAction(BaseModel):
    action: str = Field(..., description="approve, reject, or edit")
    edited_text: Optional[str] = None


# --- Zone Schemas ---
class ZoneResponse(BaseModel):
    id: int
    name: str
    disaster_type: str
    current_severity: float
    current_confidence: float
    status: str
    lat: float
    lon: float
    radius_km: float
    country: str
    region: str
    geom_geojson: Optional[Dict[str, Any]]
    updated_at: datetime

    class Config:
        from_attributes = True

class ZoneDetailResponse(ZoneResponse):
    incidents: List[IncidentResponse] = []
    evidence_items: List[EvidenceResponse] = []
    latest_weather: Optional[WeatherSnapshotResponse] = None
    recent_sensors: List[SensorReadingResponse] = []
    active_summary: Optional[SituationSummaryResponse] = None


# --- Image Analysis Schemas ---
class ImageAnalysisResult(BaseModel):
    condition: str = Field(..., description="flooded | smoke | damaged_infrastructure | none")
    severity_0_to_1: float = Field(..., ge=0.0, le=1.0)
    confidence_0_to_1: float = Field(..., ge=0.0, le=1.0)
    rationale: str
    detected_features: List[str] = []
    model_used: str = "gpt-4o"
    zone_id: Optional[int] = None
    evidence_id: Optional[int] = None
    image_url: str


# --- Report Schemas ---
class ReportGenerateRequest(BaseModel):
    zone_id: int
    title: Optional[str] = None
    operator_name: Optional[str] = "Disaster Operations Desk"

class ReportResponse(BaseModel):
    id: int
    zone_id: int
    title: str
    content_md: str
    generated_at: datetime
    generated_by: str
    status: str

    class Config:
        from_attributes = True


# --- FIRMS Wildfire Hotspot Schemas ---
class FirmsHotspot(BaseModel):
    latitude: float
    longitude: float
    brightness: float
    scan: float
    track: float
    acq_date: str
    acq_time: str
    satellite: str
    confidence: float
    version: str
    frp: float
    daynight: str
    country: Optional[str] = "Global"
