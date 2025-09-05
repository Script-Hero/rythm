"""
AlgoTrade Forward Testing Service
Handles multi-session paper trading with real-time strategy execution.
"""

import asyncio
import time
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional
from uuid import UUID

import structlog
import uvicorn
from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks, Request
from fastapi.responses import JSONResponse

# Add shared models to path
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../..'))

from shared.models.forward_test_models import (
    ForwardTestSessionCreate, ForwardTestSessionUpdate, ForwardTestSessionResponse,
    SessionStatus, TradeResponse, PortfolioSummary, SessionMetrics,
    SessionChartData
)
from shared.response_models import (
    StandardResponse, ListResponse, SessionDetailResponse, CreationResponse
)

from .config import settings
from .services import DatabaseService, MarketDataService, StrategyService, TradingEngine
from .auth import get_current_user, User
from .session_manager import SessionStateManager, SessionValidator, SessionMetricsCalculator
from .strategy_executor import strategy_executor, performance_monitor
from .portfolio_manager import portfolio_manager
from .session_event_publisher import session_event_publisher

# Configure logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(30),
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Global session manager
session_manager = SessionStateManager()


# Helper functions for data retrieval
async def get_portfolio_data(session_id: str, current_user: User) -> dict:
    """Get portfolio data for session detail response."""
    try:
        session = await DatabaseService.get_session_by_session_id(session_id, UUID(current_user.id))
        if not session:
            return {}
        
        # Get actual portfolio data from session
        cash_balance = float(session.current_balance)
        total_value = cash_balance  # Simplified - should add position values
        total_pnl = float(session.total_pnl)
        initial_balance = float(session.starting_balance)
        total_pnl_percent = (total_pnl / initial_balance * 100) if initial_balance > 0 else 0.0
        
        portfolio = PortfolioSummary(
            session_id=session.id,
            cash_balance=cash_balance,
            total_value=total_value,
            total_pnl=total_pnl,
            total_pnl_percent=total_pnl_percent,
            positions=[],  # TODO: Get actual positions from database
            position_count=0,  # TODO: Count actual positions
            updated_at=time.time()
        )
        return portfolio.dict()
    except Exception as e:
        logger.error("Failed to get portfolio data", session_id=session_id, error=str(e))
        return {}


async def get_metrics_data(session_id: str, current_user: User) -> dict:
    """Get metrics data for session detail response."""
    try:
        session = await DatabaseService.get_session_by_session_id(session_id, UUID(current_user.id))
        if not session:
            return {}
        
        # Build metrics from session data
        total_pnl = float(session.total_pnl)
        initial_balance = float(session.starting_balance)
        total_pnl_percent = (total_pnl / initial_balance * 100) if initial_balance > 0 else 0.0
        
        metrics = SessionMetrics(
            session_id=session.id,
            total_trades=session.total_trades,
            winning_trades=session.winning_trades,
            losing_trades=session.losing_trades,
            win_rate=float(session.win_rate),
            total_pnl=session.total_pnl,
            total_pnl_percent=total_pnl_percent,
            max_drawdown=session.max_drawdown,
            max_drawdown_percent=float(session.max_drawdown),
            sharpe_ratio=float(session.sharpe_ratio) if session.sharpe_ratio else None,
            profit_factor=None,  # TODO: Calculate profit factor
            average_trade_pnl=session.total_pnl / max(session.total_trades, 1),
            largest_win=Decimal("0"),  # TODO: Get from trades data
            largest_loss=Decimal("0"),  # TODO: Get from trades data
            consecutive_wins=0,  # TODO: Calculate from trades sequence
            consecutive_losses=0,  # TODO: Calculate from trades sequence
            updated_at=datetime.utcnow()
        )
        return metrics.dict()
    except Exception as e:
        logger.error("Failed to get metrics data", session_id=session_id, error=str(e))
        return {}


