"""
AlgoTrade Analytics Service
Provides real-time and historical analytics for trading strategies.
"""

import asyncio
from contextlib import asynccontextmanager
from typing import Dict, Any

import structlog
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .cache_manager import CacheManager
from .kafka_processor import AnalyticsKafkaProcessor
from .routers import analytics_router, health_router

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

# Global services
cache_manager = CacheManager()
kafka_processor = AnalyticsKafkaProcessor()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    # Startup
    logger.info("🚀 ANALYTICS SERVICE: Starting Analytics Service")
    logger.info("🔧 ANALYTICS SERVICE: Configuration", 
               debug_mode=settings.DEBUG,
               service_port=settings.SERVICE_PORT if hasattr(settings, 'SERVICE_PORT') else 'unknown')
    
    try:
        # Initialize database
        logger.info("📊 ANALYTICS SERVICE: Initializing database")
        await init_db()
        logger.info("✅ ANALYTICS SERVICE: Database initialized")
        
        # Connect to Redis
        logger.info("🔴 ANALYTICS SERVICE: Connecting to Redis")
        await cache_manager.connect()
        logger.info("✅ ANALYTICS SERVICE: Connected to Redis")
        
        # Start Kafka processor in background
        kafka_task = None
        if not settings.DEBUG:  # Skip Kafka in debug mode
            logger.info("📨 ANALYTICS SERVICE: Starting Kafka processor")
            kafka_task = asyncio.create_task(kafka_processor.start())
            logger.info("✅ ANALYTICS SERVICE: Kafka processor started")
        else:
            logger.info("⚠️ ANALYTICS SERVICE: Skipping Kafka in debug mode")
        
        logger.info("🎯 ANALYTICS SERVICE: Startup complete, ready to serve requests")
        yield
        
    except Exception as e:
        logger.error("❌ ANALYTICS SERVICE: STARTUP FAILED", error=str(e))
        import traceback
        logger.error("❌ ANALYTICS SERVICE: Startup traceback", traceback=traceback.format_exc())
        raise
    
    finally:
        # Shutdown
        logger.info("🛑 ANALYTICS SERVICE: Shutting down Analytics Service")
        
        # Stop Kafka processor
        if kafka_task and not kafka_task.done():
            logger.info("📨 ANALYTICS SERVICE: Stopping Kafka processor")
            kafka_task.cancel()
            try:
                await kafka_task
            except asyncio.CancelledError:
                logger.info("✅ ANALYTICS SERVICE: Kafka processor cancelled")
        
        await kafka_processor.stop()
        
        # Disconnect Redis
        logger.info("🔴 ANALYTICS SERVICE: Disconnecting Redis")
        await cache_manager.disconnect()
        
        logger.info("✅ ANALYTICS SERVICE: Shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="AlgoTrade Analytics Service",
    description="Real-time and historical analytics for trading strategies",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)
