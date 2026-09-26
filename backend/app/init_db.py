import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from backend.app.database import SessionLocal, Base, engine
from backend.app.models import Zone, Incident, Evidence, SensorReading, WeatherSnapshot, SituationSummary
from backend.app.sensor_simulator import generate_sensor_readings_for_zone
from backend.app.weather_poller import poll_weather_for_zone
from backend.app.fusion import run_fusion_for_zone

# Authentic Recent Worldwide Disaster Zones
SEED_ZONES = [
    {
        "name": "Valencia Metropolitan Basin",
        "country": "Spain",
        "region": "Valencian Community",
        "disaster_type": "flood",
        "lat": 39.4699,
        "lon": -0.3763,
        "radius_km": 28.0,
        "severity": 0.88,
        "confidence": 0.91,
        "status": "critical",
        "polygon": [
            [-0.55, 39.35], [-0.25, 39.35], [-0.20, 39.60], [-0.50, 39.60], [-0.55, 39.35]
        ],
        "incidents": [
            {
                "lat": 39.423, "lon": -0.428, "severity": 5, "disaster_type": "flood",
                "description": "Massive overflow of Rambla del Poyo river ravine; floodwaters reached second story in Paiporta. Submerged vehicles blocking evacuation routes.",
                "source": "Emergency Responder Dispatch"
            },
            {
                "lat": 39.489, "lon": -0.362, "severity": 4, "disaster_type": "flood",
                "description": "Severe storm drain backflow and standing water >1.2m across commercial logistics district near Turia basin.",
                "source": "Citizen Ground Report"
            }
        ]
    },
    {
        "name": "Jasper National Park Firefront",
        "country": "Canada",
        "region": "Alberta Rockies",
        "disaster_type": "wildfire",
        "lat": 52.8737,
        "lon": -118.0814,
        "radius_km": 35.0,
        "severity": 0.85,
        "confidence": 0.88,
        "status": "critical",
        "polygon": [
            [-118.30, 52.70], [-117.85, 52.70], [-117.85, 53.05], [-118.30, 53.05], [-118.30, 52.70]
        ],
        "incidents": [
            {
                "lat": 52.861, "lon": -118.065, "severity": 5, "disaster_type": "wildfire",
                "description": "Fast-moving crown fire jumping Highway 16 with 100m flame heights. Structural damage reported in south perimeter.",
                "source": "Parks Canada Fire Command"
            },
            {
                "lat": 52.895, "lon": -118.110, "severity": 4, "disaster_type": "wildfire",
                "description": "Heavy pyroconvective smoke obscuring daylight, severe particulate fallout and ember showers.",
                "source": "Aerial Reconnaissance Pilot"
            }
        ]
    },
    {
        "name": "Pantanal Wetland Fire Complex",
        "country": "Brazil",
        "region": "Mato Grosso do Sul",
        "disaster_type": "wildfire",
        "lat": -17.5210,
        "lon": -56.8920,
        "radius_km": 45.0,
        "severity": 0.79,
        "confidence": 0.84,
        "status": "critical",
        "polygon": [
            [-57.25, -17.80], [-56.50, -17.80], [-56.50, -17.20], [-57.25, -17.20], [-57.25, -17.80]
        ],
        "incidents": [
            {
                "lat": -17.502, "lon": -56.875, "severity": 4, "disaster_type": "wildfire",
                "description": "Dry peat and dense scrub ignited along Cuiaba river corridor. Heavy smoke corridor affecting regional biodiversity reserves.",
                "source": "IBAMA Federal Ranger"
            }
        ]
    },
    {
        "name": "Thessaly Agricultural Plains",
        "country": "Greece",
        "region": "Central Greece",
        "disaster_type": "flood",
        "lat": 39.6390,
        "lon": 22.4191,
        "radius_km": 30.0,
        "severity": 0.68,
        "confidence": 0.82,
        "status": "monitoring",
        "polygon": [
            [22.15, 39.45], [22.70, 39.45], [22.70, 39.85], [22.15, 39.85], [22.15, 39.45]
        ],
        "incidents": [
            {
                "lat": 39.615, "lon": 22.390, "severity": 3, "disaster_type": "flood",
                "description": "Pineios river levees experiencing saturated toe seepage. Agricultural flood basins inundated up to 2m.",
                "source": "Hellenic Civil Protection"
            }
        ]
    },
    {
        "name": "Sierra Foothills Wildfire Zone",
        "country": "United States",
        "region": "California",
        "disaster_type": "wildfire",
        "lat": 39.7596,
        "lon": -121.6219,
        "radius_km": 25.0,
        "severity": 0.74,
        "confidence": 0.87,
        "status": "critical",
        "polygon": [
            [-121.80, 39.60], [-121.40, 39.60], [-121.40, 39.90], [-121.80, 39.90], [-121.80, 39.60]
        ],
        "incidents": [
            {
                "lat": 39.745, "lon": -121.610, "severity": 4, "disaster_type": "wildfire",
                "description": "Steep canyon brush fire burning uphill with gusting northeast Diablo winds. Evacuation warnings active for upper ridges.",
                "source": "CalFire Watch Desk"
            }
        ]
    },
    {
        "name": "Wayanad Monsoon Inundation Zone",
        "country": "India",
        "region": "Kerala",
        "disaster_type": "flood",
        "lat": 11.6854,
        "lon": 76.1320,
        "radius_km": 22.0,
        "severity": 0.82,
        "confidence": 0.86,
        "status": "critical",
        "polygon": [
            [75.95, 11.55], [76.30, 11.55], [76.30, 11.85], [75.95, 11.85], [75.95, 11.55]
        ],
        "incidents": [
            {
                "lat": 11.662, "lon": 76.120, "severity": 5, "disaster_type": "flood",
                "description": "Flash surge down Iruvanji river with saturated hillside debris flow. Bridge access severed to plantation hamlets.",
                "source": "State Disaster Response Force"
            }
        ]
    },
    {
        "name": "Pilbara Remote Bushfire Corridor",
        "country": "Australia",
        "region": "Western Australia",
        "disaster_type": "wildfire",
        "lat": -21.4120,
        "lon": 117.8420,
        "radius_km": 50.0,
        "severity": 0.58,
        "confidence": 0.65,
        "status": "monitoring",
        "polygon": [
            [117.30, -21.80], [118.30, -21.80], [118.30, -21.00], [117.30, -21.00], [117.30, -21.80]
        ],
        "incidents": [
            {
                "lat": -21.430, "lon": 117.860, "severity": 3, "disaster_type": "wildfire",
                "description": "Spinifex grassland fire propagating westward across pastoral lease territory under dry seasonal conditions.",
                "source": "DFES Bushfire Service"
            }
        ]
    }
]

