"""
AlgoTrade Market Data Service
Real-time market data ingestion with Redis sliding window optimization.
Key Innovation: Eliminates per-strategy data storage concerns.
"""

import asyncio
import os
import sys
import time
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional

import structlog
import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

# Add shared models to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../..'))

from shared.models.market_data_models import (
    MarketSymbol, PriceData, MarketDataRequest, MarketDataResponse,
    SymbolSearchRequest, SymbolSearchResponse, RealTimePriceUpdate
)
from .config import settings
from .services import RedisStreamService, CoinbaseWebSocketService, KafkaService
from .data_providers import DataProviderManager

# Configure logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(30),
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    logger.info("🚀 Starting Market Data Service")
    
    # Initialize services
    await RedisStreamService.initialize()
    await KafkaService.initialize()
    await DataProviderManager.initialize()
    
    # Start background tasks
    asyncio.create_task(CoinbaseWebSocketService.start_feeds())
    # TEMPORARILY DISABLED: asyncio.create_task(periodic_symbol_update())
    
    logger.info("✅ Market Data Service initialized")
    
    yield
    
    logger.info("🛑 Shutting down Market Data Service")
    await CoinbaseWebSocketService.stop_feeds()
    await RedisStreamService.close()
    await KafkaService.close()


app = FastAPI(
    title="AlgoTrade Market Data Service",
    description="Real-time market data with Redis sliding window optimization",
    version="1.0.0",
    lifespan=lifespan
)


