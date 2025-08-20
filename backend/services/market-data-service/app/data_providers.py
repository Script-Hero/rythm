"""Data providers for market data service - focused on Coinbase as primary source."""

import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Set
from decimal import Decimal
import hashlib
import json

import ccxt.async_support as ccxt
import structlog
import redis.asyncio as redis

from .config import settings

logger = structlog.get_logger()


class HistoricalDataCache:
    """Redis-based cache for historical market data."""
    
    redis_client = None
    cache_ttl = 3600  # 1 hour cache TTL
    
    @classmethod
    async def initialize(cls):
        """Initialize Redis connection for caching."""
        cls.redis_client = redis.from_url(settings.REDIS_URL)
        await cls.redis_client.ping()
        logger.info("Historical data cache initialized")
    
    @classmethod
    def _generate_cache_key(cls, symbol: str, start_date: datetime, end_date: datetime, interval: str) -> str:
        """Generate cache key for historical data request."""
        key_data = f"{symbol}:{start_date.isoformat()}:{end_date.isoformat()}:{interval}"
        return f"historical_data:{hashlib.md5(key_data.encode()).hexdigest()}"
    
    @classmethod
    async def get_cached_data(
        cls, 
        symbol: str, 
        start_date: datetime, 
        end_date: datetime, 
        interval: str
    ) -> Optional[List[Dict[str, Any]]]:
        """Get cached historical data if available."""
        if not cls.redis_client:
            return None
        
        try:
            cache_key = cls._generate_cache_key(symbol, start_date, end_date, interval)
            cached_data = await cls.redis_client.get(cache_key)
            
            if cached_data:
                data = json.loads(cached_data)
                logger.debug("Retrieved cached historical data", 
                           symbol=symbol, points=len(data))
                return data
            
            return None
            
        except Exception as e:
            logger.error("Failed to get cached data", error=str(e))
            return None
    
    @classmethod
    async def cache_data(
        cls,
        symbol: str,
        start_date: datetime,
        end_date: datetime,
        interval: str,
        data: List[Dict[str, Any]]
    ):
        """Cache historical data."""
        if not cls.redis_client or not data:
            return
        
        try:
            cache_key = cls._generate_cache_key(symbol, start_date, end_date, interval)
            
            # Convert data to JSON-serializable format
            serializable_data = []
            for point in data:
                serializable_point = {}
                for key, value in point.items():
                    if isinstance(value, (Decimal, datetime)):
                        serializable_point[key] = str(value)
                    else:
                        serializable_point[key] = value
                serializable_data.append(serializable_point)
            
            await cls.redis_client.setex(
                cache_key,
                cls.cache_ttl,
                json.dumps(serializable_data)
            )
            
            logger.debug("Cached historical data", 
                        symbol=symbol, points=len(data))
            
        except Exception as e:
            logger.error("Failed to cache data", error=str(e))


