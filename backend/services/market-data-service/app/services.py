"""Core services for Market Data Service."""

import asyncio
import json
import time
from typing import List, Dict, Any, Optional
from decimal import Decimal
from datetime import datetime

import redis.asyncio as redis
import structlog
from aiokafka import AIOKafkaProducer
import websockets

from .config import settings

logger = structlog.get_logger()


class RedisStreamService:
    """
    Redis Sliding Window Service - The Heart of Our Optimization
    
    Key Innovation: Each symbol gets a Redis stream with automatic TTL cleanup.
    Strategies consume latest N values without worrying about storage.
    """
    
    redis = None
    
    @classmethod
    async def initialize(cls):
        """Initialize Redis connection."""
        cls.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
        await cls.redis.ping()
        logger.info("✅ Redis connected for sliding window service")
    
    @classmethod
    async def close(cls):
        """Close Redis connection."""
        if cls.redis:
            await cls.redis.close()
    
    @classmethod
    async def is_connected(cls) -> bool:
        """Check if Redis is connected."""
        try:
            await cls.redis.ping()
            return True
        except Exception:
            return False
    
    @classmethod
    def _get_stream_key(cls, symbol: str) -> str:
        """Get Redis stream key for symbol."""
        clean_symbol = symbol.replace("/", "").replace("-", "")
        return f"market:{clean_symbol}"
    
    @classmethod
    async def add_price_data(cls, symbol: str, price_data: Dict[str, Any]):
        """
        Add price data to sliding window.
        Automatically maintains window size and TTL.
        """
        stream_key = cls._get_stream_key(symbol)
        
        # Add to stream
        await cls.redis.xadd(stream_key, price_data)
        
        # Trim to maintain sliding window size
        await cls.redis.xtrim(stream_key, maxlen=settings.REDIS_SLIDING_WINDOW_SIZE, approximate=True)
        
        # Set TTL for automatic cleanup
        await cls.redis.expire(stream_key, settings.REDIS_STREAM_TTL)
        
        logger.debug("Added price data", symbol=symbol, price=price_data.get("price"))
    
    @classmethod
    async def get_latest_prices(cls, symbol: str, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get latest N prices from sliding window.
        This is what strategies will call - instant access to recent data.
        """
        stream_key = cls._get_stream_key(symbol)
        
        # Get latest entries from stream (XREVRANGE for newest first)
        entries = await cls.redis.xrevrange(stream_key, count=limit)
        
        prices = []
        for entry_id, fields in entries:
            price_data = {
                "timestamp": int(float(fields.get("timestamp", 0))),
                "price": float(fields.get("price", 0)),
                "volume": float(fields.get("volume", 0)),
                "bid": float(fields.get("bid", 0)) if fields.get("bid") else None,
                "ask": float(fields.get("ask", 0)) if fields.get("ask") else None,
                "stream_id": entry_id
            }
            prices.append(price_data)
        
        return prices
    
    @classmethod
    async def get_stream_info(cls, symbol: str) -> Dict[str, Any]:
        """Get information about a symbol's stream."""
        stream_key = cls._get_stream_key(symbol)
        
        try:
            info = await cls.redis.xinfo_stream(stream_key)
            return {
                "length": info["length"],
                "first_entry": info["first-entry"] if info["first-entry"] else None,
                "last_entry": info["last-entry"] if info["last-entry"] else None,
                "window_size": settings.REDIS_SLIDING_WINDOW_SIZE,
                "ttl": await cls.redis.ttl(stream_key)
            }
        except Exception as e:
            raise Exception(f"Stream not found for {symbol}")
    
    @classmethod
    async def cleanup_stream(cls, symbol: str):
        """Clean up stream for symbol."""
        stream_key = cls._get_stream_key(symbol)
        await cls.redis.delete(stream_key)
        logger.info("Cleaned up stream", symbol=symbol, stream_key=stream_key)
    
    @classmethod
    async def get_memory_usage(cls) -> Dict[str, Any]:
        """Get Redis memory usage information."""
        info = await cls.redis.info("memory")
        return {
            "used_memory": info.get("used_memory", 0),
            "used_memory_human": info.get("used_memory_human", "0B"),
            "used_memory_peak": info.get("used_memory_peak", 0),
            "used_memory_peak_human": info.get("used_memory_peak_human", "0B")
        }
    
    @classmethod
    async def get_total_messages(cls) -> int:
        """Get total messages processed across all streams."""
        # Get all market streams
        keys = await cls.redis.keys("market:*")
        total = 0
        
        for key in keys:
            try:
                info = await cls.redis.xinfo_stream(key)
                total += info["length"]
            except Exception:
                continue
        
        return total
    
    @classmethod
    async def cache_symbols(cls, symbols: List[Dict[str, Any]]):
        """Cache available symbols."""
        await cls.redis.setex(
            "symbols:cache", 
            settings.SYMBOL_CACHE_TTL, 
            json.dumps(symbols, default=str)
        )
    
    @classmethod
    async def get_cached_symbols(cls) -> Optional[List[Dict[str, Any]]]:
        """Get cached symbols."""
        cached = await cls.redis.get("symbols:cache")
        if cached:
            return json.loads(cached)
        return None


class KafkaService:
    """Kafka service for publishing market data events."""
    
    producer = None
    
    @classmethod
    async def initialize(cls):
        """Initialize Kafka producer."""
        cls.producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v, default=str).encode()
        )
        await cls.producer.start()
        logger.info("✅ Kafka producer connected")
    
    @classmethod
    async def close(cls):
        """Close Kafka producer."""
        if cls.producer:
            await cls.producer.stop()
    
    @classmethod
    async def is_connected(cls) -> bool:
        """Check if Kafka is connected."""
        return cls.producer is not None and not cls.producer._closed
    
    @classmethod
    async def publish_price_update(cls, symbol: str, price_data: Dict[str, Any]):
        """Publish price update to Kafka."""
        message = {
            "type": "price_update",
            "symbol": symbol,
            "data": price_data,
            "timestamp": time.time()
        }
        
        await cls.producer.send(settings.KAFKA_MARKET_DATA_TOPIC, message)
        logger.debug("Published price update to Kafka", symbol=symbol)