# Core Redis Sliding Window Implementation
@app.get("/symbols/{symbol:path}/latest")
async def get_latest_prices(symbol: str, limit: int = 100) -> Dict[str, Any]:
    """
    Get latest N price points from Redis sliding window.
    This is the key optimization - strategies access this instead of storing data.
    """
    try:
        prices = await RedisStreamService.get_latest_prices(symbol, limit)
        
        return {
            "success": True,
            "symbol": symbol,
            "count": len(prices),
            "prices": prices,
            "window_size": settings.REDIS_SLIDING_WINDOW_SIZE,
            "cached": True
        }
    except Exception as e:
        logger.error("Failed to get latest prices", symbol=symbol, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/symbols/{symbol:path}/stream")
async def get_price_stream_info(symbol: str) -> Dict[str, Any]:
    """Get information about the price stream for a symbol."""
    try:
        info = await RedisStreamService.get_stream_info(symbol)
        return {
            "success": True,
            "symbol": symbol,
            "stream_info": info
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Stream not found for {symbol}")


@app.post("/symbols/{symbol:path}/subscribe")
async def subscribe_to_symbol(symbol: str, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """
    Subscribe to real-time data for a symbol.
    Creates Redis sliding window and starts WebSocket feed.
    """
    try:
        # Validate symbol format
        if "/" not in symbol:
            symbol = symbol.replace("-", "/")  # Convert BTC-USD to BTC/USD
        
        # Start WebSocket subscription
        success = await CoinbaseWebSocketService.subscribe_symbol(symbol)
        
        if success:
            logger.info("Subscribed to symbol", symbol=symbol)
            return {
                "success": True,
                "symbol": symbol,
                "message": "Subscription started",
                "redis_key": f"market:{symbol.replace('/', '')}",
                "window_size": settings.REDIS_SLIDING_WINDOW_SIZE
            }
        else:
            raise HTTPException(status_code=400, detail=f"Failed to subscribe to {symbol}")
            
    except Exception as e:
        logger.error("Subscription failed", symbol=symbol, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/symbols/{symbol:path}/unsubscribe")
async def unsubscribe_from_symbol(symbol: str) -> Dict[str, Any]:
    """Unsubscribe from real-time data for a symbol."""
    try:
        success = await CoinbaseWebSocketService.unsubscribe_symbol(symbol)
        
        if success:
            # Clean up Redis stream after a delay
            asyncio.create_task(cleanup_stream_later(symbol, delay=300))  # 5 minutes
            
            return {
                "success": True,
                "symbol": symbol,
                "message": "Unsubscribed successfully"
            }
        else:
            raise HTTPException(status_code=400, detail=f"Not subscribed to {symbol}")
            
    except Exception as e:
        logger.error("Unsubscription failed", symbol=symbol, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


async def cleanup_stream_later(symbol: str, delay: int):
    """Clean up Redis stream after a delay (in case of reconnection)."""
    await asyncio.sleep(delay)
    await RedisStreamService.cleanup_stream(symbol)
    logger.info("Cleaned up stream", symbol=symbol)


# Symbol Management
@app.get("/symbols")
async def list_symbols(active_only: bool = True, min_history_days: int = 1) -> Dict[str, Any]:
    """List available trading symbols with history filtering."""
    try:
        symbol_dicts = await DataProviderManager.get_available_symbols()
        logger.info("Retrieved symbols from DataProviderManager", count=len(symbol_dicts))
        
        if active_only:
            symbol_dicts = [s for s in symbol_dicts if s.get('is_active', True)]
            logger.info("Filtered active symbols", count=len(symbol_dicts))
        
        # Apply history filtering
        filtered_symbols = await DataProviderManager.filter_symbols_by_history(symbol_dicts, min_history_days)
        logger.info("Applied history filtering", count=len(filtered_symbols), min_history_days=min_history_days)
            
        return {
            "success": True,
            "symbols": filtered_symbols,
            "total": len(filtered_symbols),
            "min_history_days": min_history_days
        }
    except Exception as e:
        logger.error("Failed to list symbols", error=str(e))
        # Return fallback symbols instead of raising an error
        fallback_symbols = [
            {
                'id': 1, 'symbol': 'BTC/USD', 'base_currency': 'BTC', 'quote_currency': 'USD',
                'base_name': 'Bitcoin', 'quote_name': 'US Dollar', 'exchange': 'fallback',
                'is_active': True, 'min_order_size': 0.0001, 'price_precision': 2, 'size_precision': 8,
                'last_price': None, 'last_updated': datetime.utcnow(), 'created_at': datetime.utcnow(), 'asset_type': 'crypto'
            },
            {
                'id': 2, 'symbol': 'ETH/USD', 'base_currency': 'ETH', 'quote_currency': 'USD',
                'base_name': 'Ethereum', 'quote_name': 'US Dollar', 'exchange': 'fallback',
                'is_active': True, 'min_order_size': 0.001, 'price_precision': 2, 'size_precision': 6,
                'last_price': None, 'last_updated': datetime.utcnow(), 'created_at': datetime.utcnow(), 'asset_type': 'crypto'
            }
        ]
        return {
            "success": True,
            "symbols": fallback_symbols,
            "total": len(fallback_symbols),
            "min_history_days": min_history_days
        }


@app.get("/symbols/search")
async def search_symbols(q: str = "", min_history_days: int = 1, limit: int = 50) -> Dict[str, Any]:
    """Search for symbols by query string with history filtering."""
    try:
        matching_symbols = await DataProviderManager.search_symbols(q, min_history_days)
        
        # Apply limit
        limited_symbols = matching_symbols[:limit]
        
        return {
            "success": True,
            "symbols": limited_symbols,
            "total": len(limited_symbols),
            "query": q,
            "min_history_days": min_history_days
        }
        
    except Exception as e:
        logger.error("Symbol search failed", error=str(e))
        raise HTTPException(status_code=500, detail="Search failed")


# Historical Data
@app.post("/historical", response_model=MarketDataResponse)
async def get_historical_data(request: MarketDataRequest) -> MarketDataResponse:
    """Get historical OHLCV data for symbols."""
    try:
        if len(request.symbols) > 10:
            raise HTTPException(status_code=400, detail="Maximum 10 symbols per request")
        
        # For now, return data for first symbol
        symbol = request.symbols[0]
        
        # Use data provider manager
        data = await DataProviderManager.get_historical_data(
            symbol, request.start_date, request.end_date, request.interval
        )
        
        return MarketDataResponse(
            symbol=symbol,
            data=data,
            source="coinbase",
            cached=False
        )
        
    except Exception as e:
        logger.error("Historical data request failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# Health and monitoring
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "service": "market-data-service",
        "active_subscriptions": len(CoinbaseWebSocketService.active_subscriptions),
        "redis_connected": await RedisStreamService.is_connected(),
        "kafka_connected": await KafkaService.is_connected()
    }


@app.get("/metrics")
async def get_metrics():
    """Service metrics."""
    return {
        "active_streams": len(CoinbaseWebSocketService.active_subscriptions),
        "redis_memory_usage": await RedisStreamService.get_memory_usage(),
        "total_messages_processed": await RedisStreamService.get_total_messages(),
        "window_size": settings.REDIS_SLIDING_WINDOW_SIZE,
        "uptime_seconds": time.time() - app.state.start_time if hasattr(app.state, 'start_time') else 0
    }


# Background Tasks
async def periodic_symbol_update():
    """Periodically update symbol information."""
    while True:
        try:
            logger.info("Updating symbol information")
            await update_symbols_cache()
            await asyncio.sleep(3600)  # Update every hour
        except Exception as e:
            logger.error("Symbol update failed", error=str(e))
            await asyncio.sleep(300)  # Retry in 5 minutes


# Currency endpoints - Real data from Coinbase
@app.get("/currencies/base")
async def list_base_currencies() -> Dict[str, Any]:
    """Get available base currencies from Coinbase."""
    try:
        currencies = await DataProviderManager.get_base_currencies()
        return {
            "success": True,
            "currencies": currencies
        }
    except Exception as e:
        logger.error("Failed to get base currencies", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve base currencies")


@app.get("/currencies/quote") 
async def list_quote_currencies() -> Dict[str, Any]:
    """Get available quote currencies from Coinbase."""
    try:
        currencies = await DataProviderManager.get_quote_currencies()
        return {
            "success": True,
            "currencies": currencies
        }
    except Exception as e:
        logger.error("Failed to get quote currencies", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve quote currencies")


@app.post("/validate")
async def validate_symbol_and_dates(request: Dict[str, Any]):
    """
    Validate symbol and date range - compatibility endpoint for frontend.
    Checks if symbol exists and date range is reasonable.
    """
    symbol = request.get("symbol")
    start_date = request.get("start_date")  
    end_date = request.get("end_date")
    
    if not symbol or not start_date or not end_date:
        return {
            "valid": False,
            "errors": ["Missing required fields: symbol, start_date, end_date"]
        }
    
    try:
        # Convert symbol format if needed (BTC-USD -> BTC/USD)
        if "/" not in symbol and "-" in symbol:
            symbol = symbol.replace("-", "/")
        
        # Check if symbol exists in our cache
        available_symbols = await DataProviderManager.get_available_symbols()
        symbol_exists = any(s['symbol'] == symbol for s in available_symbols)
        
        if not symbol_exists:
            return {
                "valid": False,
                "errors": [f"Symbol {symbol} is not available"]
            }
        
        # Basic date validation (could be enhanced with actual data availability)
        from datetime import datetime, timedelta
        try:
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            
            if start >= end:
                return {
                    "valid": False,
                    "errors": ["Start date must be before end date"]
                }
            
            # Check if date range is too large (more than 2 years)
            if (end - start).days > 730:
                return {
                    "valid": False,
                    "errors": ["Date range too large. Maximum 2 years allowed"]
                }
                
        except ValueError as e:
            return {
                "valid": False, 
                "errors": [f"Invalid date format: {str(e)}"]
            }
        
        return {
            "valid": True,
            "symbol": symbol,
            "start_date": start_date,
            "end_date": end_date
        }
        
    except Exception as e:
        logger.error("Validation error", error=str(e))
        return {
            "valid": False,
            "errors": ["Validation failed"]
        }


@app.get("/symbols/{symbol:path}/date-range")
async def get_symbol_date_range(symbol: str):
    """
    Get available date range for a symbol - compatibility endpoint.
    In a real implementation, this would query actual data availability.
    """
    try:
        # Convert symbol format if needed (BTC-USD -> BTC/USD)
        if "/" not in symbol and "-" in symbol:
            symbol = symbol.replace("-", "/")
        
        # Check if symbol exists
        available_symbols = await DataProviderManager.get_available_symbols()
        symbol_exists = any(s['symbol'] == symbol for s in available_symbols)
        
        if not symbol_exists:
            return {
                "available": False,
                "symbol": symbol,
                "error": "Symbol not found"
            }
        
        # Return placeholder date range - in real implementation would query actual data
        from datetime import datetime, timedelta
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)  # 1 year of data
        
        return {
            "available": True,
            "symbol": symbol,
            "earliest_date": start_date.strftime("%Y-%m-%d"),
            "latest_date": end_date.strftime("%Y-%m-%d"),
            "total_days": 365
        }
        
    except Exception as e:
        logger.error("Date range error", symbol=symbol, error=str(e))
        return {
            "available": False,
            "symbol": symbol,
            "error": "Failed to get date range"
        }


# Helper functions
async def get_available_symbols_from_cache() -> List[MarketSymbol]:
    """Get symbols from Redis cache or fetch from provider."""
    cached_symbols = await RedisStreamService.get_cached_symbols()
    
    if cached_symbols:
        return cached_symbols
    
    # Try to fetch from all providers and cache
    try:
        symbol_dicts = await DataProviderManager.get_available_symbols()
        
        # Convert dictionaries to MarketSymbol objects
        from shared.models.market_data_models import MarketSymbol
        symbols = []
        for symbol_dict in symbol_dicts:
            try:
                symbols.append(MarketSymbol(**symbol_dict))
            except Exception as e:
                logger.warning("Failed to convert symbol dict to MarketSymbol", symbol=symbol_dict.get('symbol'), error=str(e))
        
        await RedisStreamService.cache_symbols(symbols)
        return symbols
    except Exception as e:
        logger.warning("Failed to fetch symbols from providers, using fallback", error=str(e))
        
        # Fallback to placeholder symbols for development/testing
        from shared.models.market_data_models import MarketSymbol
        from datetime import datetime
        from decimal import Decimal
        now = datetime.utcnow()
        
        placeholder_symbols = [
            MarketSymbol(
                id=1,
                symbol="BTC/USD",
                base_currency="BTC",
                quote_currency="USD", 
                exchange="fallback",
                is_active=True,
                min_order_size=Decimal('0.0001'),
                price_precision=2,
                size_precision=8,
                last_price=None,
                last_updated=now,
                created_at=now
            ),
            MarketSymbol(
                id=2,
                symbol="ETH/USD",
                base_currency="ETH",
                quote_currency="USD",
                exchange="fallback", 
                is_active=True,
                min_order_size=Decimal('0.001'),
                price_precision=2,
                size_precision=6,
                last_price=None,
                last_updated=now,
                created_at=now
            ),
            MarketSymbol(
                id=3,
                symbol="AAPL/USD",
                base_currency="AAPL",
                quote_currency="USD",
                exchange="fallback",
                is_active=True,
                min_order_size=Decimal('1.0'),
                price_precision=2,
                size_precision=0,
                last_price=None,
                last_updated=now,
                created_at=now
            )
        ]
        
        # Cache the placeholder symbols
        await RedisStreamService.cache_symbols(placeholder_symbols)
        return placeholder_symbols


async def update_symbols_cache():
    """Update the symbols cache."""
    try:
        symbols = await DataProviderManager.get_available_symbols()
        await RedisStreamService.cache_symbols(symbols)
        logger.info("Updated symbols cache", count=len(symbols))
    except Exception as e:
        logger.error("Failed to update symbols cache", error=str(e))


# Store startup time
@app.on_event("startup")
async def store_startup_time():
    app.state.start_time = time.time()


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.DEBUG
    )