class CoinbaseProvider:
    """Coinbase data provider for cryptocurrency data."""
    
    exchange = None
    _symbol_cache = None
    _cache_timestamp = None
    _cache_ttl = 3600  # Cache symbols for 1 hour
    
    @classmethod
    async def initialize(cls):
        """Initialize Coinbase exchange connection."""
        if cls.exchange is None:
            # Try using the legacy Coinbase Pro (now Advanced Trade) public endpoints
            try:
                config = {
                    'sandbox': False,
                    'rateLimit': 1000,
                    'enableRateLimit': True,
                    'urls': {
                        'api': {
                            'public': 'https://api.exchange.coinbase.com',  # Use legacy public API
                        }
                    }
                }
                
                # Add credentials if available for higher rate limits
                if hasattr(settings, 'COINBASE_API_KEY') and settings.COINBASE_API_KEY:
                    config.update({
                        'apiKey': settings.COINBASE_API_KEY,
                        'secret': settings.COINBASE_API_SECRET,
                        'password': settings.COINBASE_PASSPHRASE,
                    })
                    logger.info("Coinbase provider initialized with credentials")
                else:
                    logger.info("Coinbase provider initialized without credentials - using public API")
                
                # Use coinbasepro instead of coinbase for better public API support
                cls.exchange = ccxt.coinbasepro(config)
                
            except Exception as e:
                logger.error("Failed to initialize Coinbase provider", error=str(e))
                cls.exchange = None
    
    @classmethod
    async def _fetch_fresh_symbols(cls) -> List[Dict[str, Any]]:
        """Fetch fresh symbol data from Coinbase API."""
        # First try using ccxt
        await cls.initialize()
        
        if cls.exchange:
            try:
                markets = await cls.exchange.load_markets()
                symbols = []
                symbol_id = 1
                now = datetime.utcnow()
                
                for symbol, market in markets.items():
                    if market['active'] and market['type'] == 'spot':
                        # Extract base and quote currencies
                        base = market['base']
                        quote = market['quote']
                        
                        symbols.append({
                            'id': symbol_id,
                            'symbol': f"{base}/{quote}",
                            'base_currency': base,
                            'quote_currency': quote,
                            'base_name': base,  # For frontend display
                            'quote_name': quote,  # For frontend display
                            'exchange': 'coinbase',
                            'is_active': True,
                            'min_order_size': float(market['limits']['amount']['min']) if market['limits']['amount']['min'] else 0.0001,
                            'price_precision': int(market['precision']['price']) if isinstance(market['precision']['price'], (int, float)) else 8,
                            'size_precision': int(market['precision']['amount']) if isinstance(market['precision']['amount'], (int, float)) else 8,
                            'last_price': None,
                            'last_updated': now,
                            'created_at': now,
                            'asset_type': 'crypto'
                        })
                        symbol_id += 1
                
                # Cache the results
                cls._symbol_cache = symbols
                cls._cache_timestamp = now
                
                logger.info("Fetched Coinbase symbols via ccxt", count=len(symbols))
                return symbols
                
            except Exception as e:
                logger.error("Failed to fetch Coinbase symbols via ccxt", error=str(e))
            finally:
                if cls.exchange:
                    await cls.exchange.close()
                    cls.exchange = None
        
        # Fallback to direct HTTP API call
        try:
            logger.info("Attempting HTTP fallback to Coinbase API")
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.exchange.coinbase.com/products",
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    products = response.json()
                    symbols = []
                    symbol_id = 1
                    now = datetime.utcnow()
                    
                    for product in products:
                        if product.get('status') == 'online' and product.get('type') == 'spot':
                            base = product.get('base_currency')
                            quote = product.get('quote_currency')
                            
                            if base and quote:
                                symbols.append({
                                    'id': symbol_id,
                                    'symbol': f"{base}/{quote}",
                                    'base_currency': base,
                                    'quote_currency': quote,
                                    'base_name': base,
                                    'quote_name': quote,
                                    'exchange': 'coinbase',
                                    'is_active': True,
                                    'min_order_size': float(product.get('base_min_size', 0.0001)),
                                    'price_precision': cls._calculate_precision_from_increment(product.get('quote_increment', '0.01')),
                                    'size_precision': cls._calculate_precision_from_increment(product.get('base_increment', '0.00000001')),
                                    'last_price': None,
                                    'last_updated': now,
                                    'created_at': now,
                                    'asset_type': 'crypto'
                                })
                                symbol_id += 1
                    
                    # Cache the results
                    cls._symbol_cache = symbols
                    cls._cache_timestamp = now
                    
                    logger.info("Fetched Coinbase symbols via direct HTTP", count=len(symbols))
                    return symbols
                
        except Exception as e:
            logger.error("Failed to fetch Coinbase symbols via HTTP fallback", error=str(e))
        
        # Final fallback to popular crypto pairs
        logger.warning("Using hardcoded fallback symbols due to API failures")
        return cls._get_fallback_symbols()
    
    @classmethod
    def _get_fallback_symbols(cls) -> List[Dict[str, Any]]:
        """Get hardcoded fallback symbols when all APIs fail."""
        now = datetime.utcnow()
        
        popular_pairs = [
            ("BTC", "USD"), ("ETH", "USD"), ("ADA", "USD"), ("DOT", "USD"),
            ("SOL", "USD"), ("AVAX", "USD"), ("MATIC", "USD"), ("LINK", "USD"),
            ("UNI", "USD"), ("AAVE", "USD"), ("COMP", "USD"), ("MKR", "USD"),
            ("SNX", "USD"), ("CRV", "USD"), ("YFI", "USD"), ("SUSHI", "USD"),
            ("BTC", "EUR"), ("ETH", "EUR"), ("LTC", "USD"), ("BCH", "USD"),
            ("XLM", "USD"), ("EOS", "USD"), ("XTZ", "USD"), ("ALGO", "USD")
        ]
        
        symbols = []
        for i, (base, quote) in enumerate(popular_pairs, 1):
            symbols.append({
                'id': i,
                'symbol': f"{base}/{quote}",
                'base_currency': base,
                'quote_currency': quote,
                'base_name': base,
                'quote_name': quote,
                'exchange': 'coinbase',
                'is_active': True,
                'min_order_size': 0.0001 if base != 'BTC' else 0.00001,
                'price_precision': 2,
                'size_precision': 8,
                'last_price': None,
                'last_updated': now,
                'created_at': now,
                'asset_type': 'crypto'
            })
        
        return symbols
    
    @classmethod
    def _calculate_precision_from_increment(cls, increment_str: str) -> int:
        """Calculate precision (decimal places) from increment string."""
        try:
            # Convert to float first to handle scientific notation
            increment_float = float(increment_str)
            
            # Convert back to string to count decimal places
            increment_str = f"{increment_float:.10f}".rstrip('0')
            
            if '.' in increment_str:
                return len(increment_str.split('.')[-1])
            else:
                return 0
        except (ValueError, TypeError):
            # Default to 8 decimal places if parsing fails
            return 8
    
    @classmethod
    async def get_available_symbols(cls) -> List[Dict[str, Any]]:
        """Get available trading symbols from Coinbase with caching."""
        # Check if cache is still valid
        if (cls._symbol_cache is not None and 
            cls._cache_timestamp is not None and
            (datetime.utcnow() - cls._cache_timestamp).total_seconds() < cls._cache_ttl):
            logger.debug("Using cached Coinbase symbols", count=len(cls._symbol_cache))
            return cls._symbol_cache
        
        # Fetch fresh data
        return await cls._fetch_fresh_symbols()
    
    @classmethod
    async def get_base_currencies(cls) -> Set[str]:
        """Get unique base currencies from available symbols."""
        symbols = await cls.get_available_symbols()
        return {symbol['base_currency'] for symbol in symbols}
    
    @classmethod
    async def get_quote_currencies(cls) -> Set[str]:
        """Get unique quote currencies from available symbols."""
        symbols = await cls.get_available_symbols()
        return {symbol['quote_currency'] for symbol in symbols}
    
    @classmethod
    async def get_current_price(cls, symbol: str) -> Dict[str, Any]:
        """Get current price for a symbol."""
        await cls.initialize()
        
        try:
            ticker = await cls.exchange.fetch_ticker(symbol)
            
            return {
                'symbol': symbol,
                'price': Decimal(str(ticker['last'])),
                'bid': Decimal(str(ticker['bid'])) if ticker['bid'] else None,
                'ask': Decimal(str(ticker['ask'])) if ticker['ask'] else None,
                'volume': Decimal(str(ticker['baseVolume'])) if ticker['baseVolume'] else None,
                'timestamp': datetime.utcnow(),
                'exchange': 'coinbase'
            }
            
        except Exception as e:
            logger.error("Failed to get current price", symbol=symbol, error=str(e))
            raise
        finally:
            if cls.exchange:
                await cls.exchange.close()
                cls.exchange = None
    
    @classmethod
    async def get_historical_data(
        cls, 
        symbol: str, 
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        interval: str = "1h"
    ) -> List[Dict[str, Any]]:
        """Get historical OHLCV data with caching."""
        # Set default date range if not provided and ensure timezone consistency
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=90)  # Default to 90 days
        else:
            # Convert timezone-aware datetime to naive UTC
            if start_date.tzinfo is not None:
                start_date = start_date.utctimetuple()
                start_date = datetime(*start_date[:6])
        
        if not end_date:
            end_date = datetime.utcnow()
        else:
            # Convert timezone-aware datetime to naive UTC  
            if end_date.tzinfo is not None:
                end_date = end_date.utctimetuple()
                end_date = datetime(*end_date[:6])
        
        # Check cache first
        cached_data = await HistoricalDataCache.get_cached_data(symbol, start_date, end_date, interval)
        if cached_data:
            return cached_data
        
        # Fetch fresh data
        await cls.initialize()
        
        try:
            # Convert interval to ccxt format
            interval_map = {
                '1m': '1m',
                '5m': '5m',
                '15m': '15m',
                '1h': '1h',
                '4h': '4h',
                '1d': '1d'
            }
            
            timeframe = interval_map.get(interval, '1h')
            
            # Fetch OHLCV data
            since = int(start_date.timestamp() * 1000)  # ccxt expects milliseconds
            
            ohlcv = await cls.exchange.fetch_ohlcv(
                symbol, 
                timeframe=timeframe, 
                since=since,
                limit=1000
            )
            
            # Convert to our format
            data = []
            for candle in ohlcv:
                timestamp = datetime.fromtimestamp(candle[0] / 1000)
                
                # Skip data after end_date
                if timestamp > end_date:
                    break
                
                data.append({
                    'symbol': symbol,
                    'timestamp': timestamp,
                    'open': Decimal(str(candle[1])),
                    'high': Decimal(str(candle[2])),
                    'low': Decimal(str(candle[3])),
                    'close': Decimal(str(candle[4])),
                    'volume': Decimal(str(candle[5]))
                })
            
            # Cache the data
            await HistoricalDataCache.cache_data(symbol, start_date, end_date, interval, data)
            
            logger.info("Fetched historical data", symbol=symbol, count=len(data))
            return data
            
        except Exception as e:
            logger.error("Failed to get historical data", symbol=symbol, error=str(e))
            raise
        finally:
            if cls.exchange:
                await cls.exchange.close()
                cls.exchange = None


