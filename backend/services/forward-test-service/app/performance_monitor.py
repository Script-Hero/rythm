"""
Performance Monitor for Forward Testing.
Enhanced real-time performance tracking and analytics migrated from Beta1.
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
import statistics

import structlog
import redis.asyncio as redis
import numpy as np
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
class PerformanceMetrics:
    """Real-time performance metrics for a trading session."""
    session_id: UUID
    total_pnl: float = 0.0
    total_return_percent: float = 0.0
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate_percent: float = 0.0
    average_win: float = 0.0
    average_loss: float = 0.0
    largest_win: float = 0.0
    largest_loss: float = 0.0
    consecutive_wins: int = 0
    consecutive_losses: int = 0
    max_consecutive_wins: int = 0
    max_consecutive_losses: int = 0
    max_drawdown: float = 0.0
    max_drawdown_percent: float = 0.0
    current_drawdown: float = 0.0
    current_drawdown_percent: float = 0.0
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    profit_factor: float = 0.0
    recovery_factor: float = 0.0
    initial_capital: float = 100000.0
    current_capital: float = 100000.0
    peak_capital: float = 100000.0
    last_updated: float = 0.0
    

@dataclass
class TradeMetrics:
    """Metrics for individual trades."""
    trade_id: str
    session_id: UUID
    timestamp: float
    symbol: str
    action: str  # BUY, SELL
    quantity: float
    price: float
    fee: float
    pnl: float
    pnl_percent: float
    portfolio_value_before: float
    portfolio_value_after: float
    position_size_before: float
    position_size_after: float


class PerformanceMonitor:
    """
    Enhanced performance monitoring service migrated from Beta1.
    Tracks real-time metrics, calculates advanced performance analytics,
    and provides comprehensive risk analysis.
    """
    
    def __init__(self):
        self.session_metrics: Dict[UUID, PerformanceMetrics] = {}
        self.trade_history: Dict[UUID, deque] = defaultdict(lambda: deque(maxlen=10000))
        self.return_history: Dict[UUID, deque] = defaultdict(lambda: deque(maxlen=10000))
        self.portfolio_history: Dict[UUID, deque] = defaultdict(lambda: deque(maxlen=10000))
        self.redis_client: Optional[redis.Redis] = None
        self.kafka_producer: Optional[KafkaProducer] = None
        self._shutdown_event = asyncio.Event()
        self._monitoring_tasks: Dict[UUID, asyncio.Task] = {}
    
    async def initialize(self):
        """Initialize the performance monitor."""
        self.redis_client = redis.Redis.from_url(settings.REDIS_URL)
        await self.redis_client.ping()
        
        # Initialize Kafka producer for performance events
        self.kafka_producer = KafkaProducer(settings.KAFKA_BOOTSTRAP_SERVERS)
        await self.kafka_producer.start()
        
        logger.info("Performance monitor initialized")
    
    async def shutdown(self):
        """Shutdown the performance monitor."""
        self._shutdown_event.set()
        
        # Cancel monitoring tasks
        for task in self._monitoring_tasks.values():
            task.cancel()
        
        if self._monitoring_tasks:
            await asyncio.gather(*self._monitoring_tasks.values(), return_exceptions=True)
        
        # Close connections
        if self.kafka_producer:
            await self.kafka_producer.stop()
        
        if self.redis_client:
            await self.redis_client.close()
        
        # Clear caches
        self.session_metrics.clear()
        self.trade_history.clear()
        self.return_history.clear()
        self.portfolio_history.clear()
        
        logger.info("Performance monitor shutdown complete")
    
    async def start_session_monitoring(
        self,
        session_id: UUID,
        initial_capital: float = 100000.0
    ):
        """Start monitoring a session."""
        try:
            # Initialize session metrics
            metrics = PerformanceMetrics(
                session_id=session_id,
                initial_capital=initial_capital,
                current_capital=initial_capital,
                peak_capital=initial_capital,
                last_updated=time.time()
            )
            
            self.session_metrics[session_id] = metrics
            
            # Start monitoring task
            task = asyncio.create_task(
                self._session_monitoring_loop(session_id),
                name=f"performance-monitor-{session_id}"
            )
            self._monitoring_tasks[session_id] = task
            
            # Store initial state in Redis
            await self._persist_metrics(session_id, metrics)
            
            logger.info("Started session monitoring", 
                       session_id=session_id, initial_capital=initial_capital)
            
        except Exception as e:
            logger.error("Failed to start session monitoring", 
                        session_id=session_id, error=str(e))
    
    async def stop_session_monitoring(self, session_id: UUID):
        """Stop monitoring a session."""
        try:
            # Cancel monitoring task
            if session_id in self._monitoring_tasks:
                task = self._monitoring_tasks[session_id]
                task.cancel()
                
                try:
                    await task
                except asyncio.CancelledError:
                    pass
                
                del self._monitoring_tasks[session_id]
            
            # Final metrics calculation and persistence
            if session_id in self.session_metrics:
                await self._calculate_final_metrics(session_id)
                await self._persist_metrics(session_id, self.session_metrics[session_id])
            
            logger.info("Stopped session monitoring", session_id=session_id)
            
        except Exception as e:
            logger.error("Failed to stop session monitoring", 
                        session_id=session_id, error=str(e))
    
    async def record_trade(
        self,
        session_id: UUID,
        trade_data: Dict[str, Any],
        portfolio_value_before: float,
        portfolio_value_after: float
    ):
        """Record a trade and update performance metrics."""
        try:
            if session_id not in self.session_metrics:
                logger.warning("Session not being monitored", session_id=session_id)
                return
            
            metrics = self.session_metrics[session_id]
            
            # Create trade metrics
            trade_metrics = TradeMetrics(
                trade_id=trade_data.get('trade_id', str(UUID.uuid4())),
                session_id=session_id,
                timestamp=time.time(),
                symbol=trade_data.get('symbol', ''),
                action=trade_data.get('action', ''),
                quantity=float(trade_data.get('quantity', 0)),
                price=float(trade_data.get('price', 0)),
                fee=float(trade_data.get('fee', 0)),
                pnl=portfolio_value_after - portfolio_value_before,
                pnl_percent=((portfolio_value_after - portfolio_value_before) / portfolio_value_before) * 100,
                portfolio_value_before=portfolio_value_before,
                portfolio_value_after=portfolio_value_after,
                position_size_before=float(trade_data.get('position_size_before', 0)),
                position_size_after=float(trade_data.get('position_size_after', 0))
            )
            
            # Add to trade history
            self.trade_history[session_id].append(trade_metrics)
            
            # Update metrics
            await self._update_trade_metrics(session_id, trade_metrics)
            
            # Record return
            if portfolio_value_before > 0:
                return_pct = ((portfolio_value_after - portfolio_value_before) / portfolio_value_before) * 100
                self.return_history[session_id].append(return_pct)
            
            # Record portfolio value
            self.portfolio_history[session_id].append(portfolio_value_after)
            
            # Calculate advanced metrics
            await self._calculate_advanced_metrics(session_id)
            
            # Persist updated metrics
            await self._persist_metrics(session_id, metrics)
            
            # Publish performance update
            if self.kafka_producer:
                await self.kafka_producer.send_message(
                    topic=Topics.PORTFOLIO_UPDATES,
                    message={
                        "event_type": "TRADE_RECORDED",
                        "session_id": str(session_id),
                        "trade_metrics": asdict(trade_metrics),
                        "session_metrics": asdict(metrics)
                    },
                    key=str(session_id)
                )
            
            logger.debug("Trade recorded", 
                        session_id=session_id, pnl=trade_metrics.pnl)
            
        except Exception as e:
            logger.error("Failed to record trade", 
                        session_id=session_id, error=str(e))
    
    async def update_portfolio_value(self, session_id: UUID, new_value: float):
        """Update current portfolio value and recalculate metrics."""
        try:
            if session_id not in self.session_metrics:
                return
            
            metrics = self.session_metrics[session_id]
            old_value = metrics.current_capital
            
            # Update portfolio value
            metrics.current_capital = new_value
            metrics.last_updated = time.time()
            
            # Update peak capital
            if new_value > metrics.peak_capital:
                metrics.peak_capital = new_value
            
            # Calculate current drawdown
            await self._calculate_drawdown(session_id)
            
            # Record portfolio value
            self.portfolio_history[session_id].append(new_value)
            
            # Recalculate return-based metrics
            await self._calculate_advanced_metrics(session_id)
            
            # Persist metrics
            await self._persist_metrics(session_id, metrics)
            
        except Exception as e:
            logger.error("Failed to update portfolio value", 
                        session_id=session_id, error=str(e))
    
    async def get_performance_summary(self, session_id: UUID) -> Optional[Dict[str, Any]]:
        """Get comprehensive performance summary for a session."""
        try:
            if session_id not in self.session_metrics:
                # Try to restore from Redis
                restored = await self._restore_metrics_from_redis(session_id)
                if not restored:
                    return None
            
            metrics = self.session_metrics[session_id]
            
            # Get recent trades
            recent_trades = list(self.trade_history[session_id])[-10:]  # Last 10 trades
            
            # Get performance over time
            performance_series = await self._get_performance_series(session_id)
            
            return {
                "session_id": str(session_id),
                "metrics": asdict(metrics),
                "recent_trades": [asdict(trade) for trade in recent_trades],
                "performance_series": performance_series,
                "risk_analysis": await self._get_risk_analysis(session_id),
                "updated_at": metrics.last_updated
            }
            
        except Exception as e:
            logger.error("Failed to get performance summary", 
                        session_id=session_id, error=str(e))
            return None
    
    async def _session_monitoring_loop(self, session_id: UUID):
        """Background monitoring loop for a session."""
        try:
            while not self._shutdown_event.is_set():
                # Recalculate metrics periodically
                await self._calculate_advanced_metrics(session_id)
                
                # Persist metrics
                if session_id in self.session_metrics:
                    await self._persist_metrics(session_id, self.session_metrics[session_id])
                
                # Wait for next calculation
                await asyncio.sleep(30)  # Update every 30 seconds
                
        except asyncio.CancelledError:
            logger.info("Session monitoring cancelled", session_id=session_id)
            raise
        except Exception as e:
            logger.error("Session monitoring error", session_id=session_id, error=str(e))
    
    async def _update_trade_metrics(self, session_id: UUID, trade: TradeMetrics):
        """Update basic trade-based metrics."""
        metrics = self.session_metrics[session_id]
        
        # Update trade counts
        metrics.total_trades += 1
        
        if trade.pnl > 0:
            metrics.winning_trades += 1
            metrics.consecutive_wins += 1
            metrics.consecutive_losses = 0
            metrics.max_consecutive_wins = max(metrics.max_consecutive_wins, metrics.consecutive_wins)
        elif trade.pnl < 0:
            metrics.losing_trades += 1
            metrics.consecutive_losses += 1
            metrics.consecutive_wins = 0
            metrics.max_consecutive_losses = max(metrics.max_consecutive_losses, metrics.consecutive_losses)
        
        # Update win rate
        if metrics.total_trades > 0:
            metrics.win_rate_percent = (metrics.winning_trades / metrics.total_trades) * 100
        
        # Update PnL
        metrics.total_pnl += trade.pnl
        if metrics.initial_capital > 0:
            metrics.total_return_percent = (metrics.total_pnl / metrics.initial_capital) * 100
        
        # Update win/loss averages
        if metrics.winning_trades > 0:
            winning_trades = [t for t in self.trade_history[session_id] if t.pnl > 0]
            metrics.average_win = statistics.mean([t.pnl for t in winning_trades])
            metrics.largest_win = max([t.pnl for t in winning_trades])
        
        if metrics.losing_trades > 0:
            losing_trades = [t for t in self.trade_history[session_id] if t.pnl < 0]
            metrics.average_loss = statistics.mean([t.pnl for t in losing_trades])
            metrics.largest_loss = min([t.pnl for t in losing_trades])
        
        # Calculate profit factor
        if metrics.losing_trades > 0 and metrics.average_loss < 0:
            gross_profit = metrics.winning_trades * metrics.average_win
            gross_loss = abs(metrics.losing_trades * metrics.average_loss)
            metrics.profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
    
    async def _calculate_advanced_metrics(self, session_id: UUID):
        """Calculate advanced performance metrics."""
        try:
            if session_id not in self.session_metrics:
                return
            
            metrics = self.session_metrics[session_id]
            returns = list(self.return_history[session_id])
            
            if len(returns) < 2:
                return
            
            # Calculate Sharpe ratio (assuming risk-free rate of 2%)
            risk_free_rate = 0.02 / 252  # Daily risk-free rate
            excess_returns = [r - risk_free_rate for r in returns]
            
            if len(excess_returns) > 1:
                avg_excess_return = statistics.mean(excess_returns)
                std_dev = statistics.stdev(excess_returns) if len(excess_returns) > 1 else 0
                metrics.sharpe_ratio = (avg_excess_return / std_dev) * np.sqrt(252) if std_dev > 0 else 0
            
            # Calculate Sortino ratio (downside deviation)
            negative_returns = [r for r in returns if r < 0]
            if negative_returns:
                downside_deviation = statistics.stdev(negative_returns)
                avg_return = statistics.mean(returns)
                metrics.sortino_ratio = (avg_return / downside_deviation) * np.sqrt(252) if downside_deviation > 0 else 0
            
            # Calculate Calmar ratio
            if metrics.max_drawdown_percent > 0:
                annual_return = metrics.total_return_percent * (252 / len(returns)) if len(returns) > 0 else 0
                metrics.calmar_ratio = annual_return / abs(metrics.max_drawdown_percent)
            
            # Calculate recovery factor
            if metrics.max_drawdown != 0:
                metrics.recovery_factor = metrics.total_pnl / abs(metrics.max_drawdown)
            
        except Exception as e:
            logger.error("Failed to calculate advanced metrics", 
                        session_id=session_id, error=str(e))
    
    async def _calculate_drawdown(self, session_id: UUID):
        """Calculate current and maximum drawdown."""
        try:
            metrics = self.session_metrics[session_id]
            
            # Current drawdown
            metrics.current_drawdown = metrics.peak_capital - metrics.current_capital
            if metrics.peak_capital > 0:
                metrics.current_drawdown_percent = (metrics.current_drawdown / metrics.peak_capital) * 100
            
            # Maximum drawdown
            if metrics.current_drawdown > metrics.max_drawdown:
                metrics.max_drawdown = metrics.current_drawdown
                metrics.max_drawdown_percent = metrics.current_drawdown_percent
            
        except Exception as e:
            logger.error("Failed to calculate drawdown", session_id=session_id, error=str(e))
    
    async def _persist_metrics(self, session_id: UUID, metrics: PerformanceMetrics):
        """Persist metrics to Redis."""
        try:
            if not self.redis_client:
                return
            
            metrics_key = f"performance_metrics:{session_id}"
            await self.redis_client.setex(
                metrics_key,
                86400,  # 24 hour TTL
                json.dumps(asdict(metrics), default=str)
            )
            
        except Exception as e:
            logger.error("Failed to persist metrics", session_id=session_id, error=str(e))
    
    async def _restore_metrics_from_redis(self, session_id: UUID) -> bool:
        """Restore metrics from Redis."""
        try:
            if not self.redis_client:
                return False
            
            metrics_key = f"performance_metrics:{session_id}"
            data = await self.redis_client.get(metrics_key)
            
            if data:
                metrics_data = json.loads(data)
                metrics = PerformanceMetrics(**metrics_data)
                self.session_metrics[session_id] = metrics
                return True
            
            return False
            
        except Exception as e:
            logger.error("Failed to restore metrics", session_id=session_id, error=str(e))
            return False
    
    async def _get_performance_series(self, session_id: UUID) -> List[Dict[str, Any]]:
        """Get performance over time series."""
        try:
            portfolio_values = list(self.portfolio_history[session_id])
            
            if not portfolio_values:
                return []
            
            # Create time series with cumulative returns
            series = []
            initial_value = portfolio_values[0] if portfolio_values else 100000.0
            
            for i, value in enumerate(portfolio_values):
                series.append({
                    "timestamp": time.time() - (len(portfolio_values) - i) * 60,  # Assume 1-minute intervals
                    "portfolio_value": value,
                    "cumulative_return": ((value - initial_value) / initial_value) * 100,
                    "peak_value": max(portfolio_values[:i+1])
                })
            
            return series[-100:]  # Return last 100 points
            
        except Exception as e:
            logger.error("Failed to get performance series", session_id=session_id, error=str(e))
            return []
    
    async def _get_risk_analysis(self, session_id: UUID) -> Dict[str, Any]:
        """Get risk analysis for a session."""
        try:
            metrics = self.session_metrics[session_id]
            returns = list(self.return_history[session_id])
            
            if len(returns) < 2:
                return {}
            
            # Value at Risk (95%)
            var_95 = np.percentile(returns, 5) if returns else 0
            
            # Expected Shortfall (Conditional VaR)
            shortfall_returns = [r for r in returns if r <= var_95]
            expected_shortfall = statistics.mean(shortfall_returns) if shortfall_returns else 0
            
            # Volatility
            volatility = statistics.stdev(returns) if len(returns) > 1 else 0
            
            return {
                "value_at_risk_95": var_95,
                "expected_shortfall": expected_shortfall,
                "volatility": volatility,
                "max_drawdown": metrics.max_drawdown,
                "max_drawdown_percent": metrics.max_drawdown_percent,
                "current_drawdown": metrics.current_drawdown,
                "current_drawdown_percent": metrics.current_drawdown_percent,
                "sharpe_ratio": metrics.sharpe_ratio,
                "sortino_ratio": metrics.sortino_ratio
            }
            
        except Exception as e:
            logger.error("Failed to get risk analysis", session_id=session_id, error=str(e))
            return {}
    
    async def _calculate_final_metrics(self, session_id: UUID):
        """Calculate final metrics when session ends."""
        try:
            await self._calculate_advanced_metrics(session_id)
            
            # Additional final calculations could go here
            
        except Exception as e:
            logger.error("Failed to calculate final metrics", session_id=session_id, error=str(e))
    
    async def cleanup_session_data(self, session_id: UUID):
        """Clean up session data."""
        try:
            # Clear in-memory data
            if session_id in self.session_metrics:
                del self.session_metrics[session_id]
            
            if session_id in self.trade_history:
                del self.trade_history[session_id]
            
            if session_id in self.return_history:
                del self.return_history[session_id]
            
            if session_id in self.portfolio_history:
                del self.portfolio_history[session_id]
            
            # Stop monitoring task
            await self.stop_session_monitoring(session_id)
            
            logger.info("Performance data cleaned up", session_id=session_id)
            
        except Exception as e:
            logger.error("Failed to cleanup performance data", session_id=session_id, error=str(e))


# Global instance
performance_monitor = PerformanceMonitor()