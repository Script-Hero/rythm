"""Data models for Backtesting Service."""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Dict, List, Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class BacktestStatus(str, Enum):
    """Backtest job status enumeration."""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class BacktestRequest(BaseModel):
    """Backtest request model."""
    strategy_id: Optional[UUID] = Field(default=None, description="ID of the strategy to backtest")
    # Optional: allow passing a raw json_tree for template-based or ad-hoc strategies
    json_tree: Optional[Dict[str, Any]] = Field(default=None, description="Strategy graph (nodes, edges)")
    symbol: str = Field(..., description="Trading symbol (e.g., BTC/USD)")
    start_date: datetime = Field(..., description="Backtest start date")
    end_date: datetime = Field(..., description="Backtest end date")
    interval: str = Field(default="1d", description="Data interval (1m, 5m, 1h, 1d)")
    initial_capital: Decimal = Field(default=Decimal("100000"), description="Starting capital")
    commission_rate: Decimal = Field(default=Decimal("0.001"), description="Commission rate (0.1%)")
    slippage_rate: Decimal = Field(default=Decimal("0.0005"), description="Slippage rate (0.05%)")
    
    class Config:
        json_encoders = {
            Decimal: str,
            datetime: lambda v: v.isoformat()
        }


class TradeResult(BaseModel):
    """Individual trade result."""
    trade_id: str
    symbol: str
    side: str  # "buy" or "sell"
    quantity: Decimal
    price: Decimal
    timestamp: datetime
    pnl: Decimal
    commission: Decimal
    portfolio_value: Decimal
    
    class Config:
        json_encoders = {
            Decimal: str,
            datetime: lambda v: v.isoformat()
        }


class BacktestResults(BaseModel):
    """Comprehensive backtest results."""
    # Basic metrics
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    
    # Performance metrics
    total_return: Decimal
    total_return_percent: float
    max_drawdown: Decimal
    max_drawdown_percent: float
    final_portfolio_value: Decimal
    initial_portfolio_value: Decimal
    
    # Advanced metrics
    sharpe_ratio: Optional[float] = None
    sortino_ratio: Optional[float] = None
    calmar_ratio: Optional[float] = None
    sterling_ratio: Optional[float] = None
    ulcer_index: Optional[float] = None
    information_ratio: Optional[float] = None
    volatility: Optional[float] = None
    
    # Additional metrics for frontend compatibility
    cagr: Optional[float] = None
    avg_win: Optional[float] = None
    avg_loss: Optional[float] = None
    win_loss_ratio: Optional[float] = None
    expectancy: Optional[float] = None
    kelly_criterion: Optional[float] = None
    turnover_ratio: Optional[float] = None
    trades_per_day: Optional[float] = None
    capacity: Optional[float] = None
    runtime_days: Optional[float] = None
    runtime_years: Optional[float] = None
    
    # Profit/Loss metrics
    gross_profit: Decimal
    gross_loss: Decimal
    net_profit: Decimal
    profit_factor: Optional[float] = None
    
    # Trade statistics
    average_trade: Decimal
    largest_win: Decimal
    largest_loss: Decimal
    consecutive_wins: int
    consecutive_losses: int
    
    # Chart data
    chart_data: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Trade history
    trades: List[TradeResult] = Field(default_factory=list)

    # Metadata
    execution_time_ms: int
    total_periods: int

    # Analytics timeseries for frontend charts (optional)
    cumulative_returns: Optional[Dict[str, Any]] = None
    daily_returns: Optional[Dict[str, Any]] = None
    monthly_returns: Optional[Dict[str, Any]] = None
    annual_returns: Optional[Dict[str, Any]] = None
    average_annual_return: Optional[float] = None
    drawdown: Optional[Dict[str, Any]] = None
    underwater_curve: Optional[Dict[str, Any]] = None
    rolling_volatility: Optional[Dict[str, Any]] = None
    rolling_sharpe: Optional[Dict[str, Any]] = None
    rolling_beta: Optional[Dict[str, Any]] = None
    trade_return_histogram: Optional[Dict[str, Any]] = None

    # Attribution metrics
    alpha: Optional[float] = None
    beta: Optional[float] = None
    r_squared: Optional[float] = None
    tracking_error: Optional[float] = None
    treynor_ratio: Optional[float] = None
    up_capture: Optional[float] = None
    down_capture: Optional[float] = None
    
    class Config:
        json_encoders = {
            Decimal: str,
            datetime: lambda v: v.isoformat()
        }


class BacktestMetrics(BaseModel):
    """Detailed performance metrics."""
    job_id: UUID
    
    # Risk metrics
    value_at_risk_95: Optional[float] = None
    value_at_risk_99: Optional[float] = None
    conditional_var_95: Optional[float] = None
    maximum_drawdown_duration: Optional[int] = None
    
    # Return metrics
    annual_return: Optional[float] = None
    monthly_returns: List[float] = Field(default_factory=list)
    daily_returns: List[float] = Field(default_factory=list)
    
    # Benchmark comparison
    benchmark_symbol: Optional[str] = None
    alpha: Optional[float] = None
    beta: Optional[float] = None
    tracking_error: Optional[float] = None
    information_ratio: Optional[float] = None
    
    # Trade analysis
    trade_duration_avg: Optional[float] = None
    trade_duration_std: Optional[float] = None
    win_loss_ratio: Optional[float] = None
    expectancy: Optional[float] = None
    
    class Config:
        json_encoders = {
            UUID: str,
            datetime: lambda v: v.isoformat()
        }


class BacktestJob(BaseModel):
    """Backtest job model."""
    job_id: UUID
    user_id: UUID
    request: BacktestRequest
    strategy: Dict[str, Any]  # Compiled strategy
    status: BacktestStatus
    progress: float = 0.0
    created_at: float
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    error_message: Optional[str] = None
    
    class Config:
        json_encoders = {
            UUID: str,
            datetime: lambda v: v.isoformat()
        }


class BacktestResponse(BaseModel):
    """Backtest API response model."""
    success: bool
    job_id: str
    status: BacktestStatus
    message: str
    progress: Optional[float] = None
    results: Optional[BacktestResults] = None
    error_message: Optional[str] = None
    estimated_duration: Optional[int] = None
    created_at: Optional[float] = None
    completed_at: Optional[float] = None
