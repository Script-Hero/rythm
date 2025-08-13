"""Configuration for Market Data Service."""

import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Market Data Service settings."""
    
    # Application
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Redis Configuration
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379")
    REDIS_SLIDING_WINDOW_SIZE: int = int(os.getenv("REDIS_SLIDING_WINDOW_SIZE", "1000"))
    REDIS_STREAM_TTL: int = int(os.getenv("REDIS_STREAM_TTL", "86400"))  # 24 hours
    
    # Kafka Configuration
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    KAFKA_MARKET_DATA_TOPIC: str = "market-data-updates"
    
    # WebSocket Feeds
    COINBASE_WS_URL: str = os.getenv("COINBASE_WS_URL", "wss://ws-feed.exchange.coinbase.com")
    RECONNECT_DELAY: int = int(os.getenv("RECONNECT_DELAY", "5"))  # seconds
    MAX_RECONNECT_ATTEMPTS: int = int(os.getenv("MAX_RECONNECT_ATTEMPTS", "10"))
    
    # API Keys
    FINNHUB_TOKEN: str = os.getenv("FINNHUB_TOKEN", "")
    
    # Caching
    SYMBOL_CACHE_TTL: int = int(os.getenv("SYMBOL_CACHE_TTL", "3600"))  # 1 hour
    PRICE_CACHE_TTL: int = int(os.getenv("PRICE_CACHE_TTL", "60"))     # 1 minute
    
    # Rate Limiting
    MAX_SUBSCRIPTIONS_PER_CLIENT: int = int(os.getenv("MAX_SUBSCRIPTIONS_PER_CLIENT", "50"))
    
    # Performance
    BATCH_SIZE: int = int(os.getenv("BATCH_SIZE", "100"))
    FLUSH_INTERVAL: int = int(os.getenv("FLUSH_INTERVAL", "1"))  # seconds
    
    class Config:
        case_sensitive = True


settings = Settings()