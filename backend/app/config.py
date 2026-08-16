import os
from pydantic_settings import BaseSettings

from pydantic import ConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Onam Sadhya QR Ticketing"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./onam_sadhya.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "onam_sadhya_secret_key_festive_2026_safe_hash")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 12  # Token expires after 12 hours
    OTP_EXPIRY_MINUTES: int = 10
    DEV_MODE: bool = False
    SADHYA_TICKET_PRICE: float = 250.0  # Ticket price per student for analytics
    
    # College domain restriction
    COLLEGE_EMAIL_DOMAIN: str = os.getenv("COLLEGE_EMAIL_DOMAIN", "malayalamuniversity.org")
    
    # SMTP Settings for Free Email OTP
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "465"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "")

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

settings = Settings()
if settings.FRONTEND_URL and settings.FRONTEND_URL not in settings.CORS_ORIGINS:
    settings.CORS_ORIGINS.append(settings.FRONTEND_URL)

