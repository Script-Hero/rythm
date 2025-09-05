"""
Shared data models for forward testing sessions.
Standardizes field names and data structures across all services.
"""

from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime
from uuid import UUID

from .forward_test_models import SessionStatus


@dataclass
class SessionPortfolioData:
    """Standardized portfolio data structure."""
    session_id: str
    cash_balance: float
    total_value: float
    total_pnl: float
    total_pnl_percent: float
    positions: List[Dict[str, Any]]
    position_count: int
    trade_count: int
    updated_at: float
    
    # Separate PnL fields for clarity
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0


@dataclass
class SessionMetricsData:
    """Standardized metrics data structure."""
    session_id: str
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_pnl: float
    total_pnl_percent: float
    max_drawdown: float
    max_drawdown_percent: float
    sharpe_ratio: Optional[float]
    current_drawdown: float = 0.0
    updated_at: Optional[datetime] = None


@dataclass
class SessionTradeData:
    """Standardized trade data structure."""
    trade_id: str
    session_id: str
    symbol: str
    side: str  # 'BUY' or 'SELL'
    quantity: float
    price: float
    fee: float
    total_cost: float
    timestamp: float
    status: str
    pnl: float = 0.0
    pnl_percent: float = 0.0


@dataclass
class SessionDetailData:
    """Complete session data structure for detail views."""
    # Core session info - all UUIDs now
    session_id: str  # UUID string
    user_id: str     # UUID string
    session_name: str
    strategy_name: str
    status: str
    symbol: str
    timeframe: str
    
    # Timestamps
    created_at: datetime
    started_at: Optional[datetime]
    updated_at: datetime
    
    # Financial data
    initial_balance: float
    current_balance: float
    current_portfolio_value: float
    
    # Performance metrics
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_pnl: float
    total_return: float  # percentage
    max_drawdown: float
    sharpe_ratio: Optional[float]
    
    # Settings
    settings: Dict[str, Any]


@dataclass
class SessionSummaryData:
    """Lightweight session data for list views."""
    session_id: str  # UUID string
    session_name: str
    strategy_name: str
    status: str
    symbol: str
    timeframe: str
    is_active: bool
    start_time: datetime
    current_portfolio_value: float
    initial_balance: float
    total_trades: int
    total_return: float  # percentage
    total_pnl: float
    max_drawdown: float
    win_rate: float
    settings: Dict[str, Any]


def normalize_session_fields(raw_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize session field names to snake_case standard.
    Handles common field name variations.
    """
    field_mappings = {
        # Session identifiers - all map to session_id now
        'sessionId': 'session_id',
        'testId': 'session_id',
        'external_session_id': 'session_id',
        'id': 'session_id',
        'userId': 'user_id',
        
        # Names
        'sessionName': 'session_name',
        'strategyName': 'strategy_name',
        'name': 'session_name',
        
        # Timestamps
        'startTime': 'started_at',
        'createdAt': 'created_at',
        'updatedAt': 'updated_at',
        'start_time': 'started_at',
        
        # Financial fields
        'initialBalance': 'initial_balance',
        'currentBalance': 'current_balance',
        'portfolioValue': 'current_portfolio_value',
        'currentPortfolioValue': 'current_portfolio_value',
        'starting_balance': 'initial_balance',
        'current_portfolio_value': 'current_portfolio_value',
        
        # Performance fields
        'totalTrades': 'total_trades',
        'winningTrades': 'winning_trades',
        'losingTrades': 'losing_trades',
        'winRate': 'win_rate',
        'totalPnl': 'total_pnl',
        'pnlPercent': 'total_return',
        'pnlDollar': 'total_pnl',
        'totalReturn': 'total_return',
        'maxDrawdown': 'max_drawdown',
        'sharpeRatio': 'sharpe_ratio',
        'realized_pnl': 'total_pnl',
        
        # Portfolio fields
        'cashBalance': 'cash_balance',
        'totalValue': 'total_value',
        'realizedPnL': 'realized_pnl',
        'unrealizedPnL': 'unrealized_pnl',
        'cash_balance': 'cash_balance',
        'total_value': 'total_value',
        'realized_pnl': 'realized_pnl',
        'unrealized_pnl': 'unrealized_pnl',
        
        # Status fields
        'isActive': 'is_active',
    }
    
    normalized = {}
    
    for key, value in raw_data.items():
        # Use mapped field name if available, otherwise keep original
        normalized_key = field_mappings.get(key, key)
        normalized[normalized_key] = value
    
    return normalized


def safe_float_conversion(value: Any, default: float = 0.0) -> float:
    """Safely convert value to float with default fallback."""
    if value is None or value == "":
        return default
    
    try:
        if isinstance(value, (int, float, Decimal)):
            result = float(value)
            # Check for NaN or infinity
            if result != result or result == float('inf') or result == float('-inf'):
                return default
            return result
        return float(str(value))
    except (ValueError, TypeError, OverflowError):
        return default


def safe_int_conversion(value: Any, default: int = 0) -> int:
    """Safely convert value to int with default fallback."""
    if value is None or value == "":
        return default
    
    try:
        if isinstance(value, (int, float, Decimal)):
            return int(value)
        return int(float(str(value)))
    except (ValueError, TypeError, OverflowError):
        return default


def parse_timestamp(value: Any) -> Optional[datetime]:
    """Parse timestamp from various formats."""
    if not value:
        return None
    
    try:
        if isinstance(value, datetime):
            return value
        elif isinstance(value, (int, float)):
            # Handle both seconds and milliseconds
            timestamp = float(value)
            if timestamp > 1e12:  # Looks like milliseconds
                timestamp = timestamp / 1000
            return datetime.fromtimestamp(timestamp)
        elif isinstance(value, str):
            # Try parsing ISO format
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except (ValueError, TypeError, OverflowError):
        pass
    
    return None
