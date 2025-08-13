"""Backtesting related data models."""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel


class BacktestRequest(BaseModel):
    strategy_id: Optional[UUID] = None
    strategy_template: Optional[str] = None  # For template-based backtests
    symbol: str
    start_date: date
    end_date: date
    interval: str  # 1m, 5m, 15m, 1h, 1d
    initial_balance: Decimal = Decimal('10000')
    commission: Decimal = Decimal('0.005')  # 0.5% commission
    slippage: Decimal = Decimal('0.001')   # 0.1% slippage


class BacktestResponse(BaseModel):
    id: UUID
    user_id: UUID
    strategy_id: Optional[UUID] = None
    strategy_name: str
    symbol: str
    start_date: date
    end_date: date
    interval: str
    initial_balance: Decimal
    final_balance: Decimal
    total_return: Decimal
    sharpe_ratio: Optional[Decimal] = None
    max_drawdown: Optional[Decimal] = None
    trade_count: Optional[int] = None
    win_rate: Optional[Decimal] = None
    analytics: Optional[Dict[str, Any]] = None
    s3_result_key: Optional[str] = None
    execution_time_ms: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BacktestResult(BacktestResponse):
    """Internal backtest result model."""
    strategy_snapshot: Optional[Dict[str, Any]] = None


class BacktestAnalytics(BaseModel):
    # Performance Metrics
    total_return: Decimal
    annualized_return: Decimal
    volatility: Decimal
    sharpe_ratio: Decimal
    sortino_ratio: Optional[Decimal] = None
    calmar_ratio: Optional[Decimal] = None
    
    # Risk Metrics
    max_drawdown: Decimal
    max_drawdown_duration: Optional[int] = None  # days
    var_95: Optional[Decimal] = None  # Value at Risk
    
    # Trade Metrics
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: Decimal
    avg_win: Decimal
    avg_loss: Decimal
    profit_factor: Decimal
    
    # Additional Metrics
    beta: Optional[Decimal] = None
    alpha: Optional[Decimal] = None
    information_ratio: Optional[Decimal] = None


class BacktestBarData(BaseModel):
    timestamp: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal
    position: int  # 1 for long, -1 for short, 0 for flat
    portfolio_value: Decimal
    drawdown: Decimal
    trade_pnl: Optional[Decimal] = None


class BacktestTrade(BaseModel):
    entry_date: datetime
    exit_date: datetime
    symbol: str
    side: str  # LONG, SHORT
    entry_price: Decimal
    exit_price: Decimal
    quantity: Decimal
    pnl: Decimal
    pnl_pct: Decimal
    commission: Decimal
    duration_hours: float


class BacktestDetailedResult(BaseModel):
    metadata: BacktestResponse
    analytics: BacktestAnalytics
    bar_data: List[BacktestBarData]
    trades: List[BacktestTrade]
    monthly_returns: Dict[str, Decimal]  # "2024-01": 0.05
    annual_returns: Dict[str, Decimal]   # "2024": 0.15


class BacktestJobStatus(BaseModel):
    job_id: str
    status: str  # PENDING, RUNNING, COMPLETED, FAILED
    progress: float  # 0.0 to 1.0
    message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result_id: Optional[UUID] = None


class BacktestQueueRequest(BaseModel):
    request: BacktestRequest
    priority: int = 1  # 1-10, higher is more important
    user_id: UUID
    estimated_duration_minutes: Optional[int] = None