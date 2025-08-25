"""
Configuration settings for Strategy Service.
"""

import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    
    # Service configuration
    SERVICE_NAME: str = "strategy-service"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+psycopg://algotrade:algotrade_pass@postgres:5432/algotrade"
    )
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    REDIS_STRATEGY_CACHE_TTL: int = 3600  # 1 hour cache for compiled strategies
    
    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    STRATEGY_COMPILATIONS_TOPIC: str = "strategy-compilations"
    
    # JWT Authentication
    # TODO: Replace default JWT secret with secure production value
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production") 
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    def __post_init__(self):
        """Validate configuration after initialization."""
        # TODO: Add warning for insecure JWT secret in production
        if self.JWT_SECRET_KEY == "your-secret-key-change-in-production":
            import warnings
            warnings.warn(
                "Using default JWT secret key. This is insecure for production use. "
                "Set JWT_SECRET_KEY environment variable with a secure random key.",
                UserWarning,
                stacklevel=2
            )
    
    class Config:
        env_file = ".env"


settings = Settings()