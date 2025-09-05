"""
Session data mapping utilities.
Consolidates all session data transformation logic into a single location.
"""

from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime

from ..models.session_data_models import (
    SessionDetailData, SessionSummaryData, SessionPortfolioData, 
    SessionMetricsData, SessionTradeData, normalize_session_fields,
    safe_float_conversion, safe_int_conversion, parse_timestamp
)


class SessionMapper:
    """Centralizes all session data mapping operations."""
    
    @staticmethod
    def map_db_session_to_detail(session_row: Any, portfolio_data: Optional[Dict] = None, 
                                metrics_data: Optional[Dict] = None) -> SessionDetailData:
        """
        Map database session row to SessionDetailData.
        Handles all common field name variations and type conversions.
        """
        # Convert to dict if it's a database row object
        if hasattr(session_row, '__dict__'):
            raw_data = session_row.__dict__
        elif hasattr(session_row, '_asdict'):  # namedtuple
            raw_data = session_row._asdict()
        else:
            raw_data = dict(session_row) if session_row else {}
        
        # Normalize field names
        normalized = normalize_session_fields(raw_data)
        
        # Extract core session info
        session_id = str(normalized.get('session_id') or normalized.get('id', ''))
        user_id = str(normalized.get('user_id', ''))
        
        # Names with fallbacks
        session_name = normalized.get('session_name') or normalized.get('name') or f"Session {session_id[:8]}"
        strategy_name = normalized.get('strategy_name') or 'Unknown Strategy'
        
        # Status and trading info
        status = normalized.get('status', 'STOPPED')
        symbol = normalized.get('symbol', 'BTC/USD')
        timeframe = normalized.get('timeframe') or '1m'  # Only fallback if completely missing
        
        # Timestamps
        created_at = parse_timestamp(normalized.get('created_at')) or datetime.now()
        started_at = parse_timestamp(normalized.get('started_at'))
        updated_at = parse_timestamp(normalized.get('updated_at')) or datetime.now()
        
        # Financial data with safe conversions
        initial_balance = safe_float_conversion(normalized.get('initial_balance'), 10000.0)
        current_balance = safe_float_conversion(normalized.get('current_balance'), initial_balance)
        current_portfolio_value = safe_float_conversion(
            normalized.get('current_portfolio_value') or 
            normalized.get('current_balance'), 
            initial_balance
        )
        
        # Performance metrics from session or provided metrics_data
        metrics = metrics_data or {}
        total_trades = safe_int_conversion(metrics.get('total_trades') or normalized.get('total_trades'))
        winning_trades = safe_int_conversion(metrics.get('winning_trades') or normalized.get('winning_trades'))
        losing_trades = safe_int_conversion(metrics.get('losing_trades') or normalized.get('losing_trades'))
        win_rate = safe_float_conversion(metrics.get('win_rate') or normalized.get('win_rate'))
        total_pnl = safe_float_conversion(metrics.get('total_pnl') or normalized.get('total_pnl'))
        total_return = safe_float_conversion(metrics.get('total_return') or normalized.get('total_return'))
        max_drawdown = safe_float_conversion(metrics.get('max_drawdown') or normalized.get('max_drawdown'))
        sharpe_ratio = metrics.get('sharpe_ratio') or normalized.get('sharpe_ratio')
        if sharpe_ratio is not None:
            sharpe_ratio = safe_float_conversion(sharpe_ratio)
        
        # Settings
        settings = normalized.get('settings', {})
        if isinstance(settings, str):
            import json
            try:
                settings = json.loads(settings)
            except:
                settings = {}
        
        return SessionDetailData(
            session_id=session_id,
            user_id=user_id,
            session_name=session_name,
            strategy_name=strategy_name,
            status=status,
            symbol=symbol,
            timeframe=timeframe,
            created_at=created_at,
            started_at=started_at,
            updated_at=updated_at,
            initial_balance=initial_balance,
            current_balance=current_balance,
            current_portfolio_value=current_portfolio_value,
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            win_rate=win_rate,
            total_pnl=total_pnl,
            total_return=total_return,
            max_drawdown=max_drawdown,
            sharpe_ratio=sharpe_ratio,
            settings=settings
        )
    
    @staticmethod
    def map_db_session_to_summary(session_row: Any) -> SessionSummaryData:
        """Map database session row to SessionSummaryData for list views."""
        # Convert to dict if it's a database row object
        if hasattr(session_row, '__dict__'):
            raw_data = session_row.__dict__
        elif hasattr(session_row, '_asdict'):  # namedtuple
            raw_data = session_row._asdict()
        else:
            raw_data = dict(session_row) if session_row else {}
        
        # Normalize field names
        normalized = normalize_session_fields(raw_data)
        
        # Extract required fields
        session_id = str(normalized.get('session_id') or normalized.get('id', ''))
        session_name = normalized.get('session_name') or normalized.get('name') or f"Session {session_id[:8]}"
        strategy_name = normalized.get('strategy_name') or 'Unknown Strategy'
        status = normalized.get('status', 'STOPPED')
        symbol = normalized.get('symbol', 'BTC/USD')
        timeframe = normalized.get('timeframe') or '1m'  # Only fallback if completely missing
        
        # Active status
        is_active = status in ['RUNNING', 'PAUSED']
        
        # Timestamps
        start_time = parse_timestamp(normalized.get('started_at') or normalized.get('created_at')) or datetime.now()
        
        # Financial data
        initial_balance = safe_float_conversion(normalized.get('initial_balance'), 10000.0)
        current_portfolio_value = safe_float_conversion(
            normalized.get('current_portfolio_value') or 
            normalized.get('current_balance'), 
            initial_balance
        )
        
        # Performance metrics
        total_trades = safe_int_conversion(normalized.get('total_trades'))
        total_return = safe_float_conversion(normalized.get('total_return'))
        total_pnl = safe_float_conversion(normalized.get('total_pnl'))
        max_drawdown = safe_float_conversion(normalized.get('max_drawdown'))
        win_rate = safe_float_conversion(normalized.get('win_rate'))
        
        # Settings
        settings = normalized.get('settings', {})
        if isinstance(settings, str):
            import json
            try:
                settings = json.loads(settings)
            except:
                settings = {}
        
        return SessionSummaryData(
            session_id=session_id,
            session_name=session_name,
            strategy_name=strategy_name,
            status=status,
            symbol=symbol,
            timeframe=timeframe,
            is_active=is_active,
            start_time=start_time,
            current_portfolio_value=current_portfolio_value,
            initial_balance=initial_balance,
            total_trades=total_trades,
            total_return=total_return,
            total_pnl=total_pnl,
            max_drawdown=max_drawdown,
            win_rate=win_rate,
            settings=settings
        )
    
    @staticmethod
    def map_portfolio_data(raw_portfolio: Dict[str, Any], session_id: str) -> SessionPortfolioData:
        """Map raw portfolio data to standardized format."""
        normalized = normalize_session_fields(raw_portfolio)
        
        cash_balance = safe_float_conversion(normalized.get('cash_balance'))
        total_value = safe_float_conversion(normalized.get('total_value'))
        total_pnl = safe_float_conversion(normalized.get('total_pnl'))
        trade_count = safe_int_conversion(
            normalized.get('trade_count') if normalized.get('trade_count') is not None else normalized.get('total_trades')
        )
        
        # Calculate percentage if we have initial balance
        total_pnl_percent = 0.0
        if 'initial_capital' in normalized:
            initial = safe_float_conversion(normalized['initial_capital'])
            if initial > 0:
                total_pnl_percent = (total_pnl / initial) * 100
        
        positions = normalized.get('positions', [])
        if not isinstance(positions, list):
            positions = []
        
        return SessionPortfolioData(
            session_id=session_id,
            cash_balance=cash_balance,
            total_value=total_value,
            total_pnl=total_pnl,
            total_pnl_percent=total_pnl_percent,
            positions=positions,
            position_count=len(positions),
            trade_count=trade_count,
            updated_at=safe_float_conversion(normalized.get('updated_at'), datetime.now().timestamp()),
            realized_pnl=safe_float_conversion(normalized.get('realized_pnl')),
            unrealized_pnl=safe_float_conversion(normalized.get('unrealized_pnl'))
        )
    
    @staticmethod
    def map_metrics_data(raw_metrics: Dict[str, Any], session_id: str) -> SessionMetricsData:
        """Map raw metrics data to standardized format."""
        normalized = normalize_session_fields(raw_metrics)
        
        total_trades = safe_int_conversion(normalized.get('total_trades'))
        winning_trades = safe_int_conversion(normalized.get('winning_trades'))
        losing_trades = safe_int_conversion(normalized.get('losing_trades'))
        
        return SessionMetricsData(
            session_id=session_id,
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            win_rate=safe_float_conversion(normalized.get('win_rate')),
            total_pnl=safe_float_conversion(normalized.get('total_pnl')),
            total_pnl_percent=safe_float_conversion(normalized.get('total_pnl_percent')),
            max_drawdown=safe_float_conversion(normalized.get('max_drawdown')),
            max_drawdown_percent=safe_float_conversion(normalized.get('max_drawdown_percent')),
            sharpe_ratio=safe_float_conversion(normalized.get('sharpe_ratio')) if normalized.get('sharpe_ratio') is not None else None,
            current_drawdown=safe_float_conversion(normalized.get('current_drawdown')),
            updated_at=parse_timestamp(normalized.get('updated_at'))
        )
    
    @staticmethod
    def map_trade_data(raw_trade: Dict[str, Any]) -> SessionTradeData:
        """Map raw trade data to standardized format."""
        normalized = normalize_session_fields(raw_trade)
        
        return SessionTradeData(
            trade_id=str(normalized.get('trade_id', normalized.get('id', ''))),
            session_id=str(normalized.get('session_id', '')),
            symbol=str(normalized.get('symbol', '')),
            side=str(normalized.get('side', normalized.get('action', ''))),
            quantity=safe_float_conversion(normalized.get('quantity')),
            price=safe_float_conversion(normalized.get('price')),
            fee=safe_float_conversion(normalized.get('fee')),
            total_cost=safe_float_conversion(normalized.get('total_cost')),
            timestamp=safe_float_conversion(normalized.get('timestamp'), datetime.now().timestamp()),
            status=str(normalized.get('status', 'FILLED')),
            pnl=safe_float_conversion(normalized.get('pnl')),
            pnl_percent=safe_float_conversion(normalized.get('pnl_percent'))
        )
    
    @staticmethod
    def create_api_response(data: Any) -> Dict[str, Any]:
        """Create standardized API response format."""
        if isinstance(data, (SessionDetailData, SessionSummaryData, SessionPortfolioData, 
                           SessionMetricsData, SessionTradeData)):
            # Convert dataclass to dict
            result = data.__dict__.copy()
            
            # Convert datetime objects to ISO strings for JSON serialization
            for key, value in result.items():
                if isinstance(value, datetime):
                    result[key] = value.isoformat()
            
            return result
        elif isinstance(data, list):
            return [SessionMapper.create_api_response(item) for item in data]
        else:
            return data
