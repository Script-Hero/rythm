"""Market data related models."""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class MarketSymbol(BaseModel):
    id: int
    symbol: str
    base_currency: str
    quote_currency: str
    exchange: str
    is_active: bool = True
    min_order_size: Optional[Decimal] = None
    price_precision: Optional[int] = None
    size_precision: Optional[int] = None
    last_price: Optional[Decimal] = None
    last_updated: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class PriceData(BaseModel):
    symbol: str
    price: Decimal
    bid: Optional[Decimal] = None
    ask: Optional[Decimal] = None
    volume: Optional[Decimal] = None
    timestamp: datetime
    exchange: str = "coinbase"


class ChartData(BaseModel):
    id: int
    session_id: str
    data_type: str  # 'price', 'portfolio', 'drawdown', 'volume', 'pnl'
    timestamp: int  # Unix timestamp
    value: Decimal
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OHLCV(BaseModel):
    symbol: str
    timestamp: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal


class MarketDataRequest(BaseModel):
    symbols: List[str]
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    interval: str = "1m"  # 1m, 5m, 15m, 1h, 1d


class MarketDataResponse(BaseModel):
    symbol: str
    data: List[OHLCV]
    source: str
    cached: bool = False


class SymbolSearchRequest(BaseModel):
    query: str
    exchange: Optional[str] = None
    limit: int = 50


class SymbolSearchResponse(BaseModel):
    symbols: List[MarketSymbol]
    total: int


class MarketDataSubscription(BaseModel):
    symbols: List[str]
    data_types: List[str] = ["ticker", "trade"]  # ticker, trade, orderbook


class RealTimePriceUpdate(BaseModel):
    symbol: str
    price: Decimal
    volume: Optional[Decimal] = None
    timestamp: datetime
    change_24h: Optional[Decimal] = None
    change_pct_24h: Optional[Decimal] = None


class MarketStatus(BaseModel):
    exchange: str
    is_open: bool
    next_open: Optional[datetime] = None
    next_close: Optional[datetime] = None
    timezone: str