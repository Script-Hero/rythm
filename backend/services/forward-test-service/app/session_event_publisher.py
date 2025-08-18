"""
Session Event Publisher for Forward Testing.
Handles real-time WebSocket events, chart data collection, and portfolio updates.
Migrated and enhanced from Beta1's session event publishing functionality.
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any, Tuple
from uuid import UUID
from dataclasses import dataclass, asdict
from collections import defaultdict, deque

import structlog
import redis.asyncio as redis
from contextlib import asynccontextmanager

from .config import settings

# Add shared models to path
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../..'))

from shared.models.forward_test_models import SessionStatus
from shared.kafka_client import KafkaProducer, Topics

logger = structlog.get_logger()


@dataclass
class ChartDataPoint:
    """Chart data point for session visualization."""
    timestamp: float
    price: float
    portfolio_value: float
    pnl: float
    pnl_percent: float
    position_size: float = 0.0
    cash_balance: float = 0.0
    trade_count: int = 0


@dataclass
class SessionEvent:
    """Session event for WebSocket broadcasting."""
    event_type: str
    session_id: UUID
    user_id: UUID
    data: Dict[str, Any]
    timestamp: float


class SessionEventPublisher:
    """
    Enhanced session event publisher migrated from Beta1.
    Handles real-time WebSocket events, chart data collection, and portfolio updates.
    """
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.kafka_producer: Optional[KafkaProducer] = None
        self.chart_data_cache: Dict[UUID, deque] = defaultdict(lambda: deque(maxlen=10000))
        self.session_subscribers: Dict[UUID, set] = defaultdict(set)
        self._shutdown_event = asyncio.Event()
    
    async def initialize(self):
        """Initialize the session event publisher."""
        self.redis_client = redis.Redis.from_url(settings.REDIS_URL)
        await self.redis_client.ping()
        
        # Initialize Kafka producer for events
        self.kafka_producer = KafkaProducer(settings.KAFKA_BOOTSTRAP_SERVERS)
        await self.kafka_producer.start()
        
        logger.info("Session event publisher initialized")
    
    async def shutdown(self):
        """Shutdown the event publisher."""
        self._shutdown_event.set()
        
        # Close connections
        if self.kafka_producer:
            await self.kafka_producer.stop()
        
        if self.redis_client:
            await self.redis_client.close()
        
        # Clear caches
        self.chart_data_cache.clear()
        self.session_subscribers.clear()
        
        logger.info("Session event publisher shutdown complete")
    
    async def publish_session_event(
        self,
        event_type: str,
        session_id: UUID,
        user_id: UUID,
        data: Dict[str, Any]
    ):
        """Publish a session event for WebSocket broadcasting."""
        try:
            event = SessionEvent(
                event_type=event_type,
                session_id=session_id,
                user_id=user_id,
                data=data,
                timestamp=time.time()
            )
            
            # Store in Redis for immediate WebSocket access
            event_key = f"session_events:{session_id}:latest"
            await self.redis_client.setex(
                event_key,
                300,  # 5 minute TTL
                json.dumps(asdict(event), default=str)
            )
            
            # Add to session event stream for historical access
            stream_key = f"session_events:{session_id}"
            await self.redis_client.xadd(stream_key, asdict(event))
            
            # Trim stream to keep only recent events
            await self.redis_client.xtrim(stream_key, maxlen=1000, approximate=True)
            await self.redis_client.expire(stream_key, 86400)  # 24 hour TTL
            
            # Publish to Kafka for other services
            if self.kafka_producer:
                await self.kafka_producer.send_message(
                    topic=Topics.REALTIME_UPDATES,
                    message={
                        "event_type": event_type,
                        "session_id": str(session_id),
                        "user_id": str(user_id),
                        "data": data,
                        "timestamp": event.timestamp
                    },
                    key=str(session_id)
                )
            
            logger.debug("Session event published", 
                        event_type=event_type, session_id=session_id)
            
        except Exception as e:
            logger.error("Failed to publish session event", 
                        event_type=event_type, session_id=session_id, error=str(e))
    
    async def add_chart_data_point(
        self,
        session_id: UUID,
        user_id: UUID,
        price: float,
        portfolio_value: float,
        pnl: float,
        pnl_percent: float,
        position_size: float = 0.0,
        cash_balance: float = 0.0,
        trade_count: int = 0
    ):
        """Add a chart data point and publish update."""
        try:
            timestamp = time.time()
            
            chart_point = ChartDataPoint(
                timestamp=timestamp,
                price=price,
                portfolio_value=portfolio_value,
                pnl=pnl,
                pnl_percent=pnl_percent,
                position_size=position_size,
                cash_balance=cash_balance,
                trade_count=trade_count
            )
            
            # Add to in-memory cache
            self.chart_data_cache[session_id].append(chart_point)
            
            # Store in Redis for persistence
            chart_key = f"chart_data:{session_id}"
            await self.redis_client.zadd(
                chart_key,
                {json.dumps(asdict(chart_point), default=str): timestamp}
            )
            
            # Keep only recent data points
            cutoff_time = timestamp - (24 * 3600)  # 24 hours
            await self.redis_client.zremrangebyscore(chart_key, 0, cutoff_time)
            await self.redis_client.expire(chart_key, 86400)  # 24 hour TTL
            
            # Publish chart update event
            await self.publish_session_event(
                event_type="CHART_DATA_UPDATE",
                session_id=session_id,
                user_id=user_id,
                data={
                    "chart_point": asdict(chart_point),
                    "total_points": len(self.chart_data_cache[session_id])
                }
            )
            
            logger.debug("Chart data point added", 
                        session_id=session_id, price=price, pnl=pnl_percent)
            
        except Exception as e:
            logger.error("Failed to add chart data point", 
                        session_id=session_id, error=str(e))
    
    async def publish_portfolio_update(
        self,
        session_id: UUID,
        user_id: UUID,
        portfolio_data: Dict[str, Any]
    ):
        """Publish portfolio update event."""
        await self.publish_session_event(
            event_type="PORTFOLIO_UPDATE",
            session_id=session_id,
            user_id=user_id,
            data=portfolio_data
        )
    
    async def publish_trade_executed(
        self,
        session_id: UUID,
        user_id: UUID,
        trade_data: Dict[str, Any]
    ):
        """Publish trade execution event."""
        await self.publish_session_event(
            event_type="TRADE_EXECUTED",
            session_id=session_id,
            user_id=user_id,
            data=trade_data
        )
    
    async def publish_price_update(
        self,
        session_id: UUID,
        user_id: UUID,
        symbol: str,
        price: float,
        volume: float = 0.0
    ):
        """Publish price update event."""
        await self.publish_session_event(
            event_type="PRICE_UPDATE",
            session_id=session_id,
            user_id=user_id,
            data={
                "symbol": symbol,
                "price": price,
                "volume": volume,
                "timestamp": time.time()
            }
        )
    
    async def publish_session_status_change(
        self,
        session_id: UUID,
        user_id: UUID,
        old_status: SessionStatus,
        new_status: SessionStatus,
        reason: Optional[str] = None
    ):
        """Publish session status change event."""
        await self.publish_session_event(
            event_type="SESSION_STATUS_CHANGE",
            session_id=session_id,
            user_id=user_id,
            data={
                "old_status": old_status.value,
                "new_status": new_status.value,
                "reason": reason,
                "timestamp": time.time()
            }
        )
    
    async def get_recent_chart_data(
        self,
        session_id: UUID,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """Get recent chart data for a session."""
        try:
            # First try in-memory cache
            if session_id in self.chart_data_cache:
                cache_data = list(self.chart_data_cache[session_id])
                if cache_data:
                    # Return most recent points
                    recent_data = cache_data[-limit:] if len(cache_data) > limit else cache_data
                    return [asdict(point) for point in recent_data]
            
            # Fallback to Redis
            chart_key = f"chart_data:{session_id}"
            
            # Get recent data points (newest first)
            data_points = await self.redis_client.zrevrange(
                chart_key, 0, limit - 1, withscores=True
            )
            
            chart_data = []
            for data_json, timestamp in data_points:
                try:
                    data_point = json.loads(data_json)
                    chart_data.append(data_point)
                except json.JSONDecodeError:
                    continue
            
            # Reverse to get chronological order
            chart_data.reverse()
            
            return chart_data
            
        except Exception as e:
            logger.error("Failed to get chart data", session_id=session_id, error=str(e))
            return []
    
    async def restore_session_chart_data(
        self,
        session_id: UUID,
        user_id: UUID
    ) -> Tuple[bool, List[Dict[str, Any]]]:
        """Restore chart data for a session and publish restoration event."""
        try:
            chart_data = await self.get_recent_chart_data(session_id)
            
            # Reload into cache
            if chart_data:
                cache_points = []
                for point_data in chart_data:
                    try:
                        cache_points.append(ChartDataPoint(**point_data))
                    except TypeError:
                        # Skip invalid data points
                        continue
                
                self.chart_data_cache[session_id] = deque(cache_points, maxlen=10000)
            
            # Publish restoration event
            await self.publish_session_event(
                event_type="CHART_DATA_RESTORED",
                session_id=session_id,
                user_id=user_id,
                data={
                    "chart_data": chart_data,
                    "point_count": len(chart_data),
                    "restored_at": time.time()
                }
            )
            
            logger.info("Chart data restored", 
                       session_id=session_id, point_count=len(chart_data))
            
            return True, chart_data
            
        except Exception as e:
            logger.error("Failed to restore chart data", 
                        session_id=session_id, error=str(e))
            return False, []
    
    async def get_session_events(
        self,
        session_id: UUID,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get recent events for a session."""
        try:
            stream_key = f"session_events:{session_id}"
            
            # Get recent events from stream
            events = await self.redis_client.xrevrange(stream_key, count=limit)
            
            event_list = []
            for event_id, fields in events:
                try:
                    # Convert fields dict to event data
                    event_data = {}
                    for key, value in fields.items():
                        if isinstance(key, bytes):
                            key = key.decode('utf-8')
                        if isinstance(value, bytes):
                            value = value.decode('utf-8')
                        
                        # Try to parse JSON values
                        if key == 'data':
                            try:
                                event_data[key] = json.loads(value)
                            except json.JSONDecodeError:
                                event_data[key] = value
                        else:
                            event_data[key] = value
                    
                    event_data['event_id'] = event_id if isinstance(event_id, str) else event_id.decode('utf-8')
                    event_list.append(event_data)
                    
                except Exception:
                    continue
            
            # Reverse to get chronological order
            event_list.reverse()
            
            return event_list
            
        except Exception as e:
            logger.error("Failed to get session events", session_id=session_id, error=str(e))
            return []
    
    async def cleanup_session_data(self, session_id: UUID):
        """Clean up session data when session ends."""
        try:
            # Clear in-memory cache
            if session_id in self.chart_data_cache:
                del self.chart_data_cache[session_id]
            
            if session_id in self.session_subscribers:
                del self.session_subscribers[session_id]
            
            # Clean up Redis data (with delay to allow final access)
            async def delayed_cleanup():
                await asyncio.sleep(300)  # 5 minutes
                
                keys_to_delete = [
                    f"session_events:{session_id}:latest",
                    f"session_events:{session_id}",
                    f"chart_data:{session_id}"
                ]
                
                for key in keys_to_delete:
                    await self.redis_client.delete(key)
                
                logger.info("Session data cleaned up", session_id=session_id)
            
            asyncio.create_task(delayed_cleanup())
            
        except Exception as e:
            logger.error("Failed to cleanup session data", session_id=session_id, error=str(e))
    
    async def add_session_subscriber(self, session_id: UUID, subscriber_id: str):
        """Add a subscriber to session events."""
        self.session_subscribers[session_id].add(subscriber_id)
        logger.debug("Added session subscriber", session_id=session_id, subscriber=subscriber_id)
    
    async def remove_session_subscriber(self, session_id: UUID, subscriber_id: str):
        """Remove a subscriber from session events."""
        if session_id in self.session_subscribers:
            self.session_subscribers[session_id].discard(subscriber_id)
            
            # Clean up empty subscriber sets
            if not self.session_subscribers[session_id]:
                del self.session_subscribers[session_id]
        
        logger.debug("Removed session subscriber", session_id=session_id, subscriber=subscriber_id)
    
    async def get_session_subscriber_count(self, session_id: UUID) -> int:
        """Get number of subscribers for a session."""
        return len(self.session_subscribers.get(session_id, set()))


# Global instance
session_event_publisher = SessionEventPublisher()