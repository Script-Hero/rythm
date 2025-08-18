"""Data providers for market data service."""

import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from decimal import Decimal
import hashlib
import json

import httpx
import ccxt.async_support as ccxt
import pandas as pd
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
    
    @classmethod
    async def initialize(cls):
        """Initialize Coinbase exchange connection."""
        if cls.exchange is None:
            cls.exchange = ccxt.coinbasepro({
                'sandbox': False,
                'rateLimit': 1000,
                'enableRateLimit': True,
            })
    
    @classmethod
    async def get_available_symbols(cls) -> List[Dict[str, Any]]:
        """Get available trading symbols from Coinbase."""
        await cls.initialize()
        
        try:
            markets = await cls.exchange.load_markets()
            symbols = []
            
            for symbol, market in markets.items():
                if market['active'] and market['type'] == 'spot':
                    symbols.append({
                        'symbol': symbol,
                        'base_currency': market['base'],
                        'quote_currency': market['quote'],
                        'exchange': 'coinbase',
                        'is_active': True,
                        'min_order_size': float(market['limits']['amount']['min']) if market['limits']['amount']['min'] else None,
                        'price_precision': market['precision']['price'],
                        'size_precision': market['precision']['amount'],
                        'last_price': None,
                        'last_updated': datetime.utcnow(),
                        'created_at': datetime.utcnow()
                    })
            
            logger.info("Fetched Coinbase symbols", count=len(symbols))
            return symbols
            
        except Exception as e:
            logger.error("Failed to fetch Coinbase symbols", error=str(e))
            return []
        finally:
            if cls.exchange:
                await cls.exchange.close()
                cls.exchange = None
    
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
        # Set default date range if not provided
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()
        
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


class FinnhubProvider:
    """Finnhub data provider for stocks and other assets."""
    
    base_url = "https://finnhub.io/api/v1"
    
    @classmethod
    async def get_available_symbols(cls) -> List[Dict[str, Any]]:
        """Get available stock symbols from Finnhub."""
        if not settings.FINNHUB_TOKEN:
            logger.warning("Finnhub token not configured")
            return []
        
        try:
            async with httpx.AsyncClient() as client:
                # Get US stocks
                response = await client.get(
                    f"{cls.base_url}/stock/symbol",
                    params={
                        'exchange': 'US',
                        'token': settings.FINNHUB_TOKEN
                    }
                )
                response.raise_for_status()
                
                stocks = response.json()
                symbols = []
                
                # Limit to major stocks for demo
                major_stocks = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META']
                
                for stock in stocks[:100]:  # Limit for demo
                    if stock['symbol'] in major_stocks:
                        symbols.append({
                            'symbol': f"{stock['symbol']}/USD",
                            'base_currency': stock['symbol'],
                            'quote_currency': 'USD',
                            'exchange': 'finnhub',
                            'is_active': True,
                            'min_order_size': 1.0,
                            'price_precision': 2,
                            'size_precision': 0,
                            'last_price': None,
                            'last_updated': datetime.utcnow(),
                            'created_at': datetime.utcnow()
                        })
                
                logger.info("Fetched Finnhub symbols", count=len(symbols))
                return symbols
                
        except Exception as e:
            logger.error("Failed to fetch Finnhub symbols", error=str(e))
            return []
    
    @classmethod
    async def get_current_price(cls, symbol: str) -> Dict[str, Any]:
        """Get current stock price."""
        if not settings.FINNHUB_TOKEN:
            raise Exception("Finnhub token not configured")
        
        # Extract stock symbol (remove /USD)
        stock_symbol = symbol.replace('/USD', '')
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{cls.base_url}/quote",
                    params={
                        'symbol': stock_symbol,
                        'token': settings.FINNHUB_TOKEN
                    }
                )
                response.raise_for_status()
                
                data = response.json()
                
                return {
                    'symbol': symbol,
                    'price': Decimal(str(data['c'])),  # Current price
                    'bid': None,
                    'ask': None,
                    'volume': None,
                    'timestamp': datetime.utcnow(),
                    'exchange': 'finnhub'
                }
                
        except Exception as e:
            logger.error("Failed to get Finnhub price", symbol=symbol, error=str(e))
            raise
    
    @classmethod
    async def get_historical_data(
        cls,
        symbol: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        interval: str = "D"
    ) -> List[Dict[str, Any]]:
        """Get historical stock data from Finnhub."""
        if not settings.FINNHUB_TOKEN:
            raise Exception("Finnhub token not configured")
        
        # Extract stock symbol
        stock_symbol = symbol.replace('/USD', '')
        
        # Set default date range
        if not start_date:
            start_date = datetime.utcnow() - pd.Timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{cls.base_url}/stock/candle",
                    params={
                        'symbol': stock_symbol,
                        'resolution': interval,
                        'from': int(start_date.timestamp()),
                        'to': int(end_date.timestamp()),
                        'token': settings.FINNHUB_TOKEN
                    }
                )
                response.raise_for_status()
                
                data = response.json()
                
                if data.get('s') != 'ok':
                    raise Exception(f"Finnhub API error: {data}")
                
                # Convert to our format
                historical_data = []
                
                for i in range(len(data['t'])):
                    historical_data.append({
                        'symbol': symbol,
                        'timestamp': datetime.fromtimestamp(data['t'][i]),
                        'open': Decimal(str(data['o'][i])),
                        'high': Decimal(str(data['h'][i])),
                        'low': Decimal(str(data['l'][i])),
                        'close': Decimal(str(data['c'][i])),
                        'volume': Decimal(str(data['v'][i]))
                    })
                
                logger.info("Fetched Finnhub historical data", symbol=symbol, count=len(historical_data))
                return historical_data
                
        except Exception as e:
            logger.error("Failed to get Finnhub historical data", symbol=symbol, error=str(e))
            raise


