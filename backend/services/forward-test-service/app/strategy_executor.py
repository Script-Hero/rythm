"""
Strategy Execution Service for Forward Testing.
Enhanced background execution engine migrated from Beta1's strategy execution logic.
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any, Tuple
from uuid import UUID
from dataclasses import dataclass, asdict

import structlog
import redis.asyncio as redis
from contextlib import asynccontextmanager

from .config import settings
from .services import DatabaseService, MarketDataService
from .portfolio_manager import portfolio_manager
from .session_event_publisher import session_event_publisher

# Add shared models to path
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../..'))

from shared.models.forward_test_models import SessionStatus
from shared.strategy_engine.compiler import CompiledStrategy
from shared.kafka_client import KafkaProducer, Topics

logger = structlog.get_logger()


@dataclass
class StrategyExecutionContext:
    """Context for strategy execution."""
    session_id: UUID
    user_id: UUID
    symbol: str
    compiled_strategy: CompiledStrategy
    last_execution: Optional[datetime] = None
    execution_count: int = 0
    error_count: int = 0
    max_errors: int = 10
    is_active: bool = True


class StrategyExecutionService:
    """
    Enhanced strategy execution service migrated from Beta1.
    Manages background strategy execution with sophisticated error handling and monitoring.
    """
    
    def __init__(self):
        self.execution_contexts: Dict[UUID, StrategyExecutionContext] = {}
        self.execution_tasks: Dict[UUID, asyncio.Task] = {}
        self.redis_client: Optional[redis.Redis] = None
        self.kafka_producer: Optional[KafkaProducer] = None
        self._shutdown_event = asyncio.Event()
    
    async def initialize(self):
        """Initialize the strategy execution service."""
        self.redis_client = redis.Redis.from_url(settings.REDIS_URL)
        await self.redis_client.ping()
        
        # Initialize Kafka producer for strategy signals
        self.kafka_producer = KafkaProducer(settings.KAFKA_BOOTSTRAP_SERVERS)
        await self.kafka_producer.start()
        
        # Initialize portfolio manager
        await portfolio_manager.initialize()
        
        # Initialize session event publisher
        await session_event_publisher.initialize()
        
        logger.info("Strategy execution service initialized")
    
    async def shutdown(self):
        """Shutdown the execution service."""
        self._shutdown_event.set()
        
        # Cancel all running tasks
        for task in self.execution_tasks.values():
            task.cancel()
        
        # Wait for tasks to complete
        if self.execution_tasks:
            await asyncio.gather(*self.execution_tasks.values(), return_exceptions=True)
        
        # Shutdown subsystems
        await portfolio_manager.shutdown()
        await session_event_publisher.shutdown()
        
        # Close connections
        if self.kafka_producer:
            await self.kafka_producer.stop()
        
        if self.redis_client:
            await self.redis_client.close()
        
        logger.info("Strategy execution service shutdown complete")
    
    async def start_strategy_execution(
        self,
        session_id: UUID,
        user_id: UUID,
        symbol: str,
        compiled_strategy: CompiledStrategy,
        initial_capital: float = 100000.0
    ) -> Tuple[bool, Optional[str]]:
        """Start strategy execution for a session."""
        try:
            # Create execution context
            context = StrategyExecutionContext(
                session_id=session_id,
                user_id=user_id,
                symbol=symbol,
                compiled_strategy=compiled_strategy
            )
            
            self.execution_contexts[session_id] = context
            
            # Create portfolio for this session (store user_id for event routing)
            await portfolio_manager.create_portfolio(session_id, user_id, initial_capital)
            
            # Start execution task
            task = asyncio.create_task(
                self._strategy_execution_loop(context),
                name=f"strategy-execution-{session_id}"
            )
            self.execution_tasks[session_id] = task
            
            logger.info("Strategy execution started", session_id=session_id, symbol=symbol)
            return True, None
            
        except Exception as e:
            error_msg = f"Failed to start strategy execution: {str(e)}"
            logger.error("Strategy execution start error", session_id=session_id, error=str(e))
            return False, error_msg
    
    async def stop_strategy_execution(self, session_id: UUID) -> Tuple[bool, Optional[str]]:
        """Stop strategy execution for a session."""
        try:
            # Mark context as inactive
            if session_id in self.execution_contexts:
                self.execution_contexts[session_id].is_active = False
            
            # Cancel execution task
            if session_id in self.execution_tasks:
                task = self.execution_tasks[session_id]
                task.cancel()
                
                try:
                    await task
                except asyncio.CancelledError:
                    pass
                
                del self.execution_tasks[session_id]
            
            # Clean up context
            if session_id in self.execution_contexts:
                del self.execution_contexts[session_id]
            
            # Clean up portfolio and session data
            await portfolio_manager.cleanup_session_data(session_id)
            await session_event_publisher.cleanup_session_data(session_id)
            
            # Clear Redis cache
            if self.redis_client:
                await self.redis_client.delete(f"strategy_execution:{session_id}:*")
            
            logger.info("Strategy execution stopped", session_id=session_id)
            return True, None
            
        except Exception as e:
            error_msg = f"Failed to stop strategy execution: {str(e)}"
            logger.error("Strategy execution stop error", session_id=session_id, error=str(e))
            return False, error_msg
    
    async def get_execution_status(self, session_id: UUID) -> Optional[Dict[str, Any]]:
        """Get execution status for a session."""
        context = self.execution_contexts.get(session_id)
        if not context:
            return None
        
        return {
            "session_id": str(session_id),
            "is_active": context.is_active,
            "last_execution": context.last_execution.isoformat() if context.last_execution else None,
            "execution_count": context.execution_count,
            "error_count": context.error_count,
            "max_errors": context.max_errors
        }
    
    async def _strategy_execution_loop(self, context: StrategyExecutionContext):
        """Main strategy execution loop for a session."""
        session_id = context.session_id
        
        logger.info("Starting strategy execution loop", session_id=session_id)
        
        try:
            while context.is_active and not self._shutdown_event.is_set():
                # Check if session is still running
                session = await DatabaseService.get_session(session_id, context.user_id)
                
                if not session or session.status != SessionStatus.RUNNING:
                    logger.info("Session no longer running, stopping execution", 
                               session_id=session_id)
                    break
                
                # Get latest market data from Redis sliding window
                market_data = await self._get_latest_market_data(context.symbol)
                
                if market_data:
                    # Execute strategy
                    await self._execute_strategy_iteration(context, market_data)
                    
                    # Update execution metrics
                    context.execution_count += 1
                    context.last_execution = datetime.utcnow()
                
                # Wait for next iteration
                await asyncio.sleep(1.0)  # Execute every second
                
        except asyncio.CancelledError:
            logger.info("Strategy execution loop cancelled", session_id=session_id)
            raise
        except Exception as e:
            logger.error("Strategy execution loop error", 
                        session_id=session_id, error=str(e))
            context.error_count += 1
            
            # Stop execution if too many errors
            if context.error_count >= context.max_errors:
                context.is_active = False
                await self._handle_execution_error(
                    session_id, 
                    f"Too many execution errors ({context.error_count}): {str(e)}"
                )
        
        finally:
            logger.info("Strategy execution loop ended", session_id=session_id)
    
    async def _execute_strategy_iteration(
        self, 
        context: StrategyExecutionContext, 
        market_data: Dict[str, Any]
    ):
        """Execute one iteration of strategy logic."""
        session_id = context.session_id
        
        try:
            # Reset strategy state if needed
            if context.execution_count == 0:
                context.compiled_strategy.reset()
            
            # Execute strategy with current market data
            signals = context.compiled_strategy.execute(market_data)
            
            # Process any signals generated
            for signal in signals:
                await self._process_strategy_signal(context, signal, market_data)
            
            # Update strategy state cache
            await self._update_strategy_state_cache(context)
            
        except Exception as e:
            logger.error("Strategy iteration error", 
                        session_id=session_id, error=str(e))
            context.error_count += 1
            raise
    
    async def _process_strategy_signal(
        self, 
        context: StrategyExecutionContext, 
        signal: Dict[str, Any], 
        market_data: Dict[str, Any]
    ):
        """Process a trading signal from strategy execution."""
        session_id = context.session_id
        
        if not signal or signal.get('action') == 'HOLD':
            return
        
        logger.info("Processing strategy signal", 
                   session_id=session_id, signal=signal)
        
        # Execute trade through portfolio manager
        trade = await portfolio_manager.process_strategy_signal(
            session_id=session_id,
            signal=signal,
            market_data=market_data
        )
        
        # Prepare signal data for Kafka
        signal_data = {
            "session_id": str(session_id),
            "user_id": str(context.user_id),
            "symbol": context.symbol,
            "signal": signal,
            "market_data": market_data,
            "trade_executed": trade is not None,
            "trade_id": trade.trade_id if trade else None,
            "timestamp": datetime.utcnow().isoformat(),
            "strategy_state": context.compiled_strategy.get_state_summary()
        }
        
        # Publish signal to Kafka for other services
        if self.kafka_producer:
            await self.kafka_producer.send_message(
                topic=Topics.STRATEGY_SIGNALS.value,
                message=signal_data,
                key=str(session_id)
            )
        
        # Store signal in Redis for immediate access
        if self.redis_client:
            await self.redis_client.setex(
                f"strategy_execution:{session_id}:latest_signal",
                300,  # 5 minute TTL
                json.dumps(signal_data, default=str)
            )
        
        # Publish price update event
        await session_event_publisher.publish_price_update(
            session_id=session_id,
            user_id=context.user_id,
            symbol=context.symbol,
            price=float(market_data.get('price', 0)),
            volume=float(market_data.get('volume', 0))
        )
    
    async def _get_latest_market_data(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get latest market data from Redis sliding window."""
        if not self.redis_client:
            return None
        
        try:
            # Clean symbol format to match Market Data Service key format
            clean_symbol = symbol.replace("/", "").replace("-", "")
            stream_name = f"market:{clean_symbol}"
            
            # Get the most recent entry from stream
            entries = await self.redis_client.xrevrange(stream_name, count=1)
            
            if entries:
                entry_id, fields = entries[0]
                
                # Convert Redis fields to dict (fields is already a dict in python)
                market_data = {}
                for key, value in fields.items():
                    # Decode if bytes
                    if isinstance(key, bytes):
                        key = key.decode('utf-8')
                    if isinstance(value, bytes):
                        value = value.decode('utf-8')
                    
                    # Convert numeric values
                    try:
                        if key in ['price', 'volume', 'bid', 'ask', 'high_24h', 'low_24h']:
                            market_data[key] = float(value) if value else 0.0
                        elif key == 'timestamp':
                            # Convert timestamp to float then to datetime
                            timestamp_float = float(value)
                            market_data[key] = timestamp_float
                            market_data['datetime'] = datetime.fromtimestamp(timestamp_float)
                        else:
                            market_data[key] = value
                    except (ValueError, TypeError):
                        market_data[key] = value
                
                # Add metadata
                market_data['symbol'] = symbol
                market_data['redis_entry_id'] = entry_id if isinstance(entry_id, str) else entry_id.decode('utf-8')
                
                # Ensure we have a price field
                if 'price' not in market_data or market_data['price'] == 0.0:
                    logger.warning("No valid price in market data", symbol=symbol, data=market_data)
                    return None
                
                logger.debug("Retrieved market data from Redis", 
                           symbol=symbol, price=market_data.get('price'))
                return market_data
            else:
                logger.debug("No entries found in Redis stream", symbol=symbol, stream=stream_name)
            
        except Exception as e:
            logger.error("Failed to get market data from Redis", 
                        symbol=symbol, error=str(e))
        
        # Fallback: get from Market Data Service API
        try:
            # Call market data service directly via HTTP
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"http://market-data-service:8001/symbols/{symbol}/latest",
                    params={"limit": 1},
                    timeout=5.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success") and data.get("prices"):
                        latest_price = data["prices"][0]
                        return {
                            "symbol": symbol,
                            "price": latest_price.get("price", 0.0),
                            "volume": latest_price.get("volume", 0.0),
                            "timestamp": latest_price.get("timestamp", time.time()),
                            "datetime": datetime.utcnow(),
                            "source": "market_data_service_api"
                        }
                        
        except Exception as e:
            logger.error("Failed to get market data from API", 
                        symbol=symbol, error=str(e))
        
        # Final fallback: generate mock data for development
        logger.warning("Using mock market data", symbol=symbol)
        return {
            "symbol": symbol,
            "price": 50000.0,  # Mock BTC price
            "volume": 1000.0,
            "timestamp": time.time(),
            "datetime": datetime.utcnow(),
            "source": "mock_data"
        }
    
    async def _update_strategy_state_cache(self, context: StrategyExecutionContext):
        """Update strategy state in Redis cache."""
        if not self.redis_client:
            return
        
        try:
            state_summary = context.compiled_strategy.get_state_summary()
            
            await self.redis_client.setex(
                f"strategy_execution:{context.session_id}:state",
                3600,  # 1 hour TTL
                json.dumps({
                    "state_summary": state_summary,
                    "execution_count": context.execution_count,
                    "last_execution": context.last_execution.isoformat() if context.last_execution else None,
                    "updated_at": datetime.utcnow().isoformat()
                }, default=str)
            )
            
        except Exception as e:
            logger.error("Failed to update strategy state cache", 
                        session_id=context.session_id, error=str(e))
    
    async def _handle_execution_error(self, session_id: UUID, error_message: str):
        """Handle strategy execution errors."""
        try:
            # Update session status to ERROR
            await DatabaseService.update_session_status(session_id, SessionStatus.ERROR)
            
            # Store error details in Redis
            if self.redis_client:
                error_data = {
                    "error": error_message,
                    "timestamp": datetime.utcnow().isoformat(),
                    "session_id": str(session_id)
                }
                
                await self.redis_client.setex(
                    f"strategy_execution:{session_id}:error",
                    3600,  # 1 hour TTL
                    json.dumps(error_data)
                )
            
            # Publish error event to Kafka
            if self.kafka_producer:
                await self.kafka_producer.send_message(
                    topic=Topics.FORWARD_TEST_EVENTS.value,
                    message={
                        "event_type": "EXECUTION_ERROR",
                        "session_id": str(session_id),
                        "error": error_message,
                        "timestamp": datetime.utcnow().isoformat()
                    },
                    key=str(session_id)
                )
            
            logger.error("Strategy execution error handled", 
                        session_id=session_id, error=error_message)
            
        except Exception as e:
            logger.error("Failed to handle execution error", 
                        session_id=session_id, 
                        original_error=error_message,
                        handler_error=str(e))


