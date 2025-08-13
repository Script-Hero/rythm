"""
Clean Redis Service for Strategy Caching
Simple key-value caching for compiled strategies
"""

import redis.asyncio as redis
import pickle
from typing import Optional, Any
import structlog

logger = structlog.get_logger("redis_service")

class RedisService:
    """Simple Redis caching for compiled strategies"""
    
    def __init__(self):
        self.client: Optional[redis.Redis] = None
    
    async def initialize(self, redis_url: str):
        """Initialize Redis connection"""
        logger.info("🔄 Initializing Redis connection")
        
        try:
            self.client = redis.from_url(redis_url, decode_responses=False)
            # Test connection
            await self.client.ping()
            logger.info("✅ Redis connection established")
        except Exception as e:
            logger.exception("❌ Failed to connect to Redis", error=str(e))
            raise
    
    async def close(self):
        """Close Redis connection"""
        if self.client:
            await self.client.aclose()
            logger.info("🔒 Redis connection closed")
    
    async def is_connected(self) -> bool:
        """Check Redis connection health"""
        if not self.client:
            return False
        try:
            await self.client.ping()
            return True
        except:
            return False
    
    async def cache_compiled_strategy(self, strategy_id: str, strategy_instance: Any, ttl: int = 3600):
        """Cache a compiled strategy"""
        if not self.client:
            logger.warning("⚠️ Redis not initialized, skipping cache")
            return
        
        try:
            key = f"strategy:compiled:{strategy_id}"
            serialized = pickle.dumps(strategy_instance)
            await self.client.setex(key, ttl, serialized)
            logger.info("✅ Compiled strategy cached", strategy_id=strategy_id)
        except Exception as e:
            logger.warning("⚠️ Failed to cache compiled strategy", 
                          strategy_id=strategy_id, error=str(e))
    
    async def get_compiled_strategy(self, strategy_id: str) -> Optional[Any]:
        """Get cached compiled strategy"""
        if not self.client:
            return None
        
        try:
            key = f"strategy:compiled:{strategy_id}"
            serialized = await self.client.get(key)
            if serialized:
                strategy_instance = pickle.loads(serialized)
                logger.info("✅ Compiled strategy retrieved from cache", strategy_id=strategy_id)
                return strategy_instance
        except Exception as e:
            logger.warning("⚠️ Failed to get cached strategy", 
                          strategy_id=strategy_id, error=str(e))
        
        return None
    
    async def remove_compiled_strategy(self, strategy_id: str):
        """Remove cached compiled strategy"""
        if not self.client:
            return
        
        try:
            key = f"strategy:compiled:{strategy_id}"
            await self.client.delete(key)
            logger.info("✅ Compiled strategy removed from cache", strategy_id=strategy_id)
        except Exception as e:
            logger.warning("⚠️ Failed to remove cached strategy", 
                          strategy_id=strategy_id, error=str(e))