class DataProviderManager:
    """Enhanced manager for coordinating multiple data providers with failover."""
    
    # Provider priority order for different asset types
    PROVIDER_PRIORITY = {
        'crypto': ['coinbase', 'finnhub'],
        'stock': ['finnhub', 'coinbase'],
        'default': ['coinbase', 'finnhub']
    }
    
    @classmethod
    async def initialize(cls):
        """Initialize the data provider manager."""
        await HistoricalDataCache.initialize()
        logger.info("Data provider manager initialized")
    
    @classmethod
    async def get_best_provider_for_symbol(cls, symbol: str) -> str:
        """Determine the best data provider for a symbol."""
        if '/' in symbol and any(crypto in symbol.upper() for crypto in ['BTC', 'ETH', 'LTC', 'ADA', 'SOL', 'DOT']):
            return 'coinbase'
        elif '/USD' in symbol and not any(crypto in symbol.upper() for crypto in ['BTC', 'ETH']):
            return 'finnhub'
        else:
            return 'coinbase'  # Default
    
    @classmethod
    async def get_current_price_unified(cls, symbol: str) -> Dict[str, Any]:
        """Get current price using the best provider with failover."""
        primary_provider = await cls.get_best_provider_for_symbol(symbol)
        
        # Try primary provider first
        try:
            if primary_provider == 'coinbase':
                return await CoinbaseProvider.get_current_price(symbol)
            elif primary_provider == 'finnhub':
                return await FinnhubProvider.get_current_price(symbol)
        except Exception as e:
            logger.warning("Primary provider failed", provider=primary_provider, symbol=symbol, error=str(e))
        
        # Fallback to other providers
        fallback_provider = 'finnhub' if primary_provider == 'coinbase' else 'coinbase'
        
        try:
            if fallback_provider == 'coinbase':
                result = await CoinbaseProvider.get_current_price(symbol)
                result['fallback_used'] = True
                return result
            elif fallback_provider == 'finnhub':
                result = await FinnhubProvider.get_current_price(symbol)
                result['fallback_used'] = True
                return result
        except Exception as e:
            logger.error("Fallback provider also failed", provider=fallback_provider, symbol=symbol, error=str(e))
        
        raise Exception(f"All providers failed for symbol {symbol}")
    
    @classmethod
    async def get_historical_data_unified(
        cls,
        symbol: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        interval: str = "1h"
    ) -> Tuple[List[Dict[str, Any]], str]:
        """Get historical data with provider failover."""
        primary_provider = await cls.get_best_provider_for_symbol(symbol)
        
        # Try primary provider first
        try:
            if primary_provider == 'coinbase':
                data = await CoinbaseProvider.get_historical_data(symbol, start_date, end_date, interval)
                return data, 'coinbase'
            elif primary_provider == 'finnhub':
                data = await FinnhubProvider.get_historical_data(symbol, start_date, end_date, interval)
                return data, 'finnhub'
        except Exception as e:
            logger.warning("Primary provider failed for historical data", 
                         provider=primary_provider, symbol=symbol, error=str(e))
        
        # Fallback to other providers
        fallback_provider = 'finnhub' if primary_provider == 'coinbase' else 'coinbase'
        
        try:
            if fallback_provider == 'coinbase':
                data = await CoinbaseProvider.get_historical_data(symbol, start_date, end_date, interval)
                return data, f'{fallback_provider}_fallback'
            elif fallback_provider == 'finnhub':
                data = await FinnhubProvider.get_historical_data(symbol, start_date, end_date, interval)
                return data, f'{fallback_provider}_fallback'
        except Exception as e:
            logger.error("Fallback provider also failed for historical data", 
                        provider=fallback_provider, symbol=symbol, error=str(e))
        
        raise Exception(f"All providers failed for historical data: {symbol}")
    
    @classmethod
    async def get_all_symbols(cls) -> List[Dict[str, Any]]:
        """Get symbols from all providers with error handling."""
        tasks = [
            cls._safe_get_symbols('coinbase', CoinbaseProvider.get_available_symbols),
            cls._safe_get_symbols('finnhub', FinnhubProvider.get_available_symbols)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        all_symbols = []
        for result in results:
            if isinstance(result, list):
                all_symbols.extend(result)
        
        logger.info("Retrieved symbols from providers", total_symbols=len(all_symbols))
        return all_symbols
    
    @classmethod
    async def _safe_get_symbols(cls, provider_name: str, provider_func) -> List[Dict[str, Any]]:
        """Safely get symbols from a provider."""
        try:
            symbols = await provider_func()
            logger.info("Retrieved symbols", provider=provider_name, count=len(symbols))
            return symbols
        except Exception as e:
            logger.error("Provider failed to get symbols", provider=provider_name, error=str(e))
            return []
    
    @classmethod
    async def health_check(cls) -> Dict[str, Any]:
        """Check health of all data providers."""
        health_status = {
            'coinbase': {'status': 'unknown', 'error': None},
            'finnhub': {'status': 'unknown', 'error': None},
            'cache': {'status': 'unknown', 'error': None}
        }
        
        # Test Coinbase
        try:
            await CoinbaseProvider.get_available_symbols()
            health_status['coinbase']['status'] = 'healthy'
        except Exception as e:
            health_status['coinbase']['status'] = 'unhealthy'
            health_status['coinbase']['error'] = str(e)
        
        # Test Finnhub
        try:
            await FinnhubProvider.get_available_symbols()
            health_status['finnhub']['status'] = 'healthy'
        except Exception as e:
            health_status['finnhub']['status'] = 'unhealthy'
            health_status['finnhub']['error'] = str(e)
        
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