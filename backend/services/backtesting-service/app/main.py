"""
AlgoTrade Backtesting Service
Historical data processing with comprehensive strategy testing and advanced analytics.
"""

import asyncio
import time
import uuid
from contextlib import asynccontextmanager
from typing import Dict, List, Any, Optional
from uuid import UUID

import structlog
import uvicorn
from fastapi import FastAPI, HTTPException, status, Depends, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .models import (
    BacktestRequest, BacktestResponse, BacktestStatus, BacktestJob,
    BacktestResults, BacktestMetrics
)
from .services import (
    DatabaseService, HistoricalDataService, StrategyService,
    BacktestEngine, AnalyticsEngine, JobQueue
)
from .auth import get_current_user, User

# Configure logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(40),
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Global services
database_service = DatabaseService()
historical_data_service = HistoricalDataService()
strategy_service = StrategyService()
backtest_engine = BacktestEngine()
analytics_engine = AnalyticsEngine()
job_queue = JobQueue()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    logger.info("🚀 Starting Backtesting Service")
    
    # Initialize services
    await database_service.initialize()
    await historical_data_service.initialize()
    await strategy_service.initialize()
    await backtest_engine.initialize()
    await analytics_engine.initialize()
    await job_queue.initialize()
    
    # Start background workers
    asyncio.create_task(job_worker())
    asyncio.create_task(cleanup_worker())
    
    logger.info("✅ Backtesting Service initialized")
    
    yield
    
    logger.info("🛑 Shutting down Backtesting Service")
    
    # Shutdown services
    await job_queue.shutdown()
    await backtest_engine.shutdown()
    await historical_data_service.shutdown()
    await database_service.shutdown()


app = FastAPI(
    title="AlgoTrade Backtesting Service",
    description="Historical strategy testing with advanced analytics",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/run", response_model=BacktestResponse)
async def run_backtest(
    request: BacktestRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    current_user: User = Depends(get_current_user)
) -> BacktestResponse:
    """
    Submit a backtest job for execution.
    Returns job ID for tracking progress and retrieving results.
    """
    try:
        # Extract token from Authorization header
        auth_header = http_request.headers.get("Authorization")
        user_token = None
        if auth_header and auth_header.startswith("Bearer "):
            user_token = auth_header[7:]  # Remove "Bearer " prefix
        
        logger.warning("🚀 BACKTEST REQUEST RECEIVED", 
                   user_id=current_user.id,
                   symbol=request.symbol,
                   strategy_id=request.strategy_id,
                   has_auth_header=bool(auth_header),
                   token_length=len(user_token) if user_token else 0)
        
        # Validate request parameters
        if not await _validate_backtest_request(request):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid backtest parameters"
            )
        
        # Get strategy from Strategy Service with user authentication
        strategy = await strategy_service.get_compiled_strategy(request.strategy_id, user_token)
        if not strategy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found or not compiled"
            )
        
        # Create backtest job
        job_id = uuid.uuid4()
        job = BacktestJob(
            job_id=job_id,
            user_id=UUID(current_user.id),
            request=request,
            strategy=strategy,
            status=BacktestStatus.QUEUED,
            created_at=time.time()
        )
        
        # Store job in database
        await database_service.create_backtest_job(job)
        
        # Queue job for processing
        await job_queue.enqueue_job(job)
        
        logger.info("Backtest job created", 
                   job_id=str(job_id),
                   user_id=current_user.id)
        
        return BacktestResponse(
            success=True,
            job_id=str(job_id),
            status=BacktestStatus.QUEUED,
            message="Backtest job submitted successfully",
            estimated_duration=await _estimate_backtest_duration(request)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Backtest submission failed", 
                    user_id=current_user.id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit backtest"
        )


