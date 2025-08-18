"""Configuration settings for API Gateway."""

import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Application
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173"
    ]
    
    # Trusted hosts - allow localhost for development
    ALLOWED_HOSTS: List[str] = [
        "localhost",
        "127.0.0.1", 
        "localhost:8000",
        "127.0.0.1:8000",
        "*"
    ]
    
    # Database
    POSTGRES_URL: str = os.getenv(
        "POSTGRES_URL", 
        "postgresql+psycopg://algotrade:algotrade_pass@postgres:5432/algotrade"
    )
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379")
    
    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    
    # JWT Configuration
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))  # 1 hour
    JWT_REFRESH_EXPIRE_DAYS: int = int(os.getenv("JWT_REFRESH_EXPIRE_DAYS", "7"))  # 7 days
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "100"))
    
    # Service URLs (internal communication)
    STRATEGY_SERVICE_URL: str = os.getenv("STRATEGY_SERVICE_URL", "http://strategy-service:8002")
    MARKET_DATA_SERVICE_URL: str = os.getenv("MARKET_DATA_SERVICE_URL", "http://market-data-service:8001")
    FORWARD_TEST_SERVICE_URL: str = os.getenv("FORWARD_TEST_SERVICE_URL", "http://forward-test-service:8003")
    BACKTESTING_SERVICE_URL: str = os.getenv("BACKTESTING_SERVICE_URL", "http://backtesting-service:8004")
    ANALYTICS_SERVICE_URL: str = os.getenv("ANALYTICS_SERVICE_URL", "http://analytics-service:8006")
    NOTIFICATION_SERVICE_URL: str = os.getenv("NOTIFICATION_SERVICE_URL", "http://notification-service:8005")
    
    # External APIs
    FINNHUB_TOKEN: str = os.getenv("FINNHUB_TOKEN", "")
    
    # Monitoring
    ENABLE_METRICS: bool = os.getenv("ENABLE_METRICS", "true").lower() == "true"
    
    class Config:
        case_sensitive = True


settings = Settings()