async def get_trades_data(session_id: str, current_user: User) -> list:
    """Get trades data for session detail response."""
    try:
        session = await DatabaseService.get_session_by_session_id(session_id, UUID(current_user.id))
        if not session:
            return []
        # TODO: Implement actual trade retrieval
        return []
    except Exception:
        return []


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    logger.info("🚀 Starting Forward Testing Service")
    
    # Initialize services
    await DatabaseService.initialize()
    await session_manager.initialize()
    await strategy_executor.initialize()  # This will also initialize portfolio_manager and session_event_publisher
    await performance_monitor.initialize()
    
    # Start background tasks
    asyncio.create_task(session_monitor())
    
    logger.info("✅ Forward Testing Service initialized")
    
    yield
    
    logger.info("🛑 Shutting down Forward Testing Service")
    
    # Shutdown services
    await strategy_executor.shutdown()
    await session_manager.shutdown()
    await DatabaseService.close()


app = FastAPI(
    title="AlgoTrade Forward Testing Service",
    description="Multi-session paper trading with real-time strategy execution",
    version="1.0.0",
    lifespan=lifespan
)


# Session Management Endpoints
@app.post("/")
async def create_session(
    session_data: ForwardTestSessionCreate,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Create a new forward testing session with enhanced validation."""
    try:
        # Validate session data
        is_valid, validation_errors = SessionValidator.validate_session_creation(session_data.dict())
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Validation errors: {', '.join(validation_errors)}"
            )
        
        # Extract JWT token from Authorization header
        user_token = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            user_token = auth_header[7:]  # Remove "Bearer " prefix

        # Get strategy from Strategy Service (requires auth)
        strategy = await StrategyService.get_compiled_strategy(session_data.strategy_id, user_token)
        if not strategy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found or not compiled"
            )
        
        # Create session in database
        session, ext_session_id = await DatabaseService.create_session(
            user_id=UUID(current_user.id),
            session_data=session_data,
            strategy_snapshot=strategy
        )
        
        # Create session in session manager
        success, error_msg = await session_manager.create_session(session, strategy, user_token)
        if not success:
            # Clean up database session
            # TODO: Implement cleanup
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Session initialization failed: {error_msg}"
            )
        
        logger.info(
            "Forward test session created and initialized",
            session_id=str(session.id),
            user_id=current_user.id,
            symbol=session_data.symbol
        )
        
        return CreationResponse.session_created(
            session_id=str(ext_session_id),
            message="Forward test session created successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Session creation failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Session creation failed"
        )


@app.get("/")
async def list_sessions(
    status_filter: Optional[SessionStatus] = None,
    symbol: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user)
):
    """List user's forward testing sessions."""
    try:
        sessions = await DatabaseService.list_sessions(
            user_id=UUID(current_user.id),
            status_filter=status_filter,
            symbol=symbol,
            limit=limit,
            offset=offset
        )
        return ListResponse.sessions_response([s.dict() for s in sessions], "Sessions retrieved successfully")
        
    except Exception as e:
        logger.error("Failed to list sessions", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve sessions"
        )


@app.get("/{session_id}")
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific forward testing session."""
    try:
        session = await DatabaseService.get_session_by_session_id(session_id, UUID(current_user.id))
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Get additional data for session detail response
        portfolio = await get_portfolio_data(session_id, current_user)
        metrics = await get_metrics_data(session_id, current_user)
        trades = await get_trades_data(session_id, current_user)
        
        return SessionDetailResponse.create(
            session=session,
            portfolio=portfolio,
            metrics=metrics,
            trades=trades
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get session", session_id=str(session_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve session"
        )


@app.put("/{session_id}/status")
async def update_session_status(
    session_id: str,
    session_update: ForwardTestSessionUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a forward testing session."""
    try:
        # Get existing session
        session = await DatabaseService.get_session_by_session_id(session_id, UUID(current_user.id))
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Update status if provided
        if session_update.status:
            await DatabaseService.update_session_status(session.id, session_update.status)
            session.status = session_update.status
            
            logger.info(
                "Session status updated",
                session_id=str(session_id),
                status=session_update.status.value
            )
        
        # TODO: Handle other updates (name, description, risk management)
        
        return StandardResponse.success_response(
            data=session,
            message="Session status updated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Session update failed", session_id=str(session_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Session update failed"
        )


@app.get("/{session_id}/portfolio")
async def get_session_portfolio(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get current portfolio data for a session."""
    try:
        portfolio_data = await get_portfolio_data(session_id, current_user)
        if not portfolio_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found or no portfolio data"
            )
        
        return StandardResponse.success_response(
            data=portfolio_data,
            message="Portfolio data retrieved successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get portfolio data", session_id=session_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve portfolio data"
        )


@app.get("/{session_id}/metrics")
async def get_session_metrics(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get current performance metrics for a session."""
    try:
        metrics_data = await get_metrics_data(session_id, current_user)
        if not metrics_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found or no metrics data"
            )
        
        return StandardResponse.success_response(
            data=metrics_data,
            message="Metrics data retrieved successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get metrics data", session_id=session_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve metrics data"
        )


@app.get("/{session_id}/trades")
async def get_session_trades(
    session_id: str,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get recent trades for a session."""
    try:
        trades_data = await get_trades_data(session_id, current_user)
        
        return StandardResponse.success_response(
            data={"trades": trades_data, "count": len(trades_data)},
            message="Trades data retrieved successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get trades data", session_id=session_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve trades data"
        )


@app.post("/{session_id}/start")
async def start_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Start a forward testing session with enhanced state management."""
    try:
        session = await DatabaseService.get_session_by_session_id(session_id, UUID(current_user.id))
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

        # Validate state transition
        valid_transition, error_msg = SessionValidator.validate_state_transition(
            session.status, SessionStatus.RUNNING
        )
        if not valid_transition:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg
            )

        # Start session through session manager
        success, error_msg = await session_manager.start_session(session.id, UUID(current_user.id))
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to start session: {error_msg}"
            )

        # Start strategy execution with proper initial capital
        runtime_data = session_manager.active_sessions.get(session.id)
        if runtime_data and runtime_data.compiled_strategy:
            success, error_msg = await strategy_executor.start_strategy_execution(
                session_id=session.id,
                user_id=UUID(current_user.id),
                symbol=session.symbol,
                compiled_strategy=runtime_data.compiled_strategy,
                initial_capital=float(session.starting_balance)
            )

            if not success:
                # Rollback session start
                await session_manager.stop_session(session.id, "Strategy execution failed")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to start strategy execution: {error_msg}"
                )

        logger.info("Session started with strategy execution", session_id=str(session.id))
        # Publish lifecycle event
        await session_event_publisher.publish_session_status_change(
            session_id=session.id,
            user_id=UUID(current_user.id),
            old_status=session.status,
            new_status=SessionStatus.RUNNING
        )

        return StandardResponse.success_response(
            message="Session started successfully"
        ).dict()

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to start session", session_id=str(session_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start session"
        )


