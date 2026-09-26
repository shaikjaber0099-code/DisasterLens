import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Zone(Base):
    __tablename__ = "zones"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    disaster_type = Column(String(100), nullable=False) # flood, wildfire, severe_storm, earthquake
    current_severity = Column(Float, default=0.0) # 0.0 to 1.0 (deterministic fusion score)
    current_confidence = Column(Float, default=0.0) # 0.0 to 1.0
    status = Column(String(50), default="monitoring") # monitoring, critical, review_needed, approved, archived
    
    # Geographic properties
    lat = Column(Float, nullable=False) # Zone centroid latitude
    lon = Column(Float, nullable=False) # Zone centroid longitude
    radius_km = Column(Float, default=15.0)
    country = Column(String(100), default="Global")
    region = Column(String(100), default="Region")
    geom_geojson = Column(JSON, nullable=True) # GeoJSON Polygon coordinates
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    incidents = relationship("Incident", back_populates="zone", cascade="all, delete-orphan")
    evidence_items = relationship("Evidence", back_populates="zone", cascade="all, delete-orphan")
    sensor_readings = relationship("SensorReading", back_populates="zone", cascade="all, delete-orphan")
    weather_snapshots = relationship("WeatherSnapshot", back_populates="zone", cascade="all, delete-orphan")
    summaries = relationship("SituationSummary", back_populates="zone", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="zone", cascade="all, delete-orphan")


class Incident(Base):
    __tablename__ = "incidents"
    
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True, index=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    disaster_type = Column(String(100), nullable=False) # flood, wildfire, etc.
    severity = Column(Integer, nullable=False) # 1 to 5 user reported
    description = Column(Text, nullable=False)
    image_url = Column(String(500), nullable=True)
    reported_at = Column(DateTime, default=datetime.utcnow)
    source = Column(String(100), default="citizen_report") # citizen_report, first_responder, field_operator
    status = Column(String(50), default="active")
    
    zone = relationship("Zone", back_populates="incidents")


class Evidence(Base):
    __tablename__ = "evidence"
    
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False, index=True)
    type = Column(String(50), nullable=False) # image, sensor, weather, report, satellite_firms
    payload = Column(JSON, nullable=False) # JSON data payload (e.g. classification result, raw telemetry, reading values)
    confidence = Column(Float, default=0.5) # 0.0 to 1.0
    model_used = Column(String(100), default="deterministic") # gpt-4o, llama-3.3-70b, sensor_gauge, rules_engine
    status = Column(String(50), default="pending_review") # pending_review, approved, rejected, needs_more_data
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    operator_notes = Column(Text, nullable=True)
    
    zone = relationship("Zone", back_populates="evidence_items")


class SensorReading(Base):
    __tablename__ = "sensor_readings"
    
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False, index=True)
    sensor_type = Column(String(100), nullable=False) # water_level, smoke_density, air_quality_pm25, temperature, wind_gust
    value = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False) # m, ppm, ug/m3, C, km/h
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    zone = relationship("Zone", back_populates="sensor_readings")


class WeatherSnapshot(Base):
    __tablename__ = "weather_snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False, index=True)
    temperature = Column(Float, nullable=False) # Celsius
    humidity = Column(Float, nullable=False) # %
    pressure = Column(Float, nullable=False) # hPa
    wind_speed = Column(Float, nullable=False) # km/h or m/s
    precipitation = Column(Float, default=0.0) # mm
    weather_condition = Column(String(100), default="Clear")
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    zone = relationship("Zone", back_populates="weather_snapshots")


class SituationSummary(Base):
    __tablename__ = "situation_summaries"
    
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False, index=True)
    summary_text = Column(Text, nullable=False)
    generated_by = Column(String(100), default="groq_llama-3.3-70b") # openai, groq_llama-3.3-70b, deterministic_fallback
    confidence = Column(Float, default=0.5)
    status = Column(String(50), default="pending") # pending, approved, rejected
    priority_rank = Column(Integer, default=5) # 1 highest, 10 lowest
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    
    zone = relationship("Zone", back_populates="summaries")


class Report(Base):
    __tablename__ = "reports"
    
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content_md = Column(Text, nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow)
    generated_by = Column(String(100), default="groq_llama-3.3-70b")
    status = Column(String(50), default="final")
    
    zone = relationship("Zone", back_populates="reports")