class CoinbaseWebSocketService:
    """
    Enhanced Coinbase WebSocket service for real-time price feeds.
    Feeds data into Redis sliding windows with robust error handling.
    """
    
    active_subscriptions = set()
    websocket = None
    running = False
    connection_count = 0
    last_message_time = None
    reconnect_attempts = 0
    max_reconnect_attempts = 10
    
    @classmethod
    async def start_feeds(cls):
        """Start WebSocket connection and feed processing with enhanced error handling."""
        cls.running = True
        cls.reconnect_attempts = 0
        
        while cls.running and cls.reconnect_attempts < cls.max_reconnect_attempts:
            try:
                await cls._connect_and_process()
                cls.reconnect_attempts = 0  # Reset on successful connection
            except Exception as e:
                cls.reconnect_attempts += 1
                delay = min(2 ** cls.reconnect_attempts, 60)  # Exponential backoff, max 60 seconds
                
                logger.error("WebSocket connection failed", 
                           error=str(e), 
                           attempt=cls.reconnect_attempts,
                           max_attempts=cls.max_reconnect_attempts,
                           retry_delay=delay)
                
                if cls.running and cls.reconnect_attempts < cls.max_reconnect_attempts:
                    await asyncio.sleep(delay)
        
        if cls.reconnect_attempts >= cls.max_reconnect_attempts:
            logger.error("Max reconnection attempts reached, stopping WebSocket service")
            cls.running = False
    
    @classmethod
    async def stop_feeds(cls):
        """Stop WebSocket feeds."""
        cls.running = False
        if cls.websocket:
            await cls.websocket.close()
    
    @classmethod
    async def _connect_and_process(cls):
        """Connect to Coinbase WebSocket and process messages with enhanced error handling."""
        try:
            # Add connection timeout and headers
            connect_timeout = 10  # 10 second connection timeout
            
            async with websockets.connect(
                settings.COINBASE_WS_URL,
                timeout=connect_timeout,
                ping_interval=20,  # Send ping every 20 seconds
                ping_timeout=10,   # Wait 10 seconds for pong
                close_timeout=10   # Wait 10 seconds for close
            ) as websocket:
                cls.websocket = websocket
                cls.connection_count += 1
                cls.last_message_time = time.time()
                
                logger.info("Connected to Coinbase WebSocket", 
                           connection_count=cls.connection_count,
                           active_subscriptions=len(cls.active_subscriptions))
                
                # Subscribe to active symbols
                if cls.active_subscriptions:
                    await cls._send_subscription()
                
                # Start heartbeat monitoring
                heartbeat_task = asyncio.create_task(cls._monitor_heartbeat())
                
                try:
                    # Process incoming messages
                    async for message in websocket:
                        try:
                            cls.last_message_time = time.time()
                            data = json.loads(message)
                            await cls._process_message(data)
                        except json.JSONDecodeError as e:
                            logger.warning("Invalid JSON received", message=message[:100], error=str(e))
                        except Exception as e:
                            logger.error("Message processing failed", error=str(e))
                finally:
                    heartbeat_task.cancel()
                    try:
                        await heartbeat_task
                    except asyncio.CancelledError:
                        pass
                        
        except websockets.exceptions.ConnectionClosed as e:
            logger.warning("WebSocket connection closed", code=e.code, reason=e.reason)
            raise
        except asyncio.TimeoutError:
            logger.error("WebSocket connection timeout")
            raise
        except Exception as e:
            logger.error("WebSocket connection error", error=str(e))
            raise
    
    @classmethod
    async def _send_subscription(cls):
        """Send subscription message for active symbols."""
        if not cls.active_subscriptions:
            return
        
        # Convert symbols to Coinbase format
        product_ids = [symbol.replace("/", "-") for symbol in cls.active_subscriptions]
        
        subscription = {
            "type": "subscribe",
            "channels": [
                {"name": "ticker", "product_ids": product_ids}
            ]
        }
        
        await cls.websocket.send(json.dumps(subscription))
        logger.info("Sent subscription", symbols=list(cls.active_subscriptions))
    
    @classmethod
    async def _monitor_heartbeat(cls):
        """Monitor WebSocket connection health."""
        try:
            while cls.running and cls.websocket:
                current_time = time.time()
                
                # Check if we've received messages recently
                if cls.last_message_time and (current_time - cls.last_message_time) > 60:
                    logger.warning("No messages received for 60 seconds, connection may be stale")
                    # Close connection to trigger reconnection
                    if cls.websocket:
                        await cls.websocket.close()
                    break
                
                await asyncio.sleep(30)  # Check every 30 seconds
                
        except asyncio.CancelledError:
            logger.debug("Heartbeat monitor cancelled")
            raise
        except Exception as e:
            logger.error("Heartbeat monitor error", error=str(e))
    
    @classmethod
    async def _process_message(cls, data: Dict[str, Any]):
        """Process incoming WebSocket message with enhanced validation."""
        try:
            message_type = data.get("type")
            
            if message_type == "ticker":
                symbol = data.get("product_id", "").replace("-", "/")
                
                # Validate required fields
                if not symbol or not data.get("price"):
                    logger.warning("Invalid ticker data", data=data)
                    return
                
                # Validate price is numeric
                try:
                    price = float(data.get("price", 0))
                    if price <= 0:
                        logger.warning("Invalid price value", symbol=symbol, price=price)
                        return
                except (ValueError, TypeError):
                    logger.warning("Non-numeric price", symbol=symbol, price=data.get("price"))
                    return
                
                price_data = {
                    "timestamp": str(int(time.time())),
                    "price": str(price),
                    "volume": str(data.get("volume_24h", 0)),
                    "bid": str(data.get("best_bid", 0)),
                    "ask": str(data.get("best_ask", 0)),
                    "high_24h": str(data.get("high_24h", 0)),
                    "low_24h": str(data.get("low_24h", 0))
                }
                
                # Add to Redis sliding window
                await RedisStreamService.add_price_data(symbol, price_data)
                
                # Publish to Kafka
                await KafkaService.publish_price_update(symbol, price_data)
                
                logger.debug("Processed ticker update", symbol=symbol, price=price)
                
            elif message_type == "subscriptions":
                logger.info("Subscription confirmation", channels=data.get("channels", []))
                
            elif message_type == "error":
                logger.error("WebSocket error message", error=data.get("message"), reason=data.get("reason"))
                
            else:
                logger.debug("Unhandled message type", type=message_type, data=data)
                
        except Exception as e:
            logger.error("Message processing error", error=str(e), data=data)
    
    @classmethod
    async def subscribe_symbol(cls, symbol: str) -> bool:
        """Subscribe to a symbol."""
        try:
            cls.active_subscriptions.add(symbol)
            
            # If connected, send subscription update
            if cls.websocket and not cls.websocket.closed:
                await cls._send_subscription()
            
            logger.info("Added subscription", symbol=symbol)
            return True
            
        except Exception as e:
            logger.error("Subscription failed", symbol=symbol, error=str(e))
            return False
    
    @classmethod
    async def unsubscribe_symbol(cls, symbol: str) -> bool:
        """Unsubscribe from a symbol."""
        try:
            if symbol in cls.active_subscriptions:
                cls.active_subscriptions.remove(symbol)
                
                # Send unsubscribe message
                if cls.websocket and not cls.websocket.closed:
                    unsubscribe = {
                        "type": "unsubscribe",
                        "channels": [
                            {"name": "ticker", "product_ids": [symbol.replace("/", "-")]}
                        ]
                    }
                    await cls.websocket.send(json.dumps(unsubscribe))
                
                logger.info("Removed subscription", symbol=symbol)
                return True
            
            return False
            
        except Exception as e:
            logger.error("Unsubscription failed", symbol=symbol, error=str(e))
            return False