@app.post("/{session_id}/stop")
async def stop_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Stop a forward testing session."""
    try:
        session = await DatabaseService.get_session_by_session_id(session_id, UUID(current_user.id))
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        if session.status not in [SessionStatus.RUNNING, SessionStatus.PAUSED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Session cannot be stopped from status: {session.status}"
            )
        
        # Update session to stopped
        await DatabaseService.update_session_status(session.id, SessionStatus.STOPPED)
        await session_manager.stop_session(session.id, "User requested")
        # Publish lifecycle event
        await session_event_publisher.publish_session_status_change(
            session_id=session.id,
            user_id=UUID(current_user.id),
            old_status=session.status,
            new_status=SessionStatus.STOPPED,
            reason="User requested"
        )
        
        logger.info("Session stopped", session_id=str(session_id))
        
        return StandardResponse.success_response(
            message="Session stopped successfully"
        ).dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to stop session", session_id=str(session_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to stop session"
        )


@app.post("/{session_id}/pause")
async def pause_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Pause a forward testing session."""
    try:
        session = await DatabaseService.get_session_by_session_id(session_id, UUID(current_user.id))
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        # Validate transition
        valid, error_msg = SessionValidator.validate_state_transition(session.status, SessionStatus.PAUSED)
        if not valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

        success, err = await session_manager.pause_session(session.id)
        if not success:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=err or "Failed to pause session")

        await DatabaseService.update_session_status(session.id, SessionStatus.PAUSED)

        await session_event_publisher.publish_session_status_change(
            session_id=session.id,
            user_id=UUID(current_user.id),
            old_status=session.status,
            new_status=SessionStatus.PAUSED,
            reason="User requested"
        )

        return StandardResponse.success_response(message="Session paused successfully").dict()

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to pause session", session_id=str(session_id), error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to pause session")


