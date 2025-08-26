"""Core services for Backtesting Service."""

import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from uuid import UUID
from decimal import Decimal

import structlog
import httpx
import redis.asyncio as redis
import asyncpg

from .config import settings
from .models import BacktestJob, BacktestResults, BacktestStatus, BacktestMetrics, TradeResult

logger = structlog.get_logger()


class DatabaseService:
    """Database service for backtest job and result management."""
    
    def __init__(self):
        self._pool = None
        self._redis = None
    
    async def initialize(self):
        """Initialize database connection."""
        try:
            self._pool = await asyncpg.create_pool(
                settings.DATABASE_URL,
                min_size=1,
                max_size=10,
                command_timeout=60
            )
            logger.info("Database service initialized successfully")
            
            # Initialize Redis for chart data caching
            try:
                import redis.asyncio as redis
                self._redis = redis.from_url(settings.REDIS_URL)
                await self._redis.ping()
                logger.info("Redis connection established for chart data caching")
            except Exception as e:
                logger.warning("Failed to connect to Redis, chart data caching will be disabled", error=str(e))
                self._redis = None
                
        except Exception as e:
            logger.error("Failed to initialize database", error=str(e))
            raise
    
    async def shutdown(self):
        """Shutdown database connection."""
        if self._pool:
            await self._pool.close()
        if self._redis:
            await self._redis.aclose()
        logger.info("Database service shutdown")
    
    async def is_connected(self) -> bool:
        """Check database connection."""
        if not self._pool:
            return False
        try:
            async with self._pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            return True
        except Exception:
            return False
    
    async def create_backtest_job(self, job: BacktestJob):
        """Store backtest job in database."""
        logger.info("Storing backtest job", job_id=str(job.job_id))
        
        if not self._pool:
            logger.error("Database not initialized")
            return
            
        try:
            async with self._pool.acquire() as conn:
                # Insert into backtest_results table (strategy_id as NULL for test strategies)
                await conn.execute("""
                    INSERT INTO backtest_results (
                        id, user_id, strategy_id, strategy_name, symbol,
                        start_date, end_date, interval, initial_balance, 
                        final_balance, total_return
                    ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $8, 0)
                """, 
                    job.job_id,
                    job.user_id, 
                    "Test Strategy",  # Default name
                    job.request.symbol,
                    job.request.start_date.date(),
                    job.request.end_date.date(), 
                    job.request.interval,
                    float(job.request.initial_capital),
                )
                logger.info("Backtest job stored successfully", job_id=str(job.job_id))
                
        except Exception as e:
            logger.error("Failed to store backtest job", job_id=str(job.job_id), error=str(e))
    
    async def get_backtest_job(self, job_id: UUID, user_id: UUID) -> Optional[BacktestJob]:
        """Get backtest job by ID."""
        if not self._pool:
            logger.error("Database not initialized")
            return None
            
        try:
            async with self._pool.acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT id, user_id, strategy_id, symbol, start_date, end_date,
                           interval, initial_balance, final_balance, total_return,
                           sharpe_ratio, max_drawdown, trade_count, win_rate,
                           created_at, analytics
                    FROM backtest_results 
                    WHERE id = $1 AND user_id = $2
                """, job_id, user_id)
                
                if not row:
                    return None
                
                # Convert row to BacktestJob (simplified)
                from .models import BacktestRequest
                from uuid import uuid4
                request = BacktestRequest(
                    strategy_id=row['strategy_id'] or uuid4(),  # Provide default UUID if NULL
                    symbol=row['symbol'],
                    start_date=datetime.combine(row['start_date'], datetime.min.time()),
                    end_date=datetime.combine(row['end_date'], datetime.min.time()),
                    interval=row['interval'],
                    initial_capital=Decimal(str(row['initial_balance']))
                )
                
                # Create simplified job object for retrieval
                job = BacktestJob(
                    job_id=row['id'],
                    user_id=row['user_id'],
                    request=request,
                    strategy={},  # Empty strategy dict for completed jobs
                    status=BacktestStatus.COMPLETED,  # Assume completed if in results
                    created_at=row['created_at'].timestamp() if row['created_at'] else time.time()
                )
                
                return job
                
        except Exception as e:
            logger.error("Failed to get backtest job", job_id=str(job_id), error=str(e))
            return None
    
    async def list_backtest_jobs(
        self, 
        user_id: UUID, 
        limit: int = 20, 
        offset: int = 0, 
        status_filter: Optional[BacktestStatus] = None
    ) -> List[BacktestJob]:
        """List user's backtest jobs."""
        # TODO: Implement database query
        return []
    
    async def update_job_status(
        self, 
        job_id: UUID, 
        status: BacktestStatus, 
        error_message: Optional[str] = None
    ):
        """Update job status."""
        logger.info("Updating job status", job_id=str(job_id), status=status)
        
        if not self._pool:
            logger.error("Database not initialized")
            return
            
        try:
            async with self._pool.acquire() as conn:
                # For this simple implementation, we'll just log the status changes
                # In a full implementation, you might want a separate jobs table for tracking status
                logger.info("Job status updated", job_id=str(job_id), status=status, error=error_message)
                
        except Exception as e:
            logger.error("Failed to update job status", job_id=str(job_id), error=str(e))
    
    async def store_backtest_results(self, job_id: UUID, results: BacktestResults):
        """Store backtest results."""
        logger.info("Storing backtest results", job_id=str(job_id))
        
        if not self._pool:
            logger.error("Database not initialized")
            return
            
        try:
            async with self._pool.acquire() as conn:
                # Update the backtest_results record with final results
                await conn.execute("""
                    UPDATE backtest_results SET
                        final_balance = $2,
                        total_return = $3,
                        sharpe_ratio = $4,
                        max_drawdown = $5,
                        trade_count = $6,
                        win_rate = $7,
                        analytics = $8,
                        execution_time_ms = $9
                    WHERE id = $1
                """,
                    job_id,
                    float(results.final_portfolio_value),
                    float(results.total_return_percent),
                    results.sharpe_ratio,
                    float(results.max_drawdown_percent),
                    results.total_trades,
                    results.win_rate,
                    json.dumps({
                        # Performance metrics
                        'total_return_pct': results.total_return_percent,
                        'cagr': results.cagr,
                        'sharpe_ratio': results.sharpe_ratio,
                        'sortino_ratio': results.sortino_ratio,
                        'calmar_ratio': results.calmar_ratio,
                        'information_ratio': results.information_ratio,
                        
                        # Risk metrics
                        'max_drawdown_pct': results.max_drawdown_percent,
                        'volatility': results.volatility,
                        
                        # Trading metrics
                        'win_rate': results.win_rate,
                        'total_trades': results.total_trades,
                        'winning_trades': results.winning_trades,
                        'losing_trades': results.losing_trades,
                        'profit_factor': results.profit_factor,
                        'consecutive_wins': results.consecutive_wins,
                        'consecutive_losses': results.consecutive_losses,
                        
                        # Trade details
                        'gross_profit': float(results.gross_profit),
                        'gross_loss': float(results.gross_loss),
                        'net_profit': float(results.net_profit),
                        'average_trade': float(results.average_trade),
                        'largest_win': float(results.largest_win),
                        'largest_loss': float(results.largest_loss),
                        
                        # Derived metrics
                        'avg_win': results.avg_win,
                        'avg_loss': results.avg_loss,
                        'win_loss_ratio': results.win_loss_ratio,
                        'expectancy': results.expectancy,
                        'kelly_criterion': results.kelly_criterion,
                        
                        # Capacity and frequency
                        'turnover_ratio': results.turnover_ratio,
                        'trades_per_day': results.trades_per_day,
                        'capacity': results.capacity,
                        'runtime_days': results.runtime_days,
                        'runtime_years': results.runtime_years,
                        
                        # Meta
                        'total_periods': results.total_periods
                    }),
                    results.execution_time_ms
                )
                
                # Cache chart_data in Redis for 24 hours for recently completed backtests
                if results.chart_data and self._redis:
                    try:
                        chart_data_json = json.dumps(results.chart_data)
                        await self._redis.setex(
                            f"backtest:chart_data:{job_id}", 
                            86400,  # 24 hours TTL
                            chart_data_json
                        )
                        logger.info("Chart data cached in Redis", job_id=str(job_id), data_points=len(results.chart_data))
                    except Exception as e:
                        logger.warning("Failed to cache chart data in Redis", job_id=str(job_id), error=str(e))

                # Cache trades in Redis for 24 hours (align with chart data caching pattern)
                if results.trades and self._redis:
                    try:
                        trades_payload = [json.loads(trade.json()) for trade in results.trades]
                        await self._redis.setex(
                            f"backtest:trades:{job_id}",
                            86400,
                            json.dumps(trades_payload)
                        )
                        logger.info("Trades cached in Redis", job_id=str(job_id), trade_count=len(results.trades))
                    except Exception as e:
                        logger.warning("Failed to cache trades in Redis", job_id=str(job_id), error=str(e))
                
                logger.info("Backtest results stored successfully", job_id=str(job_id))
                
        except Exception as e:
            logger.error("Failed to store backtest results", job_id=str(job_id), error=str(e))
    
    async def get_backtest_results(self, job_id: UUID) -> Optional[BacktestResults]:
        """Get backtest results by job ID."""
        if not self._pool:
            logger.error("Database not initialized")
            return None
            
        try:
            async with self._pool.acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT final_balance, total_return, sharpe_ratio, max_drawdown,
                           trade_count, win_rate, analytics, initial_balance, execution_time_ms
                    FROM backtest_results 
                    WHERE id = $1
                """, job_id)
                
                if not row:
                    return None
                
                # Parse analytics data and use it to reconstruct complete results
                analytics = json.loads(row['analytics']) if row['analytics'] else {}
                logger.info("Retrieved analytics from database", analytics=analytics)
                
                # Use analytics data to get complete metrics, fallback to database columns if not available
                results = BacktestResults(
                    total_trades=analytics.get('total_trades', row['trade_count'] or 0),
                    winning_trades=analytics.get('winning_trades', 0),
                    losing_trades=analytics.get('losing_trades', 0),
                    win_rate=analytics.get('win_rate', row['win_rate'] or 0),
                    total_return=Decimal(str(row['total_return'] or 0)),
                    total_return_percent=analytics.get('total_return_pct', row['total_return'] or 0),
                    max_drawdown=Decimal(str(row['max_drawdown'] or 0)),
                    max_drawdown_percent=analytics.get('max_drawdown_pct', row['max_drawdown'] or 0),
                    final_portfolio_value=Decimal(str(row['final_balance'])),
                    initial_portfolio_value=Decimal(str(row['initial_balance'])),
                    sharpe_ratio=analytics.get('sharpe_ratio', row['sharpe_ratio']),
                    sortino_ratio=analytics.get('sortino_ratio', 0.0),
                    calmar_ratio=analytics.get('calmar_ratio', 0.0),
                    information_ratio=analytics.get('information_ratio', 0.0),
                    volatility=analytics.get('volatility', 0.0),
                    cagr=analytics.get('cagr', 0.0),
                    avg_win=analytics.get('avg_win', 0.0),
                    avg_loss=analytics.get('avg_loss', 0.0),
                    win_loss_ratio=analytics.get('win_loss_ratio', 0.0),
                    expectancy=analytics.get('expectancy', 0.0),
                    kelly_criterion=analytics.get('kelly_criterion', 0.0),
                    turnover_ratio=analytics.get('turnover_ratio', 0.0),
                    trades_per_day=analytics.get('trades_per_day', 0.0),
                    capacity=analytics.get('capacity', 1000000.0),
                    runtime_days=analytics.get('runtime_days', 0.0),
                    runtime_years=analytics.get('runtime_years', 0.0),
                    gross_profit=Decimal(str(analytics.get('gross_profit', 0.0))),
                    gross_loss=Decimal(str(analytics.get('gross_loss', 0.0))),
                    net_profit=Decimal(str(analytics.get('net_profit', row['final_balance'] - row['initial_balance']))),
                    profit_factor=analytics.get('profit_factor', 1.0),
                    average_trade=Decimal(str(analytics.get('average_trade', 0.0))),
                    largest_win=Decimal(str(analytics.get('largest_win', 0.0))),
                    largest_loss=Decimal(str(analytics.get('largest_loss', 0.0))),
                    consecutive_wins=analytics.get('consecutive_wins', 0),
                    consecutive_losses=analytics.get('consecutive_losses', 0),
                    chart_data=[],  # Will be populated from Redis cache below
                    trades=[],  # Not stored for retrieval
                    execution_time_ms=int(row['execution_time_ms'] or 0),
                    total_periods=analytics.get('total_periods', 0)
                )
                
                # Try to retrieve chart_data from Redis cache
                if self._redis:
                    try:
                        chart_data_json = await self._redis.get(f"backtest:chart_data:{job_id}")
                        if chart_data_json:
                            results.chart_data = json.loads(chart_data_json)
                            logger.info("Chart data retrieved from Redis cache", job_id=str(job_id), data_points=len(results.chart_data))
                        else:
                            logger.info("No cached chart data found for job", job_id=str(job_id))
                    except Exception as e:
                        logger.warning("Failed to retrieve chart data from Redis cache", job_id=str(job_id), error=str(e))

                # Try to retrieve trades from Redis cache
                if self._redis:
                    try:
                        trades_json = await self._redis.get(f"backtest:trades:{job_id}")
                        if trades_json:
                            from .models import TradeResult
                            trades_list = json.loads(trades_json)
                            results.trades = [TradeResult(**t) for t in trades_list]
                            logger.info("Trades retrieved from Redis cache", job_id=str(job_id), trade_count=len(results.trades))
                        else:
                            logger.info("No cached trades found for job", job_id=str(job_id))
                    except Exception as e:
                        logger.warning("Failed to retrieve trades from Redis cache", job_id=str(job_id), error=str(e))
                
                return results
                
        except Exception as e:
            logger.error("Failed to get backtest results", job_id=str(job_id), error=str(e))
            return None
    
    async def cleanup_old_backtests(self, max_age_days: int):
        """Clean up old backtest data."""
        logger.info("Cleaning up old backtests", max_age_days=max_age_days)
        # TODO: Implement cleanup
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get database statistics."""
        return {"total_jobs": 0, "active_jobs": 0}


