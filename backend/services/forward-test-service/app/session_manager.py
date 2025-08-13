"""
Session Manager for Forward Testing Service.
Enhanced with Beta1's sophisticated session state management.
"""

import asyncio
import json
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any, Tuple
from uuid import UUID, uuid4
from enum import Enum
from dataclasses import dataclass, asdict

import structlog
import redis.asyncio as redis
from pydantic import BaseModel

from .config import settings
from .services import DatabaseService, MarketDataService, StrategyService

# Add shared models to path
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../..'))

from shared.models.forward_test_models import SessionStatus, ForwardTestSessionResponse
from shared.strategy_engine.compiler import StrategyCompiler, CompiledStrategy

logger = structlog.get_logger()


class SessionState(str, Enum):
    """Session state enumeration with valid transitions."""
    CREATED = "CREATED"
    INITIALIZING = "INITIALIZING"
    READY = "READY"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    STOPPING = "STOPPING"
    STOPPED = "STOPPED"
    ERROR = "ERROR"
    COMPLETED = "COMPLETED"


@dataclass
class SessionRuntimeData:
    """Runtime data for active sessions."""
    session_id: UUID
    user_id: UUID
    compiled_strategy: Optional[CompiledStrategy] = None
    last_price_update: Optional[datetime] = None
    last_signal_timestamp: Optional[datetime] = None
    current_position: Decimal = Decimal('0')
    cash_balance: Decimal = Decimal('10000')
    unrealized_pnl: Decimal = Decimal('0')
    error_count: int = 0
    max_errors: int = 10


