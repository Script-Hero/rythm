"""
Kafka event processor for Analytics Service.
Handles trade executions, portfolio updates, and forward test events.
"""

import asyncio
import json
from typing import Dict, Any, Optional
from datetime import datetime
from decimal import Decimal

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .database import get_db_session
from .analytics_engine import AnalyticsEngine
from .cache_manager import CacheManager

# Import shared Kafka utilities
import sys
import os
sys.path.append('/app/shared')

from kafka_client.consumer import KafkaConsumer
from kafka_client.topics import Topics

logger = structlog.get_logger()


class AnalyticsKafkaProcessor:
    """Kafka event processor for analytics calculations."""
    
    def __init__(self):
        self.consumer: Optional[KafkaConsumer] = None
        self.analytics_engine = AnalyticsEngine()
        self.cache_manager = CacheManager()
        self._running = False
        
        # Topics to subscribe to
        self.topics = [
            Topics.TRADE_EXECUTIONS,
            Topics.PORTFOLIO_UPDATES,
            Topics.FORWARD_TEST_EVENTS
        ]
    
    async def start(self):
        """Start Kafka consumer and message processing."""
        try:
            # Initialize consumer
            self.consumer = KafkaConsumer(
                topics=self.topics,
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                group_id=settings.KAFKA_GROUP_ID,
                auto_offset_reset="latest"
            )
            
            # Register message handlers
            self.consumer.add_message_handler(Topics.TRADE_EXECUTIONS, self._handle_trade_execution)
            self.consumer.add_message_handler(Topics.PORTFOLIO_UPDATES, self._handle_portfolio_update)
            self.consumer.add_message_handler(Topics.FORWARD_TEST_EVENTS, self._handle_forward_test_event)
            
            # Start consumer
            await self.consumer.start()
            self._running = True
            
            logger.info("Analytics Kafka processor started", topics=self.topics)
            
            # Start consumption loop
            await self.consumer.start_consuming()
            
        except Exception as e:
            logger.error("Failed to start Kafka processor", error=str(e))
            raise
    
    async def stop(self):
        """Stop Kafka consumer."""
        self._running = False
        if self.consumer:
            await self.consumer.stop()
            logger.info("Analytics Kafka processor stopped")
    
    async def _handle_trade_execution(self, message: Dict[str, Any], key: str):
        """
        Handle trade execution events to update analytics.
        
        Expected message format:
        {
            "trade_id": "uuid",
            "session_id": "ft_123456",
            "symbol": "BTCUSD",
            "side": "BUY",
            "quantity": 0.1,
            "price": 50000.0,
            "fees": 5.0,
            "pnl": null,
            "execution_time": "2024-01-01T12:00:00Z",
            "status": "FILLED"
        }
        """
        try:
            session_id = message.get("session_id")
            if not session_id:
                logger.warning("Trade execution missing session_id", message=message)
                return
            
            logger.info("Processing trade execution", session_id=session_id, trade_id=message.get("trade_id"))
            
            async with get_db_session() as db:
                # Update session trade count and metrics
                await self._update_session_trade_metrics(db, session_id, message)
                
                # Recalculate live analytics for this session
                analytics = await self.analytics_engine.calculate_live_analytics(db, session_id)
                
                # Cache updated analytics
                if analytics:
                    await self.cache_manager.set_live_analytics(session_id, analytics)
                    logger.info("Updated live analytics for trade", session_id=session_id)
        
        except Exception as e:
            logger.error("Failed to process trade execution", error=str(e), message=message)
    
    async def _handle_portfolio_update(self, message: Dict[str, Any], key: str):
        """
        Handle portfolio updates to recalculate performance metrics.
        
        Expected message format:
        {
            "session_id": "ft_123456",
            "total_value": 105000.0,
            "cash_balance": 95000.0,
            "positions": [
                {
                    "symbol": "BTCUSD",
                    "quantity": 0.1,
                    "market_value": 5000.0,
                    "unrealized_pnl": 500.0
                }
            ],
            "timestamp": "2024-01-01T12:00:00Z"
        }
        """
        try:
            session_id = message.get("session_id")
            if not session_id:
                logger.warning("Portfolio update missing session_id", message=message)
                return
            
            logger.debug("Processing portfolio update", session_id=session_id)
            
            async with get_db_session() as db:
                # Store portfolio value for drawdown calculations
                await self._store_portfolio_value(db, session_id, message)
                
                # Recalculate live analytics
                analytics = await self.analytics_engine.calculate_live_analytics(db, session_id)
                
                # Cache updated analytics
                if analytics:
                    await self.cache_manager.set_live_analytics(session_id, analytics)
        
        except Exception as e:
            logger.error("Failed to process portfolio update", error=str(e), message=message)
    
    async def _handle_forward_test_event(self, message: Dict[str, Any], key: str):
        """
        Handle forward test session events (start/stop/pause).
        
        Expected message format:
        {
            "session_id": "ft_123456",
            "event_type": "session_started",
            "timestamp": "2024-01-01T12:00:00Z",
            "data": {...}
        }
        """
        try:
            session_id = message.get("session_id")
            event_type = message.get("event_type")
            
            if not session_id or not event_type:
                logger.warning("Forward test event missing required fields", message=message)
                return
            
            logger.info("Processing forward test event", 
                       session_id=session_id, event_type=event_type)
            
            if event_type == "session_started":
                # Initialize analytics for new session
                async with get_db_session() as db:
                    await self._initialize_session_analytics(db, session_id)
            
            elif event_type == "session_stopped":
                # Finalize analytics for stopped session
                async with get_db_session() as db:
                    analytics = await self.analytics_engine.calculate_final_analytics(db, session_id)
                    if analytics:
                        await self.cache_manager.set_final_analytics(session_id, analytics)
            
        except Exception as e:
            logger.error("Failed to process forward test event", error=str(e), message=message)
    
    async def _update_session_trade_metrics(self, db: AsyncSession, session_id: str, trade_message: Dict[str, Any]):
        """Update basic trade metrics for a session."""
        from sqlalchemy import update, select
        from .models import ForwardTestSession
        
        try:
            # Get current session
            result = await db.execute(
                select(ForwardTestSession).where(ForwardTestSession.session_id == session_id)
            )
            session = result.scalar_one_or_none()
            
            if not session:
                logger.warning("Session not found for trade update", session_id=session_id)
                return
            
            # Update trade count
            new_trade_count = session.trade_count + 1
            
            # Calculate basic win rate if PnL is available
            pnl = trade_message.get("pnl")
            if pnl is not None:
                pnl_decimal = Decimal(str(pnl))
                if pnl_decimal > 0:
                    # This is a winning trade
                    total_winning = int(session.win_rate * session.trade_count / 100) + 1
                    new_win_rate = (total_winning / new_trade_count) * 100
                else:
                    # Losing or break-even trade
                    total_winning = int(session.win_rate * session.trade_count / 100)
                    new_win_rate = (total_winning / new_trade_count) * 100
            else:
                new_win_rate = session.win_rate
            
            # Update session
            await db.execute(
                update(ForwardTestSession)
                .where(ForwardTestSession.session_id == session_id)
                .values(
                    trade_count=new_trade_count,
                    win_rate=new_win_rate,
                    updated_at=datetime.utcnow()
                )
            )
            
            logger.debug("Updated session trade metrics", 
                        session_id=session_id, 
                        trade_count=new_trade_count,
                        win_rate=new_win_rate)
        
        except Exception as e:
            logger.error("Failed to update session trade metrics", error=str(e))
    
    async def _store_portfolio_value(self, db: AsyncSession, session_id: str, portfolio_message: Dict[str, Any]):
        """Store portfolio value for time series analysis."""
        from .models import ChartData
        from datetime import datetime
        
        try:
            total_value = portfolio_message.get("total_value")
            timestamp_str = portfolio_message.get("timestamp")
            
            if not total_value or not timestamp_str:
                return
            
            # Parse timestamp
            timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            
            # Store portfolio value
            chart_data = ChartData(
                session_id=session_id,
                data_type="portfolio",
                timestamp=int(timestamp.timestamp()),
                value=Decimal(str(total_value)),
                metadata={"cash_balance": portfolio_message.get("cash_balance")}
            )
            
            db.add(chart_data)
            await db.flush()
            
        except Exception as e:
            logger.error("Failed to store portfolio value", error=str(e))
    
    async def _initialize_session_analytics(self, db: AsyncSession, session_id: str):
        """Initialize analytics for a new session."""
        try:
            # Create initial performance snapshot
            from .models import PerformanceSnapshot
            
            snapshot = PerformanceSnapshot(
                session_id=session_id,
                snapshot_type="live",
                total_return=Decimal("0"),
                total_trades=0,
                winning_trades=0,
                losing_trades=0,
                win_rate=Decimal("0"),
                max_drawdown=Decimal("0"),
                data_through=datetime.utcnow()
            )
            
            db.add(snapshot)
            await db.flush()
            
            logger.info("Initialized session analytics", session_id=session_id)
        
        except Exception as e:
            logger.error("Failed to initialize session analytics", error=str(e))
    
    @property
    def is_running(self) -> bool:
        """Check if processor is running."""
        return self._running