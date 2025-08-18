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
        """Calculate core performance metrics."""
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
            
            # CAGR (Compound Annual Growth Rate)
            if runtime_years > 0 and current_balance > 0 and initial_balance > 0:
                cagr = float(((current_balance / initial_balance) ** (1 / runtime_years) - 1) * 100)
            else:
                cagr = 0.0
            
            # Sharpe ratio (if we have portfolio values)
            sharpe_ratio = None
            if len(portfolio_values) > 1:
                sharpe_ratio = self._calculate_sharpe_ratio(portfolio_values)
            
            return {
                "total_return": float(total_return),
                "total_return_pct": total_return_pct,
                "cagr": cagr,
                "sharpe_ratio": sharpe_ratio,
                "initial_balance": float(initial_balance),
                "current_balance": float(current_balance),
                "runtime_days": runtime_days,
                "runtime_years": runtime_years
            }
        
        except Exception as e:
            logger.error("Failed to calculate performance metrics", error=str(e))
            return {}
    
    async def _calculate_risk_metrics(self, session: ForwardTestSession, trades: List[Trade], portfolio_values: List[Tuple[datetime, Decimal]]) -> Dict[str, Any]:
        """Calculate risk metrics including drawdown."""
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
            
            # Calculate volatility
            if len(portfolio_values) > 2:
                returns = self._calculate_returns(portfolio_values)
                if returns:
                    volatility = float(np.std(returns) * np.sqrt(252) * 100)  # Annualized volatility
                    metrics["volatility"] = volatility
                else:
                    metrics["volatility"] = 0.0
            else:
                metrics["volatility"] = 0.0
            
            return metrics
        
        except Exception as e:
            logger.error("Failed to calculate risk metrics", error=str(e))
            return {}
    
    async def _calculate_trading_metrics(self, trades: List[Trade]) -> Dict[str, Any]:
        """Calculate trading-specific metrics."""
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
                    "largest_loss": 0.0
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
                    "largest_loss": 0.0
                }
            
            # Separate winning and losing trades
            winning_trades = [t for t in completed_trades if t.pnl > 0]
            losing_trades = [t for t in completed_trades if t.pnl < 0]
            
            # Calculate metrics
            win_rate = (len(winning_trades) / len(completed_trades)) * 100 if completed_trades else 0.0
            
            avg_win = float(mean([t.pnl for t in winning_trades])) if winning_trades else 0.0
            avg_loss = float(mean([t.pnl for t in losing_trades])) if losing_trades else 0.0
            
            largest_win = float(max([t.pnl for t in winning_trades])) if winning_trades else 0.0
            largest_loss = float(min([t.pnl for t in losing_trades])) if losing_trades else 0.0
            
            # Profit factor
            total_wins = sum([t.pnl for t in winning_trades]) if winning_trades else Decimal(0)
            total_losses = abs(sum([t.pnl for t in losing_trades])) if losing_trades else Decimal(0)
            profit_factor = float(total_wins / total_losses) if total_losses > 0 else float('inf')
            
            return {
                "total_trades": len(trades),
                "completed_trades": len(completed_trades),
                "winning_trades": len(winning_trades),
                "losing_trades": len(losing_trades),
                "win_rate": win_rate,
                "profit_factor": profit_factor,
                "avg_win": avg_win,
                "avg_loss": avg_loss,
                "largest_win": largest_win,
                "largest_loss": largest_loss
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