class DataProviderManager:
    """Manager for coordinating data providers - now focused on Coinbase."""
    
    @classmethod
    async def initialize(cls):
        """Initialize the data provider manager."""
        await HistoricalDataCache.initialize()
        logger.info("Data provider manager initialized")
    
    @classmethod
    async def get_current_price(cls, symbol: str) -> Dict[str, Any]:
        """Get current price using Coinbase."""
        try:
            return await CoinbaseProvider.get_current_price(symbol)
        except Exception as e:
            logger.error("Failed to get current price", symbol=symbol, error=str(e))
            raise Exception(f"Failed to get current price for symbol {symbol}: {str(e)}")
    
    @classmethod
    async def get_historical_data(
        cls,
        symbol: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        interval: str = "1h"
    ) -> List[Dict[str, Any]]:
        """Get historical data using Coinbase."""
        try:
            # Ensure timezone consistency before calling provider
            if start_date and start_date.tzinfo is not None:
                start_date = start_date.utctimetuple()
                start_date = datetime(*start_date[:6])
            
            if end_date and end_date.tzinfo is not None:
                end_date = end_date.utctimetuple() 
                end_date = datetime(*end_date[:6])
                
            return await CoinbaseProvider.get_historical_data(symbol, start_date, end_date, interval)
        except Exception as e:
            logger.error("Failed to get historical data", symbol=symbol, error=str(e))
            raise Exception(f"Failed to get historical data for symbol {symbol}: {str(e)}")
    
    @classmethod
    async def get_available_symbols(cls) -> List[Dict[str, Any]]:
        """Get symbols from Coinbase."""
        try:
            return await CoinbaseProvider.get_available_symbols()
        except Exception as e:
            logger.error("Failed to get symbols", error=str(e))
            return []
    
    @classmethod
    async def get_base_currencies(cls) -> List[Dict[str, str]]:
        """Get available base currencies for frontend."""
        try:
            base_currencies = await CoinbaseProvider.get_base_currencies()
            return [
                {'code': currency, 'name': currency}
                for currency in sorted(base_currencies)
            ]
        except Exception as e:
            logger.error("Failed to get base currencies", error=str(e))
            return []
    
    @classmethod
    async def get_quote_currencies(cls) -> List[Dict[str, str]]:
        """Get available quote currencies for frontend."""
        try:
            quote_currencies = await CoinbaseProvider.get_quote_currencies()
            return [
                {'code': currency, 'name': currency}
                for currency in sorted(quote_currencies)
            ]
        except Exception as e:
            logger.error("Failed to get quote currencies", error=str(e))
            return []
    
    @classmethod
    async def filter_symbols_by_history(cls, symbols: List[Dict[str, Any]], min_days: int) -> List[Dict[str, Any]]:
        """Filter symbols by minimum historical data availability."""
        if min_days <= 1:
            return symbols  # Return all if minimal history required
        
        # For now, assume all Coinbase symbols have sufficient history
        # In production, you might want to check actual data availability
        logger.debug("Filtering symbols by history", min_days=min_days, total_symbols=len(symbols))
        return symbols
    
    @classmethod
    async def search_symbols(cls, query: str, min_history_days: int = 1) -> List[Dict[str, Any]]:
        """Search symbols by query string."""
        all_symbols = await cls.get_available_symbols()
        
        if not query.strip():
            filtered = await cls.filter_symbols_by_history(all_symbols, min_history_days)
            return filtered
        
        query = query.upper().strip()
        
        # Search in symbol, base_currency, or quote_currency
        matching_symbols = []
        for symbol in all_symbols:
            if (query in symbol['symbol'].upper() or 
                query in symbol['base_currency'].upper() or
                query in symbol['quote_currency'].upper()):
                matching_symbols.append(symbol)
        
        filtered = await cls.filter_symbols_by_history(matching_symbols, min_history_days)
        logger.debug("Symbol search completed", query=query, results=len(filtered))
        return filtered
    
    @classmethod
    async def health_check(cls) -> Dict[str, Any]:
        """Check health of data providers."""
        health_status = {
            'coinbase': {'status': 'unknown', 'error': None},
            'cache': {'status': 'unknown', 'error': None}
        }
        
        # Test Coinbase
        try:
            symbols = await CoinbaseProvider.get_available_symbols()
            if symbols:
                health_status['coinbase']['status'] = 'healthy'
                health_status['coinbase']['symbol_count'] = len(symbols)
            else:
                health_status['coinbase']['status'] = 'unhealthy'
                health_status['coinbase']['error'] = 'No symbols returned'
        except Exception as e:
            health_status['coinbase']['status'] = 'unhealthy'
            health_status['coinbase']['error'] = str(e)
        
        # Test Cache
        try:
            if HistoricalDataCache.redis_client:
                await HistoricalDataCache.redis_client.ping()
                health_status['cache']['status'] = 'healthy'
            else:
                health_status['cache']['status'] = 'not_initialized'
        except Exception as e:
            health_status['cache']['status'] = 'unhealthy'
            health_status['cache']['error'] = str(e)
        
        return health_status