@app.post("/{session_id}/resume")
async def resume_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Resume a paused forward testing session."""
    try:
        session = await DatabaseService.get_session_by_session_id(session_id, UUID(current_user.id))
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        # Validate transition
        valid, error_msg = SessionValidator.validate_state_transition(session.status, SessionStatus.RUNNING)
        if not valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

        success, err = await session_manager.resume_session(session.id)
        if not success:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=err or "Failed to resume session")

        await DatabaseService.update_session_status(session.id, SessionStatus.RUNNING)

        await session_event_publisher.publish_session_status_change(
            session_id=session.id,
            user_id=UUID(current_user.id),
            old_status=session.status,
            new_status=SessionStatus.RUNNING,
            reason="User requested"
        )

        return StandardResponse.success_response(message="Session resumed successfully").dict()

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to resume session", session_id=str(session_id), error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to resume session")


@app.delete("/{session_id}")
async def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Delete a forward testing session and related data."""
    try:
        # Resolve session by external string first, then try internal UUID
        session = await DatabaseService.get_session_by_session_id(session_id, UUID(current_user.id))
        if not session:
            try:
                session = await DatabaseService.get_session(UUID(session_id), UUID(current_user.id))
            except Exception:
                session = None

        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        # Stop runtime if active
        try:
            await session_manager.stop_session(session.id, "Deleted by user")
        except Exception:
            pass

        # Delete from database (cascades remove child rows)
        deleted = await DatabaseService.delete_session(session.id, UUID(current_user.id))
        if not deleted:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete session")

        logger.info("Session deleted", session_id=str(session.id))
        return StandardResponse.success_response(message="Session deleted successfully").dict()

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete session", session_id=str(session_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete session"
        )


