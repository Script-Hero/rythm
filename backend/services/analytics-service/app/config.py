"""
Configuration for Analytics Service.
"""

import os
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    
    # Service info
    SERVICE_NAME: str = "analytics-service"
    SERVICE_PORT: int = 8006
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+psycopg_async://algotrade:password@postgres:5432/algotrade"
    )
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    REDIS_CACHE_TTL: int = int(os.getenv("REDIS_CACHE_TTL", "3600"))  # 1 hour
    
    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    KAFKA_GROUP_ID: str = os.getenv("KAFKA_GROUP_ID", "analytics-service")
    
    # Authentication
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-secret-key")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Analytics configuration
    DEFAULT_RISK_FREE_RATE: float = 0.02  # 2% annual
    ANALYTICS_CACHE_TTL_SECONDS: int = 300  # 5 minutes for live analytics
    BACKTEST_CACHE_TTL_SECONDS: int = 3600  # 1 hour for backtest analytics
    
    # Performance settings
    MAX_CONCURRENT_CALCULATIONS: int = 10
    BATCH_SIZE: int = 1000
    
    # API Gateway URL for service communication
    API_GATEWAY_URL: str = os.getenv("API_GATEWAY_URL", "http://localhost:8000")
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()