"""
Configuration settings for Forward Testing Service.
"""

import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    
    # Service configuration
    SERVICE_NAME: str = "forward-test-service"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+psycopg://algotrade:algotrade@postgres:5432/algotrade"
    )
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    
    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    STRATEGY_SIGNALS_TOPIC: str = "strategy-signals"
    TRADE_EVENTS_TOPIC: str = "trade-events"
    
    # JWT Authentication
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Trading configuration
    DEFAULT_STARTING_BALANCE: float = 100000.0  # $100k
    DEFAULT_COMMISSION_RATE: float = 0.001      # 0.1%
    DEFAULT_SLIPPAGE_RATE: float = 0.0005       # 0.05%
    MAX_POSITION_SIZE_PERCENT: float = 0.25     # 25% max position
    
    # Performance limits
    MAX_SESSIONS_PER_USER: int = 10
    SESSION_TIMEOUT_HOURS: int = 24
    
    # Market data source
    MARKET_DATA_SERVICE_URL: str = os.getenv(
        "MARKET_DATA_SERVICE_URL", 
        "http://market-data-service:8001"
    )
    
    # Strategy compilation
    STRATEGY_SERVICE_URL: str = os.getenv(
        "STRATEGY_SERVICE_URL",
        "http://strategy-service:8002"
    )
    
    class Config:
        env_file = ".env"


settings = Settings()