"""
Portfolio Manager for Forward Testing.
Handles portfolio balance tracking, trade execution, and position management.
Enhanced from Beta1's portfolio management functionality.
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from decimal import Decimal, getcontext
from typing import Dict, List, Optional, Any, Tuple
from uuid import UUID, uuid4
from dataclasses import dataclass, asdict
from enum import Enum

import structlog
import redis.asyncio as redis

from .config import settings
from .session_event_publisher import session_event_publisher
from .performance_monitor import performance_monitor

# Add shared models to path
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../..'))

from shared.models.forward_test_models import SessionStatus
from shared.kafka_client import KafkaProducer, Topics

# Set decimal precision for financial calculations
getcontext().prec = 10

logger = structlog.get_logger()


class TradeAction(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    FILLED = "FILLED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


@dataclass
class Position:
    """Current position for a symbol."""
    symbol: str
    quantity: Decimal
    average_price: Decimal
    current_price: Decimal
    market_value: Decimal
    unrealized_pnl: Decimal
    unrealized_pnl_percent: Decimal
    last_updated: float


@dataclass
class Trade:
    """Individual trade record."""
    trade_id: str
    session_id: UUID
    symbol: str
    action: TradeAction
    quantity: Decimal
    price: Decimal
    fee: Decimal
    total_cost: Decimal
    timestamp: float
    order_id: Optional[str] = None
    status: OrderStatus = OrderStatus.FILLED
    pnl: Decimal = Decimal('0')
    pnl_percent: Decimal = Decimal('0')


@dataclass
class Portfolio:
    """Portfolio state for a session."""
    session_id: UUID
    cash_balance: Decimal
    total_value: Decimal
    total_pnl: Decimal
    total_pnl_percent: Decimal
    positions: Dict[str, Position]
    trade_count: int
    last_updated: float
    initial_capital: Decimal


class PortfolioManager:
    """
    Enhanced portfolio manager migrated from Beta1.
    Handles trade execution, position tracking, and portfolio valuation.
    """
    
    def __init__(self):
        self.portfolios: Dict[UUID, Portfolio] = {}
        self.redis_client: Optional[redis.Redis] = None
        self.kafka_producer: Optional[KafkaProducer] = None
        self._shutdown_event = asyncio.Event()
        
        # Trading configuration
        self.default_fee_rate = Decimal('0.001')  # 0.1% fee
        self.default_slippage = Decimal('0.0005')  # 0.05% slippage
    
    async def initialize(self):
        """Initialize the portfolio manager."""
        self.redis_client = redis.Redis.from_url(settings.REDIS_URL)
        await self.redis_client.ping()
        
        # Initialize Kafka producer for trade events
        self.kafka_producer = KafkaProducer(settings.KAFKA_BOOTSTRAP_SERVERS)
        await self.kafka_producer.start()
        
        logger.info("Portfolio manager initialized")
    
    async def shutdown(self):
        """Shutdown the portfolio manager."""
        self._shutdown_event.set()
        
        # Close connections
        if self.kafka_producer:
            await self.kafka_producer.stop()
        
        if self.redis_client:
            await self.redis_client.close()
        
        # Clear portfolios
        self.portfolios.clear()
        
        logger.info("Portfolio manager shutdown complete")
    
    async def create_portfolio(
        self,
        session_id: UUID,
        initial_capital: float = 100000.0
    ) -> Portfolio:
        """Create a new portfolio for a session."""
        try:
            initial_capital_decimal = Decimal(str(initial_capital))
            
            portfolio = Portfolio(
                session_id=session_id,
                cash_balance=initial_capital_decimal,
                total_value=initial_capital_decimal,
                total_pnl=Decimal('0'),
                total_pnl_percent=Decimal('0'),
                positions={},
                trade_count=0,
                last_updated=time.time(),
                initial_capital=initial_capital_decimal
            )
            
            self.portfolios[session_id] = portfolio
            
            # Persist to Redis
            await self._persist_portfolio(session_id, portfolio)
            
            # Start performance monitoring
            await performance_monitor.start_session_monitoring(session_id, initial_capital)
            
            logger.info("Portfolio created", 
                       session_id=session_id, initial_capital=initial_capital)
            
            return portfolio
            
        except Exception as e:
            logger.error("Failed to create portfolio", 
                        session_id=session_id, error=str(e))
            raise
    
    async def process_strategy_signal(
        self,
        session_id: UUID,
        signal: Dict[str, Any],
        market_data: Dict[str, Any]
    ) -> Optional[Trade]:
        """Process a trading signal from strategy execution."""
        try:
            if session_id not in self.portfolios:
                logger.warning("Portfolio not found for signal", session_id=session_id)
                return None
            
            action = signal.get('action', 'HOLD')
            if action == 'HOLD':
                return None
            
            symbol = market_data.get('symbol', '')
            current_price = Decimal(str(market_data.get('price', 0)))
            
            if current_price <= 0:
                logger.warning("Invalid price for trade", symbol=symbol, price=current_price)
                return None
            
            # Determine trade quantity based on signal
            quantity = await self._calculate_trade_quantity(
                session_id, action, signal, current_price
            )
            
            if quantity <= 0:
                logger.debug("No quantity to trade", session_id=session_id, action=action)
                return None
            
            # Execute the trade
            trade = await self._execute_trade(
                session_id=session_id,
                symbol=symbol,
                action=TradeAction(action),
                quantity=quantity,
                price=current_price
            )
            
            if trade:
                # Update portfolio valuation
                await self._update_portfolio_valuation(session_id, {symbol: current_price})
                
                # Publish events
                await self._publish_trade_events(session_id, trade, market_data)
            
            return trade
            
        except Exception as e:
            logger.error("Failed to process strategy signal", 
                        session_id=session_id, error=str(e))
            return None
    
    async def update_portfolio_valuation(
        self,
        session_id: UUID,
        current_prices: Dict[str, float]
    ):
        """Update portfolio valuation with current market prices."""
        try:
            if session_id not in self.portfolios:
                return
            
            # Convert prices to Decimal
            decimal_prices = {symbol: Decimal(str(price)) for symbol, price in current_prices.items()}
            
            await self._update_portfolio_valuation(session_id, decimal_prices)
            
        except Exception as e:
            logger.error("Failed to update portfolio valuation", 
                        session_id=session_id, error=str(e))
    
    async def get_portfolio_summary(self, session_id: UUID) -> Optional[Dict[str, Any]]:
        """Get portfolio summary for a session."""
        try:
            if session_id not in self.portfolios:
                # Try to restore from Redis
                restored = await self._restore_portfolio_from_redis(session_id)
                if not restored:
                    return None
            
            portfolio = self.portfolios[session_id]
            
            # Get position summaries
            position_summaries = []
            for symbol, position in portfolio.positions.items():
                position_summaries.append({
                    "symbol": symbol,
                    "quantity": float(position.quantity),
                    "average_price": float(position.average_price),
                    "current_price": float(position.current_price),
                    "market_value": float(position.market_value),
                    "unrealized_pnl": float(position.unrealized_pnl),
                    "unrealized_pnl_percent": float(position.unrealized_pnl_percent),
                    "last_updated": position.last_updated
                })
            
            return {
                "session_id": str(session_id),
                "cash_balance": float(portfolio.cash_balance),
                "total_value": float(portfolio.total_value),
                "total_pnl": float(portfolio.total_pnl),
                "total_pnl_percent": float(portfolio.total_pnl_percent),
                "positions": position_summaries,
                "position_count": len(portfolio.positions),
                "trade_count": portfolio.trade_count,
                "last_updated": portfolio.last_updated,
                "initial_capital": float(portfolio.initial_capital)
            }
            
        except Exception as e:
            logger.error("Failed to get portfolio summary", 
                        session_id=session_id, error=str(e))
            return None
    
    async def get_recent_trades(
        self,
        session_id: UUID,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get recent trades for a session."""
        try:
            if not self.redis_client:
                return []
            
            # Get trades from Redis sorted set
            trades_key = f"trades:{session_id}"
            trade_data = await self.redis_client.zrevrange(
                trades_key, 0, limit - 1, withscores=True
            )
            
            trades = []
            for trade_json, timestamp in trade_data:
                try:
                    trade_dict = json.loads(trade_json)
                    trades.append(trade_dict)
                except json.JSONDecodeError:
                    continue
            
            return trades
            
        except Exception as e:
            logger.error("Failed to get recent trades", 
                        session_id=session_id, error=str(e))
            return []
    
    async def _calculate_trade_quantity(
        self,
        session_id: UUID,
        action: str,
        signal: Dict[str, Any],
        current_price: Decimal
    ) -> Decimal:
        """Calculate trade quantity based on signal and risk management."""
        try:
            portfolio = self.portfolios[session_id]
            
            # Get position sizing from signal (default to percentage of portfolio)
            position_size_percent = signal.get('position_size', 0.1)  # 10% default
            
            if action == 'BUY':
                # Calculate max quantity based on available cash
                available_cash = portfolio.cash_balance
                max_trade_value = available_cash * Decimal(str(position_size_percent))
                
                # Account for fees
                fee_rate = self.default_fee_rate
                max_quantity = max_trade_value / (current_price * (1 + fee_rate))
                
                return max(Decimal('0'), max_quantity.quantize(Decimal('0.00000001')))
            
            elif action == 'SELL':
                # Get current position
                symbol = signal.get('symbol', '')
                if symbol in portfolio.positions:
                    current_quantity = portfolio.positions[symbol].quantity
                    
                    # Sell percentage or all
                    sell_percent = signal.get('sell_percent', 1.0)  # 100% default
                    sell_quantity = current_quantity * Decimal(str(sell_percent))
                    
                    return max(Decimal('0'), sell_quantity.quantize(Decimal('0.00000001')))
                else:
                    return Decimal('0')
            
            return Decimal('0')
            
        except Exception as e:
            logger.error("Failed to calculate trade quantity", 
                        session_id=session_id, error=str(e))
            return Decimal('0')
    
    async def _execute_trade(
        self,
        session_id: UUID,
        symbol: str,
        action: TradeAction,
        quantity: Decimal,
        price: Decimal
    ) -> Optional[Trade]:
        """Execute a trade and update portfolio."""
        try:
            portfolio = self.portfolios[session_id]
            
            # Apply slippage to price
            execution_price = price
            if action == TradeAction.BUY:
                execution_price = price * (1 + self.default_slippage)
            elif action == TradeAction.SELL:
                execution_price = price * (1 - self.default_slippage)
            
            # Calculate trade costs
            trade_value = quantity * execution_price
            fee = trade_value * self.default_fee_rate
            total_cost = trade_value + fee
            
            # Validate trade
            if action == TradeAction.BUY and total_cost > portfolio.cash_balance:
                logger.warning("Insufficient cash for trade", 
                              session_id=session_id, required=total_cost, available=portfolio.cash_balance)
                return None
            
            if action == TradeAction.SELL:
                current_position = portfolio.positions.get(symbol)
                if not current_position or current_position.quantity < quantity:
                    logger.warning("Insufficient position for sell", 
                                  session_id=session_id, symbol=symbol, requested=quantity)
                    return None
            
            # Create trade record
            trade = Trade(
                trade_id=str(uuid4()),
                session_id=session_id,
                symbol=symbol,
                action=action,
                quantity=quantity,
                price=execution_price,
                fee=fee,
                total_cost=total_cost,
                timestamp=time.time(),
                status=OrderStatus.FILLED
            )
            
            # Update portfolio positions
            old_portfolio_value = portfolio.total_value
            await self._update_position(session_id, trade)
            
            # Update portfolio balances
            if action == TradeAction.BUY:
                portfolio.cash_balance -= total_cost
            elif action == TradeAction.SELL:
                portfolio.cash_balance += (trade_value - fee)
            
            # Increment trade count
            portfolio.trade_count += 1
            portfolio.last_updated = time.time()
            
            # Calculate trade PnL (for sells)
            if action == TradeAction.SELL and symbol in portfolio.positions:
                position = portfolio.positions[symbol]
                trade.pnl = (execution_price - position.average_price) * quantity - fee
                if position.average_price > 0:
                    trade.pnl_percent = ((execution_price - position.average_price) / position.average_price) * 100
            
            # Store trade
            await self._store_trade(session_id, trade)
            
            # Persist portfolio
            await self._persist_portfolio(session_id, portfolio)
            
            # Record with performance monitor
            new_portfolio_value = portfolio.total_value
            await performance_monitor.record_trade(
                session_id=session_id,
                trade_data=asdict(trade),
                portfolio_value_before=float(old_portfolio_value),
                portfolio_value_after=float(new_portfolio_value)
            )
            
            logger.info("Trade executed", 
                       session_id=session_id, trade_id=trade.trade_id, 
                       action=action, symbol=symbol, quantity=float(quantity))
            
            return trade
            
        except Exception as e:
            logger.error("Failed to execute trade", 
                        session_id=session_id, error=str(e))
            return None
    
    async def _update_position(self, session_id: UUID, trade: Trade):
        """Update position based on trade."""
        try:
            portfolio = self.portfolios[session_id]
            symbol = trade.symbol
            
            if trade.action == TradeAction.BUY:
                if symbol in portfolio.positions:
                    # Update existing position
                    position = portfolio.positions[symbol]
                    
                    # Calculate new average price
                    total_value = (position.quantity * position.average_price) + (trade.quantity * trade.price)
                    total_quantity = position.quantity + trade.quantity
                    
                    position.average_price = total_value / total_quantity
                    position.quantity = total_quantity
                    position.last_updated = trade.timestamp
                else:
                    # Create new position
                    portfolio.positions[symbol] = Position(
                        symbol=symbol,
                        quantity=trade.quantity,
                        average_price=trade.price,
                        current_price=trade.price,
                        market_value=trade.quantity * trade.price,
                        unrealized_pnl=Decimal('0'),
                        unrealized_pnl_percent=Decimal('0'),
                        last_updated=trade.timestamp
                    )
            
            elif trade.action == TradeAction.SELL:
                if symbol in portfolio.positions:
                    position = portfolio.positions[symbol]
                    position.quantity -= trade.quantity
                    position.last_updated = trade.timestamp
                    
                    # Remove position if quantity is zero or negative
                    if position.quantity <= 0:
                        del portfolio.positions[symbol]
            
        except Exception as e:
            logger.error("Failed to update position", 
                        session_id=session_id, error=str(e))
    
    async def _update_portfolio_valuation(
        self,
        session_id: UUID,
        current_prices: Dict[str, Decimal]
    ):
        """Update portfolio valuation with current prices."""
        try:
            portfolio = self.portfolios[session_id]
            
            # Update position valuations
            total_position_value = Decimal('0')
            
            for symbol, position in portfolio.positions.items():
                if symbol in current_prices:
                    position.current_price = current_prices[symbol]
                    position.market_value = position.quantity * position.current_price
                    position.unrealized_pnl = (position.current_price - position.average_price) * position.quantity
                    
                    if position.average_price > 0:
                        position.unrealized_pnl_percent = ((position.current_price - position.average_price) / position.average_price) * 100
                    
                    position.last_updated = time.time()
                
                total_position_value += position.market_value
            
            # Update portfolio totals
            portfolio.total_value = portfolio.cash_balance + total_position_value
            portfolio.total_pnl = portfolio.total_value - portfolio.initial_capital
            
            if portfolio.initial_capital > 0:
                portfolio.total_pnl_percent = (portfolio.total_pnl / portfolio.initial_capital) * 100
            
            portfolio.last_updated = time.time()
            
            # Update performance monitor
            await performance_monitor.update_portfolio_value(session_id, float(portfolio.total_value))
            
            # Persist updated portfolio
            await self._persist_portfolio(session_id, portfolio)
            
        except Exception as e:
            logger.error("Failed to update portfolio valuation", 
                        session_id=session_id, error=str(e))
    
    async def _store_trade(self, session_id: UUID, trade: Trade):
        """Store trade in Redis."""
        try:
            if not self.redis_client:
                return
            
            # Store in sorted set by timestamp
            trades_key = f"trades:{session_id}"
            trade_json = json.dumps(asdict(trade), default=str)
            
            await self.redis_client.zadd(trades_key, {trade_json: trade.timestamp})
            
            # Keep only recent trades (limit to 10000)
            await self.redis_client.zremrangebyrank(trades_key, 0, -10001)
            
            # Set expiry
            await self.redis_client.expire(trades_key, 86400)  # 24 hours
            
        except Exception as e:
            logger.error("Failed to store trade", session_id=session_id, error=str(e))
    
    async def _persist_portfolio(self, session_id: UUID, portfolio: Portfolio):
        """Persist portfolio to Redis."""
        try:
            if not self.redis_client:
                return
            
            portfolio_key = f"portfolio:{session_id}"
            portfolio_data = asdict(portfolio)
            
            # Convert Decimal objects to strings for JSON serialization
            def decimal_to_str(obj):
                if isinstance(obj, Decimal):
                    return str(obj)
                elif isinstance(obj, dict):
                    return {k: decimal_to_str(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [decimal_to_str(item) for item in obj]
                return obj
            
            portfolio_json = json.dumps(decimal_to_str(portfolio_data))
            
            await self.redis_client.setex(portfolio_key, 86400, portfolio_json)  # 24 hour TTL
            
        except Exception as e:
            logger.error("Failed to persist portfolio", session_id=session_id, error=str(e))
    
    async def _restore_portfolio_from_redis(self, session_id: UUID) -> bool:
        """Restore portfolio from Redis."""
        try:
            if not self.redis_client:
                return False
            
            portfolio_key = f"portfolio:{session_id}"
            data = await self.redis_client.get(portfolio_key)
            
            if data:
                portfolio_data = json.loads(data)
                
                # Convert string values back to Decimal
                def str_to_decimal(obj):
                    if isinstance(obj, dict):
                        result = {}
                        for k, v in obj.items():
                            if k in ['cash_balance', 'total_value', 'total_pnl', 'total_pnl_percent', 'initial_capital']:
                                result[k] = Decimal(str(v))
                            elif k == 'positions':
                                positions = {}
                                for symbol, pos_data in v.items():
                                    # Convert position data
                                    position = Position(
                                        symbol=pos_data['symbol'],
                                        quantity=Decimal(str(pos_data['quantity'])),
                                        average_price=Decimal(str(pos_data['average_price'])),
                                        current_price=Decimal(str(pos_data['current_price'])),
                                        market_value=Decimal(str(pos_data['market_value'])),
                                        unrealized_pnl=Decimal(str(pos_data['unrealized_pnl'])),
                                        unrealized_pnl_percent=Decimal(str(pos_data['unrealized_pnl_percent'])),
                                        last_updated=pos_data['last_updated']
                                    )
                                    positions[symbol] = position
                                result[k] = positions
                            else:
                                result[k] = v
                        return result
                    return obj
                
                converted_data = str_to_decimal(portfolio_data)
                portfolio = Portfolio(**converted_data)
                self.portfolios[session_id] = portfolio
                
                return True
            
            return False
            
        except Exception as e:
            logger.error("Failed to restore portfolio", session_id=session_id, error=str(e))
            return False
    
    async def _publish_trade_events(
        self,
        session_id: UUID,
        trade: Trade,
        market_data: Dict[str, Any]
    ):
        """Publish trade and portfolio events."""
        try:
            # Get current portfolio summary
            portfolio_summary = await self.get_portfolio_summary(session_id)
            
            # Publish trade executed event
            await session_event_publisher.publish_trade_executed(
                session_id=session_id,
                user_id=trade.session_id,  # TODO: Get actual user_id
                trade_data=asdict(trade)
            )
            
            # Publish portfolio update
            if portfolio_summary:
                await session_event_publisher.publish_portfolio_update(
                    session_id=session_id,
                    user_id=trade.session_id,  # TODO: Get actual user_id
                    portfolio_data=portfolio_summary
                )
            
            # Add chart data point
            if portfolio_summary:
                await session_event_publisher.add_chart_data_point(
                    session_id=session_id,
                    user_id=trade.session_id,  # TODO: Get actual user_id
                    price=float(trade.price),
                    portfolio_value=portfolio_summary['total_value'],
                    pnl=portfolio_summary['total_pnl'],
                    pnl_percent=portfolio_summary['total_pnl_percent'],
                    cash_balance=portfolio_summary['cash_balance'],
                    trade_count=portfolio_summary['trade_count']
                )
            
            # Publish to Kafka
            if self.kafka_producer:
                await self.kafka_producer.send_message(
                    topic=Topics.TRADE_EXECUTIONS.value,
                    message={
                        "event_type": "TRADE_EXECUTED",
                        "session_id": str(session_id),
                        "trade": asdict(trade),
                        "market_data": market_data,
                        "portfolio_summary": portfolio_summary
                    },
                    key=str(session_id)
                )
            
        except Exception as e:
            logger.error("Failed to publish trade events", 
                        session_id=session_id, error=str(e))
    
    async def cleanup_session_data(self, session_id: UUID):
        """Clean up portfolio data for a session."""
        try:
            # Clear in-memory data
            if session_id in self.portfolios:
                del self.portfolios[session_id]
            
            # Clean up Redis data with delay
            async def delayed_cleanup():
                await asyncio.sleep(300)  # 5 minutes
                
                keys_to_delete = [
                    f"portfolio:{session_id}",
                    f"trades:{session_id}"
                ]
                
                for key in keys_to_delete:
                    await self.redis_client.delete(key)
                
                logger.info("Portfolio data cleaned up", session_id=session_id)
            
            asyncio.create_task(delayed_cleanup())
            
        except Exception as e:
            logger.error("Failed to cleanup portfolio data", session_id=session_id, error=str(e))


# Global instance
portfolio_manager = PortfolioManager()