@app.get("/{job_id}", response_model=BacktestResponse)
async def get_backtest_result(
    job_id: UUID,
    current_user: User = Depends(get_current_user)
) -> BacktestResponse:
    """Get backtest results and status by job ID."""
    try:
        # Get job from database
        job = await database_service.get_backtest_job(job_id, UUID(current_user.id))
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Backtest not found"
            )
        
        # Get results if completed
        results = None
        if job.status == BacktestStatus.COMPLETED:
            results = await database_service.get_backtest_results(job_id)
        
        return BacktestResponse(
            success=True,
            job_id=str(job_id),
            status=job.status,
            message=_get_status_message(job.status),
            progress=job.progress,
            results=results,
            error_message=job.error_message,
            created_at=job.created_at,
            completed_at=job.completed_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get backtest result", 
                    job_id=str(job_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve backtest result"
        )


@app.get("/", response_model=List[BacktestResponse])
async def list_backtests(
    limit: int = 20,
    offset: int = 0,
    status_filter: Optional[BacktestStatus] = None,
    current_user: User = Depends(get_current_user)
) -> List[BacktestResponse]:
    """List user's backtest jobs with optional filtering."""
    try:
        jobs = await database_service.list_backtest_jobs(
            user_id=UUID(current_user.id),
            limit=limit,
            offset=offset,
            status_filter=status_filter
        )
        
        responses = []
        for job in jobs:
            # Get results for completed jobs
            results = None
            if job.status == BacktestStatus.COMPLETED:
                results = await database_service.get_backtest_results(job.job_id)
            
            responses.append(BacktestResponse(
                success=True,
                job_id=str(job.job_id),
                status=job.status,
                message=_get_status_message(job.status),
                progress=job.progress,
                results=results,
                error_message=job.error_message,
                created_at=job.created_at,
                completed_at=job.completed_at
            ))
        
        return responses
        
    except Exception as e:
        logger.error("Failed to list backtests", 
                    user_id=current_user.id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list backtests"
        )


@app.delete("/{job_id}")
async def cancel_backtest(
    job_id: UUID,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Cancel a running or queued backtest job."""
    try:
        # Get job
        job = await database_service.get_backtest_job(job_id, UUID(current_user.id))
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Backtest not found"
            )
        
        # Check if cancellable
        if job.status not in [BacktestStatus.QUEUED, BacktestStatus.RUNNING]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel backtest in status: {job.status}"
            )
        
        # Cancel job
        await job_queue.cancel_job(job_id)
        await database_service.update_job_status(
            job_id, BacktestStatus.CANCELLED, "Cancelled by user"
        )
        
        logger.info("Backtest cancelled", job_id=str(job_id), user_id=current_user.id)
        
        return {
            "success": True,
            "job_id": str(job_id),
            "message": "Backtest cancelled successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to cancel backtest", 
                    job_id=str(job_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel backtest"
        )


@app.get("/{job_id}/metrics", response_model=BacktestMetrics)
async def get_backtest_metrics(
    job_id: UUID,
    current_user: User = Depends(get_current_user)
) -> BacktestMetrics:
    """Get detailed performance metrics for a completed backtest."""
    try:
        # Get job and verify ownership
        job = await database_service.get_backtest_job(job_id, UUID(current_user.id))
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Backtest not found"
            )
        
        if job.status != BacktestStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Backtest not completed"
            )
        
        # Get detailed metrics
        metrics = await analytics_engine.calculate_detailed_metrics(job_id)
        if not metrics:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Metrics not found"
            )
        
        return metrics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get backtest metrics", 
                    job_id=str(job_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve metrics"
        )


# Background task workers
async def job_worker():
    """Background worker for processing backtest jobs."""
    logger.info("Starting backtest job worker")
    
    while True:
        try:
            # Get next job from queue
            job = await job_queue.dequeue_job()
            
            if job:
                logger.info("Processing backtest job", job_id=str(job.job_id))
                
                # Update status to running
                await database_service.update_job_status(
                    job.job_id, BacktestStatus.RUNNING
                )
                
                # Process the backtest
                try:
                    results = await backtest_engine.run_backtest(job)
                    
                    # Store results
                    await database_service.store_backtest_results(job.job_id, results)
                    
                    # Update status to completed
                    await database_service.update_job_status(
                        job.job_id, BacktestStatus.COMPLETED
                    )
                    
                    logger.info("Backtest job completed", job_id=str(job.job_id))
                    
                except Exception as e:
                    # Handle job failure
                    error_msg = f"Backtest execution failed: {str(e)}"
                    await database_service.update_job_status(
                        job.job_id, BacktestStatus.FAILED, error_msg
                    )
                    
                    logger.error("Backtest job failed", 
                               job_id=str(job.job_id), error=str(e))
            else:
                # No jobs available, wait before checking again
                await asyncio.sleep(5)
                
        except Exception as e:
            logger.error("Job worker error", error=str(e))
            await asyncio.sleep(10)


async def cleanup_worker():
    """Background worker for cleaning up old backtest data."""
    while True:
        try:
            await database_service.cleanup_old_backtests(
                max_age_days=settings.BACKTEST_RETENTION_DAYS
            )
            
            # Sleep for 1 hour before next cleanup
            await asyncio.sleep(3600)
            
        except Exception as e:
            logger.error("Cleanup worker error", error=str(e))
            await asyncio.sleep(300)  # Wait 5 minutes on error


# Helper functions
async def _validate_backtest_request(request: BacktestRequest) -> bool:
    """Validate backtest request parameters."""
    try:
        # Check date range
        if request.start_date >= request.end_date:
            return False
        
        # Check if date range is reasonable (not too large)
        date_diff = request.end_date - request.start_date
        if date_diff.days > settings.MAX_BACKTEST_DAYS:
            return False
        
        # Validate symbol exists
        symbol_exists = await historical_data_service.validate_symbol(request.symbol)
        if not symbol_exists:
            return False
        
        return True
        
    except Exception as e:
        logger.error("Request validation error", error=str(e))
        return False


async def _estimate_backtest_duration(request: BacktestRequest) -> int:
    """Estimate backtest duration in seconds."""
    try:
        date_diff = request.end_date - request.start_date
        days = date_diff.days
        
        # Simple estimation: ~1 second per day for daily data
        if request.interval == "1d":
            return max(10, min(days, 300))  # 10 seconds minimum, 5 minutes maximum
        elif request.interval == "1h":
            return max(30, min(days * 2, 600))  # More time for hourly data
        else:
            return max(60, min(days * 5, 1800))  # Even more for minute data
            
    except Exception:
        return 60  # Default to 1 minute


def _get_status_message(status: BacktestStatus) -> str:
    """Get human-readable status message."""
    messages = {
        BacktestStatus.QUEUED: "Backtest is queued for processing",
        BacktestStatus.RUNNING: "Backtest is currently running",
        BacktestStatus.COMPLETED: "Backtest completed successfully",
        BacktestStatus.FAILED: "Backtest failed during execution",
        BacktestStatus.CANCELLED: "Backtest was cancelled"
    }
    return messages.get(status, "Unknown status")


# Health check and monitoring
@app.get("/health")
async def health_check():
    """Health check endpoint - public access for monitoring."""
    try:
        stats = await job_queue.get_queue_stats()
        
        return {
            "status": "healthy",
            "timestamp": time.time(),
            "service": "backtesting-service",
            "queue_stats": stats,
            "database_connected": await database_service.is_connected(),
            "historical_data_available": await historical_data_service.is_available()
        }
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        return {
            "status": "unhealthy",
            "timestamp": time.time(),
            "service": "backtesting-service",
            "error": str(e)
        }


@app.get("/stats")
async def get_service_stats():
    """Get service statistics for monitoring."""
    return {
        "queue_stats": await job_queue.get_queue_stats(),
        "database_stats": await database_service.get_stats(),
        "processing_stats": await backtest_engine.get_stats()
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8004,
        reload=settings.DEBUG
    )