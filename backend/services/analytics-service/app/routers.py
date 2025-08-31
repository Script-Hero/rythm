"""
API routers for Analytics Service.
"""

from typing import Dict, Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from .database import get_db
from .auth import get_current_user
from .analytics_engine import AnalyticsEngine
from .cache_manager import CacheManager
from .response_models import (
    LiveAnalyticsResponse, KeyMetricsResponse, BacktestAnalyticsSummary,
    ForwardTestPerformanceResponse, HealthCheckResponse, ErrorResponse
)

logger = structlog.get_logger()

# Create routers
analytics_router = APIRouter(prefix="/api/analytics", tags=["analytics"])
health_router = APIRouter(tags=["health"])

# Initialize services
analytics_engine = AnalyticsEngine()
cache_manager = CacheManager()


@health_router.get("/health", response_model=HealthCheckResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check endpoint with dependency status."""
    import time
    from .database import health_check as db_health_check
    
    # Check dependencies
    db_healthy = await db_health_check()
    redis_healthy = await cache_manager.health_check()
    
    dependencies = {
        "database": db_healthy,
        "redis": redis_healthy
    }
    
    # Overall status
    all_healthy = all(dependencies.values())
    status_text = "healthy" if all_healthy else "degraded"
    
    return HealthCheckResponse(
        status=status_text,
        timestamp=time.time(),
        service="analytics-service",
        dependencies=dependencies,
        message="All systems operational" if all_healthy else "Some dependencies unavailable"
    )


@analytics_router.get("/forward-test/{session_id}/live", response_model=LiveAnalyticsResponse)
async def get_live_analytics(
    session_id: str,
    force_recalculate: bool = Query(False, description="Force recalculation, bypass cache"),
    current_user: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get real-time analytics for a forward testing session.
    
    Args:
        session_id: Forward test session ID
        force_recalculate: Bypass cache and force recalculation
        current_user: Current authenticated user
        db: Database session
    """
    try:
        logger.info("Getting live analytics", session_id=session_id, user_id=str(current_user))
        
        # Check cache first (unless forced recalculation)
        # Ensure Redis connection before cache operations
        await cache_manager.ensure_connected()

        if not force_recalculate:
            cached_analytics = await cache_manager.get_live_analytics(session_id)
            if cached_analytics:
                logger.debug("Returning cached live analytics", session_id=session_id)
                return LiveAnalyticsResponse(**cached_analytics)
        
        # Calculate fresh analytics
        analytics = await analytics_engine.calculate_live_analytics(db, session_id)
        
        if not analytics:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found or no data available"
            )
        
        # Verify user owns this session (security check)
        await _verify_session_ownership(db, session_id, current_user)
        
        # Cache the results
        await cache_manager.set_live_analytics(session_id, analytics)
        
        return LiveAnalyticsResponse(**analytics)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get live analytics", error=str(e), session_id=session_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to calculate analytics"
        )


@analytics_router.get("/forward-test/{session_id}/performance", response_model=ForwardTestPerformanceResponse)
async def get_forward_test_performance(
    session_id: str,
    current_user: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get performance summary for a forward testing session.
    
    Args:
        session_id: Forward test session ID
        current_user: Current authenticated user
        db: Database session
    """
    try:
        # Verify ownership
        await _verify_session_ownership(db, session_id, current_user)
        
        # Get analytics
        analytics = await analytics_engine.calculate_live_analytics(db, session_id)
        
        if not analytics:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found"
            )
        
        # Calculate performance score
        performance_data = _calculate_performance_score(analytics)
        
        return ForwardTestPerformanceResponse(
            session_id=session_id,
            updated_at=analytics["calculated_at"],
            **performance_data
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get forward test performance", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get performance data"
        )


@analytics_router.get("/backtest/{backtest_id}/key-metrics", response_model=KeyMetricsResponse)
async def get_backtest_key_metrics(
    backtest_id: UUID,
    current_user: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get key metrics for a backtest result.
    
    Args:
        backtest_id: Backtest result ID
        current_user: Current authenticated user
        db: Database session
    """
    try:
        # Check cache first
        backtest_id_str = str(backtest_id)
        cached_analytics = await cache_manager.get_backtest_analytics(backtest_id_str)
        
        if cached_analytics and "key_metrics" in cached_analytics:
            return KeyMetricsResponse(**cached_analytics["key_metrics"])
        
        # Calculate analytics
        analytics = await analytics_engine.calculate_backtest_analytics(db, backtest_id_str)
        
        if not analytics:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Backtest {backtest_id} not found"
            )
        
        # Verify ownership
        await _verify_backtest_ownership(db, backtest_id, current_user)
        
        # Extract key metrics
        key_metrics = _extract_key_metrics(analytics)
        
        # Cache the results
        full_analytics = {"key_metrics": key_metrics}
        await cache_manager.set_backtest_analytics(backtest_id_str, full_analytics)
        
        return KeyMetricsResponse(**key_metrics)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get backtest key metrics", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to calculate backtest metrics"
        )


