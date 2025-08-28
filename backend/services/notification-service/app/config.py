"""Configuration settings for Notification Service."""

import os
from typing import List


class Settings:
    """Application settings with environment variable support."""
    
    # Service configuration
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # WebSocket configuration
    WEBSOCKET_TIMEOUT: int = int(os.getenv("WEBSOCKET_TIMEOUT", "300"))  # 5 minutes
    MAX_CONNECTIONS_PER_USER: int = int(os.getenv("MAX_CONNECTIONS_PER_USER", "5"))
    CONNECTION_CLEANUP_INTERVAL: int = int(os.getenv("CONNECTION_CLEANUP_INTERVAL", "60"))  # 1 minute
    
    # Authentication (support both JWT_SECRET_KEY and JWT_SECRET for parity with other services)
    JWT_SECRET: str = os.getenv("JWT_SECRET_KEY", os.getenv("JWT_SECRET", "your-secret-key-change-in-production"))
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    
    # Kafka configuration
    KAFKA_BOOTSTRAP_SERVERS: List[str] = os.getenv(
        "KAFKA_BOOTSTRAP_SERVERS", "kafka:9092"
    ).split(",")
    KAFKA_CONSUMER_GROUP: str = os.getenv("KAFKA_CONSUMER_GROUP", "notification-service")
    KAFKA_CONSUMER_TIMEOUT: int = int(os.getenv("KAFKA_CONSUMER_TIMEOUT", "30"))
    
    # Kafka topics
    KAFKA_FORWARD_TEST_EVENTS_TOPIC: str = os.getenv("KAFKA_FORWARD_TEST_EVENTS_TOPIC", "forward-test-events")
    KAFKA_PORTFOLIO_UPDATES_TOPIC: str = os.getenv("KAFKA_PORTFOLIO_UPDATES_TOPIC", "portfolio-updates")
    KAFKA_TRADE_EXECUTIONS_TOPIC: str = os.getenv("KAFKA_TRADE_EXECUTIONS_TOPIC", "trade-executions")
    KAFKA_STRATEGY_SIGNALS_TOPIC: str = os.getenv("KAFKA_STRATEGY_SIGNALS_TOPIC", "strategy-signals")
    KAFKA_REALTIME_UPDATES_TOPIC: str = os.getenv("KAFKA_REALTIME_UPDATES_TOPIC", "realtime-updates")
    
    # Redis configuration (for caching connection state)
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379")
    CONNECTION_STATE_TTL: int = int(os.getenv("CONNECTION_STATE_TTL", "3600"))  # 1 hour
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # CORS origins
    CORS_ORIGINS: List[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")


settings = Settings()
