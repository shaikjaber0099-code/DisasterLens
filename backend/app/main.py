import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.background import BackgroundScheduler

from backend.app.config import settings, UPLOAD_DIR
from backend.app.database import SessionLocal
from backend.app.init_db import init_database_and_seed
from backend.app.sensor_simulator import run_sensor_tick
from backend.app.weather_poller import run_weather_poll_all

# Import API routers
from backend.app.api.incidents import router as incidents_router
from backend.app.api.images import router as images_router
from backend.app.api.zones import router as zones_router
from backend.app.api.review import router as review_router
from backend.app.api.sensors import router as sensors_router
from backend.app.api.weather import router as weather_router
from backend.app.api.reports import router as reports_router
from backend.app.api.evaluation import router as evaluation_router
from backend.app.api.webhooks import router as webhooks_router

# Background scheduler for live IoT sensors & weather
scheduler = BackgroundScheduler()

def scheduled_sensor_job():
    db = SessionLocal()
    try:
        run_sensor_tick(db)
    except Exception as e:
        print(f"Scheduled sensor tick error: {e}")
    finally:
        db.close()

def scheduled_weather_job():
    db = SessionLocal()
    try:
        run_weather_poll_all(db)
    except Exception as e:
        print(f"Scheduled weather poll error: {e}")
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB and seed worldwide zones
    init_database_and_seed()

    # Schedule background sensor simulator (every 45 seconds) & weather poller (every 15 mins)
    scheduler.add_job(scheduled_sensor_job, 'interval', seconds=45, id='sensor_simulator_job')
    scheduler.add_job(scheduled_weather_job, 'interval', minutes=15, id='weather_poller_job')
    scheduler.start()
    print("Background disaster telemetry scheduler started.")

    yield

    # Shutdown
    scheduler.shutdown(wait=False)
    print("Disaster intelligence backend shutdown.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Multimodal AI for Real-Time Disaster Intelligence - Decision Support Platform",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploaded images
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Include Routers
app.include_router(zones_router, prefix=settings.API_PREFIX)
app.include_router(incidents_router, prefix=settings.API_PREFIX)
app.include_router(images_router, prefix=settings.API_PREFIX)
app.include_router(review_router, prefix=settings.API_PREFIX)
app.include_router(sensors_router, prefix=settings.API_PREFIX)
app.include_router(weather_router, prefix=settings.API_PREFIX)
app.include_router(reports_router, prefix=settings.API_PREFIX)
app.include_router(evaluation_router, prefix=settings.API_PREFIX)
app.include_router(webhooks_router, prefix=settings.API_PREFIX)
app.include_router(webhooks_router) # Mounts root /webhooks/twilio/inbound & /zones/{zone_id}/replies

@app.get("/")
def root():
    return {
        "status": "operational",
        "system": "Multimodal AI for Real-Time Disaster Intelligence",
        "version": settings.VERSION,
        "docs": "/docs",
        "decision_governance": "Human-in-the-Loop Gate Enforced"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