@analytics_router.get("/backtest/{backtest_id}/summary", response_model=BacktestAnalyticsSummary)
async def get_backtest_summary(
    backtest_id: UUID,
    current_user: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get complete analytics summary for a backtest.
    
    Args:
        backtest_id: Backtest result ID
        current_user: Current authenticated user
        db: Database session
    """
    try:
        # Verify ownership
        await _verify_backtest_ownership(db, backtest_id, current_user)
        
        # Calculate analytics
        backtest_id_str = str(backtest_id)
        analytics = await analytics_engine.calculate_backtest_analytics(db, backtest_id_str)
        
        if not analytics:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Backtest {backtest_id} not found"
            )
        
        # Format response
        summary = BacktestAnalyticsSummary(
            backtest_id=backtest_id_str,
            calculated_at=analytics["calculated_at"],
            key_metrics=KeyMetricsResponse(**_extract_key_metrics(analytics)),
            performance_metrics=analytics["performance_metrics"],
            risk_metrics=analytics["risk_metrics"],
            trading_metrics=analytics["trading_metrics"]
        )
        
        return summary
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get backtest summary", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get backtest summary"
        )



# Helper functions

async def _verify_session_ownership(db: AsyncSession, session_id: str, user_id: UUID):
    """Verify that the user owns the forward test session."""
    from sqlalchemy import select
    from .models import ForwardTestSession
    
    result = await db.execute(
        select(ForwardTestSession.user_id)
        .where(ForwardTestSession.session_id == session_id)
    )
    session_user_id = result.scalar_one_or_none()
    
    if not session_user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    if session_user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )


async def _verify_backtest_ownership(db: AsyncSession, backtest_id: UUID, user_id: UUID):
    """Verify that the user owns the backtest."""
    from sqlalchemy import select
    from .models import BacktestResult
    
    result = await db.execute(
        select(BacktestResult.user_id)
        .where(BacktestResult.id == backtest_id)
    )
    backtest_user_id = result.scalar_one_or_none()
    
    if not backtest_user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backtest not found"
        )
    
    if backtest_user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )


def _calculate_performance_score(analytics: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate performance score and ratings."""
    perf_metrics = analytics.get("performance_metrics", {})
    risk_metrics = analytics.get("risk_metrics", {})
    trading_metrics = analytics.get("trading_metrics", {})
    
    # Performance scoring algorithm
    sharpe_ratio = perf_metrics.get("sharpe_ratio", 0)
    win_rate = trading_metrics.get("win_rate", 0) / 100  # Convert to 0-1
    max_drawdown_pct = abs(risk_metrics.get("max_drawdown_pct", 0)) / 100  # Convert to 0-1
    
    # Component scores
    sharpe_component = min(max(sharpe_ratio * 15, -30), 30) if sharpe_ratio else 0
    win_rate_component = win_rate * 30
    drawdown_penalty = max_drawdown_pct * 20
    
    # Overall score (0-100)
    score = max(0, min(100, 50 + sharpe_component + win_rate_component - drawdown_penalty))
    
    # Ratings
    def get_rating(score: float) -> str:
        if score >= 80: return "Excellent"
        elif score >= 65: return "Good"
        elif score >= 50: return "Fair"
        else: return "Poor"
    
    def rate_sharpe(sharpe: float) -> str:
        if sharpe >= 2.0: return "Excellent"
        elif sharpe >= 1.0: return "Good"
        elif sharpe >= 0.5: return "Fair"
        else: return "Poor"
    
    def rate_win_rate(wr: float) -> str:
        if wr >= 70: return "Excellent"
        elif wr >= 60: return "Good"
        elif wr >= 50: return "Fair"
        else: return "Poor"
    
    def rate_drawdown(dd: float) -> str:
        if abs(dd) <= 5: return "Excellent"
        elif abs(dd) <= 10: return "Good"
        elif abs(dd) <= 20: return "Fair"
        else: return "Poor"
    
    def assess_risk_level(dd: float) -> str:
        if abs(dd) <= 10: return "Low"
        elif abs(dd) <= 25: return "Medium"
        else: return "High"
    
    return {
        "performance_score": score,
        "rating": get_rating(score),
        "sharpe_rating": rate_sharpe(sharpe_ratio or 0),
        "win_rate_rating": rate_win_rate(trading_metrics.get("win_rate", 0)),
        "drawdown_rating": rate_drawdown(risk_metrics.get("max_drawdown_pct", 0)),
        "risk_level": assess_risk_level(risk_metrics.get("max_drawdown_pct", 0)),
        "total_return_pct": perf_metrics.get("total_return_pct", 0),
        "sharpe_ratio": sharpe_ratio,
        "max_drawdown_pct": risk_metrics.get("max_drawdown_pct", 0),
        "win_rate": trading_metrics.get("win_rate", 0),
        "total_trades": trading_metrics.get("total_trades", 0)
    }


def _extract_key_metrics(analytics: Dict[str, Any]) -> Dict[str, Any]:
    """Extract key metrics from analytics data."""
    perf_metrics = analytics.get("performance_metrics", {})
    risk_metrics = analytics.get("risk_metrics", {})
    trading_metrics = analytics.get("trading_metrics", {})
    
    return {
        "cagr": perf_metrics.get("cagr", 0),
        "sharpe_ratio": perf_metrics.get("sharpe_ratio"),
        "sortino_ratio": None,  # TODO: Implement Sortino ratio
        "information_ratio": None,  # TODO: Implement Information ratio
        "max_drawdown": risk_metrics.get("max_drawdown_pct", 0),
        "turnover_ratio": None,  # TODO: Implement turnover ratio
        "trades_per_day": trading_metrics.get("total_trades", 0) / max(perf_metrics.get("runtime_days", 1), 1),
        "win_rate": trading_metrics.get("win_rate", 0),
        "capacity": None,  # TODO: Implement capacity estimation
        "runtime_days": perf_metrics.get("runtime_days", 0),
        "runtime_years": perf_metrics.get("runtime_years", 0)
    }
