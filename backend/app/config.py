import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Root directory of the repository
BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "backend" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseSettings):
    PROJECT_NAME: str = "Multimodal AI Real-Time Disaster Intelligence"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # API Keys
    OPENAI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    OPENWEATHER_API_KEY: str = ""
    FIRMS_MAP_KEY: str = ""
    SENTINEL_CLIENT_ID: str = ""
    SENTINEL_CLIENT_SECRET: str = ""
    
    # Supabase (optional)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    
    # Database
    DATABASE_URL: str = ""
    
    class Config:
        env_file = str(BASE_DIR / ".env")
        env_file_encoding = "utf-8"
        extra = "allow"

settings = Settings()
