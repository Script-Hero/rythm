"""
Service layer for Strategy Service.
Clean service implementations with proper database and Redis integration.
"""

from .database_service import DatabaseService as DatabaseServiceImpl
from .redis_service import RedisService as RedisServiceImpl
from .config import settings

# Global service instances
_database_service = DatabaseServiceImpl()
_redis_service = RedisServiceImpl()

class DatabaseService:
    """Database service wrapper for strategy operations"""
    
    @staticmethod
    async def initialize():
        """Initialize database connection"""
        await _database_service.initialize(settings.DATABASE_URL)
    
    @staticmethod
    async def close():
        """Close database connection"""
        await _database_service.close()
    
    @staticmethod
    async def is_connected() -> bool:
        """Check if database is connected"""
        return await _database_service.is_connected()
    
    @staticmethod
    async def create_strategy(*args, **kwargs):
        """Create a strategy"""
        return await _database_service.create_strategy(*args, **kwargs)
    
    @staticmethod
    async def list_user_strategies(*args, **kwargs):
        """List user strategies"""
        return await _database_service.list_user_strategies(*args, **kwargs)
    
    @staticmethod
    async def get_strategy_by_id(*args, **kwargs):
        """Get strategy by ID"""
        return await _database_service.get_strategy_by_id(*args, **kwargs)
    
    @staticmethod
    async def update_strategy(*args, **kwargs):
        """Update strategy"""
        return await _database_service.update_strategy(*args, **kwargs)
    
    @staticmethod
    async def delete_strategy(*args, **kwargs):
        """Delete strategy"""
        return await _database_service.delete_strategy(*args, **kwargs)
    
    @staticmethod
    async def update_compilation_report(*args, **kwargs):
        """Update compilation report"""
        return await _database_service.update_compilation_report(*args, **kwargs)
    
    @staticmethod
    async def search_strategies(*args, **kwargs):
        """Search strategies"""
        return await _database_service.search_strategies(*args, **kwargs)
    
    @staticmethod
    async def get_user_strategy_stats(*args, **kwargs):
        """Get user strategy stats"""
        return await _database_service.get_user_strategy_stats(*args, **kwargs)


class RedisService:
    """Redis service wrapper for caching"""
    
    @staticmethod
    async def initialize():
        """Initialize Redis connection"""
        await _redis_service.initialize(settings.REDIS_URL)
    
    @staticmethod
    async def close():
        """Close Redis connection"""
        await _redis_service.close()
    
    @staticmethod
    async def is_connected() -> bool:
        """Check if Redis is connected"""
        return await _redis_service.is_connected()
    
    @staticmethod
    async def cache_compiled_strategy(strategy_id: str, strategy_instance, ttl: int = None):
        """Cache compiled strategy"""
        if ttl is None:
            ttl = settings.REDIS_STRATEGY_CACHE_TTL
        return await _redis_service.cache_compiled_strategy(strategy_id, strategy_instance, ttl)
    
    @staticmethod
    async def remove_compiled_strategy(strategy_id: str):
        """Remove compiled strategy from cache"""
        return await _redis_service.remove_compiled_strategy(strategy_id)


class StrategyTemplateService:
    """Strategy template service - placeholder for future implementation"""
    
    @staticmethod
    async def initialize():
        """Initialize template service"""
        pass
    
    @staticmethod
    async def get_all_templates():
        """Get all templates"""
        return []
    
    @staticmethod
    async def get_template(*args, **kwargs):
        """Get template by name"""
        return None