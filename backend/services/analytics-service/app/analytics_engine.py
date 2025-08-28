"""
Analytics engine for calculating performance metrics.
"""

import math
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from statistics import mean, stdev

import numpy as np
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import structlog

from .models import ForwardTestSession, Trade, ChartData, BacktestResult
from .config import settings

logger = structlog.get_logger()


class AnalyticsEngine:
    """Core analytics calculation engine."""
    
    def __init__(self):
        self.risk_free_rate = Decimal(str(settings.DEFAULT_RISK_FREE_RATE))
    
    async def calculate_live_analytics(self, db: AsyncSession, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Calculate live analytics for a forward testing session.
        
        Args:
            db: Database session
            session_id: Forward test session ID
            
        Returns:
            Dictionary containing live analytics or None if session not found
        """
        try:
            # Get session data
            session = await self._get_session(db, session_id)
            if not session:
                logger.warning("Session not found for analytics", session_id=session_id)
                return None
            
            # Get trades
            trades = await self._get_session_trades(db, session_id)
            
            # Get portfolio value history
            portfolio_values = await self._get_portfolio_values(db, session_id)
            
            # Calculate core metrics
            analytics = {
                "session_id": session_id,
                "calculated_at": datetime.utcnow().isoformat(),
                "performance_metrics": await self._calculate_performance_metrics(session, trades, portfolio_values),
                "risk_metrics": await self._calculate_risk_metrics(session, trades, portfolio_values),
                "trading_metrics": await self._calculate_trading_metrics(trades),
                "portfolio_overview": await self._calculate_portfolio_overview(session, trades)
            }
            
            logger.info("Calculated live analytics", 
                       session_id=session_id,
                       total_trades=len(trades),
                       total_return=analytics["performance_metrics"].get("total_return_pct"))
            
            return analytics
        
        except Exception as e:
            logger.error("Failed to calculate live analytics", error=str(e), session_id=session_id)
            return None
    
    async def calculate_backtest_analytics(self, db: AsyncSession, backtest_id: str) -> Optional[Dict[str, Any]]:
        """
        Calculate analytics for a completed backtest.
        
        Args:
            db: Database session
            backtest_id: Backtest result ID
            
        Returns:
            Dictionary containing backtest analytics
        """
        try:
            # Get backtest result
            result = await db.execute(
                select(BacktestResult).where(BacktestResult.id == backtest_id)
            )
            backtest = result.scalar_one_or_none()
            
            if not backtest:
                logger.warning("Backtest not found", backtest_id=backtest_id)
                return None
            
            # Calculate analytics based on backtest data
            analytics = {
                "backtest_id": backtest_id,
                "calculated_at": datetime.utcnow().isoformat(),
                "performance_metrics": self._calculate_backtest_performance_metrics(backtest),
                "risk_metrics": self._calculate_backtest_risk_metrics(backtest),
                "trading_metrics": self._calculate_backtest_trading_metrics(backtest)
            }
            
            return analytics
        
        except Exception as e:
            logger.error("Failed to calculate backtest analytics", error=str(e), backtest_id=backtest_id)
            return None
    
    async def calculate_final_analytics(self, db: AsyncSession, session_id: str) -> Optional[Dict[str, Any]]:
        """Calculate final analytics for a completed session."""
        # Same as live analytics but with completed flag
        analytics = await self.calculate_live_analytics(db, session_id)
        if analytics:
            analytics["status"] = "completed"
            analytics["final_calculation"] = True
        return analytics
    
    async def _get_session(self, db: AsyncSession, session_id: str) -> Optional[ForwardTestSession]:
        """Get forward test session."""
        result = await db.execute(
            select(ForwardTestSession).where(ForwardTestSession.session_id == session_id)
        )
        return result.scalar_one_or_none()
    
    async def _get_session_trades(self, db: AsyncSession, session_id: str) -> List[Trade]:
        """Get all trades for a session."""
        result = await db.execute(
            select(Trade)
            .where(Trade.session_id == session_id)
            .order_by(Trade.execution_time)
        )
        return result.scalars().all()
    
    async def _get_portfolio_values(self, db: AsyncSession, session_id: str) -> List[Tuple[datetime, Decimal]]:
        """Get portfolio value time series."""
        result = await db.execute(
            select(ChartData.timestamp, ChartData.value)
            .where(ChartData.session_id == session_id)
            .where(ChartData.data_type == "portfolio")
            .order_by(ChartData.timestamp)
        )
        
        # Convert timestamps to datetime objects
        values = []
        for timestamp, value in result.fetchall():
            dt = datetime.fromtimestamp(timestamp)
            values.append((dt, value))
        
        return values
    
    async def _calculate_performance_metrics(self, session: ForwardTestSession, trades: List[Trade], portfolio_values: List[Tuple[datetime, Decimal]]) -> Dict[str, Any]:
        """Calculate comprehensive performance metrics."""
        try:
            initial_balance = session.initial_balance
            current_balance = session.current_balance or initial_balance
            
            # Total return
            total_return = current_balance - initial_balance
            total_return_pct = float((total_return / initial_balance) * 100) if initial_balance > 0 else 0.0
            
            # Time-based metrics
            start_time = session.start_time or session.created_at
            runtime_days = (datetime.utcnow() - start_time).days or 1
            runtime_years = runtime_days / 365.25
            
            # CAGR using new calculation method
            cagr = self._calculate_cagr(float(initial_balance), float(current_balance), runtime_years) or 0.0
            
            # Calculate returns for advanced metrics
            returns = self._calculate_returns(portfolio_values) if len(portfolio_values) > 1 else []
            
            # Risk-adjusted metrics
            sharpe_ratio = self._calculate_sharpe_ratio(portfolio_values) if len(portfolio_values) > 1 else None
            sortino_ratio = self._calculate_sortino_ratio(returns) if returns else None
            information_ratio = self._calculate_information_ratio(returns) if returns else None
            
            # Get risk metrics for Calmar ratio
            risk_metrics = await self._calculate_risk_metrics(session, trades, portfolio_values)
            max_drawdown_pct = risk_metrics.get("max_drawdown_pct", 0.0)
            calmar_ratio = self._calculate_calmar_ratio(total_return_pct, max_drawdown_pct, runtime_years) if max_drawdown_pct > 0 else None
            
            # Capacity and turnover estimates
            avg_portfolio_value = float((initial_balance + current_balance) / 2)
            volatility = risk_metrics.get("volatility", 0.0) / 100  # Convert from percentage
            capacity_estimate = self._calculate_capacity_estimate(trades, avg_portfolio_value, volatility) or 1000000  # Default $1M
            turnover_ratio = self._calculate_turnover_ratio(trades, avg_portfolio_value, runtime_days) or 0.0
            
            # Trading frequency
            trades_per_day = len(trades) / max(runtime_days, 1)
            
            return {
                "total_return": float(total_return),
                "total_return_pct": total_return_pct,
                "cagr": cagr,
                "sharpe_ratio": sharpe_ratio,
                "sortino_ratio": sortino_ratio,
                "calmar_ratio": calmar_ratio,
                "information_ratio": information_ratio,
                "initial_balance": float(initial_balance),
                "current_balance": float(current_balance),
                "runtime_days": runtime_days,
                "runtime_years": runtime_years,
                "capacity_estimate": capacity_estimate,
                "turnover_ratio": turnover_ratio,
                "trades_per_day": trades_per_day
            }
        
        except Exception as e:
            logger.error("Failed to calculate performance metrics", error=str(e))
            return {}
    
    async def _calculate_risk_metrics(self, session: ForwardTestSession, trades: List[Trade], portfolio_values: List[Tuple[datetime, Decimal]]) -> Dict[str, Any]:
        """Calculate comprehensive risk metrics including drawdown and downside measures."""
        try:
            metrics = {}
            
            # Calculate drawdown from portfolio values
            if len(portfolio_values) > 1:
                drawdown_data = self._calculate_drawdown_series(portfolio_values)
                metrics.update({
                    "max_drawdown": drawdown_data["max_drawdown"],
                    "max_drawdown_pct": drawdown_data["max_drawdown_pct"],
                    "current_drawdown": drawdown_data["current_drawdown"],
                    "current_drawdown_pct": drawdown_data["current_drawdown_pct"]
                })
            else:
                metrics.update({
                    "max_drawdown": 0.0,
                    "max_drawdown_pct": 0.0,
                    "current_drawdown": 0.0,
                    "current_drawdown_pct": 0.0
                })
            
            # Calculate volatility and downside metrics
            if len(portfolio_values) > 2:
                returns = self._calculate_returns(portfolio_values)
                if returns:
                    # Standard volatility
                    volatility = float(np.std(returns) * np.sqrt(252) * 100)  # Annualized volatility
                    metrics["volatility"] = volatility
                    
                    # Downside deviation
                    downside_deviation = self._calculate_downside_deviation(returns)
                    metrics["downside_deviation"] = downside_deviation or 0.0
                    
                    # Simple VaR estimates (95% and 99% confidence levels)
                    sorted_returns = sorted(returns)
                    n = len(sorted_returns)
                    if n > 20:  # Need sufficient data for VaR
                        var_95_idx = int(0.05 * n)
                        var_99_idx = int(0.01 * n)
                        metrics["value_at_risk_95"] = abs(sorted_returns[var_95_idx] * 100) if var_95_idx < n else 0.0
                        metrics["value_at_risk_99"] = abs(sorted_returns[var_99_idx] * 100) if var_99_idx < n else 0.0
                    else:
                        metrics["value_at_risk_95"] = 0.0
                        metrics["value_at_risk_99"] = 0.0
                else:
                    metrics.update({
                        "volatility": 0.0,
                        "downside_deviation": 0.0,
                        "value_at_risk_95": 0.0,
                        "value_at_risk_99": 0.0
                    })
            else:
                metrics.update({
                    "volatility": 0.0,
                    "downside_deviation": 0.0,
                    "value_at_risk_95": 0.0,
                    "value_at_risk_99": 0.0
                })
            
            return metrics
        
        except Exception as e:
            logger.error("Failed to calculate risk metrics", error=str(e))
            return {}
    
    async def _calculate_trading_metrics(self, trades: List[Trade]) -> Dict[str, Any]:
        """Calculate comprehensive trading-specific metrics."""
        try:
            if not trades:
                return {
                    "total_trades": 0,
                    "winning_trades": 0,
                    "losing_trades": 0,
                    "win_rate": 0.0,
                    "profit_factor": 0.0,
                    "avg_win": 0.0,
                    "avg_loss": 0.0,
                    "largest_win": 0.0,
                    "largest_loss": 0.0,
                    "consecutive_wins": 0,
                    "consecutive_losses": 0,
                    "kelly_criterion": 0.0,
                    "expectancy": 0.0,
                    "win_loss_ratio": 0.0,
                    "gross_profit": 0.0,
                    "gross_loss": 0.0
                }
            
            # Filter trades with PnL data
            completed_trades = [t for t in trades if t.pnl is not None]
            
            if not completed_trades:
                return {
                    "total_trades": len(trades),
                    "winning_trades": 0,
                    "losing_trades": 0,
                    "win_rate": 0.0,
                    "profit_factor": 0.0,
                    "avg_win": 0.0,
                    "avg_loss": 0.0,
                    "largest_win": 0.0,
                    "largest_loss": 0.0,
                    "consecutive_wins": 0,
                    "consecutive_losses": 0,
                    "kelly_criterion": 0.0,
                    "expectancy": 0.0,
                    "win_loss_ratio": 0.0,
                    "gross_profit": 0.0,
                    "gross_loss": 0.0
                }
            
            # Separate winning and losing trades
            winning_trades = [t for t in completed_trades if t.pnl > 0]
            losing_trades = [t for t in completed_trades if t.pnl < 0]
            
            # Basic metrics
            win_rate = (len(winning_trades) / len(completed_trades)) if completed_trades else 0.0
            
            avg_win = float(mean([t.pnl for t in winning_trades])) if winning_trades else 0.0
            avg_loss = float(abs(mean([t.pnl for t in losing_trades]))) if losing_trades else 0.0
            
            largest_win = float(max([t.pnl for t in winning_trades])) if winning_trades else 0.0
            largest_loss = float(min([t.pnl for t in losing_trades])) if losing_trades else 0.0
            
            # Profit factor and gross amounts
            gross_profit = float(sum([t.pnl for t in winning_trades])) if winning_trades else 0.0
            gross_loss = float(abs(sum([t.pnl for t in losing_trades]))) if losing_trades else 0.0
            profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf') if gross_profit > 0 else 1.0
            
            # Advanced metrics using new calculation methods
            consecutive_wins, consecutive_losses = self._calculate_consecutive_trades(completed_trades)
            expectancy = self._calculate_expectancy(completed_trades) or 0.0
            kelly_criterion = self._calculate_kelly_criterion(win_rate, avg_win, avg_loss) or 0.0
            
            # Win/Loss ratio
            win_loss_ratio = avg_win / avg_loss if avg_loss > 0 else 0.0
            
            return {
                "total_trades": len(trades),
                "completed_trades": len(completed_trades),
                "winning_trades": len(winning_trades),
                "losing_trades": len(losing_trades),
                "win_rate": win_rate * 100,  # Convert to percentage
                "profit_factor": profit_factor,
                "avg_win": avg_win,
                "avg_loss": avg_loss,
                "largest_win": largest_win,
                "largest_loss": largest_loss,
                "consecutive_wins": consecutive_wins,
                "consecutive_losses": consecutive_losses,
                "kelly_criterion": kelly_criterion,
                "expectancy": expectancy,
                "win_loss_ratio": win_loss_ratio,
                "gross_profit": gross_profit,
                "gross_loss": gross_loss
            }
        
        except Exception as e:
            logger.error("Failed to calculate trading metrics", error=str(e))
            return {}
    
    async def _calculate_portfolio_overview(self, session: ForwardTestSession, trades: List[Trade]) -> Dict[str, Any]:
        """Calculate portfolio overview."""
        try:
            total_pnl = sum([t.pnl for t in trades if t.pnl is not None], Decimal(0))
            
            return {
                "total_value": float(session.current_balance or session.initial_balance),
                "cash": float(session.current_balance or session.initial_balance),  # Simplified for now
                "total_pnl": float(total_pnl),
                "initial_balance": float(session.initial_balance),
                "symbol": session.symbol,
                "session_name": session.name,
                "status": session.status
            }
        
        except Exception as e:
            logger.error("Failed to calculate portfolio overview", error=str(e))
            return {}
    
    def _calculate_sharpe_ratio(self, portfolio_values: List[Tuple[datetime, Decimal]]) -> Optional[float]:
        """Calculate Sharpe ratio from portfolio values."""
        try:
            if len(portfolio_values) < 2:
                return None
            
            # Calculate daily returns
            returns = self._calculate_returns(portfolio_values)
            if not returns or len(returns) < 2:
                return None
            
            # Calculate excess returns (assuming daily risk-free rate)
            daily_risk_free = float(self.risk_free_rate) / 252
            excess_returns = [r - daily_risk_free for r in returns]
            
            # Calculate Sharpe ratio
            if len(excess_returns) > 1:
                mean_excess = mean(excess_returns)
                std_excess = stdev(excess_returns) if len(excess_returns) > 1 else 0
                
                if std_excess > 0:
                    sharpe = (mean_excess / std_excess) * math.sqrt(252)  # Annualized
                    return sharpe
            
            return None
        
        except Exception as e:
            logger.error("Failed to calculate Sharpe ratio", error=str(e))
            return None
    
    def _calculate_returns(self, portfolio_values: List[Tuple[datetime, Decimal]]) -> List[float]:
        """Calculate daily returns from portfolio values."""
        if len(portfolio_values) < 2:
            return []
        
        returns = []
        for i in range(1, len(portfolio_values)):
            prev_value = float(portfolio_values[i-1][1])
            curr_value = float(portfolio_values[i][1])
            
            if prev_value > 0:
                daily_return = (curr_value - prev_value) / prev_value
                returns.append(daily_return)
        
        return returns
    
    def _calculate_drawdown_series(self, portfolio_values: List[Tuple[datetime, Decimal]]) -> Dict[str, float]:
        """Calculate drawdown series and statistics."""
        if len(portfolio_values) < 2:
            return {
                "max_drawdown": 0.0,
                "max_drawdown_pct": 0.0,
                "current_drawdown": 0.0,
                "current_drawdown_pct": 0.0
            }
        
        values = [float(pv[1]) for pv in portfolio_values]
        
        # Calculate running maximum (peak)
        peak = values[0]
        max_drawdown = 0.0
        max_drawdown_pct = 0.0
        
        for value in values:
            # Update peak
            if value > peak:
                peak = value
            
            # Calculate drawdown
            drawdown = peak - value
            drawdown_pct = (drawdown / peak * 100) if peak > 0 else 0.0
            
            # Update max drawdown
            if drawdown > max_drawdown:
                max_drawdown = drawdown
                max_drawdown_pct = drawdown_pct
        
        # Current drawdown
        current_value = values[-1]
        current_drawdown = peak - current_value
        current_drawdown_pct = (current_drawdown / peak * 100) if peak > 0 else 0.0
        
        return {
            "max_drawdown": max_drawdown,
            "max_drawdown_pct": max_drawdown_pct,
            "current_drawdown": current_drawdown,
            "current_drawdown_pct": current_drawdown_pct
        }
    
    def _calculate_backtest_performance_metrics(self, backtest: BacktestResult) -> Dict[str, Any]:
        """Calculate performance metrics for backtest results."""
        try:
            return {
                "total_return": float(backtest.total_return),
                "sharpe_ratio": float(backtest.sharpe_ratio) if backtest.sharpe_ratio else None,
                "initial_balance": float(backtest.initial_balance),
                "final_balance": float(backtest.final_balance),
                "start_date": backtest.start_date.isoformat(),
                "end_date": backtest.end_date.isoformat(),
                "runtime_days": (backtest.end_date - backtest.start_date).days
            }
        except Exception as e:
            logger.error("Failed to calculate backtest performance metrics", error=str(e))
            return {}
    
    def _calculate_backtest_risk_metrics(self, backtest: BacktestResult) -> Dict[str, Any]:
        """Calculate risk metrics for backtest results."""
        try:
            return {
                "max_drawdown": float(backtest.max_drawdown) if backtest.max_drawdown else 0.0
            }
        except Exception as e:
            logger.error("Failed to calculate backtest risk metrics", error=str(e))
            return {}
    
    def _calculate_backtest_trading_metrics(self, backtest: BacktestResult) -> Dict[str, Any]:
        """Calculate trading metrics for backtest results."""
        try:
            return {
                "total_trades": backtest.trade_count or 0,
                "win_rate": float(backtest.win_rate) if backtest.win_rate else 0.0
            }
        except Exception as e:
            logger.error("Failed to calculate backtest trading metrics", error=str(e))
            return {}
    
    def _calculate_sortino_ratio(self, returns: List[float], risk_free_rate: float = 0.0) -> Optional[float]:
        """
        Calculate Sortino ratio using downside deviation.
        
        Args:
            returns: List of period returns
            risk_free_rate: Risk-free rate (annualized)
            
        Returns:
            Sortino ratio or None if insufficient data
        """
        try:
            if len(returns) < 2:
                return None
            
            # Calculate excess returns
            excess_returns = [r - risk_free_rate/252 for r in returns]  # Daily risk-free rate
            mean_excess = mean(excess_returns)
            
            # Calculate downside deviation (only negative returns)
            downside_returns = [r for r in excess_returns if r < 0]
            if not downside_returns:
                return float('inf') if mean_excess > 0 else 0.0
            
            downside_deviation = math.sqrt(sum(r**2 for r in downside_returns) / len(downside_returns))
            
            if downside_deviation > 0:
                sortino = (mean_excess / downside_deviation) * math.sqrt(252)  # Annualized
                return sortino
            
            return None
        
        except Exception as e:
            logger.error("Failed to calculate Sortino ratio", error=str(e))
            return None
    
    def _calculate_calmar_ratio(self, total_return_pct: float, max_drawdown_pct: float, years: float) -> Optional[float]:
        """
        Calculate Calmar ratio (Annual return / Max drawdown).
        
        Args:
            total_return_pct: Total return percentage
            max_drawdown_pct: Maximum drawdown percentage
            years: Time period in years
            
        Returns:
            Calmar ratio or None
        """
        try:
            if years <= 0 or max_drawdown_pct <= 0:
                return None
            
            # Annualized return
            annual_return = total_return_pct / years
            calmar = annual_return / max_drawdown_pct
            
            return calmar
        
        except Exception as e:
            logger.error("Failed to calculate Calmar ratio", error=str(e))
            return None
    
    def _calculate_information_ratio(self, portfolio_returns: List[float], benchmark_returns: List[float] = None) -> Optional[float]:
        """
        Calculate Information ratio (Excess return / Tracking error).
        
        Args:
            portfolio_returns: Portfolio returns
            benchmark_returns: Benchmark returns (if None, uses risk-free rate)
            
        Returns:
            Information ratio or None
        """
        try:
            if len(portfolio_returns) < 2:
                return None
            
            # Use risk-free rate as benchmark if not provided
            if benchmark_returns is None:
                benchmark_returns = [float(self.risk_free_rate) / 252] * len(portfolio_returns)
            
            if len(benchmark_returns) != len(portfolio_returns):
                return None
            
            # Calculate excess returns
            excess_returns = [p - b for p, b in zip(portfolio_returns, benchmark_returns)]
            
            if len(excess_returns) < 2:
                return None
            
            mean_excess = mean(excess_returns)
            tracking_error = stdev(excess_returns) if len(excess_returns) > 1 else 0
            
            if tracking_error > 0:
                info_ratio = (mean_excess / tracking_error) * math.sqrt(252)  # Annualized
                return info_ratio
            
            return None
        
        except Exception as e:
            logger.error("Failed to calculate Information ratio", error=str(e))
            return None
    
    def _calculate_kelly_criterion(self, win_rate: float, avg_win: float, avg_loss: float) -> Optional[float]:
        """
        Calculate Kelly criterion for optimal position sizing.
        
        Formula: f = (bp - q) / b
        Where:
        - b = odds received on the wager (avg_win / avg_loss)
        - p = probability of winning (win_rate)
        - q = probability of losing (1 - win_rate)
        
        Args:
            win_rate: Win rate (0.0 to 1.0)
            avg_win: Average winning trade
            avg_loss: Average losing trade (positive value)
            
        Returns:
            Kelly criterion percentage (0.0 to 1.0) or None
        """
        try:
            if win_rate <= 0 or win_rate >= 1 or avg_win <= 0 or avg_loss <= 0:
                return None
            
            # Calculate odds (payoff ratio)
            b = avg_win / avg_loss
            p = win_rate
            q = 1 - win_rate
            
            kelly = (b * p - q) / b
            
            # Cap at reasonable values (max 25% position size)
            kelly = max(0, min(kelly, 0.25))
            
            return kelly
        
        except Exception as e:
            logger.error("Failed to calculate Kelly criterion", error=str(e))
            return None
    
    def _calculate_consecutive_trades(self, trades: List[Trade]) -> Tuple[int, int]:
        """
        Calculate maximum consecutive wins and losses.
        
        Args:
            trades: List of trades with PnL
            
        Returns:
            Tuple of (max_consecutive_wins, max_consecutive_losses)
        """
        try:
            if not trades:
                return (0, 0)
            
            # Sort trades by execution time
            sorted_trades = sorted([t for t in trades if t.pnl is not None], 
                                 key=lambda x: x.execution_time)
            
            if not sorted_trades:
                return (0, 0)
            
            max_consecutive_wins = 0
            max_consecutive_losses = 0
            current_wins = 0
            current_losses = 0
            
            for trade in sorted_trades:
                pnl = float(trade.pnl)
                
                if pnl > 0:  # Winning trade
                    current_wins += 1
                    current_losses = 0
                    max_consecutive_wins = max(max_consecutive_wins, current_wins)
                elif pnl < 0:  # Losing trade
                    current_losses += 1
                    current_wins = 0
                    max_consecutive_losses = max(max_consecutive_losses, current_losses)
                # If pnl == 0, continue current streak
            
            return (max_consecutive_wins, max_consecutive_losses)
        
        except Exception as e:
            logger.error("Failed to calculate consecutive trades", error=str(e))
            return (0, 0)
    
    def _calculate_turnover_ratio(self, trades: List[Trade], avg_portfolio_value: float, days: int) -> Optional[float]:
        """
        Calculate turnover ratio (trading frequency measure).
        
        Args:
            trades: List of trades
            avg_portfolio_value: Average portfolio value during period
            days: Number of trading days
            
        Returns:
            Annual turnover ratio or None
        """
        try:
            if not trades or avg_portfolio_value <= 0 or days <= 0:
                return None
            
            # Calculate total trading volume
            total_volume = sum(float(trade.quantity) * float(trade.price) for trade in trades if trade.quantity and trade.price)
            
            if total_volume <= 0:
                return 0.0
            
            # Annualized turnover
            period_turnover = total_volume / avg_portfolio_value
            annual_turnover = period_turnover * (252 / days)  # Assuming 252 trading days per year
            
            return annual_turnover
        
        except Exception as e:
            logger.error("Failed to calculate turnover ratio", error=str(e))
            return None
    
    def _calculate_cagr(self, initial_value: float, final_value: float, years: float) -> Optional[float]:
        """
        Calculate Compound Annual Growth Rate.
        
        Args:
            initial_value: Starting value
            final_value: Ending value
            years: Time period in years
            
        Returns:
            CAGR as percentage or None
        """
        try:
            if initial_value <= 0 or final_value <= 0 or years <= 0:
                return None
            
            cagr = ((final_value / initial_value) ** (1 / years) - 1) * 100
            return cagr
        
        except Exception as e:
            logger.error("Failed to calculate CAGR", error=str(e))
            return None
    
    def _calculate_expectancy(self, trades: List[Trade]) -> Optional[float]:
        """
        Calculate expectancy (expected value per trade).
        
        Args:
            trades: List of trades with PnL
            
        Returns:
            Expectancy value or None
        """
        try:
            completed_trades = [t for t in trades if t.pnl is not None]
            if not completed_trades:
                return None
            
            total_pnl = sum(float(t.pnl) for t in completed_trades)
            expectancy = total_pnl / len(completed_trades)
            
            return expectancy
        
        except Exception as e:
            logger.error("Failed to calculate expectancy", error=str(e))
            return None
    
    def _calculate_capacity_estimate(self, trades: List[Trade], avg_portfolio_value: float, volatility: float) -> Optional[float]:
        """
        Estimate strategy capacity based on trading patterns.
        
        Args:
            trades: List of trades
            avg_portfolio_value: Average portfolio value
            volatility: Portfolio volatility
            
        Returns:
            Estimated capacity in dollars or None
        """
        try:
            if not trades or avg_portfolio_value <= 0:
                return None
            
            # Simple capacity estimation based on:
            # 1. Trading frequency
            # 2. Average trade size
            # 3. Market volatility impact
            
            avg_trade_size = sum(float(t.quantity) * float(t.price) for t in trades if t.quantity and t.price) / len(trades)
            trades_per_day = len(trades) / 252  # Approximate
            
            # Conservative estimate: capacity is limited by market impact
            # Higher frequency and larger trades reduce capacity
            frequency_factor = max(0.1, 1 - (trades_per_day * 0.1))  # Penalty for high frequency
            size_factor = max(0.1, avg_portfolio_value / max(avg_trade_size, 1))  # Larger portfolio vs trade size
            volatility_factor = max(0.1, 1 - volatility)  # Lower volatility allows larger capacity
            
            estimated_capacity = avg_portfolio_value * frequency_factor * min(size_factor, 10) * volatility_factor
            
            # Cap at reasonable values
            return min(estimated_capacity, 100_000_000)  # $100M max
        
        except Exception as e:
            logger.error("Failed to calculate capacity estimate", error=str(e))
            return None
    
    def _calculate_downside_deviation(self, returns: List[float], target_return: float = 0.0) -> Optional[float]:
        """
        Calculate downside deviation (volatility of negative returns only).
        
        Args:
            returns: List of returns
            target_return: Target return threshold
            
        Returns:
            Downside deviation or None
        """
        try:
            if len(returns) < 2:
                return None
            
            downside_returns = [r for r in returns if r < target_return]
            if not downside_returns:
                return 0.0
            
            # Calculate downside deviation
            mean_downside = sum(downside_returns) / len(downside_returns)
            variance = sum((r - mean_downside) ** 2 for r in downside_returns) / len(downside_returns)
            downside_deviation = math.sqrt(variance)
            
            return downside_deviation * math.sqrt(252) * 100  # Annualized percentage
        
        except Exception as e:
            logger.error("Failed to calculate downside deviation", error=str(e))
            return None