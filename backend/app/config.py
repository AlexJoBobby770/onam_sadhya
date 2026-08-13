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
    DEV_MODE: bool = True
    SADHYA_TICKET_PRICE: float = 250.0  # Ticket price per student for analytics

    model_config = ConfigDict(env_file=".env", extra="ignore")

settings = Settings()