app.include_router(analytics_router)

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint."""
    logger.info("🏠 ANALYTICS SERVICE: Root endpoint accessed")
    return {
        "service": "analytics-service",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.post("/calculate-metrics")
async def calculate_metrics_for_backtest(request: dict):
    """
    Calculate metrics for backtest data (used by backtesting service).
    
    Expected request format:
    {
        "portfolio_values": [{"timestamp": int, "value": float}],
        "trades": [{"trade_id": str, "pnl": float, "timestamp": str}],
        "initial_capital": float,
        "final_capital": float
    }
    """
    import structlog
    logger = structlog.get_logger()
    
    try:
        logger.info("🎯 ANALYTICS SERVICE: Received calculate-metrics request")
        logger.info("📊 ANALYTICS SERVICE: Request details", 
                   request_keys=list(request.keys()),
                   portfolio_values_count=len(request.get("portfolio_values", [])),
                   trades_count=len(request.get("trades", [])),
                   initial_capital=request.get("initial_capital"),
                   final_capital=request.get("final_capital"))
        
        portfolio_values = request.get("portfolio_values", [])
        trades = request.get("trades", [])
        initial_capital = request.get("initial_capital", 0)
        final_capital = request.get("final_capital", 0)
        
        logger.info("📈 ANALYTICS SERVICE: Extracted request data",
                   portfolio_values_sample=portfolio_values[:3] if portfolio_values else [],
                   trades_sample=trades[:3] if trades else [],
                   initial_capital=initial_capital,
                   final_capital=final_capital)
        
        if not portfolio_values:
            logger.info("⚠️ ANALYTICS SERVICE: No portfolio values provided, using basic calculations")
            # Create basic analytics if no portfolio data
            total_return_pct = ((final_capital - initial_capital) / initial_capital * 100) if initial_capital > 0 else 0
            
            basic_result = {
                "total_return_pct": total_return_pct,
                "sharpe_ratio": 0,
                "max_drawdown": 0,
                "max_drawdown_pct": 0,
                "volatility": 0,
                "win_rate": 0,
                "total_trades": len(trades),
                "avg_trade_pnl": sum(trade.get("pnl", 0) for trade in trades) / len(trades) if trades else 0,
                "profit_factor": 1.0
            }
            
            logger.info("📊 ANALYTICS SERVICE: Returning basic analytics", result=basic_result)
            return basic_result
        
        logger.info("🧮 ANALYTICS SERVICE: Starting full analytics calculation")
        
        # Calculate basic metrics from portfolio values
        values = [pv["value"] for pv in portfolio_values]
        logger.info("📈 ANALYTICS SERVICE: Portfolio values extracted",
                   values_count=len(values),
                   values_sample=values[:5] if values else [],
                   min_value=min(values) if values else None,
                   max_value=max(values) if values else None)
        
        # Total return
        total_return_pct = ((final_capital - initial_capital) / initial_capital * 100) if initial_capital > 0 else 0
        logger.info("💰 ANALYTICS SERVICE: Total return calculated",
                   initial_capital=initial_capital,
                   final_capital=final_capital,
                   total_return_pct=total_return_pct)
        
        # Max drawdown calculation  
        peak = initial_capital
        max_drawdown = 0
        for i, value in enumerate(values):
            if value > peak:
                peak = value
            drawdown = peak - value
            if drawdown > max_drawdown:
                max_drawdown = drawdown
                logger.info("📉 ANALYTICS SERVICE: New max drawdown found",
                           step=i,
                           peak=peak,
                           current_value=value,
                           drawdown=drawdown)
        
        max_drawdown_pct = (max_drawdown / peak * 100) if peak > 0 else 0
        logger.info("📉 ANALYTICS SERVICE: Max drawdown calculated",
                   max_drawdown=max_drawdown,
                   max_drawdown_pct=max_drawdown_pct,
                   peak=peak)
        
        # Simple volatility (standard deviation of returns)
        logger.info("📊 ANALYTICS SERVICE: Starting volatility calculation")
        if len(values) > 1:
            returns = [(values[i] - values[i-1]) / values[i-1] for i in range(1, len(values)) if values[i-1] != 0]
            logger.info("📊 ANALYTICS SERVICE: Returns calculated",
                       returns_count=len(returns),
                       returns_sample=returns[:5] if returns else [],
                       avg_return_preview=sum(returns) / len(returns) if returns else 0)
            
            if returns:
                avg_return = sum(returns) / len(returns)
                variance = sum((r - avg_return) ** 2 for r in returns) / len(returns)
                volatility = variance ** 0.5
                # Simple Sharpe approximation (assuming risk-free rate = 0)
                sharpe_ratio = avg_return / volatility if volatility > 0 else 0
                
                logger.info("📊 ANALYTICS SERVICE: Volatility and Sharpe calculated",
                           avg_return=avg_return,
                           variance=variance,
                           volatility=volatility,
                           sharpe_ratio=sharpe_ratio)
            else:
                volatility = 0
                sharpe_ratio = 0
                logger.info("⚠️ ANALYTICS SERVICE: No valid returns, setting volatility and Sharpe to 0")
        else:
            volatility = 0 
            sharpe_ratio = 0
            logger.info("⚠️ ANALYTICS SERVICE: Insufficient values for volatility calculation")
        
        # Trade metrics
        logger.info("💹 ANALYTICS SERVICE: Starting trade metrics calculation")
        winning_trades = [t for t in trades if t.get("pnl", 0) > 0]
        losing_trades = [t for t in trades if t.get("pnl", 0) < 0]
        win_rate = (len(winning_trades) / len(trades) * 100) if trades else 0
        avg_trade_pnl = sum(trade.get("pnl", 0) for trade in trades) / len(trades) if trades else 0
        
        logger.info("💹 ANALYTICS SERVICE: Trade breakdown",
                   total_trades=len(trades),
                   winning_trades=len(winning_trades),
                   losing_trades=len(losing_trades),
                   win_rate=win_rate,
                   avg_trade_pnl=avg_trade_pnl)
        
        # Profit factor
        gross_profit = sum(t.get("pnl", 0) for t in winning_trades)
        gross_loss = abs(sum(t.get("pnl", 0) for t in trades if t.get("pnl", 0) < 0))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf') if gross_profit > 0 else 1.0
        
        logger.info("💰 ANALYTICS SERVICE: Profit metrics",
                   gross_profit=gross_profit,
                   gross_loss=gross_loss,
                   profit_factor=profit_factor)
        
        # Calculate advanced metrics
        logger.info("🧮 ANALYTICS SERVICE: Calculating advanced risk-adjusted metrics")
        
        # Calculate Sortino ratio (downside deviation-based)
        downside_returns = [r for r in returns if r < 0] if returns else []
        if downside_returns:
            downside_deviation = (sum(r**2 for r in downside_returns) / len(downside_returns)) ** 0.5
            sortino_ratio = (avg_return / downside_deviation) * (252 ** 0.5) if downside_deviation > 0 else 0
        else:
            sortino_ratio = sharpe_ratio if sharpe_ratio > 0 else 0
        
        # Calculate Calmar ratio (Annual return / Max drawdown)
        trading_period_years = max(len(values) / 252, 1/252)  # Minimum 1 trading day
        annual_return = total_return_pct / trading_period_years
        calmar_ratio = annual_return / max_drawdown_pct if max_drawdown_pct > 0 else 0
        
        # Calculate CAGR
        cagr = ((final_capital / initial_capital) ** (1 / trading_period_years) - 1) * 100 if trading_period_years > 0 and initial_capital > 0 else 0
        
        # Calculate Kelly Criterion
        kelly_criterion = 0
        if winning_trades and losing_trades and avg_trade_pnl != 0:
            avg_win_abs = sum(t.get("pnl", 0) for t in winning_trades) / len(winning_trades)
            avg_loss_abs = abs(sum(t.get("pnl", 0) for t in losing_trades) / len(losing_trades))
            if avg_loss_abs > 0:
                win_rate_decimal = win_rate / 100
                payoff_ratio = avg_win_abs / avg_loss_abs
                kelly_criterion = max(0, min((payoff_ratio * win_rate_decimal - (1 - win_rate_decimal)) / payoff_ratio, 0.25))
        
        # Calculate consecutive trades
        consecutive_wins = 0
        consecutive_losses = 0
        if trades:
            current_wins = 0
            current_losses = 0
            max_wins = 0
            max_losses = 0
            
            for trade in trades:
                pnl = trade.get("pnl", 0)
                if pnl > 0:
                    current_wins += 1
                    current_losses = 0
                    max_wins = max(max_wins, current_wins)
                elif pnl < 0:
                    current_losses += 1
                    current_wins = 0
                    max_losses = max(max_losses, current_losses)
            
            consecutive_wins = max_wins
            consecutive_losses = max_losses
        
        # Calculate derived metrics
        avg_win = gross_profit / len(winning_trades) if winning_trades else 0
        avg_loss = gross_loss / len(losing_trades) if losing_trades else 0
        win_loss_ratio = avg_win / avg_loss if avg_loss > 0 else 0
        expectancy = avg_trade_pnl
        
        # Calculate capacity and turnover estimates
        avg_portfolio_value = (initial_capital + final_capital) / 2
        total_volume = sum(abs(t.get("pnl", 0)) for t in trades) * 20  # Rough volume estimate
        turnover_ratio = (total_volume / avg_portfolio_value) if avg_portfolio_value > 0 else 0
        trades_per_day = len(trades) / max(trading_period_years * 252, 1)
        capacity_estimate = min(avg_portfolio_value * (1 - trades_per_day * 0.01), 100_000_000)  # Simple capacity model
        
        # Information ratio (using Sharpe as proxy)
        information_ratio = sharpe_ratio * 100
        
        metrics = {
            # Performance metrics
            "total_return_pct": total_return_pct,
            "cagr": cagr,
            "sharpe_ratio": sharpe_ratio * 100,  # Annualized percentage
            "sortino_ratio": sortino_ratio * 100,
            "calmar_ratio": calmar_ratio,
            "information_ratio": information_ratio,
            
            # Risk metrics  
            "max_drawdown": max_drawdown,
            "max_drawdown_pct": max_drawdown_pct,
            "volatility": volatility * 100,
            
            # Trading metrics
            "total_trades": len(trades),
            "winning_trades": len(winning_trades),
            "losing_trades": len(losing_trades),
            "win_rate": win_rate,
            "profit_factor": profit_factor,
            "avg_trade_pnl": avg_trade_pnl,
            "largest_win": max(t.get("pnl", 0) for t in trades) if trades else 0,
            "largest_loss": min(t.get("pnl", 0) for t in trades) if trades else 0,
            "consecutive_wins": consecutive_wins,
            "consecutive_losses": consecutive_losses,
            "gross_profit": gross_profit,
            "gross_loss": gross_loss,
            "net_profit": gross_profit - gross_loss,
            
            # Derived metrics
            "avg_win": avg_win,
            "avg_loss": avg_loss,
            "win_loss_ratio": win_loss_ratio,
            "expectancy": expectancy,
            "kelly_criterion": kelly_criterion,
            
            # Portfolio metrics
            "initial_portfolio_value": initial_capital,
            "final_portfolio_value": final_capital,
            
            # Capacity and frequency
            "turnover_ratio": turnover_ratio,
            "trades_per_day": trades_per_day,
            "capacity": capacity_estimate,
            "runtime_days": trading_period_years * 365.25,
            "runtime_years": trading_period_years,
            "total_periods": len(values)
        }
        
        logger.info("✅ ANALYTICS SERVICE: Metrics calculated successfully", 
                   total_return=total_return_pct,
                   sharpe=sharpe_ratio * 100,
                   max_dd=max_drawdown_pct,
                   volatility=volatility * 100,
                   profit_factor=profit_factor)
        
        logger.info("🎯 ANALYTICS SERVICE: Final metrics object", metrics=metrics)
        
        return metrics
        
    except Exception as e:
        logger.error("❌ ANALYTICS SERVICE: CRITICAL ERROR in calculate_metrics", 
                    error=str(e),
                    error_type=type(e).__name__,
                    request_summary={
                        "portfolio_values_count": len(request.get("portfolio_values", [])),
                        "trades_count": len(request.get("trades", [])),
                        "initial_capital": request.get("initial_capital"),
                        "final_capital": request.get("final_capital")
                    })
        import traceback
        logger.error("❌ ANALYTICS SERVICE: Full traceback", traceback=traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to calculate metrics: {str(e)}"
        )

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    logger.error("💥 ANALYTICS SERVICE: UNHANDLED EXCEPTION", 
                error=str(exc), 
                error_type=type(exc).__name__,
                path=request.url.path,
                method=request.method)
    import traceback
    logger.error("💥 ANALYTICS SERVICE: Exception traceback", traceback=traceback.format_exc())
    return HTTPException(
        status_code=500,
        detail="Internal server error"
    )

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.SERVICE_PORT,
        reload=settings.DEBUG,
        log_level="info"
    )