class StrategyPerformanceMonitor:
    """
    Performance monitoring for strategy execution.
    Tracks execution metrics and identifies bottlenecks.
    """
    
    def __init__(self):
        self.performance_data: Dict[UUID, Dict[str, Any]] = {}
        self.redis_client: Optional[redis.Redis] = None
    
    async def initialize(self):
        """Initialize performance monitor."""
        self.redis_client = redis.Redis.from_url(settings.REDIS_URL)
        await self.redis_client.ping()
        logger.info("Strategy performance monitor initialized")
    
    async def record_execution_metrics(
        self, 
        session_id: UUID, 
        execution_time_ms: float,
        signal_count: int,
        error_occurred: bool = False
    ):
        """Record execution metrics for analysis."""
        timestamp = datetime.utcnow()
        
        # Update in-memory data
        if session_id not in self.performance_data:
            self.performance_data[session_id] = {
                "total_executions": 0,
                "total_execution_time_ms": 0.0,
                "total_signals": 0,
                "total_errors": 0,
                "last_execution": None
            }
        
        data = self.performance_data[session_id]
        data["total_executions"] += 1
        data["total_execution_time_ms"] += execution_time_ms
        data["total_signals"] += signal_count
        if error_occurred:
            data["total_errors"] += 1
        data["last_execution"] = timestamp
        
        # Store in Redis for persistence
        if self.redis_client:
            await self.redis_client.zadd(
                f"performance:{session_id}:execution_times",
                {str(timestamp.timestamp()): execution_time_ms}
            )
            
            # Keep only last 1000 entries
            await self.redis_client.zremrangebyrank(
                f"performance:{session_id}:execution_times", 0, -1001
            )
    
    async def get_performance_summary(self, session_id: UUID) -> Optional[Dict[str, Any]]:
        """Get performance summary for a session."""
        data = self.performance_data.get(session_id)
        if not data:
            return None
        
        avg_execution_time = (
            data["total_execution_time_ms"] / max(data["total_executions"], 1)
        )
        
        error_rate = data["total_errors"] / max(data["total_executions"], 1)
        
        return {
            "session_id": str(session_id),
            "total_executions": data["total_executions"],
            "average_execution_time_ms": avg_execution_time,
            "total_signals_generated": data["total_signals"],
            "error_rate": error_rate,
            "last_execution": data["last_execution"].isoformat() if data["last_execution"] else None
        }
    
    async def cleanup_performance_data(self, session_id: UUID):
        """Clean up performance data for a session."""
        if session_id in self.performance_data:
            del self.performance_data[session_id]
        
        if self.redis_client:
            await self.redis_client.delete(f"performance:{session_id}:*")


# Global instance
strategy_executor = StrategyExecutionService()
performance_monitor = StrategyPerformanceMonitor()
