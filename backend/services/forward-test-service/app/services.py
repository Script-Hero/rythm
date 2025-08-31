"""
Core services for Forward Testing Service.
Handles database operations, trading logic, and portfolio management.
"""

import asyncio
import json
import pickle
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any, Tuple
from uuid import UUID, uuid4

import asyncpg
import redis.asyncio as redis
import httpx
import structlog
from dataclasses import dataclass

from .config import settings

# Add shared models to path
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../..'))

from shared.models.forward_test_models import (
    SessionStatus, TradeAction, OrderStatus,
    ForwardTestSessionCreate, ForwardTestSessionResponse,
    TradeResponse, PortfolioSummary, PortfolioPosition,
    SessionMetrics, ChartDataPoint
)
from shared.strategy_engine.compiler import CompiledStrategy

logger = structlog.get_logger()


@dataclass
class MarketData:
    """Market data point."""
    symbol: str
    price: Decimal
    volume: Decimal
    timestamp: datetime


class DatabaseService:
    """Database operations for forward testing."""
    
    _pool: Optional[asyncpg.Pool] = None
    
    @classmethod
    async def initialize(cls):
        """Initialize database connection pool."""
        cls._pool = await asyncpg.create_pool(
            settings.DATABASE_URL,
            min_size=5,
            max_size=20,
            command_timeout=60
        )
        logger.info("Database connection pool initialized")
    
    @classmethod
    async def close(cls):
        """Close database connection pool."""
        if cls._pool:
            await cls._pool.close()
            logger.info("Database connection pool closed")
    
    @classmethod
    async def create_session(
        cls,
        user_id: UUID,
        session_data: ForwardTestSessionCreate,
        strategy_snapshot: Dict[str, Any]
    ) -> Tuple[ForwardTestSessionResponse, str]:
        """Create a new forward testing session (aligned to DB schema)."""
        row_id = uuid4()
        # External string session identifier for cross-service linking
        session_id_str = f"ft_{int(datetime.utcnow().timestamp() * 1000)}"
        now = datetime.utcnow()

        # Derive values expected by schema
        strategy_name = (strategy_snapshot or {}).get("name") or "Strategy"
        name = session_data.session_name or strategy_name
        timeframe = "1m"  # default if not provided by caller

        # Persist full settings for future analytics and controls
        settings_obj: Dict[str, Any] = {
            "symbol": session_data.symbol,
            "timeframe": timeframe,
            "starting_balance": str(session_data.starting_balance),
            "max_position_size_percent": session_data.max_position_size_percent,
            "commission_rate": session_data.commission_rate,
            "slippage_rate": session_data.slippage_rate,
            "risk_management": session_data.risk_management or {},
        }

        async with cls._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO forward_test_sessions (
                    id, session_id, user_id, strategy_id, name, strategy_name,
                    strategy_snapshot, symbol, timeframe, status, settings,
                    initial_balance, current_balance, created_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11,
                    $12, $13, $14
                )
                """,
                row_id,
                session_id_str,
                user_id,
                session_data.strategy_id,
                name,
                strategy_name,
                json.dumps(strategy_snapshot),
                session_data.symbol,
                timeframe,
                SessionStatus.STOPPED.value,
                json.dumps(settings_obj),
                session_data.starting_balance,
                session_data.starting_balance,
                now,
            )

            # Return mapped response (using our shared model fields)
            return ForwardTestSessionResponse(
                id=row_id,
                session_id=session_id_str,
                user_id=user_id,
                strategy_id=session_data.strategy_id,
                strategy_snapshot=strategy_snapshot,
                symbol=session_data.symbol,
                session_name=name,
                strategy_name=strategy_name,
                description=None,
                status=SessionStatus.STOPPED,
                starting_balance=session_data.starting_balance,
                current_balance=session_data.starting_balance,
                current_position_size=Decimal("0"),
                max_position_size_percent=session_data.max_position_size_percent,
                commission_rate=session_data.commission_rate,
                slippage_rate=session_data.slippage_rate,
                risk_management=session_data.risk_management,
                created_at=now,
                started_at=None,
                stopped_at=None,
                last_signal_at=None,
                total_trades=0,
                winning_trades=0,
                losing_trades=0,
                total_pnl=Decimal("0"),
                unrealized_pnl=Decimal("0"),
                max_drawdown=Decimal("0"),
            ), session_id_str
    
    @classmethod
    async def get_session(cls, session_id: UUID, user_id: UUID) -> Optional[ForwardTestSessionResponse]:
        """Get session by UUID id (internal)."""
        async with cls._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT * FROM forward_test_sessions
                WHERE id = $1 AND user_id = $2
                """,
                session_id,
                user_id,
            )

            if not row:
                return None

            return cls._map_row_to_session(row)

    @classmethod
    async def get_session_by_session_id(
        cls, session_id_str: str, user_id: UUID
    ) -> Optional[ForwardTestSessionResponse]:
        """Get session by external string session_id (ft_...)."""
        async with cls._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT * FROM forward_test_sessions
                WHERE session_id = $1 AND user_id = $2
                """,
                session_id_str,
                user_id,
            )

            if not row:
                return None

            return cls._map_row_to_session(row)

    @classmethod
    def _map_row_to_session(cls, row: asyncpg.Record) -> ForwardTestSessionResponse:
        """Map DB row (new schema) to shared response model (legacy fields)."""
        # Settings may be dict or JSON string
        settings_val = row.get("settings")
        if isinstance(settings_val, str):
            try:
                settings_obj = json.loads(settings_val)
            except Exception:
                settings_obj = {}
        else:
            settings_obj = settings_val or {}

        def _get_setting(key: str, default=None):
            return settings_obj.get(key, default)

        return ForwardTestSessionResponse(
            id=row["id"],
            session_id=row.get("session_id"),
            user_id=row["user_id"],
            strategy_id=row["strategy_id"],
            strategy_snapshot=json.loads(row["strategy_snapshot"]) if isinstance(row["strategy_snapshot"], str) else row["strategy_snapshot"],
            symbol=row["symbol"],
            session_name=row.get("name"),
            strategy_name=row.get("strategy_name"),
            description=None,
            status=SessionStatus(row["status"]),
            starting_balance=row.get("initial_balance"),
            current_balance=row.get("current_balance") or row.get("initial_balance"),
            current_position_size=Decimal("0"),
            max_position_size_percent=_get_setting("max_position_size_percent", 0.25),
            commission_rate=_get_setting("commission_rate", 0.001),
            slippage_rate=_get_setting("slippage_rate", 0.0005),
            risk_management=_get_setting("risk_management", {}),
            created_at=row["created_at"],
            started_at=row.get("start_time"),
            stopped_at=row.get("end_time"),
            last_signal_at=None,
            total_trades=row.get("trade_count") or 0,
            winning_trades=0,
            losing_trades=0,
            total_pnl=row.get("total_pnl") or Decimal("0"),
            unrealized_pnl=Decimal("0"),
            max_drawdown=row.get("max_drawdown") or Decimal("0"),
        )

    @classmethod
    async def list_sessions(
        cls,
        user_id: UUID,
        status_filter: Optional[SessionStatus] = None,
        symbol: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> List[ForwardTestSessionResponse]:
        """List sessions for a user with optional filters and pagination."""
        async with cls._pool.acquire() as conn:
            conditions = ["user_id = $1"]
            params: List[Any] = [user_id]
            param_idx = 2

            if status_filter is not None:
                conditions.append(f"status = ${param_idx}")
                params.append(status_filter.value)
                param_idx += 1

            if symbol:
                conditions.append(f"symbol = ${param_idx}")
                params.append(symbol)
                param_idx += 1

            where_clause = " AND ".join(conditions)
            query = f"""
                SELECT * FROM forward_test_sessions
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT ${param_idx} OFFSET ${param_idx + 1}
            """
            params.extend([limit, offset])

            rows = await conn.fetch(query, *params)
            return [cls._map_row_to_session(row) for row in rows]

    @classmethod
    async def delete_session(cls, session_id: UUID, user_id: UUID) -> bool:
        """Delete a session by internal UUID (cascades will remove child rows)."""
        async with cls._pool.acquire() as conn:
            result = await conn.execute(
                """
                DELETE FROM forward_test_sessions
                WHERE id = $1 AND user_id = $2
                """,
                session_id,
                user_id,
            )
            return result == "DELETE 1"
    
    @classmethod
    async def update_session_status(cls, session_id: UUID, status: SessionStatus) -> bool:
        """Update session status."""
        async with cls._pool.acquire() as conn:
            # Persist only statuses allowed by DB CHECK constraint
            allowed = {"STOPPED", "RUNNING", "PAUSED", "ERROR", "COMPLETED"}
            persist_status = status.value if status.value in allowed else "STOPPED"
            result = await conn.execute(
                """
                UPDATE forward_test_sessions
                SET status = $1, updated_at = $2
                WHERE id = $3
                """,
                persist_status,
                datetime.utcnow(),
                session_id,
            )
            
            return result == "UPDATE 1"
    
    @classmethod
    async def get_external_session_id(cls, internal_session_id: UUID) -> Optional[str]:
        """Get external session ID (ft_format) from internal UUID."""
        async with cls._pool.acquire() as conn:
            result = await conn.fetchval(
                "SELECT session_id FROM forward_test_sessions WHERE id = $1",
                internal_session_id
            )
            return result
    
    @classmethod
    async def record_trade(
        cls, 
        session_id: UUID, 
        user_id: UUID,
        trade_data: Dict[str, Any]
    ) -> TradeResponse:
        """Record a trade execution."""
        trade_id = uuid4()
        now = datetime.utcnow()
        
        async with cls._pool.acquire() as conn:
            async with conn.transaction():
                # Insert trade (matching updated database schema)
                # Get the session to retrieve the external session_id
                session_row = await conn.fetchrow("SELECT session_id FROM forward_test_sessions WHERE id = $1", session_id)
                external_session_id = session_row['session_id'] if session_row else str(session_id)
                
                await conn.execute("""
                    INSERT INTO trades (
                        id, session_id, user_id, trade_id, symbol, action, quantity,
                        price, filled_quantity, commission, slippage, total_cost,
                        status, strategy_signal, executed_at, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                """,
                    trade_id, external_session_id, user_id, str(trade_id), trade_data['symbol'],
                    trade_data['action'], trade_data['quantity'], trade_data['price'],
                    trade_data['filled_quantity'], trade_data['commission'],
                    trade_data['slippage'], trade_data['total_cost'],
                    trade_data['status'], json.dumps(trade_data.get('strategy_signal')),
                    now, now
                )
                
                # Update session metrics
                await cls._update_session_after_trade(conn, session_id, trade_data)
                
                return TradeResponse(
                    id=trade_id,
                    session_id=session_id,  # This is the UUID for the TradeResponse model
                    user_id=user_id,
                    symbol=trade_data['symbol'],
                    action=TradeAction(trade_data['action']),
                    quantity=trade_data['quantity'],
                    price=trade_data['price'],
                    filled_quantity=trade_data['filled_quantity'],
                    commission=trade_data['commission'],
                    slippage=trade_data['slippage'],
                    total_cost=trade_data['total_cost'],
                    status=OrderStatus(trade_data['status']),
                    strategy_signal=trade_data.get('strategy_signal'),
                    executed_at=now,
                    created_at=now
                )
    
    @classmethod
    async def _update_session_after_trade(
        cls, 
        conn: asyncpg.Connection, 
        session_id: UUID, 
        trade_data: Dict[str, Any]
    ):
        """Update session metrics after trade execution."""
        # This would update session balance, position, PnL, etc.
        # Implementation depends on specific trading logic
        pass


class MarketDataService:
    """Service for fetching market data from Market Data Service."""
    
    @classmethod
    async def get_current_price(cls, symbol: str) -> Optional[Decimal]:
        """Get current market price for symbol."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{settings.MARKET_DATA_SERVICE_URL}/symbols/{symbol}/latest?limit=1"
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('prices'):
                        return Decimal(str(data['prices'][0]['price']))
                        
        except Exception as e:
            logger.error("Failed to get current price", symbol=symbol, error=str(e))
        
        return None
    
    @classmethod
    async def subscribe_to_symbol(cls, symbol: str) -> bool:
        """Subscribe to real-time market data for symbol."""
        try:
            async with httpx.AsyncClient() as client:
                # Align with Market Data Service route: /symbols/{symbol}/subscribe
                response = await client.post(
                    f"{settings.MARKET_DATA_SERVICE_URL}/symbols/{symbol}/subscribe"
                )
                return response.status_code == 200
                
        except Exception as e:
            logger.error("Failed to subscribe to symbol", symbol=symbol, error=str(e))
            return False


class StrategyService:
    """Service for interacting with Strategy Service."""
    
    @classmethod
    async def get_compiled_strategy(cls, strategy_id: UUID, user_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get full strategy record from Strategy Service (unwraps StandardResponse)."""
        try:
            headers = {"Authorization": f"Bearer {user_token}"} if user_token else {}
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{settings.STRATEGY_SERVICE_URL}/{strategy_id}",
                    headers=headers
                )

                if response.status_code == 200:
                    payload = response.json()
                    if isinstance(payload, dict) and "data" in payload:
                        return payload.get("data")
                    return payload

        except Exception as e:
            logger.error("Failed to get strategy", strategy_id=str(strategy_id), error=str(e))

        return None
    
    @classmethod
    async def get_compiled_strategy_binary(cls, strategy_id: UUID, user_token: str) -> Optional[CompiledStrategy]:
        """Get compiled strategy binary from Strategy Service Redis cache with fallback compilation."""
        try:
            logger.info("🔄 Requesting compiled strategy binary from Strategy Service", 
                       strategy_id=str(strategy_id))
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{settings.STRATEGY_SERVICE_URL}/{strategy_id}/compiled",
                    headers={"Authorization": f"Bearer {user_token}"}
                )
                
                if response.status_code == 200:
                    logger.info("✅ Received compiled strategy binary", 
                               strategy_id=str(strategy_id),
                               content_length=len(response.content))
                    
                    # Deserialize the pickled CompiledStrategy
                    compiled_strategy = pickle.loads(response.content)
                    
                    logger.info("🥒 Successfully unpickled compiled strategy",
                               strategy_id=str(strategy_id),
                               strategy_type=type(compiled_strategy).__name__,
                               node_count=len(compiled_strategy.nodes) if hasattr(compiled_strategy, 'nodes') else 0,
                               execution_order=compiled_strategy.execution_order if hasattr(compiled_strategy, 'execution_order') else [])
                    
                    return compiled_strategy
                
                elif response.status_code == 404:
                    logger.warning("❌ Compiled strategy not found in cache, attempting to compile", 
                                  strategy_id=str(strategy_id))
                    
                    # Fallback: Request compilation
                    compile_response = await client.post(
                        f"{settings.STRATEGY_SERVICE_URL}/{strategy_id}/compile",
                        headers={"Authorization": f"Bearer {user_token}"}
                    )
                    
                    if compile_response.status_code == 200:
                        logger.info("✅ Strategy compiled successfully, fetching binary", 
                                   strategy_id=str(strategy_id))
                        
                        # Now get the compiled binary
                        binary_response = await client.get(
                            f"{settings.STRATEGY_SERVICE_URL}/{strategy_id}/compiled",
                            headers={"Authorization": f"Bearer {user_token}"}
                        )
                        
                        if binary_response.status_code == 200:
                            compiled_strategy = pickle.loads(binary_response.content)
                            logger.info("🎯 Successfully compiled and retrieved strategy",
                                       strategy_id=str(strategy_id))
                            return compiled_strategy
                    
                    logger.error("❌ Failed to compile strategy", 
                                strategy_id=str(strategy_id),
                                compile_status=compile_response.status_code)
                    return None
                else:
                    logger.error("❌ Failed to get compiled strategy binary", 
                                strategy_id=str(strategy_id),
                                status_code=response.status_code,
                                response_text=response.text)
                    
        except Exception as e:
            logger.exception("💥 Error getting compiled strategy binary", 
                           strategy_id=str(strategy_id), 
                           error=str(e))
        
        return None


class TradingEngine:
    """Core trading logic engine."""
    
    def __init__(self, session: ForwardTestSessionResponse):
        self.session = session
        self.current_position = Decimal('0')
        self.cash_balance = session.current_balance
    
    async def execute_signal(self, signal: Dict[str, Any], market_data: MarketData) -> Optional[TradeResponse]:
        """Execute trading signal with risk management."""
        action = signal.get('action')
        quantity = Decimal(str(signal.get('quantity', 0)))
        
        if action == 'HOLD' or quantity <= 0:
            return None
        
        # Risk management checks
        if not self._validate_trade(action, quantity, market_data.price):
            logger.warning("Trade rejected by risk management", 
                         session_id=self.session.id, signal=signal)
            return None
        
        # Calculate trade parameters
        trade_data = self._calculate_trade_execution(action, quantity, market_data)
        
        # Record trade in database
        return await DatabaseService.record_trade(
            self.session.id, 
            self.session.user_id,
            trade_data
        )
    
    def _validate_trade(self, action: str, quantity: Decimal, price: Decimal) -> bool:
        """Validate trade against risk management rules."""
        # Position size check
        position_value = quantity * price
        max_position_value = self.session.starting_balance * Decimal(str(self.session.max_position_size_percent))
        
        if position_value > max_position_value:
            return False
        
        # Balance check for buys
        if action == 'BUY':
            total_cost = position_value * (1 + Decimal(str(self.session.commission_rate)))
            if total_cost > self.cash_balance:
                return False
        
        # Position check for sells
        if action == 'SELL' and quantity > self.current_position:
            return False
        
        return True
    
    def _calculate_trade_execution(
        self, 
        action: str, 
        quantity: Decimal, 
        market_data: MarketData
    ) -> Dict[str, Any]:
        """Calculate realistic trade execution with fees and slippage."""
        base_price = market_data.price
        
        # Apply slippage
        slippage_factor = Decimal(str(self.session.slippage_rate))
        if action == 'BUY':
            execution_price = base_price * (1 + slippage_factor)
        else:
            execution_price = base_price * (1 - slippage_factor)
        
        # Calculate costs
        gross_value = quantity * execution_price
        commission = gross_value * Decimal(str(self.session.commission_rate))
        slippage_cost = abs(execution_price - base_price) * quantity
        
        if action == 'BUY':
            total_cost = gross_value + commission
        else:
            total_cost = gross_value - commission
        
        return {
            'symbol': self.session.symbol,
            'action': action,
            'quantity': quantity,
            'price': execution_price,
            'filled_quantity': quantity,  # Assume full fill for paper trading
            'commission': commission,
            'slippage': slippage_cost,
            'total_cost': total_cost,
            'status': 'FILLED'
        }
