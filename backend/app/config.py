import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Onam Sadhya QR Ticketing"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./onam_sadhya.db")
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 12  # Token expires after 12 hours
    DEV_MODE: bool = False
    SADHYA_TICKET_PRICE: float = 250.0  # Ticket price per student for analytics
    SUPER_ADMIN_OVERRIDE_CODE: str = ""
    GOOGLE_CLIENT_ID: str = ""

    # Supabase Free Tier Storage Settings
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_BUCKET: str = os.getenv("SUPABASE_BUCKET", "payment-proofs")

    # CORS Allowed Origins
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    model_config = ConfigDict(env_file=".env", extra="ignore")

def validate_settings(s: Settings) -> None:
    # Hard Fail-Loud Security Invariants: No fallback literals for JWT signing, Override secrets, or Google Client ID
    if not s.SECRET_KEY or not s.SECRET_KEY.strip():
        raise KeyError("CRITICAL SECURITY ERROR: SECRET_KEY environment variable is missing or empty. Server cannot start.")
    if not s.SUPER_ADMIN_OVERRIDE_CODE or not s.SUPER_ADMIN_OVERRIDE_CODE.strip():
        raise KeyError("CRITICAL SECURITY ERROR: SUPER_ADMIN_OVERRIDE_CODE environment variable is missing or empty. Server cannot start.")
    if not s.GOOGLE_CLIENT_ID or not s.GOOGLE_CLIENT_ID.strip():
        raise KeyError("CRITICAL SECURITY ERROR: GOOGLE_CLIENT_ID environment variable is missing or empty. Server cannot start.")

settings = Settings()
validate_settings(settings)

if settings.FRONTEND_URL and settings.FRONTEND_URL not in settings.CORS_ORIGINS:
    settings.CORS_ORIGINS.append(settings.FRONTEND_URL)

