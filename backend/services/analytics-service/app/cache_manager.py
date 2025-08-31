"""
Cache manager for Analytics Service using Redis.
"""

import json
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from decimal import Decimal

import redis.asyncio as redis
import structlog

from .config import settings

logger = structlog.get_logger()


class DecimalEncoder(json.JSONEncoder):
    """JSON encoder that handles Decimal objects."""
    
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


class CacheManager:
    """Redis cache manager for analytics data."""
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self._connected = False
    
    async def connect(self):
        """Connect to Redis."""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            
            # Test connection
            await self.redis_client.ping()
            self._connected = True
            
            logger.info("Connected to Redis", url=settings.REDIS_URL)
        
        except Exception as e:
            logger.error("Failed to connect to Redis", error=str(e))
            self._connected = False
            raise
    
    async def disconnect(self):
        """Disconnect from Redis."""
        if self.redis_client:
            await self.redis_client.close()
            self._connected = False
            logger.info("Disconnected from Redis")

    async def ensure_connected(self) -> bool:
        """Ensure a Redis connection is available; attempts to connect if not connected."""
        if self._connected and self.redis_client:
            return True
        try:
            await self.connect()
            return True
        except Exception:
            return False
    
    def _get_key(self, key_type: str, identifier: str) -> str:
        """Generate Redis key with consistent naming."""
        return f"analytics:{key_type}:{identifier}"
    
    async def set_live_analytics(self, session_id: str, analytics: Dict[str, Any], ttl: int = None) -> bool:
        """
        Cache live analytics for a forward testing session.
        
        Args:
            session_id: Forward test session ID
            analytics: Analytics data to cache
            ttl: Time to live in seconds (default: ANALYTICS_CACHE_TTL_SECONDS)
        """
        if not self._connected or not self.redis_client:
            logger.warning("Redis not connected, skipping cache")
            return False
        
        try:
            key = self._get_key("live", session_id)
            ttl = ttl or settings.ANALYTICS_CACHE_TTL_SECONDS
            
            # Add cache metadata
            cache_data = {
                "data": analytics,
                "cached_at": datetime.utcnow().isoformat(),
                "session_id": session_id,
                "type": "live_analytics"
            }
            
            # Serialize with Decimal handling
            serialized = json.dumps(cache_data, cls=DecimalEncoder)
            
            # Set with TTL
            await self.redis_client.setex(key, ttl, serialized)
            
            logger.debug("Cached live analytics", session_id=session_id, ttl=ttl)
            return True
        
        except Exception as e:
            logger.error("Failed to cache live analytics", error=str(e), session_id=session_id)
            return False
    
    async def get_live_analytics(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get cached live analytics for a session.
        
        Args:
            session_id: Forward test session ID
            
        Returns:
            Cached analytics data or None if not found/expired
        """
        if not self._connected or not self.redis_client:
            return None
        
        try:
            key = self._get_key("live", session_id)
            cached = await self.redis_client.get(key)
            
            if not cached:
                return None
            
            cache_data = json.loads(cached)
            return cache_data.get("data")
        
        except Exception as e:
            logger.error("Failed to get live analytics from cache", error=str(e), session_id=session_id)
            return None
    
    async def set_backtest_analytics(self, backtest_id: str, analytics: Dict[str, Any], ttl: int = None) -> bool:
        """
        Cache backtest analytics.
        
        Args:
            backtest_id: Backtest ID
            analytics: Analytics data to cache
            ttl: Time to live in seconds (default: BACKTEST_CACHE_TTL_SECONDS)
        """
        if not self._connected or not self.redis_client:
            return False
        
        try:
            key = self._get_key("backtest", backtest_id)
            ttl = ttl or settings.BACKTEST_CACHE_TTL_SECONDS
            
            cache_data = {
                "data": analytics,
                "cached_at": datetime.utcnow().isoformat(),
                "backtest_id": backtest_id,
                "type": "backtest_analytics"
            }
            
            serialized = json.dumps(cache_data, cls=DecimalEncoder)
            await self.redis_client.setex(key, ttl, serialized)
            
            logger.debug("Cached backtest analytics", backtest_id=backtest_id, ttl=ttl)
            return True
        
        except Exception as e:
            logger.error("Failed to cache backtest analytics", error=str(e), backtest_id=backtest_id)
            return False
    
    async def get_backtest_analytics(self, backtest_id: str) -> Optional[Dict[str, Any]]:
        """Get cached backtest analytics."""
        if not self._connected or not self.redis_client:
            return None
        
        try:
            key = self._get_key("backtest", backtest_id)
            cached = await self.redis_client.get(key)
            
            if not cached:
                return None
            
            cache_data = json.loads(cached)
            return cache_data.get("data")
        
        except Exception as e:
            logger.error("Failed to get backtest analytics from cache", error=str(e))
            return None
    
    async def set_final_analytics(self, session_id: str, analytics: Dict[str, Any]) -> bool:
        """
        Cache final analytics for a completed session (longer TTL).
        
        Args:
            session_id: Session ID
            analytics: Final analytics data
        """
        return await self.set_live_analytics(session_id, analytics, ttl=86400)  # 24 hours
    
    async def invalidate_session_cache(self, session_id: str) -> bool:
        """
        Invalidate all cached data for a session.
        
        Args:
            session_id: Session ID to invalidate
        """
        if not self._connected or not self.redis_client:
            return False
        
        try:
            key = self._get_key("live", session_id)
            await self.redis_client.delete(key)
            
            logger.debug("Invalidated session cache", session_id=session_id)
            return True
        
        except Exception as e:
            logger.error("Failed to invalidate session cache", error=str(e), session_id=session_id)
            return False
    
    async def set_custom_cache(self, key: str, data: Dict[str, Any], ttl: int = 3600) -> bool:
        """
        Set custom cache entry.
        
        Args:
            key: Cache key
            data: Data to cache
            ttl: Time to live in seconds
        """
        if not self._connected or not self.redis_client:
            return False
        
        try:
            cache_key = self._get_key("custom", key)
            serialized = json.dumps(data, cls=DecimalEncoder)
            await self.redis_client.setex(cache_key, ttl, serialized)
            return True
        
        except Exception as e:
            logger.error("Failed to set custom cache", error=str(e), key=key)
            return False
    
    async def get_custom_cache(self, key: str) -> Optional[Dict[str, Any]]:
        """Get custom cache entry."""
        if not self._connected or not self.redis_client:
            return None
        
        try:
            cache_key = self._get_key("custom", key)
            cached = await self.redis_client.get(cache_key)
            
            if not cached:
                return None
            
            return json.loads(cached)
        
        except Exception as e:
            logger.error("Failed to get custom cache", error=str(e), key=key)
            return None
    
    async def health_check(self) -> bool:
        """Check Redis connectivity."""
        try:
            if not self.redis_client:
                return False
            
            await self.redis_client.ping()
            return True
        
        except Exception as e:
            logger.error("Redis health check failed", error=str(e))
            return False
    
    @property
    def is_connected(self) -> bool:
        """Check if connected to Redis."""
        return self._connected
