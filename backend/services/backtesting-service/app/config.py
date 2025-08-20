"""Configuration settings for Backtesting Service."""

import os
from typing import List


class Settings:
    """Application settings with environment variable support."""
    
    # Service configuration
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Database configuration
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://algotrade:password@postgres:5432/algotrade")
    
    # Redis configuration
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379")
    
    # Kafka configuration
    KAFKA_BOOTSTRAP_SERVERS: List[str] = os.getenv(
        "KAFKA_BOOTSTRAP_SERVERS", "kafka:9092"
    ).split(",")
    
    # Authentication
    JWT_SECRET: str = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    
    # Backtesting configuration
    MAX_BACKTEST_DAYS: int = int(os.getenv("MAX_BACKTEST_DAYS", "365"))  # 1 year max
    BACKTEST_RETENTION_DAYS: int = int(os.getenv("BACKTEST_RETENTION_DAYS", "30"))
    MAX_CONCURRENT_JOBS: int = int(os.getenv("MAX_CONCURRENT_JOBS", "5"))
    JOB_TIMEOUT_SECONDS: int = int(os.getenv("JOB_TIMEOUT_SECONDS", "3600"))  # 1 hour
    
    # Historical data configuration
    HISTORICAL_DATA_CACHE_TTL: int = int(os.getenv("HISTORICAL_DATA_CACHE_TTL", "3600"))  # 1 hour
    MAX_DATA_POINTS: int = int(os.getenv("MAX_DATA_POINTS", "10000"))
    
    # Market data service
    MARKET_DATA_SERVICE_URL: str = os.getenv("MARKET_DATA_SERVICE_URL", "http://market-data-service:8001")
    
    # Strategy service
    STRATEGY_SERVICE_URL: str = os.getenv("STRATEGY_SERVICE_URL", "http://strategy-service:8002")
    
    # Analytics service
    ANALYTICS_SERVICE_URL: str = os.getenv("ANALYTICS_SERVICE_URL", "http://analytics-service:8006")
    
    # Auth service
    AUTH_SERVICE_URL: str = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8007")
    
    # Storage configuration (for large result sets)
    S3_BUCKET: str = os.getenv("S3_BUCKET", "algotrade-backtests")
    S3_ENDPOINT: str = os.getenv("S3_ENDPOINT", "")
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY", "")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY", "")
    
    # Performance settings
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "1000"))  # Process data in chunks
    PARALLEL_PROCESSING: bool = os.getenv("PARALLEL_PROCESSING", "true").lower() == "true"
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")


settings = Settings()