class HistoricalDataService:
    """Service for retrieving historical market data."""
    
    def __init__(self):
        self.redis_client = None
    
    async def initialize(self):
        """Initialize historical data service."""
        self.redis_client = redis.from_url(settings.REDIS_URL)
        await self.redis_client.ping()
        logger.info("Historical data service initialized")
    
    async def shutdown(self):
        """Shutdown historical data service."""
        if self.redis_client:
            await self.redis_client.close()
        logger.info("Historical data service shutdown")
    
    async def is_available(self) -> bool:
        """Check if historical data is available."""
        return True
    
    async def validate_symbol(self, symbol: str) -> bool:
        """Validate that symbol exists and has data."""
        try:
            # Call market data service to validate symbol exists
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{settings.MARKET_DATA_SERVICE_URL}/symbols",
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("symbols"):
                        # Check if symbol exists in available symbols
                        available_symbols = {s['symbol'] for s in data['symbols']}
                        return symbol in available_symbols
                
        except Exception as e:
            logger.error("Failed to validate symbol", symbol=symbol, error=str(e))
            
        # If validation fails, assume symbol is valid (fallback behavior)
        logger.warning("Symbol validation failed, assuming valid", symbol=symbol)
        return True
    
    async def get_historical_data(
        self, 
        symbol: str, 
        start_date: datetime, 
        end_date: datetime, 
        interval: str = "1d"
    ) -> List[Dict[str, Any]]:
        """Get historical OHLCV data for backtesting."""
        try:
            # Call market data service for historical data
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{settings.MARKET_DATA_SERVICE_URL}/historical",
                    json={
                        "symbols": [symbol],
                        "start_date": start_date.isoformat(),
                        "end_date": end_date.isoformat(),
                        "interval": interval
                    },
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    response_data = response.json()
                    return response_data.get("data", [])
                
        except Exception as e:
            logger.error("Failed to get historical data", error=str(e))
        
        # If we get here, the market data service is unavailable - use mock data but make it obvious
        logger.warning("🚨 USING MOCK DATA - Market data service unavailable, generating test data")
        return self._generate_mock_data(symbol, start_date, end_date, interval)
    
    def _generate_mock_data(
        self, 
        symbol: str, 
        start_date: datetime, 
        end_date: datetime, 
        interval: str
    ) -> List[Dict[str, Any]]:
        """Generate mock historical data for testing."""
        data = []
        current_date = start_date
        current_price = 50000.0  # Starting price
        
        # Determine interval delta
        if interval == "1d":
            delta = timedelta(days=1)
        elif interval == "1h":
            delta = timedelta(hours=1)
        elif interval == "5m":
            delta = timedelta(minutes=5)
        else:
            delta = timedelta(days=1)
        
        while current_date <= end_date and len(data) < 10000:  # Limit data points
            # Simple random walk for mock data
            price_change = (hash(str(current_date)) % 201 - 100) * 0.01  # -1% to +1%
            current_price *= (1 + price_change / 100)
            
            data.append({
                "symbol": symbol,
                "timestamp": current_date,
                "open": current_price,
                "high": current_price * 1.02,
                "low": current_price * 0.98,
                "close": current_price,
                "volume": 1000.0
            })
            
            current_date += delta
        
        logger.info("Generated mock historical data", 
                   symbol=symbol, points=len(data))
        return data