def init_database_and_seed():
    """Initializes tables and seeds worldwide disaster zones with real-time dynamic feeds."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        existing_count = db.query(Zone).count()
        if existing_count == 0:
            print("Seeding worldwide disaster zones...")
            for z_data in SEED_ZONES:
                geom = {
                    "type": "Polygon",
                    "coordinates": [z_data["polygon"]]
                }
                zone = Zone(
                    name=z_data["name"],
                    country=z_data["country"],
                    region=z_data["region"],
                    disaster_type=z_data["disaster_type"],
                    lat=z_data["lat"],
                    lon=z_data["lon"],
                    radius_km=z_data["radius_km"],
                    current_severity=z_data["severity"],
                    current_confidence=z_data["confidence"],
                    status=z_data["status"],
                    geom_geojson=geom
                )
                db.add(zone)
                db.commit()
                db.refresh(zone)

                # Seed incidents
                for inc_data in z_data.get("incidents", []):
                    inc = Incident(
                        zone_id=zone.id,
                        lat=inc_data["lat"],
                        lon=inc_data["lon"],
                        disaster_type=inc_data["disaster_type"],
                        severity=inc_data["severity"],
                        description=inc_data["description"],
                        source=inc_data["source"],
                        reported_at=datetime.utcnow() - timedelta(hours=3),
                        status="active"
                    )
                    db.add(inc)
                    # Evidence row
                    ev = Evidence(
                        zone_id=zone.id,
                        type="report",
                        payload={
                            "description": inc.description,
                            "severity_reported": inc.severity,
                            "source": inc.source
                        },
                        confidence=0.85,
                        model_used="first_responder_dispatch",
                        status="approved"
                    )
                    db.add(ev)
                db.commit()

                # Generate sensor time-series with historical backfill for sparklines
                generate_sensor_readings_for_zone(zone, db, backfill_hours=24)

                # Poll real worldwide weather with 24h history
                poll_weather_for_zone(zone, db, backfill_hours=24)

                # Run multi-modal fusion and summary generation
                run_fusion_for_zone(zone.id, db)

            print(f"Successfully seeded {len(SEED_ZONES)} worldwide disaster zones with dynamic telemetry!")
        else:
            print(f"Database already populated with {existing_count} zones.")
    except Exception as e:
        print(f"Error during database initialization: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_database_and_seed()