class SessionStateManager:
    """
    Enhanced session state management with sophisticated lifecycle control.
    Migrated and improved from Beta1's session management logic.
    """
    
    # Valid state transitions
    VALID_TRANSITIONS = {
        SessionState.CREATED: [SessionState.INITIALIZING, SessionState.ERROR],
        SessionState.INITIALIZING: [SessionState.READY, SessionState.ERROR],
        SessionState.READY: [SessionState.RUNNING, SessionState.STOPPED, SessionState.ERROR],
        SessionState.RUNNING: [SessionState.PAUSED, SessionState.STOPPING, SessionState.ERROR],
        SessionState.PAUSED: [SessionState.RUNNING, SessionState.STOPPING, SessionState.ERROR],
        SessionState.STOPPING: [SessionState.STOPPED, SessionState.ERROR],
        SessionState.STOPPED: [SessionState.READY, SessionState.COMPLETED],
        SessionState.ERROR: [SessionState.READY, SessionState.STOPPED],
        SessionState.COMPLETED: []  # Terminal state
    }
    
    def __init__(self):
        self.active_sessions: Dict[UUID, SessionRuntimeData] = {}
        self.state_locks: Dict[UUID, asyncio.Lock] = {}
        self.redis_client: Optional[redis.Redis] = None
        self.strategy_compiler = StrategyCompiler()
    
    async def initialize(self):
        """Initialize session manager."""
        self.redis_client = redis.Redis.from_url(settings.REDIS_URL)
        await self.redis_client.ping()
        logger.info("Session manager initialized")
    
    async def shutdown(self):
        """Shutdown session manager."""
        # Stop all running sessions
        running_sessions = [
            session_id for session_id, runtime_data in self.active_sessions.items()
        ]
        
        for session_id in running_sessions:
            await self.stop_session(session_id, reason="Service shutdown")
        
        if self.redis_client:
            await self.redis_client.close()
        
        logger.info("Session manager shutdown complete")
    
    async def create_session(
        self, 
        session_data: ForwardTestSessionResponse,
        strategy_json: Dict[str, Any]
    ) -> Tuple[bool, Optional[str]]:
        """Create and initialize a new session."""
        session_id = session_data.id
        
        try:
            # Create session lock
            self.state_locks[session_id] = asyncio.Lock()
            
            async with self.state_locks[session_id]:
                # Initialize runtime data
                runtime_data = SessionRuntimeData(
                    session_id=session_id,
                    user_id=session_data.user_id,
                    cash_balance=session_data.starting_balance
                )
                
                self.active_sessions[session_id] = runtime_data
                
                # Update database status
                await DatabaseService.update_session_status(session_id, SessionStatus.INITIALIZING)
                
                # Compile strategy
                compilation_result = self.strategy_compiler.compile_strategy(strategy_json)
                
                if not compilation_result.success:
                    error_msg = f"Strategy compilation failed: {', '.join(compilation_result.errors)}"
                    await self._handle_session_error(session_id, error_msg)
                    return False, error_msg
                
                runtime_data.compiled_strategy = compilation_result.strategy_instance
                
                # Subscribe to market data
                subscribe_success = await MarketDataService.subscribe_to_symbol(session_data.symbol)
                if not subscribe_success:
                    error_msg = f"Failed to subscribe to market data for {session_data.symbol}"
                    await self._handle_session_error(session_id, error_msg)
                    return False, error_msg
                
                # Mark as ready
                await DatabaseService.update_session_status(session_id, SessionStatus.READY)
                
                logger.info("Session created successfully", session_id=session_id)
                return True, None
                
        except Exception as e:
            error_msg = f"Session creation failed: {str(e)}"
            logger.error("Session creation error", session_id=session_id, error=str(e))
            await self._handle_session_error(session_id, error_msg)
            return False, error_msg
    
    async def start_session(self, session_id: UUID) -> Tuple[bool, Optional[str]]:
        """Start a session (transition to RUNNING state)."""
        if session_id not in self.active_sessions:
            return False, "Session not found"
        
        async with self.state_locks[session_id]:
            try:
                # Update database status
                await DatabaseService.update_session_status(session_id, SessionStatus.RUNNING)
                
                # Start background processing
                asyncio.create_task(self._session_processing_loop(session_id))
                
                logger.info("Session started", session_id=session_id)
                return True, None
                
            except Exception as e:
                error_msg = f"Failed to start session: {str(e)}"
                await self._handle_session_error(session_id, error_msg)
                return False, error_msg
    
    async def pause_session(self, session_id: UUID) -> Tuple[bool, Optional[str]]:
        """Pause a running session."""
        if session_id not in self.active_sessions:
            return False, "Session not found"
        
        async with self.state_locks[session_id]:
            try:
                await DatabaseService.update_session_status(session_id, SessionStatus.PAUSED)
                logger.info("Session paused", session_id=session_id)
                return True, None
                
            except Exception as e:
                return False, f"Failed to pause session: {str(e)}"
    
    async def resume_session(self, session_id: UUID) -> Tuple[bool, Optional[str]]:
        """Resume a paused session."""
        return await self.start_session(session_id)  # Same logic as start
    
    async def stop_session(self, session_id: UUID, reason: str = "User requested") -> Tuple[bool, Optional[str]]:
        """Stop a session."""
        if session_id not in self.active_sessions:
            return False, "Session not found"
        
        async with self.state_locks[session_id]:
            try:
                await DatabaseService.update_session_status(session_id, SessionStatus.STOPPED)
                
                # Clean up runtime data (but keep for potential restart)
                runtime_data = self.active_sessions.get(session_id)
                if runtime_data and runtime_data.compiled_strategy:
                    runtime_data.compiled_strategy.reset()
                
                logger.info("Session stopped", session_id=session_id, reason=reason)
                return True, None
                
            except Exception as e:
                return False, f"Failed to stop session: {str(e)}"
    
    async def delete_session(self, session_id: UUID) -> Tuple[bool, Optional[str]]:
        """Delete a session and clean up all resources."""
        # Stop session first
        await self.stop_session(session_id, "Session deletion")
        
        try:
            # Remove from active sessions
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]
            
            # Remove state lock
            if session_id in self.state_locks:
                del self.state_locks[session_id]
            
            # Clear Redis cache
            if self.redis_client:
                await self.redis_client.delete(f"session:{session_id}:*")
            
            logger.info("Session deleted", session_id=session_id)
            return True, None
            
        except Exception as e:
            return False, f"Failed to delete session: {str(e)}"
    
    async def process_market_data(
        self, 
        session_id: UUID, 
        market_data: Dict[str, Any]
    ) -> Tuple[bool, Optional[str]]:
        """Process new market data for a session."""
        if session_id not in self.active_sessions:
            return False, "Session not found"
        
        runtime_data = self.active_sessions[session_id]
        
        # Check if session is running
        session = await DatabaseService.get_session(session_id, runtime_data.user_id)
        if not session or session.status != SessionStatus.RUNNING:
            return False, "Session not running"
        
        try:
            # Execute strategy with market data
            if runtime_data.compiled_strategy:
                signals = runtime_data.compiled_strategy.execute(market_data)
                
                # Process any trading signals
                for signal in signals:
                    await self._process_trading_signal(session_id, signal, market_data)
                
                # Update last price update
                runtime_data.last_price_update = datetime.utcnow()
            
            return True, None
            
        except Exception as e:
            logger.error("Market data processing error", 
                        session_id=session_id, error=str(e))
            
            # Increment error count
            runtime_data.error_count += 1
            if runtime_data.error_count >= runtime_data.max_errors:
                await self._handle_session_error(session_id, f"Too many processing errors: {str(e)}")
            
            return False, str(e)
    
    async def get_session_metrics(self, session_id: UUID) -> Optional[Dict[str, Any]]:
        """Get real-time session metrics."""
        if session_id not in self.active_sessions:
            return None
        
        runtime_data = self.active_sessions[session_id]
        session = await DatabaseService.get_session(session_id, runtime_data.user_id)
        
        if not session:
            return None
        
        # Calculate metrics
        total_return = ((session.current_balance - session.starting_balance) / session.starting_balance) * 100
        win_rate = (session.winning_trades / max(session.total_trades, 1)) * 100
        
        return {
            "session_id": str(session_id),
            "status": session.status.value,
            "current_balance": float(session.current_balance),
            "starting_balance": float(session.starting_balance),
            "current_position": float(runtime_data.current_position),
            "unrealized_pnl": float(runtime_data.unrealized_pnl),
            "total_pnl": float(session.total_pnl),
            "total_return_percent": float(total_return),
            "total_trades": session.total_trades,
            "winning_trades": session.winning_trades,
            "losing_trades": session.losing_trades,
            "win_rate_percent": float(win_rate),
            "max_drawdown": float(session.max_drawdown),
            "last_price_update": runtime_data.last_price_update.isoformat() if runtime_data.last_price_update else None,
            "error_count": runtime_data.error_count
        }
    
    async def _session_processing_loop(self, session_id: UUID):
        """Background processing loop for active session."""
        runtime_data = self.active_sessions.get(session_id)
        if not runtime_data:
            return
        
        logger.info("Starting processing loop", session_id=session_id)
        
        try:
            while session_id in self.active_sessions:
                session = await DatabaseService.get_session(session_id, runtime_data.user_id)
                
                if not session or session.status != SessionStatus.RUNNING:
                    break
                
                # Check for new market data from Redis sliding window
                latest_price = await MarketDataService.get_current_price(session.symbol)
                
                if latest_price:
                    market_data = {
                        "symbol": session.symbol,
                        "price": float(latest_price),
                        "volume": 1000.0,  # Placeholder
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    
                    await self.process_market_data(session_id, market_data)
                
                # Sleep before next iteration
                await asyncio.sleep(1)  # Process every second
                
        except asyncio.CancelledError:
            logger.info("Processing loop cancelled", session_id=session_id)
        except Exception as e:
            logger.error("Processing loop error", session_id=session_id, error=str(e))
            await self._handle_session_error(session_id, f"Processing loop error: {str(e)}")
    
    async def _process_trading_signal(
        self, 
        session_id: UUID, 
        signal: Dict[str, Any], 
        market_data: Dict[str, Any]
    ):
        """Process a trading signal generated by strategy."""
        runtime_data = self.active_sessions[session_id]
        session = await DatabaseService.get_session(session_id, runtime_data.user_id)
        
        if not session:
            return
        
        action = signal.get('action')
        quantity = Decimal(str(signal.get('quantity', 0)))
        price = Decimal(str(market_data['price']))
        
        logger.info("Processing trading signal", 
                   session_id=session_id, action=action, quantity=quantity, price=price)
        
        # Import TradingEngine here to avoid circular imports
        from .services import TradingEngine
        
        # Execute trade
        trading_engine = TradingEngine(session)
        trading_engine.current_position = runtime_data.current_position
        trading_engine.cash_balance = runtime_data.cash_balance
        
        # Create market data object
        from .services import MarketData
        market_data_obj = MarketData(
            symbol=session.symbol,
            price=price,
            volume=Decimal(str(market_data.get('volume', 1000))),
            timestamp=datetime.utcnow()
        )
        
        trade_result = await trading_engine.execute_signal(signal, market_data_obj)
        
        if trade_result:
            # Update runtime data
            if action == 'BUY':
                runtime_data.current_position += quantity
                runtime_data.cash_balance -= trade_result.total_cost
            elif action == 'SELL':
                runtime_data.current_position -= quantity
                runtime_data.cash_balance += trade_result.total_cost
            
            runtime_data.last_signal_timestamp = datetime.utcnow()
            
            logger.info("Trade executed", 
                       session_id=session_id, trade_id=trade_result.id)
    
    async def _handle_session_error(self, session_id: UUID, error_message: str):
        """Handle session errors and transition to error state."""
        try:
            await DatabaseService.update_session_status(session_id, SessionStatus.ERROR)
            logger.error("Session error", session_id=session_id, error=error_message)
            
            # Store error in Redis for debugging
            if self.redis_client:
                await self.redis_client.setex(
                    f"session:{session_id}:error",
                    3600,  # 1 hour TTL
                    json.dumps({
                        "error": error_message,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                )
        
        except Exception as e:
            logger.error("Failed to handle session error", 
                        session_id=session_id, original_error=error_message, 
                        handler_error=str(e))


class SessionValidator:
    """
    Session validation logic migrated from Beta1.
    Validates session parameters and state transitions.
    """
    
    @staticmethod
    def validate_session_creation(session_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate session creation parameters."""
        errors = []
        
        # Required fields
        required_fields = ['symbol', 'starting_balance', 'strategy_id']
        for field in required_fields:
            if field not in session_data or not session_data[field]:
                errors.append(f"Missing required field: {field}")
        
        # Validate starting balance
        try:
            balance = Decimal(str(session_data.get('starting_balance', 0)))
            if balance <= 0:
                errors.append("Starting balance must be positive")
            if balance > Decimal('1000000'):  # 1M limit
                errors.append("Starting balance exceeds maximum allowed")
        except (ValueError, TypeError):
            errors.append("Invalid starting balance format")
        
        # Validate symbol format
        symbol = session_data.get('symbol', '')
        if not symbol or len(symbol) < 3:
            errors.append("Invalid symbol format")
        
        # Validate risk management settings
        if 'max_position_size_percent' in session_data:
            try:
                max_pos = float(session_data['max_position_size_percent'])
                if max_pos <= 0 or max_pos > 1:
                    errors.append("Max position size must be between 0 and 1")
            except (ValueError, TypeError):
                errors.append("Invalid max position size format")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_state_transition(
        current_state: SessionStatus, 
        target_state: SessionStatus
    ) -> Tuple[bool, Optional[str]]:
        """Validate if state transition is allowed."""
        # Convert to internal enum for validation
        try:
            current = SessionState(current_state.value)
            target = SessionState(target_state.value)
            
            if target in SessionStateManager.VALID_TRANSITIONS.get(current, []):
                return True, None
            else:
                return False, f"Invalid transition from {current.value} to {target.value}"
                
        except ValueError:
            return False, "Invalid session state"


class SessionMetricsCalculator:
    """
    Enhanced metrics calculation migrated from Beta1.
    Provides real-time performance analytics.
    """
    
    @staticmethod
    async def calculate_session_metrics(session_id: UUID) -> Dict[str, Any]:
        """Calculate comprehensive session metrics."""
        # This would be implemented with database queries
        # to calculate Sharpe ratio, drawdown, etc.
        # Placeholder for now
        return {
            "sharpe_ratio": 0.0,
            "sortino_ratio": 0.0,
            "max_drawdown_percent": 0.0,
            "calmar_ratio": 0.0,
            "profit_factor": 0.0,
            "average_trade_duration": 0,
            "largest_winning_trade": 0.0,
            "largest_losing_trade": 0.0
        }
    
    @staticmethod
    def calculate_real_time_pnl(
        current_position: Decimal, 
        entry_price: Decimal, 
        current_price: Decimal
    ) -> Decimal:
        """Calculate real-time unrealized PnL."""
        if current_position == 0:
            return Decimal('0')
        
        return current_position * (current_price - entry_price)
    
    @staticmethod
    def calculate_drawdown(balance_history: List[Decimal]) -> Tuple[Decimal, Decimal]:
        """Calculate current and maximum drawdown."""
        if len(balance_history) < 2:
            return Decimal('0'), Decimal('0')
        
        running_max = balance_history[0]
        max_drawdown = Decimal('0')
        current_drawdown = Decimal('0')
        
        for balance in balance_history[1:]:
            if balance > running_max:
                running_max = balance
                current_drawdown = Decimal('0')
            else:
                current_drawdown = (running_max - balance) / running_max
                max_drawdown = max(max_drawdown, current_drawdown)
        
        return current_drawdown, max_drawdown