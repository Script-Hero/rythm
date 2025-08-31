"""
Pydantic models for Forward Testing Service.
"""

from decimal import Decimal
from datetime import datetime
from typing import Dict, List, Optional, Any
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field, validator


class SessionStatus(str, Enum):
    """Forward testing session status (DB uses uppercase)."""
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    STOPPED = "STOPPED"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"


class TradeAction(str, Enum):
    """Trade action types."""
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


class OrderStatus(str, Enum):
    """Order execution status (DB uses uppercase)."""
    PENDING = "PENDING"
    FILLED = "FILLED"
    PARTIAL = "PARTIAL"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"


# Request/Response Models
class ForwardTestSessionCreate(BaseModel):
    """Create forward testing session request."""
    strategy_id: UUID
    symbol: str
    starting_balance: Decimal = Field(default=Decimal("100000.0"))
    max_position_size_percent: float = Field(default=0.25, ge=0.01, le=1.0)
    commission_rate: float = Field(default=0.001, ge=0.0, le=0.1)
    slippage_rate: float = Field(default=0.0005, ge=0.0, le=0.1)
    session_name: Optional[str] = None
    description: Optional[str] = None
    risk_management: Optional[Dict[str, Any]] = None
    
    @validator('symbol')
    def symbol_must_be_uppercase(cls, v):
        return v.upper()


class ForwardTestSessionUpdate(BaseModel):
    """Update forward testing session request."""
    status: Optional[SessionStatus] = None
    session_name: Optional[str] = None
    description: Optional[str] = None
    risk_management: Optional[Dict[str, Any]] = None


class ForwardTestSessionResponse(BaseModel):
    """Forward testing session response."""
    id: UUID
    session_id: Optional[str] = None
    user_id: UUID
    strategy_id: UUID
    strategy_snapshot: Dict[str, Any]  # Full strategy JSON for historical analysis
    symbol: str
    session_name: Optional[str]
    strategy_name: Optional[str]
    description: Optional[str]
    status: SessionStatus
    starting_balance: Decimal
    current_balance: Decimal
    current_position_size: Decimal
    max_position_size_percent: float
    commission_rate: float
    slippage_rate: float
    risk_management: Optional[Dict[str, Any]]
    created_at: datetime
    started_at: Optional[datetime]
    stopped_at: Optional[datetime]
    last_signal_at: Optional[datetime]
    
    # Performance metrics
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    total_pnl: Decimal = Decimal("0")
    unrealized_pnl: Decimal = Decimal("0")
    max_drawdown: Decimal = Decimal("0")
    
    class Config:
        from_attributes = True


class TradeResponse(BaseModel):
    """Trade execution response."""
    id: UUID
    session_id: UUID
    user_id: UUID
    symbol: str
    action: TradeAction
    quantity: Decimal
    price: Decimal
    filled_quantity: Decimal
    commission: Decimal
    slippage: Decimal
    total_cost: Decimal
    status: OrderStatus
    strategy_signal: Optional[Dict[str, Any]]
    executed_at: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True


class PortfolioPosition(BaseModel):
    """Portfolio position."""
    symbol: str
    quantity: Decimal
    average_price: Decimal
    current_price: Decimal
    market_value: Decimal
    unrealized_pnl: Decimal
    unrealized_pnl_percent: float


class PortfolioSummary(BaseModel):
    """Portfolio summary."""
    session_id: UUID
    cash_balance: Decimal
    total_value: Decimal
    total_pnl: Decimal
    total_pnl_percent: float
    positions: List[PortfolioPosition]
    position_count: int
    updated_at: datetime


class SessionMetrics(BaseModel):
    """Session performance metrics."""
    session_id: UUID
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_pnl: Decimal
    total_pnl_percent: float
    max_drawdown: Decimal
    max_drawdown_percent: float
    sharpe_ratio: Optional[float] = None
    profit_factor: Optional[float] = None
    average_trade_pnl: Decimal
    largest_win: Decimal
    largest_loss: Decimal
    consecutive_wins: int
    consecutive_losses: int
    updated_at: datetime


class ChartDataPoint(BaseModel):
    """Chart data point."""
    timestamp: datetime
    portfolio_value: Decimal
    cash_balance: Decimal
    position_value: Decimal
    pnl: Decimal
    drawdown: Decimal


class SessionChartData(BaseModel):
    """Session chart data."""
    session_id: UUID
    data_points: List[ChartDataPoint]
    updated_at: datetime
