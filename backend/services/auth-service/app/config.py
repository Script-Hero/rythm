"""Configuration for Authentication Service."""

import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    
    # Basic config
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://algotrade:algotrade@postgres:5432/algotrade"
    )
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    
    # JWT Configuration
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24 hours
    
    # Development Authentication
    DEV_MODE: bool = os.getenv("DEV_MODE", "true").lower() == "true"
    DEV_USER_ID: str = os.getenv("DEV_USER_ID", "00000000-0000-0000-0000-000000000000")
    DEV_USERNAME: str = os.getenv("DEV_USERNAME", "dev_user")
    DEV_EMAIL: str = os.getenv("DEV_EMAIL", "dev@example.com")
    
    class Config:
        env_file = ".env"


settings = Settings()