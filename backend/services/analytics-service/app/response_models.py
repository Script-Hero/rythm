"""
Response models for Analytics Service API.
"""

from decimal import Decimal
from datetime import datetime
from typing import Dict, List, Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field


class PerformanceMetrics(BaseModel):
    """Performance metrics response model."""
    total_return: float
    total_return_pct: float
    cagr: float
    sharpe_ratio: Optional[float] = None
    initial_balance: float
    current_balance: float
    runtime_days: int
    runtime_years: float


class RiskMetrics(BaseModel):
    """Risk metrics response model."""
    max_drawdown: float
    max_drawdown_pct: float
    current_drawdown: float
    current_drawdown_pct: float
    volatility: float


class TradingMetrics(BaseModel):
    """Trading metrics response model."""
    total_trades: int
    completed_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    profit_factor: float
    avg_win: float
    avg_loss: float
    largest_win: float
    largest_loss: float


class PortfolioOverview(BaseModel):
    """Portfolio overview response model."""
    total_value: float
    cash: float
    total_pnl: float
    initial_balance: float
    symbol: str
    session_name: str
    status: str


class LiveAnalyticsResponse(BaseModel):
    """Live analytics response for forward testing sessions."""
    session_id: str
    calculated_at: str
    performance_metrics: PerformanceMetrics
    risk_metrics: RiskMetrics
    trading_metrics: TradingMetrics
    portfolio_overview: PortfolioOverview


class KeyMetricsResponse(BaseModel):
    """Key metrics response for backtests."""
    cagr: float = Field(description="Compound Annual Growth Rate")
    sharpe_ratio: Optional[float] = Field(description="Sharpe ratio")
    sortino_ratio: Optional[float] = Field(description="Sortino ratio")
    information_ratio: Optional[float] = Field(description="Information ratio")
    max_drawdown: float = Field(description="Maximum drawdown percentage")
    turnover_ratio: Optional[float] = Field(description="Portfolio turnover ratio")
    trades_per_day: float = Field(description="Average trades per day")
    win_rate: float = Field(description="Win rate percentage")
    capacity: Optional[int] = Field(description="Strategy capacity estimate")
    runtime_days: int = Field(description="Runtime in days")
    runtime_years: float = Field(description="Runtime in years")


class DrawdownPeriod(BaseModel):
    """Individual drawdown period."""
    start_date: str
    end_date: str
    drawdown: float
    duration_days: int


class DrawdownSeries(BaseModel):
    """Drawdown time series data."""
    dates: List[str]
    drawdowns: List[float]
    peaks: List[float]


class UnderwaterCurve(BaseModel):
    """Underwater curve data."""
    dates: List[str]
    underwater: List[float]
    recovery_times: List[int]
    longest_underwater_period: int


class DrawdownAnalysisResponse(BaseModel):
    """Drawdown analysis response."""
    drawdown_series: DrawdownSeries
    max_drawdown: float
    avg_drawdown: float
    time_underwater: float
    longest_drawdown_period: int
    top_drawdowns: List[DrawdownPeriod]
    underwater_curve: UnderwaterCurve


class ReturnsAnalysisResponse(BaseModel):
    """Returns analysis response."""
    dates: List[str]
    backtest: List[float] = Field(description="Portfolio returns")
    benchmark: Optional[List[float]] = Field(description="Benchmark returns")
    outperformance: Optional[List[float]] = Field(description="Outperformance vs benchmark")
    final_outperformance: Optional[float] = Field(description="Final outperformance")


class MonthlyReturnsResponse(BaseModel):
    """Monthly returns heatmap response."""
    monthly_returns: Dict[str, Dict[str, float]]  # {"Jan": {"2024": 0.05}}
    best_month: float
    worst_month: float
    avg_monthly_return: float
    monthly_win_rate: float


class AnnualReturnsResponse(BaseModel):
    """Annual returns response."""
    annual_returns: Dict[str, float]  # {"2024": 0.15}
    average_annual_return: float
    best_year: float
    worst_year: float
    annual_win_rate: float
    consistency_score: float


class AttributionAnalysisResponse(BaseModel):
    """Performance attribution analysis response."""
    alpha: float
    beta: float
    tracking_error: float
    information_ratio: float
    treynor_ratio: Optional[float]
    up_capture: float
    down_capture: float
    r_squared: float
    active_return: float
    active_risk: float


class BacktestAnalyticsSummary(BaseModel):
    """Complete backtest analytics summary."""
    backtest_id: str
    calculated_at: str
    key_metrics: KeyMetricsResponse
    performance_metrics: PerformanceMetrics
    risk_metrics: RiskMetrics
    trading_metrics: TradingMetrics


class ForwardTestPerformanceResponse(BaseModel):
    """Forward test performance summary."""
    session_id: str
    performance_score: float = Field(ge=0, le=100, description="Overall performance score 0-100")
    rating: str = Field(description="Performance rating: Excellent, Good, Fair, Poor")
    sharpe_rating: str
    win_rate_rating: str
    drawdown_rating: str
    risk_level: str = Field(description="Risk level: Low, Medium, High")
    
    # Core metrics
    total_return_pct: float
    sharpe_ratio: Optional[float]
    max_drawdown_pct: float
    win_rate: float
    total_trades: int
    
    updated_at: str


class HealthCheckResponse(BaseModel):
    """Health check response."""
    status: str
    timestamp: float
    service: str
    dependencies: Dict[str, bool] = Field(description="Status of service dependencies")
    message: Optional[str] = None


class ErrorResponse(BaseModel):
    """Error response model."""
    error: str
    detail: Optional[str] = None
    timestamp: str