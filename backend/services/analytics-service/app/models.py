"""
SQLAlchemy models for Analytics Service.
"""

from decimal import Decimal
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, ForeignKey, 
    Integer, Numeric, String, Text, JSON
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID, ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

Base = declarative_base()


class User(Base):
    """User model - mirrors main database."""
    __tablename__ = "users"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class Strategy(Base):
    """Strategy model - mirrors main database."""
    __tablename__ = "strategies"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100), default="custom")
    tags = Column(ARRAY(String))
    json_tree = Column(JSON, nullable=False)
    compilation_report = Column(JSON)
    is_template = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    version = Column(Integer, default=1)
    parent_strategy_id = Column(PGUUID(as_uuid=True), ForeignKey("strategies.id"))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class ForwardTestSession(Base):
    """Forward testing session model - mirrors main database."""
    __tablename__ = "forward_test_sessions"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(String(100), unique=True, nullable=False)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    strategy_id = Column(PGUUID(as_uuid=True), ForeignKey("strategies.id"))
    name = Column(String(255), nullable=False)
    strategy_name = Column(String(255), nullable=False)
    strategy_snapshot = Column(JSON)
    symbol = Column(String(50), nullable=False)
    timeframe = Column(String(10), nullable=False)
    status = Column(String(20), default="STOPPED")
    settings = Column(JSON, nullable=False)
    initial_balance = Column(Numeric(15, 2), nullable=False)
    current_balance = Column(Numeric(15, 2))
    total_pnl = Column(Numeric(15, 2), default=0)
    trade_count = Column(Integer, default=0)
    win_rate = Column(Numeric(5, 2), default=0)
    max_drawdown = Column(Numeric(5, 2), default=0)
    sharpe_ratio = Column(Numeric(8, 4), default=0)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    last_error = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class Trade(Base):
    """Trade model - mirrors main database."""
    __tablename__ = "trades"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(String(100), ForeignKey("forward_test_sessions.session_id"), nullable=False)
    trade_id = Column(String(100), nullable=False)
    symbol = Column(String(50), nullable=False)
    side = Column(String(10), nullable=False)
    order_type = Column(String(20), nullable=False)
    quantity = Column(Numeric(20, 8), nullable=False)
    price = Column(Numeric(20, 8), nullable=False)
    fees = Column(Numeric(20, 8), default=0)
    pnl = Column(Numeric(20, 8))
    status = Column(String(20), default="FILLED")
    execution_time = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=func.now())


class BacktestResult(Base):
    """Backtest result model - mirrors main database."""
    __tablename__ = "backtest_results"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    strategy_id = Column(PGUUID(as_uuid=True), ForeignKey("strategies.id"))
    strategy_name = Column(String(255), nullable=False)
    strategy_snapshot = Column(JSON)
    symbol = Column(String(50), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    interval = Column(String(10), nullable=False)
    initial_balance = Column(Numeric(15, 2), nullable=False)
    final_balance = Column(Numeric(15, 2), nullable=False)
    total_return = Column(Numeric(8, 4), nullable=False)
    sharpe_ratio = Column(Numeric(8, 4))
    max_drawdown = Column(Numeric(5, 2))
    trade_count = Column(Integer)
    win_rate = Column(Numeric(5, 2))
    analytics = Column(JSON)
    s3_result_key = Column(String(500))
    execution_time_ms = Column(Integer)
    created_at = Column(DateTime, default=func.now())


class ChartData(Base):
    """Chart data model - mirrors main database."""
    __tablename__ = "chart_data"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(String(100), ForeignKey("forward_test_sessions.session_id"), nullable=False)
    data_type = Column(String(20), nullable=False)
    timestamp = Column(BigInteger, nullable=False)
    value = Column(Numeric(20, 8), nullable=False)
    extra_data = Column(JSON)
    created_at = Column(DateTime, default=func.now())


class AnalyticsCache(Base):
    """Analytics cache model."""
    __tablename__ = "analytics_cache"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    cache_key = Column(String(255), unique=True, nullable=False)
    data = Column(JSON, nullable=False)
    ttl = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=func.now())


class PerformanceSnapshot(Base):
    """Performance snapshot for caching expensive calculations."""
    __tablename__ = "performance_snapshots"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(String(100), ForeignKey("forward_test_sessions.session_id"))
    backtest_id = Column(PGUUID(as_uuid=True), ForeignKey("backtest_results.id"))
    snapshot_type = Column(String(20), nullable=False)  # 'live', 'backtest'
    
    # Core metrics
    total_return = Column(Numeric(10, 6))
    annualized_return = Column(Numeric(10, 6))
    volatility = Column(Numeric(10, 6))
    sharpe_ratio = Column(Numeric(10, 6))
    sortino_ratio = Column(Numeric(10, 6))
    max_drawdown = Column(Numeric(10, 6))
    calmar_ratio = Column(Numeric(10, 6))
    
    # Trading metrics
    total_trades = Column(Integer)
    winning_trades = Column(Integer)
    losing_trades = Column(Integer)
    win_rate = Column(Numeric(5, 4))
    profit_factor = Column(Numeric(10, 6))
    avg_win = Column(Numeric(15, 8))
    avg_loss = Column(Numeric(15, 8))
    
    # Risk metrics
    var_95 = Column(Numeric(15, 8))
    var_99 = Column(Numeric(15, 8))
    beta = Column(Numeric(10, 6))
    alpha = Column(Numeric(10, 6))
    information_ratio = Column(Numeric(10, 6))
    
    # Timing
    calculated_at = Column(DateTime, default=func.now())
    data_through = Column(DateTime, nullable=False)
    
    # Additional analytics stored as JSON
    extended_metrics = Column(JSON)