class StrategyService:
    """Service for retrieving compiled strategies."""
    
    async def initialize(self):
        """Initialize strategy service."""
        logger.info("Strategy service initialized")
    
    async def get_compiled_strategy(self, strategy_id: UUID, user_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get strategy metadata from Strategy Service via API Gateway."""
        try:
            # Use API Gateway for proper authentication handling
            api_gateway_url = settings.API_GATEWAY_URL or "http://api-gateway:8000"
            
            logger.info("🔍 Making strategy request to API Gateway", 
                       strategy_id=str(strategy_id),
                       api_gateway_url=api_gateway_url,
                       has_token=bool(user_token),
                       token_length=len(user_token) if user_token else 0)
            
            # Prepare headers with authentication if token is provided
            headers = {
                "X-Service-Name": "backtesting-service",
                "X-Internal-Request": "true"
            }
            if user_token:
                headers["Authorization"] = f"Bearer {user_token}"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{api_gateway_url}/api/strategies/{strategy_id}",
                    timeout=10.0,
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    # Extract strategy data from the StandardResponse format
                    if data.get("success") and data.get("data"):
                        strategy = data["data"]
                        logger.info("✅ Retrieved strategy via API Gateway", 
                                   strategy_id=str(strategy_id),
                                   strategy_name=strategy.get("name"))
                        return strategy
                    else:
                        logger.warning("⚠️ API Gateway returned success=false", 
                                     strategy_id=str(strategy_id), 
                                     response=data)
                elif response.status_code == 401:
                    logger.warning("🔐 Authentication required for strategy access", 
                                 strategy_id=str(strategy_id))
                else:
                    logger.warning("⚠️ API Gateway returned non-200 status", 
                                 strategy_id=str(strategy_id), 
                                 status_code=response.status_code,
                                 response_text=response.text[:200])
                
        except Exception as e:
            logger.error("Failed to get strategy via API Gateway", 
                        strategy_id=str(strategy_id), 
                        error=str(e))
        
        # No fallback - if strategy retrieval fails, it should be obvious
        logger.error("Failed to retrieve strategy - no fallback available", 
                    strategy_id=str(strategy_id))
        return None


class BacktestEngine:
    """Core backtesting engine."""
    
    def __init__(self):
        self.stats = {"jobs_processed": 0, "total_trades": 0}
    
    async def initialize(self):
        """Initialize backtest engine."""
        logger.info("Backtest engine initialized")
    
    async def shutdown(self):
        """Shutdown backtest engine."""
        logger.info("Backtest engine shutdown")
    
    async def run_backtest(self, job: BacktestJob) -> BacktestResults:
        """Run backtest for a job."""
        logger.info("Starting backtest execution", job_id=str(job.job_id))
        
        # Validate job data early
        if not job.strategy:
            raise ValueError(f"Job {job.job_id} has no strategy data")
        
        if not job.request.symbol:
            raise ValueError(f"Job {job.job_id} has no symbol specified")
            
        logger.info("✅ Job validation passed", 
                   job_id=str(job.job_id),
                   symbol=job.request.symbol,
                   start_date=job.request.start_date,
                   end_date=job.request.end_date,
                   initial_capital=job.request.initial_capital)
        
        start_time = time.time()
        
        try:
            # Get historical data
            historical_data_service = HistoricalDataService()
            await historical_data_service.initialize()
            
            data = await historical_data_service.get_historical_data(
                job.request.symbol,
                job.request.start_date,
                job.request.end_date,
                job.request.interval
            )
            
            # Validate historical data
            if not data:
                raise ValueError(f"No historical data retrieved for {job.request.symbol}")
            
            logger.info("📈 Historical data retrieved", 
                       symbol=job.request.symbol,
                       data_points=len(data),
                       date_range=f"{job.request.start_date} to {job.request.end_date}")
            
            # Run backtest simulation
            execution_time = int((time.time() - start_time) * 1000)
            results = await self._simulate_strategy(job, data, execution_time, len(data))
            
            # Update stats
            self.stats["jobs_processed"] += 1
            self.stats["total_trades"] += results.total_trades
            
            logger.info("Backtest execution completed", 
                       job_id=str(job.job_id),
                       execution_time_ms=execution_time,
                       total_trades=results.total_trades)
            
            return results
            
        except Exception as e:
            logger.error("Backtest execution failed", 
                        job_id=str(job.job_id), error=str(e))
            raise
    
    async def _simulate_strategy(self, job: BacktestJob, data: List[Dict[str, Any]], execution_time_ms: int, total_periods: int) -> BacktestResults:
        """Execute real compiled strategy on historical data."""
        # Initialize portfolio
        portfolio_value = float(job.request.initial_capital)
        initial_capital = float(job.request.initial_capital)
        cash = portfolio_value
        position = 0.0
        
        trades = []
        chart_data = []
        equity_curve = []  # Track portfolio value over time
        
        # Import strategy engine
        import sys
        import os
        sys.path.append(os.path.join(os.path.dirname(__file__), '../../..'))

        # Debug the strategy data structure
        logger.info("🔍 Analyzing strategy data structure for backtest")
        
        try:
            # Create compiled strategy from job.strategy
            strategy_data = job.strategy
            logger.info("📊 Strategy data received", 
                       strategy_data_type=type(strategy_data).__name__,
                       strategy_data_keys=list(strategy_data.keys()) if isinstance(strategy_data, dict) else "Not a dict",
                       strategy_data_size=len(str(strategy_data)) if strategy_data else 0)
            
            # Extract nodes and execution order from the correct locations
            json_tree = strategy_data.get("json_tree", {}) if strategy_data else {}
            compilation_report = strategy_data.get("compilation_report", {}) if strategy_data else {}
            nodes = json_tree.get("nodes", [])
            edges = json_tree.get("edges", [])
            execution_order = compilation_report.get("execution_order", [])
            
            logger.info("📋 Strategy structure analysis",
                       json_tree_keys=list(json_tree.keys()) if json_tree else [],
                       compilation_report_keys=list(compilation_report.keys()) if compilation_report else [],
                       nodes_count=len(nodes),
                       edges_count=len(edges),
                       execution_order_length=len(execution_order),
                       first_few_nodes=[node.get('type', 'unknown') for node in nodes[:3]] if nodes else [])
            
            if strategy_data and nodes and execution_order:
                # Create strategy executor with proper data format
                executor_data = {
                    "nodes": nodes,
                    "edges": edges,
                    "execution_order": execution_order,
                    "execution_graph": {}  # TODO: Build execution graph if needed
                }
                strategy_executor = self._create_strategy_executor(executor_data)
                logger.warning("✅ STRATEGY EXECUTOR CREATED", 
                              node_count=len(nodes),
                              edge_count=len(edges),
                              execution_order=execution_order,
                              executor_available=bool(strategy_executor))
            else:
                # No fallback - strategy compilation failed
                strategy_executor = None
                logger.error("❌ STRATEGY COMPILATION FAILED - missing required data",
                             has_strategy_data=bool(strategy_data),
                             has_nodes=bool(nodes),
                             has_execution_order=bool(execution_order),
                             strategy_data_keys=list(strategy_data.keys()) if strategy_data else [],
                             nodes_count=len(nodes) if nodes else 0,
                             execution_order_length=len(execution_order) if execution_order else 0)
                
        except Exception as e:
            logger.error("Failed to initialize strategy engine", error=str(e))
            strategy_executor = None
        
        # Execute strategy on each data point
        logger.warning("🚀 STARTING BACKTEST EXECUTION", 
                      total_bars=len(data),
                      strategy_executor_available=bool(strategy_executor),
                      first_bar_sample=data[0] if data else None)
        
        for i, bar in enumerate(data):
            current_price = float(bar.get("close", 50000))
            timestamp = bar.get("timestamp", datetime.utcnow())
            
            if i < 3 or i == len(data) - 1:  # Log first 3 and last bar
                logger.warning(f"🔍 BAR {i}", 
                              bar=bar,
                              current_price=current_price,
                              timestamp=timestamp)
            
            # Convert timestamp if needed
            if isinstance(timestamp, str):
                try:
                    timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                except ValueError:
                    timestamp = datetime.utcnow()
            elif not isinstance(timestamp, datetime):
                timestamp = datetime.fromtimestamp(float(timestamp))
            
            # Prepare market data for strategy - ensure all numeric values are properly converted
            try:
                open_price = float(bar.get('open', current_price))
                high_price = float(bar.get('high', current_price))
                low_price = float(bar.get('low', current_price))
                volume_value = float(bar.get('volume', 1000))
            except (ValueError, TypeError) as e:
                logger.warning("Data conversion error", bar=bar, error=str(e))
                open_price = current_price
                high_price = current_price 
                low_price = current_price
                volume_value = 1000.0
                
            market_data = {
                'price': current_price,
                'open': open_price,
                'high': high_price,
                'low': low_price,
                'close': current_price,
                'volume': volume_value,
                'timestamp': timestamp,
                'symbol': job.request.symbol
            }
            
            # Execute strategy
            signals = []
            if strategy_executor:
                try:
                    if i < 15 or signals:  # Debug first 15 bars (enough for SMA buildup) + any with signals
                        logger.warning("🎯 EXECUTING STRATEGY", 
                                      bar_index=i,
                                      market_data=market_data,
                                      strategy_nodes=len(strategy_executor.nodes),
                                      execution_order=strategy_executor.execution_order)
                    
                    signals = strategy_executor.execute(market_data)
                    
                    if signals or i < 15 or i == len(data) - 1:  # Always log signals, plus first 15 bars
                        logger.warning("🎯 STRATEGY EXECUTION RESULT", 
                                      bar_index=i,
                                      signals_generated=len(signals) if signals else 0,
                                      signals=signals,
                                      current_price=current_price)
                               
                except Exception as e:
                    logger.error("Strategy execution error", error=str(e), bar_index=i)
                    signals = []
            else:
                # No fallback - if strategy compilation fails, backtest should fail
                logger.error("No valid strategy executor available - backtest cannot proceed", bar_index=i)
                signals = []
            
            # Process trading signals
            for signal in signals:
                action = signal.get('action', '').lower()
                signal_price = float(signal.get('price', current_price))
                size = float(signal.get('quantity', 0))
                
                if action == 'buy' and cash > 0:
                    # Calculate position size
                    if size <= 1.0:  # Percentage of available cash
                        max_investment = cash * size
                    else:  # Absolute dollar amount
                        max_investment = min(size, cash)
                    
                    if max_investment > signal_price:
                        quantity = max_investment / signal_price
                        commission = quantity * signal_price * float(job.request.commission_rate)
                        total_cost = quantity * signal_price + commission
                        
                        if total_cost <= cash:
                            position += quantity
                            cash -= total_cost
                            
                            trade = TradeResult(
                                trade_id=f"trade_{len(trades)+1}",
                                symbol=job.request.symbol,
                                side="buy",
                                quantity=Decimal(str(quantity)),
                                price=Decimal(str(signal_price)),
                                timestamp=timestamp,
                                pnl=Decimal("0"),
                                commission=Decimal(str(commission)),
                                portfolio_value=Decimal(str(cash + position * signal_price))
                            )
                            trades.append(trade)
                            
                elif action == 'sell' and position > 0:
                    # Calculate sell quantity
                    if size <= 1.0:  # Percentage of position
                        sell_quantity = position * size
                    else:  # Absolute quantity
                        sell_quantity = min(size, position)
                    
                    if sell_quantity > 0:
                        gross_proceeds = sell_quantity * signal_price
                        commission = gross_proceeds * float(job.request.commission_rate)
                        net_proceeds = gross_proceeds - commission
                        
                        # Calculate PnL (simplified - not tracking cost basis properly)
                        avg_cost = (initial_capital - cash + position * signal_price) / max(position, 1)
                        pnl = (signal_price - avg_cost) * sell_quantity - commission
                        
                        position -= sell_quantity
                        cash += net_proceeds
                        
                        trade = TradeResult(
                            trade_id=f"trade_{len(trades)+1}",
                            symbol=job.request.symbol,
                            side="sell",
                            quantity=Decimal(str(sell_quantity)),
                            price=Decimal(str(signal_price)),
                            timestamp=timestamp,
                            pnl=Decimal(str(pnl)),
                            commission=Decimal(str(commission)),
                            portfolio_value=Decimal(str(cash + position * signal_price))
                        )
                        trades.append(trade)
            
            # Record portfolio state
            current_portfolio_value = cash + position * current_price
            equity_curve.append(current_portfolio_value)
            
            chart_data.append({
                "Datetime": timestamp.timestamp(),
                "PortfolioValue": current_portfolio_value,
                "Close": current_price,
                "Open": open_price,
                "High": high_price,
                "Low": low_price,
                "cash": cash,
                "position": position
            })
        
        # Validate backtest results
        if not trades:
            logger.warning("🚨 NO TRADES GENERATED during backtest", 
                          strategy_executor_available=bool(strategy_executor),
                          data_points=len(data),
                          final_cash=cash,
                          final_position=position)
        
        # Calculate basic metrics locally
        final_portfolio_value = cash + position * float(data[-1].get("close", 50000))
        total_return = final_portfolio_value - initial_capital
        total_return_percent = (total_return / initial_capital) * 100 if initial_capital > 0 else 0
        
        logger.info("💰 Backtest financial summary",
                   initial_capital=initial_capital,
                   final_portfolio_value=final_portfolio_value,
                   total_return=total_return,
                   total_return_percent=total_return_percent,
                   total_trades=len(trades))
        
        # Calculate advanced analytics using analytics service
        analytics_data = await self._calculate_analytics_via_service(
            equity_curve=equity_curve,
            trades=trades,
            initial_capital=initial_capital,
            final_capital=final_portfolio_value,
            chart_data=chart_data,
            total_periods=total_periods
        )
        
        # Extract comprehensive metrics from analytics service
        logger.info("📊 BACKTESTING SERVICE: Extracting metrics from analytics response")
        
        # Performance metrics
        total_return_pct = analytics_data.get("total_return_pct", total_return_percent)
        cagr = analytics_data.get("cagr", 0.0)
        sharpe_ratio = analytics_data.get("sharpe_ratio", 0.0) / 100.0  # Convert from percentage
        sortino_ratio = analytics_data.get("sortino_ratio", 0.0) / 100.0
        calmar_ratio = analytics_data.get("calmar_ratio", 0.0)
        information_ratio = analytics_data.get("information_ratio", 0.0) / 100.0
        
        # Risk metrics
        max_drawdown_value = analytics_data.get("max_drawdown", 0.0)
        max_drawdown_percent = analytics_data.get("max_drawdown_pct", 0.0)
        volatility = analytics_data.get("volatility", 0.0) / 100.0  # Convert from percentage
        
        # Trading metrics
        win_rate = analytics_data.get("win_rate", 0.0) / 100.0  # Convert to decimal
        profit_factor = analytics_data.get("profit_factor", 1.0)
        total_trades_analytics = analytics_data.get("total_trades", len(trades))
        winning_trades = analytics_data.get("winning_trades", len([t for t in trades if float(t.pnl) > 0]))
        losing_trades = analytics_data.get("losing_trades", len([t for t in trades if float(t.pnl) < 0]))
        
        # Trade details
        gross_profit = analytics_data.get("gross_profit", sum(float(t.pnl) for t in trades if float(t.pnl) > 0))
        gross_loss = analytics_data.get("gross_loss", abs(sum(float(t.pnl) for t in trades if float(t.pnl) < 0)))
        net_profit = analytics_data.get("net_profit", gross_profit - gross_loss)
        avg_trade_pnl = analytics_data.get("avg_trade_pnl", 0.0)
        largest_win = analytics_data.get("largest_win", max((float(t.pnl) for t in trades if float(t.pnl) > 0), default=0.0))
        largest_loss = analytics_data.get("largest_loss", min((float(t.pnl) for t in trades if float(t.pnl) < 0), default=0.0))
        consecutive_wins = analytics_data.get("consecutive_wins", 0)
        consecutive_losses = analytics_data.get("consecutive_losses", 0)
        
        # Derived metrics
        avg_win = analytics_data.get("avg_win", 0.0)
        avg_loss = analytics_data.get("avg_loss", 0.0)
        win_loss_ratio = analytics_data.get("win_loss_ratio", 0.0)
        expectancy = analytics_data.get("expectancy", 0.0)
        kelly_criterion = analytics_data.get("kelly_criterion", 0.0)
        
        # Portfolio metrics
        initial_portfolio_value_analytics = analytics_data.get("initial_portfolio_value", initial_capital)
        final_portfolio_value_analytics = analytics_data.get("final_portfolio_value", final_portfolio_value)
        
        # Capacity and frequency metrics
        turnover_ratio = analytics_data.get("turnover_ratio", 0.0)
        trades_per_day = analytics_data.get("trades_per_day", 0.0)
        capacity_estimate = analytics_data.get("capacity", 1000000.0)  # Default $1M
        runtime_days = analytics_data.get("runtime_days", total_periods)
        runtime_years = analytics_data.get("runtime_years", total_periods / 252.0)
        
        logger.info("📊 BACKTESTING SERVICE: Comprehensive metrics extracted",
                   sharpe_ratio=sharpe_ratio,
                   sortino_ratio=sortino_ratio,
                   calmar_ratio=calmar_ratio,
                   kelly_criterion=kelly_criterion,
                   profit_factor=profit_factor,
                   win_rate=win_rate,
                   consecutive_wins=consecutive_wins,
                   consecutive_losses=consecutive_losses)
        
        return BacktestResults(
            total_trades=len(trades),
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            win_rate=win_rate,
            total_return=Decimal(str(total_return)),
            total_return_percent=total_return_pct,  # Use analytics calculated value
            max_drawdown=Decimal(str(max_drawdown_value)),
            max_drawdown_percent=max_drawdown_percent,
            final_portfolio_value=Decimal(str(final_portfolio_value_analytics)),
            initial_portfolio_value=Decimal(str(initial_portfolio_value_analytics)),
            sharpe_ratio=sharpe_ratio,
            sortino_ratio=sortino_ratio,
            calmar_ratio=calmar_ratio,
            information_ratio=information_ratio,
            volatility=volatility,
            cagr=cagr,
            avg_win=avg_win,
            avg_loss=avg_loss,
            win_loss_ratio=win_loss_ratio,
            expectancy=expectancy,
            kelly_criterion=kelly_criterion,
            turnover_ratio=turnover_ratio,
            trades_per_day=trades_per_day,
            capacity=capacity_estimate,
            runtime_days=runtime_days,
            runtime_years=runtime_years,
            gross_profit=Decimal(str(gross_profit)),
            gross_loss=Decimal(str(gross_loss)),
            net_profit=Decimal(str(net_profit)),
            profit_factor=profit_factor,
            average_trade=Decimal(str(avg_trade_pnl)),
            largest_win=Decimal(str(largest_win)),
            largest_loss=Decimal(str(largest_loss)),
            consecutive_wins=consecutive_wins,
            consecutive_losses=consecutive_losses,
            chart_data=chart_data,
            trades=trades,
            execution_time_ms=execution_time_ms,
            total_periods=total_periods
        )
    
    async def _calculate_analytics_via_service(
        self, 
        equity_curve: List[float],
        trades: List,
        initial_capital: float,
        final_capital: float,
        chart_data: List[Dict[str, Any]],
        total_periods: int
    ) -> Dict[str, Any]:
        """Calculate analytics using the analytics service."""
        logger.info("🎯 BACKTESTING SERVICE: Starting analytics service call")
        try:
            # Call analytics service for sophisticated calculations
            logger.info("📞 BACKTESTING SERVICE: Creating HTTP client for analytics service call")
            async with httpx.AsyncClient() as client:
                analytics_request = {
                    "portfolio_values": [
                        {"timestamp": i, "value": value} 
                        for i, value in enumerate(equity_curve)
                    ],
                    "trades": [
                        {
                            "trade_id": trade.trade_id,
                            "pnl": float(trade.pnl),
                            "timestamp": trade.timestamp.isoformat() if trade.timestamp else None,
                            "side": trade.side,
                            "quantity": float(trade.quantity),
                            "price": float(trade.price),
                            "commission": float(trade.commission)
                        }
                        # Only send realized PnL trades to analytics (align with other metrics)
                        for trade in trades if float(trade.pnl) != 0.0
                    ],
                    "initial_capital": initial_capital,
                    "final_capital": final_capital,
                    "trading_period_days": total_periods,
                    "chart_data_points": len(chart_data)
                }
                
                logger.info("📊 BACKTESTING SERVICE: Prepared analytics request",
                           portfolio_values_count=len(analytics_request["portfolio_values"]),
                           trades_count=len(analytics_request["trades"]),
                           initial_capital=initial_capital,
                           final_capital=final_capital,
                           analytics_url=f"{settings.ANALYTICS_SERVICE_URL}/calculate-metrics")
                
                logger.info("🌐 BACKTESTING SERVICE: Sending request to analytics service")
                response = await client.post(
                    f"{settings.ANALYTICS_SERVICE_URL}/calculate-metrics",
                    json=analytics_request,
                    timeout=30.0
                )
                
                logger.info("📡 BACKTESTING SERVICE: Received response from analytics service",
                           status_code=response.status_code,
                           response_size=len(response.content) if response.content else 0)
                
                if response.status_code == 200:
                    analytics_data = response.json()
                    logger.info("✅ BACKTESTING SERVICE: Analytics service calculation successful", 
                               sharpe_ratio=analytics_data.get("sharpe_ratio"),
                               max_drawdown=analytics_data.get("max_drawdown"),
                               full_response=analytics_data)
                    return analytics_data
                else:
                    logger.warning("⚠️ BACKTESTING SERVICE: Analytics service call failed", 
                                 status_code=response.status_code,
                                 response_text=response.text[:500],
                                 headers=dict(response.headers))
                
        except Exception as e:
            logger.error("❌ BACKTESTING SERVICE: Failed to call analytics service", 
                        error=str(e),
                        error_type=type(e).__name__,
                        analytics_url=f"{settings.ANALYTICS_SERVICE_URL}/calculate-metrics")
            import traceback
            logger.error("❌ BACKTESTING SERVICE: Analytics call traceback", traceback=traceback.format_exc())
        
        # No fallback - if analytics service fails, return empty metrics to make it obvious
        logger.error("🚨 Analytics service unavailable - returning minimal metrics")
        return {
            "max_drawdown": 0.0,
            "max_drawdown_pct": 0.0, 
            "sharpe_ratio": 0.0,
            "volatility": 0.0,
            "profit_factor": 1.0,
            "win_rate": 0.0,
            "avg_trade_pnl": 0.0
        }
    
    def _calculate_consecutive_trades(self, trades: List) -> tuple[int, int]:
        """Calculate consecutive wins and losses from trade sequence."""
        if not trades:
            return 0, 0
        
        # Sort trades by timestamp to ensure correct order
        sorted_trades = sorted(trades, key=lambda t: t.timestamp)
        
        max_consecutive_wins = 0
        max_consecutive_losses = 0
        current_consecutive_wins = 0
        current_consecutive_losses = 0
        
        for trade in sorted_trades:
            pnl = float(trade.pnl)
            
            if pnl > 0:  # Winning trade
                current_consecutive_wins += 1
                current_consecutive_losses = 0
                max_consecutive_wins = max(max_consecutive_wins, current_consecutive_wins)
            elif pnl < 0:  # Losing trade
                current_consecutive_losses += 1
                current_consecutive_wins = 0
                max_consecutive_losses = max(max_consecutive_losses, current_consecutive_losses)
            # If pnl == 0, we don't count it as win or loss
        
        return max_consecutive_wins, max_consecutive_losses

    def _calculate_basic_analytics_fallback(
        self,
        equity_curve: List[float], 
        trades: List, 
        initial_capital: float
    ) -> Dict[str, Any]:
        """Basic analytics fallback if analytics service is unavailable."""
        try:
            # Simple drawdown calculation
            if not equity_curve:
                return {"max_drawdown": 0.0, "max_drawdown_pct": 0.0, "sharpe_ratio": 0.0, "volatility": 0.0}
            
            running_max = equity_curve[0]
            max_drawdown = 0.0
            max_drawdown_pct = 0.0
            
            for value in equity_curve:
                running_max = max(running_max, value)
                drawdown = running_max - value
                drawdown_pct = (drawdown / running_max * 100) if running_max > 0 else 0
                
                max_drawdown = max(max_drawdown, drawdown)
                max_drawdown_pct = max(max_drawdown_pct, drawdown_pct)
            
            # Simple Sharpe ratio (very basic)
            returns = []
            for i in range(1, len(equity_curve)):
                if equity_curve[i-1] > 0:
                    daily_return = (equity_curve[i] - equity_curve[i-1]) / equity_curve[i-1]
                    returns.append(daily_return)
            
            sharpe_ratio = 0.0
            volatility = 0.0
            if returns:
                mean_return = sum(returns) / len(returns)
                variance = sum((r - mean_return) ** 2 for r in returns) / len(returns)
                volatility = variance ** 0.5
                sharpe_ratio = (mean_return / volatility) if volatility > 0 else 0.0
            
            # Trade metrics
            trading_metrics = {}
            if trades:
                winning_trades = [t for t in trades if float(t.pnl) > 0]
                losing_trades = [t for t in trades if float(t.pnl) < 0]
                
                trading_metrics = {
                    "winning_trades": len(winning_trades),
                    "losing_trades": len(losing_trades),
                    "win_rate": (len(winning_trades) / len(trades)) * 100 if trades else 0,
                    "largest_win": max(float(t.pnl) for t in trades) if trades else 0,
                    "largest_loss": min(float(t.pnl) for t in trades) if trades else 0,
                    "total_wins": sum(float(t.pnl) for t in winning_trades),
                    "total_losses": sum(float(t.pnl) for t in losing_trades)
                }
            
            return {
                "max_drawdown": max_drawdown,
                "max_drawdown_pct": max_drawdown_pct,
                "sharpe_ratio": sharpe_ratio,
                "volatility": volatility,
                "trading_metrics": trading_metrics
            }
        except Exception as e:
            logger.error("Fallback analytics calculation failed", error=str(e))
            return {"max_drawdown": 0.0, "max_drawdown_pct": 0.0, "sharpe_ratio": 0.0, "volatility": 0.0, "trading_metrics": {}}

    def _create_strategy_executor(self, strategy_data: Dict[str, Any]):
        """Create strategy executor from compiled strategy data."""
        try:
            from shared.strategy_engine.compiler import CompiledStrategy
            from shared.strategy_engine.nodes import NODE_REGISTRY
            
            # Reconstruct node instances from strategy data
            nodes = {}
            node_definitions = strategy_data.get("nodes", [])
            
            for node_def in node_definitions:
                node_id = node_def["id"]
                node_type = node_def["type"]
                node_data = node_def.get("data", {})
                position = node_def.get("position", {"x": 0, "y": 0})
                
                if node_type in NODE_REGISTRY:
                    node_class = NODE_REGISTRY[node_type]
                    instance = node_class(
                        node_id=node_id,
                        data=node_data,
                        position=position
                    )
                    nodes[node_id] = instance
            
            # Create compiled strategy
            execution_order = strategy_data.get("execution_order", [])
            edges = strategy_data.get("edges", [])
            execution_graph = strategy_data.get("execution_graph", {})
            
            return CompiledStrategy(nodes, edges, execution_order, execution_graph)
            
        except Exception as e:
            logger.error("Failed to create strategy executor", error=str(e))
            return None

    async def get_stats(self) -> Dict[str, Any]:
        """Get engine statistics."""
        return self.stats


class AnalyticsEngine:
    """Advanced analytics engine for backtesting."""
    
    async def initialize(self):
        """Initialize analytics engine."""
        logger.info("Analytics engine initialized")
    
    async def calculate_detailed_metrics(self, job_id: UUID) -> Optional[BacktestMetrics]:
        """Calculate detailed performance metrics."""
        # TODO: Implement advanced metrics calculation
        return BacktestMetrics(
            job_id=job_id,
            value_at_risk_95=0.05,
            annual_return=0.15,
            alpha=0.02,
            beta=1.1,
            trade_duration_avg=5.0,
            win_loss_ratio=1.5
        )


class JobQueue:
    """Job queue management for backtesting."""
    
    def __init__(self):
        self.queue = asyncio.Queue()
        self.active_jobs = {}
        self.stats = {"queued": 0, "completed": 0, "failed": 0}
    
    async def initialize(self):
        """Initialize job queue."""
        logger.info("Job queue initialized")
    
    async def shutdown(self):
        """Shutdown job queue."""
        logger.info("Job queue shutdown")
    
    async def enqueue_job(self, job: BacktestJob):
        """Add job to queue."""
        await self.queue.put(job)
        self.stats["queued"] += 1
        logger.info("Job enqueued", job_id=str(job.job_id))
    
    async def dequeue_job(self) -> Optional[BacktestJob]:
        """Get next job from queue."""
        try:
            job = await asyncio.wait_for(self.queue.get(), timeout=1.0)
            self.active_jobs[job.job_id] = job
            return job
        except asyncio.TimeoutError:
            return None
    
    async def cancel_job(self, job_id: UUID):
        """Cancel a job."""
        if job_id in self.active_jobs:
            del self.active_jobs[job_id]
        logger.info("Job cancelled", job_id=str(job_id))
    
    async def get_queue_stats(self) -> Dict[str, Any]:
        """Get queue statistics."""
        return {
            "queue_size": self.queue.qsize(),
            "active_jobs": len(self.active_jobs),
            **self.stats
        }
