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
            
            # Log strategy instance details before pickling
            logger.info("🥒 About to pickle strategy instance",
                       strategy_id=strategy_id,
                       instance_type=type(strategy_instance).__name__,
                       instance_attrs=dir(strategy_instance),
                       has_nodes=hasattr(strategy_instance, 'nodes'),
                       has_edges=hasattr(strategy_instance, 'edges'),
                       has_execution_order=hasattr(strategy_instance, 'execution_order'))
            
            if hasattr(strategy_instance, 'nodes'):
                logger.info("🧩 Strategy instance nodes details",
                           strategy_id=strategy_id,
                           node_count=len(strategy_instance.nodes),
                           node_ids=list(strategy_instance.nodes.keys()),
                           node_types=[type(node).__name__ for node in strategy_instance.nodes.values()])
            
            if hasattr(strategy_instance, 'execution_order'):
                logger.info("📋 Strategy execution order",
                           strategy_id=strategy_id,
                           execution_order=strategy_instance.execution_order)
            
            # Pickle the strategy
            logger.info("🥒 Starting pickle serialization", strategy_id=strategy_id)
            serialized = pickle.dumps(strategy_instance)
            logger.info("✅ Pickle serialization successful",
                       strategy_id=strategy_id,
                       serialized_size_bytes=len(serialized))
            
            # Store in Redis
            logger.info("💾 Storing in Redis", strategy_id=strategy_id, key=key, ttl=ttl)
            await self.client.setex(key, ttl, serialized)
            
            # Verify storage
            stored_size = await self.client.strlen(key)
            logger.info("✅ Compiled strategy cached successfully", 
                       strategy_id=strategy_id,
                       stored_size_bytes=stored_size,
                       ttl_seconds=ttl)
            
        except Exception as e:
            logger.exception("❌ Failed to cache compiled strategy", 
                          strategy_id=strategy_id, 
                          error=str(e),
                          error_type=type(e).__name__)
    
    async def get_compiled_strategy(self, strategy_id: str) -> Optional[Any]:
        """Get cached compiled strategy"""
        if not self.client:
            logger.warning("⚠️ Redis not initialized for retrieval", strategy_id=strategy_id)
            return None
        
        try:
            key = f"strategy:compiled:{strategy_id}"
            logger.info("🔍 Attempting to retrieve cached strategy", strategy_id=strategy_id, key=key)
            
            serialized = await self.client.get(key)
            if serialized:
                logger.info("📥 Found cached strategy data",
                           strategy_id=strategy_id,
                           serialized_size_bytes=len(serialized))
                
                # Unpickle the strategy
                logger.info("🥒 Starting pickle deserialization", strategy_id=strategy_id)
                strategy_instance = pickle.loads(serialized)
                
                # Log details about retrieved strategy
                logger.info("✅ Pickle deserialization successful",
                           strategy_id=strategy_id,
                           instance_type=type(strategy_instance).__name__,
                           has_nodes=hasattr(strategy_instance, 'nodes'),
                           has_edges=hasattr(strategy_instance, 'edges'),
                           has_execution_order=hasattr(strategy_instance, 'execution_order'))
                
                if hasattr(strategy_instance, 'nodes'):
                    logger.info("🧩 Retrieved strategy nodes details",
                               strategy_id=strategy_id,
                               node_count=len(strategy_instance.nodes),
                               node_ids=list(strategy_instance.nodes.keys()),
                               node_types=[type(node).__name__ for node in strategy_instance.nodes.values()])
                
                if hasattr(strategy_instance, 'execution_order'):
                    logger.info("📋 Retrieved strategy execution order",
                               strategy_id=strategy_id,
                               execution_order=strategy_instance.execution_order)
                
                return strategy_instance
            else:
                logger.info("❌ No cached strategy found", strategy_id=strategy_id)
                return None
                
        except Exception as e:
            logger.exception("❌ Failed to get cached strategy", 
                          strategy_id=strategy_id, 
                          error=str(e),
                          error_type=type(e).__name__)
        
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