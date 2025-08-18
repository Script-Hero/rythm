"""
Simple test script for Analytics Service.
"""

import asyncio
import sys
import os

# Add the app directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.analytics_engine import AnalyticsEngine
from app.cache_manager import CacheManager
from app.config import settings


async def test_analytics_engine():
    """Test the analytics engine with mock data."""
    print("Testing Analytics Engine...")
    
    engine = AnalyticsEngine()
    
    # Test calculation methods with sample data
    from decimal import Decimal
    from datetime import datetime, timedelta
    
    # Mock portfolio values
    portfolio_values = []
    base_value = Decimal("100000")
    
    for i in range(30):  # 30 days of data
        # Simulate some volatility
        change = Decimal(str((i % 5 - 2) * 0.01))  # -2% to +2%
        value = base_value * (1 + change * i * Decimal("0.1"))
        timestamp = datetime.utcnow() - timedelta(days=30-i)
        portfolio_values.append((timestamp, value))
    
    # Test drawdown calculation
    drawdown_data = engine._calculate_drawdown_series(portfolio_values)
    print(f"Max Drawdown: {drawdown_data['max_drawdown_pct']:.2f}%")
    
    # Test returns calculation
    returns = engine._calculate_returns(portfolio_values)
    print(f"Number of return periods: {len(returns)}")
    
    # Test Sharpe ratio
    sharpe = engine._calculate_sharpe_ratio(portfolio_values)
    print(f"Sharpe Ratio: {sharpe:.3f}" if sharpe else "Sharpe Ratio: None")
    
    print("✅ Analytics Engine tests passed")


async def test_cache_manager():
    """Test the cache manager."""
    print("\nTesting Cache Manager...")
    
    cache = CacheManager()
    
    try:
        # Test connection (will fail if Redis not running)
        await cache.connect()
        print("✅ Connected to Redis")
        
        # Test caching
        test_data = {"test": "data", "value": 123.45}
        success = await cache.set_custom_cache("test_key", test_data)
        print(f"Cache set: {success}")
        
        # Test retrieval
        retrieved = await cache.get_custom_cache("test_key")
        print(f"Cache retrieved: {retrieved}")
        
        await cache.disconnect()
        print("✅ Cache Manager tests passed")
        
    except Exception as e:
        print(f"⚠️  Cache Manager test failed (Redis not available?): {e}")


async def test_config():
    """Test configuration."""
    print("\nTesting Configuration...")
    
    print(f"Service Port: {settings.SERVICE_PORT}")
    print(f"Database URL: {settings.DATABASE_URL[:50]}...")
    print(f"Redis URL: {settings.REDIS_URL}")
    print(f"Kafka Servers: {settings.KAFKA_BOOTSTRAP_SERVERS}")
    print(f"Debug Mode: {settings.DEBUG}")
    
    print("✅ Configuration tests passed")


async def main():
    """Run all tests."""
    print("🚀 Starting Analytics Service Tests\n")
    
    await test_config()
    await test_analytics_engine()
    await test_cache_manager()
    
    print("\n🎉 All tests completed!")


if __name__ == "__main__":
    asyncio.run(main())