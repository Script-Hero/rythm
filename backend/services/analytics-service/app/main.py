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
    logger.info("Starting Analytics Service")
    
    try:
        # Initialize database
        await init_db()
        logger.info("Database initialized")
        
        # Connect to Redis
        await cache_manager.connect()
        logger.info("Connected to Redis")
        
        # Start Kafka processor in background
        kafka_task = None
        if not settings.DEBUG:  # Skip Kafka in debug mode
            kafka_task = asyncio.create_task(kafka_processor.start())
            logger.info("Kafka processor started")
        
        yield
        
    except Exception as e:
        logger.error("Failed to start Analytics Service", error=str(e))
        raise
    
    finally:
        # Shutdown
        logger.info("Shutting down Analytics Service")
        
        # Stop Kafka processor
        if kafka_task and not kafka_task.done():
            kafka_task.cancel()
            try:
                await kafka_task
            except asyncio.CancelledError:
                pass
        
        await kafka_processor.stop()
        
        # Disconnect Redis
        await cache_manager.disconnect()
        
        logger.info("Analytics Service shutdown complete")


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
        logger.info("Calculating metrics for backtest data")
        
        portfolio_values = request.get("portfolio_values", [])
        trades = request.get("trades", [])
        initial_capital = request.get("initial_capital", 0)
        final_capital = request.get("final_capital", 0)
        
        if not portfolio_values:
            # Create basic analytics if no portfolio data
            total_return_pct = ((final_capital - initial_capital) / initial_capital * 100) if initial_capital > 0 else 0
            
            return {
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
        
        # Calculate basic metrics from portfolio values
        values = [pv["value"] for pv in portfolio_values]
        
        # Total return
        total_return_pct = ((final_capital - initial_capital) / initial_capital * 100) if initial_capital > 0 else 0
        
        # Max drawdown calculation  
        peak = initial_capital
        max_drawdown = 0
        for value in values:
            if value > peak:
                peak = value
            drawdown = peak - value
            if drawdown > max_drawdown:
                max_drawdown = drawdown
        
        max_drawdown_pct = (max_drawdown / peak * 100) if peak > 0 else 0
        
        # Simple volatility (standard deviation of returns)
        if len(values) > 1:
            returns = [(values[i] - values[i-1]) / values[i-1] for i in range(1, len(values)) if values[i-1] != 0]
            if returns:
                avg_return = sum(returns) / len(returns)
                variance = sum((r - avg_return) ** 2 for r in returns) / len(returns)
                volatility = variance ** 0.5
                # Simple Sharpe approximation (assuming risk-free rate = 0)
                sharpe_ratio = avg_return / volatility if volatility > 0 else 0
            else:
                volatility = 0
                sharpe_ratio = 0
        else:
            volatility = 0 
            sharpe_ratio = 0
        
        # Trade metrics
        winning_trades = [t for t in trades if t.get("pnl", 0) > 0]
        win_rate = (len(winning_trades) / len(trades) * 100) if trades else 0
        avg_trade_pnl = sum(trade.get("pnl", 0) for trade in trades) / len(trades) if trades else 0
        
        # Profit factor
        gross_profit = sum(t.get("pnl", 0) for t in winning_trades)
        gross_loss = abs(sum(t.get("pnl", 0) for t in trades if t.get("pnl", 0) < 0))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf') if gross_profit > 0 else 1.0
        
        metrics = {
            "total_return_pct": total_return_pct,
            "sharpe_ratio": sharpe_ratio * 100,  # Annualized approximation
            "max_drawdown": max_drawdown,
            "max_drawdown_pct": max_drawdown_pct,
            "volatility": volatility * 100,
            "win_rate": win_rate,
            "total_trades": len(trades),
            "avg_trade_pnl": avg_trade_pnl,
            "profit_factor": profit_factor
        }
        
        logger.info("Metrics calculated successfully", 
                   total_return=total_return_pct,
                   sharpe=sharpe_ratio,
                   max_dd=max_drawdown_pct)
        
        return metrics
        
    except Exception as e:
        logger.error("Failed to calculate metrics", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to calculate metrics: {str(e)}"
        )

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    logger.error("Unhandled exception", error=str(exc), path=request.url.path)
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