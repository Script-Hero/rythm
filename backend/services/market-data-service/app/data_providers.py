"""Data providers for market data service."""

import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from decimal import Decimal

import httpx
import ccxt.async_support as ccxt
import pandas as pd
import structlog

from .config import settings

logger = structlog.get_logger()


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
        """Get historical OHLCV data."""
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
            
            # Set default date range if not provided
            if not start_date:
                start_date = datetime.utcnow() - pd.Timedelta(days=30)
            if not end_date:
                end_date = datetime.utcnow()
            
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
    """Manager for coordinating multiple data providers."""
    
    @classmethod
    async def get_best_provider_for_symbol(cls, symbol: str) -> str:
        """Determine the best data provider for a symbol."""
        if '/' in symbol and any(crypto in symbol.upper() for crypto in ['BTC', 'ETH', 'LTC', 'ADA']):
            return 'coinbase'
        elif '/USD' in symbol:
            return 'finnhub'
        else:
            return 'coinbase'  # Default
    
    @classmethod
    async def get_current_price_unified(cls, symbol: str) -> Dict[str, Any]:
        """Get current price using the best provider."""
        provider = await cls.get_best_provider_for_symbol(symbol)
        
        if provider == 'coinbase':
            return await CoinbaseProvider.get_current_price(symbol)
        elif provider == 'finnhub':
            return await FinnhubProvider.get_current_price(symbol)
        else:
            raise Exception(f"No provider available for {symbol}")
    
    @classmethod
    async def get_all_symbols(cls) -> List[Dict[str, Any]]:
        """Get symbols from all providers."""
        tasks = [
            CoinbaseProvider.get_available_symbols(),
            FinnhubProvider.get_available_symbols()
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        all_symbols = []
        for result in results:
            if isinstance(result, list):
                all_symbols.extend(result)
            else:
                logger.error("Provider failed", error=str(result))
        
        return all_symbols