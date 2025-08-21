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
        except Exception as e:
            logger.error("Failed to initialize database", error=str(e))
            raise
    
    async def shutdown(self):
        """Shutdown database connection."""
        if self._pool:
            await self._pool.close()
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
                        analytics = $8
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
                        'total_return_pct': results.total_return_percent,
                        'sharpe_ratio': results.sharpe_ratio,
                        'max_drawdown_pct': results.max_drawdown_percent,
                        'win_rate': results.win_rate,
                        'total_trades': results.total_trades,
                        'volatility': results.volatility,
                        'profit_factor': results.profit_factor
                    })
                )
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
                           trade_count, win_rate, analytics, initial_balance
                    FROM backtest_results 
                    WHERE id = $1
                """, job_id)
                
                if not row:
                    return None
                
                # Create simplified results object
                analytics = json.loads(row['analytics']) if row['analytics'] else {}
                logger.info(f"Analytics:{analytics}")
                results = BacktestResults(
                    total_trades=row['trade_count'] or 0,
                    winning_trades=0,  # Not stored
                    losing_trades=0,   # Not stored
                    win_rate=row['win_rate'] or 0,
                    total_return=Decimal(str(row['total_return'] or 0)),
                    total_return_percent=row['total_return'] or 0,
                    max_drawdown=Decimal(str(row['max_drawdown'] or 0)),
                    max_drawdown_percent=row['max_drawdown'] or 0,
                    final_portfolio_value=Decimal(str(row['final_balance'])),
                    initial_portfolio_value=Decimal(str(row['initial_balance'])),
                    sharpe_ratio=row['sharpe_ratio'],
                    gross_profit=Decimal("0"),  # Not calculated
                    gross_loss=Decimal("0"),    # Not calculated
                    net_profit=Decimal(str(row['final_balance'] - row['initial_balance'])),
                    average_trade=Decimal("0"), # Not calculated
                    largest_win=Decimal("0"),   # Not calculated
                    largest_loss=Decimal("0"),   # Not calculated
                    consecutive_wins=0,  # Not stored in database
                    consecutive_losses=0,  # Not stored in database
                    chart_data=[],  # Not stored for retrieval
                    trades=[],  # Not stored for retrieval
                    execution_time_ms=0,  # Not stored
                    total_periods=0  # Not stored
                )
                
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
        
        # Generate mock data for development
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
        
        # Return mock strategy for development (only as fallback)
        auth_status = "with auth" if user_token else "without auth"
        logger.warning("⚠️ Falling back to mock strategy", 
                      strategy_id=str(strategy_id),
                      auth_status=auth_status)
        return {
            "id": str(strategy_id),
            "name": f"Mock Strategy ({auth_status.title()})",
            "description": f"Fallback strategy used when real strategy cannot be retrieved ({auth_status})",
            "compiled": True,
            "nodes": [],
            "execution_order": []
        }


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

        # logger.warning(f"Job is {job} and data is {data}")
        
        try:
            # from shared.strategy_engine.compiler import StrategyCompiler
            # from shared.strategy_engine.nodes import NODE_REGISTRY
            
            # Create compiled strategy from job.strategy
            strategy_data = job.strategy
            logger.warning(f"Strategy data : {strategy_data}")
            
            # Extract nodes and execution order from the correct locations
            json_tree = strategy_data.get("json_tree", {}) if strategy_data else {}
            compilation_report = strategy_data.get("compilation_report", {}) if strategy_data else {}
            nodes = json_tree.get("nodes", [])
            edges = json_tree.get("edges", [])
            execution_order = compilation_report.get("execution_order", [])
            
            if strategy_data and nodes and execution_order:
                # Create strategy executor with proper data format
                executor_data = {
                    "nodes": nodes,
                    "edges": edges,
                    "execution_order": execution_order,
                    "execution_graph": {}  # TODO: Build execution graph if needed
                }
                strategy_executor = self._create_strategy_executor(executor_data)
                logger.warning("✅ Using compiled strategy for backtest", 
                           node_count=len(nodes),
                           edge_count=len(edges),
                           execution_order=execution_order)
            else:
                # Fall back to simple buy-and-hold strategy
                strategy_executor = None
                logger.warning("❌ No valid compiled strategy found, using simple buy-and-hold",
                             has_strategy_data=bool(strategy_data),
                             has_nodes=bool(nodes),
                             has_execution_order=bool(execution_order))
                
        except Exception as e:
            logger.error("Failed to initialize strategy engine, using fallback", error=str(e))
            strategy_executor = None
        
        # Execute strategy on each data point
        for i, bar in enumerate(data):
            current_price = float(bar.get("close", 50000))
            timestamp = bar.get("timestamp", datetime.utcnow())
            
            # Convert timestamp if needed
            if isinstance(timestamp, str):
                try:
                    timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                except ValueError:
                    timestamp = datetime.utcnow()
            elif not isinstance(timestamp, datetime):
                timestamp = datetime.fromtimestamp(float(timestamp))
            
            # Prepare market data for strategy
            market_data = {
                'price': current_price,
                'open': float(bar.get('open', current_price)),
                'high': float(bar.get('high', current_price)),
                'low': float(bar.get('low', current_price)),
                'close': current_price,
                'volume': float(bar.get('volume', 1000)),
                'timestamp': timestamp,
                'symbol': job.request.symbol
            }
            
            # Execute strategy
            signals = []
            if strategy_executor:
                try:
                    signals = strategy_executor.execute(market_data)
                except Exception as e:
                    logger.error("Strategy execution error", error=str(e), bar_index=i)
                    signals = []
            else:
                # Simple fallback strategy
                if i % 20 == 0 and i > 0:  # Trade every 20 bars after warmup
                    if position == 0 and cash > current_price:
                        signals = [{'action': 'buy', 'size': 0.1, 'price': current_price}]
                    elif position > 0:
                        signals = [{'action': 'sell', 'size': 1.0, 'price': current_price}]
            
            # Process trading signals
            for signal in signals:
                action = signal.get('action', '').lower()
                signal_price = float(signal.get('price', current_price))
                size = float(signal.get('size', 0))
                
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
                "timestamp": timestamp.timestamp(),
                "portfolio_value": current_portfolio_value,
                "price": current_price,
                "cash": cash,
                "position": position
            })
        
        # Calculate basic metrics locally
        final_portfolio_value = cash + position * float(data[-1].get("close", 50000))
        total_return = final_portfolio_value - initial_capital
        total_return_percent = (total_return / initial_capital) * 100 if initial_capital > 0 else 0
        
        # Calculate advanced analytics using analytics service
        analytics_data = await self._calculate_analytics_via_service(
            equity_curve=equity_curve,
            trades=trades,
            initial_capital=initial_capital,
            final_capital=final_portfolio_value,
            chart_data=chart_data
        )
        
        # Extract metrics from analytics service
        max_drawdown_value = analytics_data.get("max_drawdown", 0.0)
        max_drawdown_percent = analytics_data.get("max_drawdown_pct", 0.0)
        sharpe_ratio = analytics_data.get("sharpe_ratio", 0.0)
        volatility = analytics_data.get("volatility", 0.0)
        
        # Trade statistics from analytics service
        trading_metrics = analytics_data.get("trading_metrics", {})
        winning_trades = trading_metrics.get("winning_trades", 0)
        losing_trades = trading_metrics.get("losing_trades", 0)
        win_rate = trading_metrics.get("win_rate", 0.0) / 100.0  # Convert from percentage
        gross_profit = trading_metrics.get("total_wins", 0.0)
        gross_loss = abs(trading_metrics.get("total_losses", 0.0))
        
        return BacktestResults(
            total_trades=len(trades),
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            win_rate=win_rate,
            total_return=Decimal(str(total_return)),
            total_return_percent=total_return_percent,
            max_drawdown=Decimal(str(max_drawdown_value)),
            max_drawdown_percent=max_drawdown_percent,
            final_portfolio_value=Decimal(str(final_portfolio_value)),
            initial_portfolio_value=Decimal(str(initial_capital)),
            sharpe_ratio=sharpe_ratio,
            sortino_ratio=sharpe_ratio * 1.2,  # Approximation - could enhance with analytics service
            calmar_ratio=abs(total_return_percent / max_drawdown_percent) if max_drawdown_percent != 0 else 0,
            volatility=volatility,
            gross_profit=Decimal(str(gross_profit)),
            gross_loss=Decimal(str(gross_loss)),
            net_profit=Decimal(str(gross_profit + gross_loss)),
            profit_factor=abs(gross_profit / gross_loss) if gross_loss != 0 else None,
            average_trade=Decimal(str(total_return / max(len(trades), 1))),
            largest_win=Decimal(str(trading_metrics.get("largest_win", 0.0))),
            largest_loss=Decimal(str(trading_metrics.get("largest_loss", 0.0))),
            consecutive_wins=3,  # Could enhance with analytics service
            consecutive_losses=2,  # Could enhance with analytics service
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
        chart_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate analytics using the analytics service."""
        try:
            # Call analytics service for sophisticated calculations
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
                            "timestamp": trade.timestamp.isoformat() if trade.timestamp else None
                        }
                        for trade in trades
                    ],
                    "initial_capital": initial_capital,
                    "final_capital": final_capital
                }
                
                response = await client.post(
                    f"{settings.ANALYTICS_SERVICE_URL}/calculate-metrics",
                    json=analytics_request,
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    analytics_data = response.json()
                    logger.info("Analytics service calculation successful", 
                               sharpe_ratio=analytics_data.get("sharpe_ratio"),
                               max_drawdown=analytics_data.get("max_drawdown"))
                    return analytics_data
                else:
                    logger.warning("Analytics service call failed", 
                                 status_code=response.status_code,
                                 response=response.text[:200])
                
        except Exception as e:
            logger.error("Failed to call analytics service", error=str(e))
        
        # Fallback to basic local calculations if analytics service fails
        return self._calculate_basic_analytics_fallback(equity_curve, trades, initial_capital)
    
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