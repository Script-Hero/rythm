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
kafka_processor = AnalyticsKafkaProcessor(cache_manager=cache_manager)


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
        values = [float(pv["value"]) for pv in portfolio_values]
        dates = [int(pv.get("timestamp", i)) for i, pv in enumerate(portfolio_values)]
        # Ensure timestamps are in ms for frontend charts
        dates = [ts if ts >= 1_000_000_000_000 else ts * 1000 for ts in dates]
        
        # Optional price series for benchmark/beta
        price_series = request.get("price_series", []) or []
        price_dates = [int(p.get("timestamp", i)) for i, p in enumerate(price_series)]
        price_dates = [ts if ts >= 1_000_000_000_000 else ts * 1000 for ts in price_dates]
        prices = [float(p.get("close", 0)) for p in price_series]
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
        returns = []
        if len(values) > 1:
            returns = [(values[i] - values[i-1]) / values[i-1] if values[i-1] != 0 else 0 for i in range(1, len(values))]
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

        # Sterling Ratio (Annual return / Average drawdown percentage)
        # Use average of all drawdown magnitudes from the underwater curve
        sterling_ratio = 0.0
        try:
            if values:
                peak_val = values[0]
                underwater_vals = []
                for v in values:
                    if v > peak_val:
                        peak_val = v
                    dd = (v / peak_val) - 1.0 if peak_val > 0 else 0.0  # negative or 0
                    if dd < 0:
                        underwater_vals.append(abs(dd) * 100.0)  # percent magnitude
                avg_drawdown_pct = (sum(underwater_vals) / len(underwater_vals)) if underwater_vals else 0.0
                sterling_ratio = (annual_return / avg_drawdown_pct) if avg_drawdown_pct > 0 else 0.0
        except Exception as e:
            logger.warning("Failed to calculate Sterling ratio", error=str(e))

        # Ulcer Index: sqrt(mean(square(drawdown_pct))) over the period
        ulcer_index = 0.0
        try:
            if values:
                peak_val2 = values[0]
                dd_pcts_sq = []
                for v in values:
                    if v > peak_val2:
                        peak_val2 = v
                    dd_pct = ((v / peak_val2) - 1.0) * 100.0 if peak_val2 > 0 else 0.0  # negative or 0
                    if dd_pct < 0:
                        dd_pcts_sq.append(dd_pct * dd_pct)
                if dd_pcts_sq:
                    import math
                    ulcer_index = math.sqrt(sum(dd_pcts_sq) / len(dd_pcts_sq))
        except Exception as e:
            logger.warning("Failed to calculate Ulcer index", error=str(e))

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

        # ------------------ Timeseries datasets for frontend charts ------------------
        # Cumulative returns (strategy) vs simple benchmark from price_series (if available)
        cumulative_returns = {}
        if values:
            base = values[0] if values[0] != 0 else 1.0
            backtest_curve = [(v / base) - 1.0 for v in values]
            if prices and prices[0] != 0:
                bench_base = prices[0]
                benchmark_curve = [(p / bench_base) - 1.0 for p in prices]
                # Align lengths by trimming to min length
                n = min(len(dates), len(backtest_curve), len(benchmark_curve))
                cumulative_returns = {
                    "dates": dates[:n],
                    "backtest": backtest_curve[:n],
                    "benchmark": benchmark_curve[:n]
                }
            else:
                cumulative_returns = {"dates": dates, "backtest": backtest_curve, "benchmark": [0.0] * len(dates)}

        # Daily returns series
        daily_returns = {"dates": dates[1:], "returns": returns} if returns else {"dates": [], "returns": []}

        # Drawdown / underwater
        underwater = []
        if values:
            peak = values[0]
            for v in values:
                if v > peak: peak = v
                underwater.append((v / peak) - 1.0 if peak > 0 else 0.0)
        drawdown = {
            "drawdown_series": {"dates": dates, "drawdowns": underwater},
            "top_drawdowns": []
        } if underwater else {"drawdown_series": {"dates": [], "drawdowns": []}, "top_drawdowns": []}
        underwater_curve = {"dates": dates, "underwater": underwater} if underwater else {"dates": [], "underwater": []}

        # Monthly and annual returns
        monthly_returns = {}
        annual_returns = {}
        if values and dates:
            from collections import defaultdict
            month_map = defaultdict(lambda: defaultdict(float))  # month -> year -> return
            # Track first/last per (year,month) and per year
            first_by_month = {}
            last_by_month = {}
            first_by_year = {}
            last_by_year = {}
            for v, ts in zip(values, dates):
                d = __import__('datetime').datetime.utcfromtimestamp(ts / 1000)
                y, m = d.year, d.month
                key = (y, m)
                if key not in first_by_month:
                    first_by_month[key] = v
                last_by_month[key] = v
                if y not in first_by_year:
                    first_by_year[y] = v
                last_by_year[y] = v
            # Month name mapping
            month_names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            for (y, m), fval in first_by_month.items():
                lval = last_by_month[(y, m)]
                ret = (lval / fval) - 1.0 if fval > 0 else 0.0
                mn = month_names[m-1]
                if mn not in monthly_returns:
                    monthly_returns[mn] = {}
                monthly_returns[mn][str(y)] = ret
            for y, fval in first_by_year.items():
                lval = last_by_year[y]
                annual_returns[str(y)] = (lval / fval) - 1.0 if fval > 0 else 0.0
        average_annual_return = (sum(annual_returns.values()) / len(annual_returns)) if annual_returns else 0.0

        # Rolling volatility (3/6/12 months ~ 63/126/252 trading days)
        def rolling_std(data, window):
            out = [None] * len(data)
            if window <= 1:
                return [abs(x) for x in data]
            import math
            for i in range(window-1, len(data)):
                seg = data[i-window+1:i+1]
                mean = sum(seg) / len(seg)
                var = sum((x-mean)**2 for x in seg) / len(seg)
                out[i] = math.sqrt(var)
            return out
        vol3 = rolling_std(returns, 63) if returns else []
        vol6 = rolling_std(returns, 126) if returns else []
        vol12 = rolling_std(returns, 252) if returns else []
        # Align to dates by adding a leading None to match len(dates)
        def align(series):
            return [None] + series if series else []
        rolling_volatility = {
            "dates": dates,
            "volatility_3mo": align(vol3),
            "volatility_6mo": align(vol6),
            "volatility_12mo": align(vol12)
        } if returns else {"dates": [], "volatility_3mo": [], "volatility_6mo": [], "volatility_12mo": []}

        # Rolling Sharpe (annualized) using sqrt(252)
        def rolling_sharpe_calc(data, window):
            out = [None] * len(data)
            import math
            for i in range(window-1, len(data)):
                seg = data[i-window+1:i+1]
                mean = sum(seg) / len(seg)
                var = sum((x-mean)**2 for x in seg) / len(seg)
                std = math.sqrt(var)
                out[i] = (mean / std) * math.sqrt(252) if std > 0 else 0.0
            return out
        sh6 = rolling_sharpe_calc(returns, 126) if returns else []
        sh12 = rolling_sharpe_calc(returns, 252) if returns else []
        rolling_sharpe = {
            "dates": dates,
            "sharpe_6mo": align(sh6),
            "sharpe_12mo": align(sh12)
        } if returns else {"dates": [], "sharpe_6mo": [], "sharpe_12mo": []}

        # Rolling Beta vs benchmark price returns
        rolling_beta = {"dates": [], "beta_6mo": [], "beta_12mo": []}
        # Scalar attribution metrics defaults
        alpha_capm = 0.0
        beta_capm = 0.0
        r_squared = 0.0
        tracking_error = 0.0
        up_capture = 0.0
        down_capture = 0.0
        treynor_ratio = 0.0

        if prices and len(prices) > 1:
            bench_returns = [(prices[i] - prices[i-1]) / prices[i-1] if prices[i-1] != 0 else 0 for i in range(1, len(prices))]
            # Align lengths between returns and bench_returns
            n = min(len(returns), len(bench_returns))
            pr = returns[:n]
            br = bench_returns[:n]
            import math
            def rolling_beta_calc(x, y, window):
                out = [None] * len(x)
                for i in range(window-1, len(x)):
                    xs = x[i-window+1:i+1]
                    ys = y[i-window+1:i+1]
                    meanx = sum(xs)/window
                    meany = sum(ys)/window
                    cov = sum((xs[j]-meanx)*(ys[j]-meany) for j in range(window))/window
                    var = sum((ys[j]-meany)**2 for j in range(window))/window
                    out[i] = (cov/var) if var > 0 else 0.0
                return out
            b6 = rolling_beta_calc(pr, br, 126)
            b12 = rolling_beta_calc(pr, br, 252)
            # Dates align to returns dates (skip first element alignment like above)
            rb_dates = dates[1:1+len(pr)]
            # Pad to full dates length
            pad_len = len(dates) - len(rb_dates)
            beta6_full = [None]*pad_len + b6
            beta12_full = [None]*pad_len + b12
            rolling_beta = {"dates": dates, "beta_6mo": beta6_full, "beta_12mo": beta12_full}

            # CAPM alpha/beta and attribution metrics
            if n > 2:
                mean_p = sum(pr)/n
                mean_b = sum(br)/n
                cov_pb = sum((pr[i]-mean_p)*(br[i]-mean_b) for i in range(n)) / n
                var_b = sum((br[i]-mean_b)**2 for i in range(n)) / n
                var_p = sum((pr[i]-mean_p)**2 for i in range(n)) / n
                beta_capm = (cov_pb/var_b) if var_b > 0 else 0.0
                alpha_capm = mean_p - beta_capm*mean_b
                r_squared = (cov_pb**2)/(var_b*var_p) if (var_b>0 and var_p>0) else 0.0
                # Tracking error: std dev of active returns (p - b)
                active = [pr[i]-br[i] for i in range(n)]
                mean_active = sum(active)/n
                te_var = sum((a-mean_active)**2 for a in active) / n
                tracking_error = math.sqrt(te_var)
                # Capture ratios
                up_idx = [i for i,x in enumerate(br) if x > 0]
                down_idx = [i for i,x in enumerate(br) if x < 0]
                if up_idx:
                    avg_p_up = sum(pr[i] for i in up_idx)/len(up_idx)
                    avg_b_up = sum(br[i] for i in up_idx)/len(up_idx)
                    up_capture = (avg_p_up/avg_b_up) if avg_b_up != 0 else 0.0
                if down_idx:
                    avg_p_dn = sum(pr[i] for i in down_idx)/len(down_idx)
                    avg_b_dn = sum(br[i] for i in down_idx)/len(down_idx)
                    down_capture = (avg_p_dn/avg_b_dn) if avg_b_dn != 0 else 0.0
                # Treynor ratio: mean excess return over beta (risk-free=0)
                treynor_ratio = (mean_p/beta_capm) if beta_capm not in (0, None) else 0.0

        # Trade return histogram (new format)
        histogram = {"histogram_data": []}
        if trades:
            # Normalize trade pnl by initial_capital to a return
            rets = [(t.get("pnl", 0) / initial_capital) if initial_capital else 0 for t in trades]
            if rets:
                mn, mx = min(rets), max(rets)
                bins = max(10, min(30, len(rets)//2 or 10))
                width = (mx - mn) if (mx - mn) != 0 else 1.0
                # Build bins on return scale
                edges = [mn + (i*width)/bins for i in range(bins+1)]
                freqs = [0]*(bins)
                for r in rets:
                    idx = int((r - mn) / width * bins)
                    if idx >= bins: idx = bins-1
                    if idx < 0: idx = 0
                    freqs[idx] += 1
                data = []
                for i in range(bins):
                    r0, r1 = edges[i], edges[i+1]
                    label = f"{r0*100:.2f}% to {r1*100:.2f}%"
                    data.append({
                        "range_start": r0,
                        "range_end": r1,
                        "range_label": label,
                        "frequency": freqs[i]
                    })
                histogram = {"histogram_data": data}
        
        metrics = {
            # Performance metrics
            "total_return_pct": total_return_pct,
            "cagr": cagr,
            "sharpe_ratio": sharpe_ratio * 100,  # Annualized percentage
            "sortino_ratio": sortino_ratio * 100,
            "calmar_ratio": calmar_ratio,
            "sterling_ratio": sterling_ratio,
            "ulcer_index": ulcer_index,
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
            "total_periods": len(values),
            
            # Timeseries datasets
            "cumulative_returns": cumulative_returns,
            "daily_returns": daily_returns,
            "monthly_returns": monthly_returns,
            "annual_returns": annual_returns,
            "average_annual_return": average_annual_return,
            "drawdown": drawdown,
            "underwater_curve": underwater_curve,
            "rolling_volatility": rolling_volatility,
            "rolling_sharpe": rolling_sharpe,
            "rolling_beta": rolling_beta,
            "trade_return_histogram": histogram,
            
            # Attribution metrics (scalars)
            "alpha": alpha_capm,
            "beta": beta_capm,
            "r_squared": r_squared,
            "tracking_error": tracking_error,
            "up_capture": up_capture,
            "down_capture": down_capture,
            "treynor_ratio": treynor_ratio
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