@app.post("/restore")
async def restore_session_data(
    request: Dict[str, str],
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Restore session data."""
    try:
        session_id = request.get("session_id")
        if not session_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="session_id required"
            )
        
        # Resolve external string session_id to internal UUID
        session_obj = await DatabaseService.get_session_by_session_id(session_id, UUID(current_user.id))
        if not session_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        session_uuid = session_obj.id
        
        # Restore chart data
        success, chart_data = await session_event_publisher.restore_session_chart_data(
            session_uuid, UUID(current_user.id)
        )
        
        # Get portfolio data
        portfolio_summary = await portfolio_manager.get_portfolio_summary(session_uuid)
        
        # Get recent trades
        trades = await portfolio_manager.get_recent_trades(session_uuid, 50)
        
        # Get session from database
        session = await DatabaseService.get_session(session_uuid, UUID(current_user.id))
        
        return {
            "success": success,
            "data": {
                "session": session.dict() if session else None,
                "chart_data": chart_data,
                "portfolio": portfolio_summary,
                "trades": trades,
                "restored_at": time.time()
            },
            "message": "Session data restored successfully" if success else "Failed to restore session data"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to restore session", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to restore session"
        )


# Portfolio and Performance Endpoints
@app.get("/{session_id}/portfolio")
async def get_portfolio(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get current portfolio summary for session."""
    try:
        session = await DatabaseService.get_session_by_session_id(session_id, UUID(current_user.id))
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        portfolio_summary = await portfolio_manager.get_portfolio_summary(session.id)
        
        if not portfolio_summary:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found for session"
            )
        
        return StandardResponse.success_response(
            data=portfolio_summary,
            message="Portfolio retrieved successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get portfolio", session_id=str(session_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve portfolio"
        )


@app.get("/{session_id}/metrics")
async def get_session_metrics(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get performance metrics for session."""
    try:
        # Get real-time metrics from session manager
        session = await DatabaseService.get_session_by_session_id(session_id, UUID(current_user.id))
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        metrics = await session_manager.get_session_metrics(session.id)
        
        if not metrics:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found or not active"
            )
        
        # Convert to SessionMetrics model
        session_metrics = SessionMetrics(
            session_id=session.id,
            total_trades=metrics.get('total_trades', 0),
            winning_trades=metrics.get('winning_trades', 0),
            losing_trades=metrics.get('losing_trades', 0),
            win_rate=metrics.get('win_rate_percent', 0.0),
            total_pnl=metrics.get('total_pnl', 0),
            total_pnl_percent=metrics.get('total_return_percent', 0.0),
            max_drawdown=metrics.get('max_drawdown', 0),
            max_drawdown_percent=0.0,  # TODO: Calculate
            average_trade_pnl=0,  # TODO: Calculate
            largest_win=0,  # TODO: Calculate
            largest_loss=0,  # TODO: Calculate
            consecutive_wins=0,  # TODO: Calculate
            consecutive_losses=0,  # TODO: Calculate
            updated_at=time.time()
        )
        return StandardResponse.success_response(
            data=session_metrics,
            message="Metrics retrieved successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get metrics", session_id=str(session_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve metrics"
        )


@app.get("/{session_id}/status")
async def get_session_status(
    session_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get detailed session status including execution metrics."""
    try:
        # Resolve session and gather status data
        session = await DatabaseService.get_session_by_session_id(session_id, UUID(current_user.id))
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        session_metrics = await session_manager.get_session_metrics(session.id)
        execution_status = await strategy_executor.get_execution_status(session.id)
        performance_metrics = await performance_monitor.get_performance_summary(session.id)

        return {
            "session_id": str(session.id),
            "session_metrics": session_metrics,
            "execution_status": execution_status,
            "performance_metrics": performance_metrics,
            "timestamp": time.time()
        }
        
    except Exception as e:
        logger.error("Failed to get session status", session_id=str(session_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve session status"
        )


@app.get("/{session_id}/trades")
async def get_session_trades(
    session_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user)
):
    """Get trades for session."""
    try:
        session = await DatabaseService.get_session_by_session_id(session_id, UUID(current_user.id))
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        trades = await portfolio_manager.get_recent_trades(session.id, limit)
        return ListResponse.trades_response(trades, "Trades retrieved successfully")
        
    except Exception as e:
        logger.error("Failed to get trades", session_id=str(session_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve trades"
        )


@app.get("/{session_id}/chart")
async def get_chart_data(
    session_id: str,
    limit: int = 1000,
    current_user: User = Depends(get_current_user)
):
    """Get chart data for session."""
    try:
        session = await DatabaseService.get_session_by_session_id(session_id, UUID(current_user.id))
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        chart_data = await session_event_publisher.get_recent_chart_data(session.id, limit)
        
        response_data = SessionChartData(
            session_id=session.id,
            data_points=chart_data,
            updated_at=time.time()
        )
        
        return StandardResponse.success_response(
            data=response_data,
            message="Chart data retrieved successfully"
        )
        
    except Exception as e:
        logger.error("Failed to get chart data", session_id=str(session_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve chart data"
        )


# Background Tasks
async def session_monitor():
    """Monitor running sessions and handle timeouts."""
    while True:
        try:
            # TODO: Implement session monitoring logic
            # - Check for stale sessions
            # - Handle session timeouts
            # - Update session metrics
            
            await asyncio.sleep(30)  # Check every 30 seconds
            
        except Exception as e:
            logger.error("Session monitor error", error=str(e))
            await asyncio.sleep(60)  # Backoff on error


async def run_strategy_session(session_id: UUID):
    """Run strategy execution for a session."""
    try:
        session = await DatabaseService.get_session(session_id, session_id)  # TODO: Fix user_id
        if not session:
            logger.error("Session not found for execution", session_id=str(session_id))
            return
        
        trading_engine = TradingEngine(session)
        
        # TODO: Implement strategy execution loop
        # - Subscribe to market data stream
        # - Execute strategy on each data point
        # - Handle trading signals
        # - Update session metrics
        
        logger.info("Strategy execution started", session_id=str(session_id))
        
        # Placeholder execution loop
        while session.status == SessionStatus.RUNNING:
            await asyncio.sleep(1)  # Real implementation would stream market data
            
            # Get latest market data
            current_price = await MarketDataService.get_current_price(session.symbol)
            if current_price:
                # TODO: Execute strategy and process signals
                pass
        
        logger.info("Strategy execution completed", session_id=str(session_id))
        
    except Exception as e:
        logger.error("Strategy execution failed", session_id=str(session_id), error=str(e))
        await DatabaseService.update_session_status(session_id, SessionStatus.ERROR)


# Health and monitoring
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "service": "forward-test-service",
        "database_connected": DatabaseService._pool is not None
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8003,
        reload=settings.DEBUG
    )
