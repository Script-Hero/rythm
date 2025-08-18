# Beta1 Analytics Specification for Beta2 Implementation

## Overview

This document provides a comprehensive specification of all analytics functionality implemented in AlgoTrade Beta1, organized for implementation in the Beta2 Analytics Service (Port 8006). The analytics system supports both backtesting and forward testing with real-time calculations and visualizations.

## Analytics Service Architecture

### Service Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│                    Analytics Service (Port 8006)                │
├─────────────────────────────────────────────────────────────────┤
│  Input Sources:                                                 │
│  • Backtesting Service → Historical trade data, price data      │
│  • Forward Testing Service → Live portfolio, real-time trades   │
│  • Market Data Service → Price feeds, volume data               │
│  • Strategy Service → Strategy metadata, compilation reports    │
├─────────────────────────────────────────────────────────────────┤
│  Output Destinations:                                           │
│  • Frontend Charts → JSON formatted analytics data             │
│  • API Gateway → REST endpoints for analytics requests         │
│  • Notification Service → Performance alerts, risk warnings    │
│  • S3 Storage → Cached analytics reports, historical data      │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

1. **Kafka Event Processing**: Subscribe to trade executions, portfolio updates
2. **Real-time Calculation Engine**: Compute metrics as data streams in
3. **Caching Layer**: Redis for frequently accessed analytics
4. **Historical Analysis**: Batch processing for complex statistical calculations
5. **API Layer**: RESTful endpoints matching frontend requirements

---

## 1. Backtest Analytics

### 1.1 Core Performance Metrics

#### **Key Statistics (KeyStatistics.jsx)**

**Inputs Required:**
- Portfolio value time series
- Trade execution data
- Benchmark price data (for comparison metrics)
- Risk-free rate (configurable, default 2% annual)

**Calculations:**

```python
class CorePerformanceMetrics:
    def calculate_cagr(self, start_value: Decimal, end_value: Decimal, years: float) -> Decimal:
        """Compound Annual Growth Rate"""
        return (end_value / start_value) ** (1 / years) - 1
    
    def calculate_sharpe_ratio(self, returns: List[Decimal], risk_free_rate: Decimal = 0.02) -> Decimal:
        """Risk-adjusted return metric"""
        excess_returns = [r - risk_free_rate/252 for r in returns]  # Daily risk-free rate
        return mean(excess_returns) / std_dev(excess_returns) * sqrt(252)
    
    def calculate_sortino_ratio(self, returns: List[Decimal], risk_free_rate: Decimal = 0.02) -> Decimal:
        """Downside deviation focused Sharpe ratio"""
        excess_returns = [r - risk_free_rate/252 for r in returns]
        downside_returns = [min(r, 0) for r in excess_returns]
        downside_deviation = sqrt(mean([r**2 for r in downside_returns]))
        return mean(excess_returns) / downside_deviation * sqrt(252)
    
    def calculate_information_ratio(self, portfolio_returns: List[Decimal], benchmark_returns: List[Decimal]) -> Decimal:
        """Active return per unit of tracking error"""
        active_returns = [p - b for p, b in zip(portfolio_returns, benchmark_returns)]
        return mean(active_returns) / std_dev(active_returns) * sqrt(252)
```

**API Endpoints:**
```
GET /api/analytics/backtest/{backtest_id}/key-metrics
Response: {
    "cagr": 0.1234,
    "sharpe_ratio": 1.85,
    "sortino_ratio": 2.14,
    "information_ratio": 0.67,
    "max_drawdown": -0.0892,
    "turnover_ratio": 0.45,
    "trades_per_day": 2.3,
    "win_rate": 0.65,
    "capacity": 5000000,
    "runtime_days": 365,
    "runtime_years": 1.0
}
```

### 1.2 Risk Analytics

#### **Drawdown Analysis (Drawdown.jsx)**

**Inputs Required:**
- Portfolio value time series (daily frequency minimum)
- Peak calculation methodology (rolling maximum)

**Calculations:**

```python
class DrawdownAnalytics:
    def calculate_drawdown_series(self, portfolio_values: List[Decimal]) -> Dict:
        """Calculate drawdown time series and statistics"""
        peaks = []
        drawdowns = []
        current_peak = portfolio_values[0]
        
        for value in portfolio_values:
            current_peak = max(current_peak, value)
            peaks.append(current_peak)
            drawdown = (value - current_peak) / current_peak
            drawdowns.append(drawdown)
        
        return {
            "drawdown_series": {
                "dates": self.dates,
                "drawdowns": drawdowns,
                "peaks": peaks
            },
            "max_drawdown": min(drawdowns),
            "avg_drawdown": mean([d for d in drawdowns if d < 0]),
            "time_underwater": len([d for d in drawdowns if d < 0]) / len(drawdowns),
            "top_drawdowns": self._find_top_drawdowns(drawdowns, n=5)
        }
    
    def _find_top_drawdowns(self, drawdowns: List[Decimal], n: int = 5) -> List[Dict]:
        """Identify largest drawdown periods"""
        # Implementation for finding distinct drawdown periods and ranking them
        pass
```

**API Endpoints:**
```
GET /api/analytics/backtest/{backtest_id}/drawdown
Response: {
    "drawdown_series": {
        "dates": ["2024-01-01", "2024-01-02", ...],
        "drawdowns": [-0.02, -0.05, 0.0, ...]
    },
    "max_drawdown": -0.089,
    "avg_drawdown": -0.023,
    "time_underwater": 0.34,
    "longest_drawdown_period": 45,
    "top_drawdowns": [
        {"start": "2024-03-15", "end": "2024-04-20", "drawdown": -0.089, "duration": 36}
    ]
}
```

#### **Underwater Curve (UnderwaterCurve.jsx)**

**Purpose**: Visualizes time spent below previous portfolio peaks
**Calculation**: Same as drawdown but focuses on duration analysis

```python
def calculate_underwater_curve(self, portfolio_values: List[Decimal]) -> Dict:
    """Time-focused drawdown analysis"""
    return {
        "dates": self.dates,
        "underwater": self.calculate_drawdown_series(portfolio_values)["drawdown_series"]["drawdowns"],
        "recovery_times": self._calculate_recovery_periods(),
        "longest_underwater_period": self._longest_underwater_duration()
    }
```

### 1.3 Returns Analytics

#### **Cumulative Returns (CumulativeReturns.jsx)**

**Inputs Required:**
- Portfolio value time series
- Benchmark price data (S&P 500, BTC, etc.)
- Starting portfolio value

**Calculations:**

```python
class ReturnsAnalytics:
    def calculate_cumulative_returns(self, portfolio_values: List[Decimal], benchmark_values: List[Decimal]) -> Dict:
        """Portfolio vs benchmark cumulative performance"""
        portfolio_returns = [(v / portfolio_values[0] - 1) for v in portfolio_values]
        benchmark_returns = [(v / benchmark_values[0] - 1) for v in benchmark_values]
        
        return {
            "dates": self.dates,
            "backtest": portfolio_returns,
            "benchmark": benchmark_returns,
            "outperformance": [p - b for p, b in zip(portfolio_returns, benchmark_returns)],
            "final_outperformance": portfolio_returns[-1] - benchmark_returns[-1]
        }
```

#### **Monthly Returns Heatmap (MonthlyReturns.jsx)**

**Inputs Required:**
- Daily portfolio returns
- Date range for aggregation

**Calculations:**

```python
def calculate_monthly_returns(self, daily_returns: List[Decimal]) -> Dict:
    """Monthly return heatmap data"""
    monthly_data = {}
    
    for date, return_val in zip(self.dates, daily_returns):
        month = date.strftime("%b")
        year = date.strftime("%Y")
        
        if month not in monthly_data:
            monthly_data[month] = {}
        if year not in monthly_data[month]:
            monthly_data[month][year] = []
        
        monthly_data[month][year].append(return_val)
    
    # Aggregate to monthly returns
    for month in monthly_data:
        for year in monthly_data[month]:
            monthly_data[month][year] = sum(monthly_data[month][year])
    
    return {
        "monthly_returns": monthly_data,
        "best_month": max(all_monthly_values),
        "worst_month": min(all_monthly_values),
        "avg_monthly_return": mean(all_monthly_values),
        "monthly_win_rate": len([m for m in all_monthly_values if m > 0]) / len(all_monthly_values)
    }
```

#### **Annual Returns (AnnualReturns.jsx)**

```python
def calculate_annual_returns(self, daily_returns: List[Decimal]) -> Dict:
    """Year-over-year performance breakdown"""
    annual_data = {}
    
    for date, return_val in zip(self.dates, daily_returns):
        year = date.year
        if year not in annual_data:
            annual_data[year] = []
        annual_data[year].append(return_val)
    
    # Convert to annual returns
    annual_returns = {}
    for year, returns in annual_data.items():
        annual_returns[str(year)] = (1 + sum(returns)) ** (252 / len(returns)) - 1  # Annualized
    
    return {
        "annual_returns": annual_returns,
        "average_annual_return": mean(annual_returns.values()),
        "best_year": max(annual_returns.values()),
        "worst_year": min(annual_returns.values()),
        "annual_win_rate": len([r for r in annual_returns.values() if r > 0]) / len(annual_returns),
        "consistency_score": 1 - (std_dev(annual_returns.values()) / abs(mean(annual_returns.values())))
    }
```

#### **Daily Returns Distribution (DailyReturns.jsx)**

```python
def calculate_daily_returns_distribution(self, portfolio_values: List[Decimal]) -> Dict:
    """Daily return statistics and distribution"""
    daily_returns = [(portfolio_values[i] / portfolio_values[i-1] - 1) for i in range(1, len(portfolio_values))]
    
    return {
        "dates": self.dates[1:],
        "returns": daily_returns,
        "positive_days": len([r for r in daily_returns if r > 0]),
        "negative_days": len([r for r in daily_returns if r < 0]),
        "zero_days": len([r for r in daily_returns if r == 0]),
        "daily_win_rate": len([r for r in daily_returns if r > 0]) / len(daily_returns),
        "avg_daily_return": mean(daily_returns),
        "best_day": max(daily_returns),
        "worst_day": min(daily_returns),
        "daily_volatility": std_dev(daily_returns),
        "skewness": calculate_skewness(daily_returns),
        "kurtosis": calculate_kurtosis(daily_returns)
    }
```

### 1.4 Advanced Analytics

#### **Performance Attribution (PerformanceAttribution.jsx)**

**Inputs Required:**
- Portfolio returns vs benchmark returns
- Factor exposures (optional for factor attribution)

**Calculations:**

```python
class PerformanceAttribution:
    def calculate_attribution_metrics(self, portfolio_returns: List[Decimal], benchmark_returns: List[Decimal]) -> Dict:
        """Comprehensive attribution analysis"""
        
        # Alpha and Beta calculation using linear regression
        alpha, beta = self._calculate_alpha_beta(portfolio_returns, benchmark_returns)
        
        # Tracking error
        active_returns = [p - b for p, b in zip(portfolio_returns, benchmark_returns)]
        tracking_error = std_dev(active_returns) * sqrt(252)
        
        # Capture ratios
        up_capture = self._calculate_capture_ratio(portfolio_returns, benchmark_returns, "up")
        down_capture = self._calculate_capture_ratio(portfolio_returns, benchmark_returns, "down")
        
        # R-squared
        r_squared = self._calculate_r_squared(portfolio_returns, benchmark_returns)
        
        return {
            "alpha": alpha,
            "beta": beta,
            "tracking_error": tracking_error,
            "information_ratio": mean(active_returns) / std_dev(active_returns) * sqrt(252),
            "treynor_ratio": mean(portfolio_returns) / beta if beta != 0 else None,
            "up_capture": up_capture,
            "down_capture": down_capture,
            "r_squared": r_squared,
            "active_return": mean(active_returns) * 252,
            "active_risk": tracking_error
        }
    
    def _calculate_capture_ratio(self, portfolio_returns: List[Decimal], benchmark_returns: List[Decimal], direction: str) -> Decimal:
        """Calculate upside/downside capture ratios"""
        if direction == "up":
            portfolio_up = [p for p, b in zip(portfolio_returns, benchmark_returns) if b > 0]
            benchmark_up = [b for b in benchmark_returns if b > 0]
        else:
            portfolio_up = [p for p, b in zip(portfolio_returns, benchmark_returns) if b < 0]
            benchmark_up = [b for b in benchmark_returns if b < 0]
        
        if not benchmark_up:
            return Decimal('1.0')
        
        return mean(portfolio_up) / mean(benchmark_up)
```

#### **Rolling Beta Analysis (RollingBeta.jsx)**

```python
def calculate_rolling_beta(self, portfolio_returns: List[Decimal], benchmark_returns: List[Decimal], windows: List[int] = [126, 252]) -> Dict:
    """Rolling beta calculation for multiple time windows"""
    results = {}
    
    for window in windows:
        rolling_betas = []
        for i in range(window, len(portfolio_returns)):
            portfolio_window = portfolio_returns[i-window:i]
            benchmark_window = benchmark_returns[i-window:i]
            _, beta = self._calculate_alpha_beta(portfolio_window, benchmark_window)
            rolling_betas.append(beta)
        
        results[f"beta_{window//21}mo"] = rolling_betas  # Convert to months approximately
    
    return {
        "dates": self.dates[max(windows):],
        **results,
        "current_beta_6mo": results["beta_6mo"][-1] if results["beta_6mo"] else None,
        "current_beta_12mo": results["beta_12mo"][-1] if results["beta_12mo"] else None,
        "avg_beta_6mo": mean(results["beta_6mo"]) if results["beta_6mo"] else None,
        "avg_beta_12mo": mean(results["beta_12mo"]) if results["beta_12mo"] else None
    }
```

### 1.5 Trading Analytics

#### **Trade Analysis**

**Inputs Required:**
- Individual trade records (entry/exit prices, dates, quantities)
- Commission and slippage data

**Calculations:**

```python
class TradingAnalytics:
    def calculate_trading_metrics(self, trades: List[Trade]) -> Dict:
        """Comprehensive trade analysis"""
        winning_trades = [t for t in trades if t.pnl > 0]
        losing_trades = [t for t in trades if t.pnl < 0]
        
        return {
            "total_trades": len(trades),
            "winning_trades": len(winning_trades),
            "losing_trades": len(losing_trades),
            "win_rate": len(winning_trades) / len(trades) if trades else 0,
            "avg_win": mean([t.pnl for t in winning_trades]) if winning_trades else 0,
            "avg_loss": mean([t.pnl for t in losing_trades]) if losing_trades else 0,
            "largest_win": max([t.pnl for t in winning_trades]) if winning_trades else 0,
            "largest_loss": min([t.pnl for t in losing_trades]) if losing_trades else 0,
            "profit_factor": abs(sum([t.pnl for t in winning_trades]) / sum([t.pnl for t in losing_trades])) if losing_trades else float('inf'),
            "avg_trade_duration": mean([t.duration_hours for t in trades]),
            "trades_per_day": len(trades) / self.total_days,
            "turnover_ratio": self._calculate_turnover(trades),
            "commission_impact": sum([t.commission for t in trades]) / sum([abs(t.pnl) for t in trades]),
            "consecutive_wins": self._max_consecutive_wins(trades),
            "consecutive_losses": self._max_consecutive_losses(trades)
        }
```

---

## 2. Forward Testing Analytics

### 2.1 Real-time Performance Metrics

#### **Live Metrics Dashboard (LiveMetricsDashboard.tsx)**

**Real-time Data Sources:**
- Current portfolio value from Forward Testing Service
- Live market prices from Market Data Service
- Trade execution stream via Kafka

**Calculations:**

```python
class LiveAnalytics:
    def calculate_live_performance(self, portfolio: Portfolio, initial_balance: Decimal, current_price: Decimal) -> Dict:
        """Real-time performance calculation"""
        total_pnl = portfolio.unrealized_pnl + portfolio.realized_pnl
        return_percentage = ((portfolio.total_value - initial_balance) / initial_balance) * 100
        
        return {
            "portfolio_overview": {
                "total_value": portfolio.total_value,
                "cash": portfolio.cash,
                "total_pnl": total_pnl,
                "return_percentage": return_percentage,
                "positions": self._format_positions(portfolio.positions, current_price)
            },
            "live_metrics": {
                "sharpe_ratio": self._calculate_live_sharpe(portfolio.daily_returns),
                "win_rate": self._calculate_live_win_rate(portfolio.completed_trades),
                "max_drawdown": self._calculate_current_max_drawdown(portfolio.value_history),
                "current_drawdown": self._calculate_current_drawdown(portfolio.value_history),
                "total_trades": len(portfolio.completed_trades),
                "current_price": current_price
            }
        }
    
    def _calculate_live_sharpe(self, returns: List[Decimal], min_periods: int = 30) -> Optional[Decimal]:
        """Live Sharpe ratio with minimum period requirement"""
        if len(returns) < min_periods:
            return None
        return self.calculate_sharpe_ratio(returns[-252:])  # Trailing 1 year max
```

#### **Performance Stats (PerformanceStats.tsx)**

**Key Features:**
- Performance scoring algorithm
- Risk level assessment
- Rating system for metrics

```python
class PerformanceScoring:
    def calculate_performance_score(self, metrics: Dict) -> Dict:
        """Composite performance score (0-100)"""
        sharpe_component = min(max(metrics['sharpe_ratio'] * 15, -30), 30)
        win_rate_component = metrics['win_rate'] * 0.3
        drawdown_penalty = abs(metrics['max_drawdown']) * 2
        
        score = max(0, 50 + sharpe_component + win_rate_component - drawdown_penalty)
        
        return {
            "overall_score": score,
            "rating": self._get_rating(score),
            "sharpe_rating": self._rate_sharpe(metrics['sharpe_ratio']),
            "win_rate_rating": self._rate_win_rate(metrics['win_rate']),
            "drawdown_rating": self._rate_drawdown(metrics['max_drawdown']),
            "risk_level": self._assess_risk_level(metrics['max_drawdown'])
        }
    
    def _get_rating(self, score: float) -> str:
        if score >= 80: return "Excellent"
        elif score >= 65: return "Good"
        elif score >= 50: return "Fair"
        else: return "Poor"
```

### 2.2 Real-time Risk Management

#### **Risk Analytics**

```python
class RealTimeRiskAnalytics:
    def calculate_real_time_risk(self, portfolio: Portfolio, market_data: MarketData) -> Dict:
        """Real-time risk assessment"""
        return {
            "var_95": self._calculate_var(portfolio.value_history, confidence=0.95),
            "var_99": self._calculate_var(portfolio.value_history, confidence=0.99),
            "portfolio_volatility": self._calculate_portfolio_volatility(portfolio.daily_returns),
            "position_concentration": self._calculate_position_concentration(portfolio.positions),
            "correlation_risk": self._calculate_correlation_risk(portfolio.positions, market_data),
            "liquidity_risk": self._assess_liquidity_risk(portfolio.positions),
            "leverage_ratio": self._calculate_leverage(portfolio),
            "margin_utilization": self._calculate_margin_usage(portfolio)
        }
    
    def _calculate_var(self, value_history: List[Decimal], confidence: float = 0.95) -> Decimal:
        """Value at Risk calculation"""
        if len(value_history) < 2:
            return Decimal('0')
        
        returns = [(value_history[i] / value_history[i-1] - 1) for i in range(1, len(value_history))]
        return percentile(returns, (1 - confidence) * 100) * value_history[-1]
```

---

## 3. API Service Architecture

### 3.1 Core Endpoints

```python
# Analytics Service REST API Structure

@app.get("/api/analytics/backtest/{backtest_id}/summary")
async def get_backtest_summary(backtest_id: UUID) -> BacktestAnalyticsSummary:
    """Complete backtest analytics package"""
    pass

@app.get("/api/analytics/backtest/{backtest_id}/key-metrics")
async def get_key_metrics(backtest_id: UUID) -> KeyMetricsResponse:
    """Core performance metrics"""
    pass

@app.get("/api/analytics/backtest/{backtest_id}/drawdown")
async def get_drawdown_analysis(backtest_id: UUID) -> DrawdownAnalysisResponse:
    """Drawdown and risk metrics"""
    pass

@app.get("/api/analytics/backtest/{backtest_id}/returns/{period}")
async def get_returns_analysis(backtest_id: UUID, period: str) -> ReturnsAnalysisResponse:
    """Returns analysis by period (daily/monthly/annual)"""
    pass

@app.get("/api/analytics/backtest/{backtest_id}/attribution")
async def get_performance_attribution(backtest_id: UUID) -> AttributionAnalysisResponse:
    """Performance attribution analysis"""
    pass

@app.get("/api/analytics/forward-test/{session_id}/live")
async def get_live_analytics(session_id: UUID) -> LiveAnalyticsResponse:
    """Real-time forward testing analytics"""
    pass

@app.get("/api/analytics/forward-test/{session_id}/performance")
async def get_forward_test_performance(session_id: UUID) -> ForwardTestPerformanceResponse:
    """Forward testing performance summary"""
    pass

@app.websocket("/api/analytics/forward-test/{session_id}/stream")
async def stream_live_analytics(websocket: WebSocket, session_id: UUID):
    """Real-time analytics streaming"""
    pass
```

### 3.2 Data Models

```python
# Complete data model specifications for all analytics responses

class KeyMetricsResponse(BaseModel):
    cagr: Decimal
    sharpe_ratio: Decimal
    sortino_ratio: Decimal
    information_ratio: Decimal
    max_drawdown: Decimal
    turnover_ratio: Decimal
    trades_per_day: Decimal
    win_rate: Decimal
    capacity: Optional[int]
    runtime_days: int
    runtime_years: Decimal

class DrawdownAnalysisResponse(BaseModel):
    drawdown_series: DrawdownSeries
    max_drawdown: Decimal
    avg_drawdown: Decimal
    time_underwater: Decimal
    longest_drawdown_period: int
    top_drawdowns: List[DrawdownPeriod]
    underwater_curve: UnderwaterCurve

class LiveAnalyticsResponse(BaseModel):
    portfolio_overview: PortfolioOverview
    performance_metrics: LivePerformanceMetrics
    risk_assessment: RealTimeRiskAssessment
    recent_trades: List[RecentTrade]
    updated_at: datetime
```

### 3.3 Caching Strategy

```python
# Redis caching for frequently accessed analytics

class AnalyticsCacheManager:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.cache_ttl = {
            "backtest_analytics": 3600,  # 1 hour for completed backtests
            "live_analytics": 60,        # 1 minute for live data
            "daily_analytics": 86400,    # 24 hours for daily summaries
        }
    
    async def get_cached_analytics(self, key: str) -> Optional[Dict]:
        """Retrieve cached analytics if available"""
        cached = await self.redis.get(f"analytics:{key}")
        return json.loads(cached) if cached else None
    
    async def cache_analytics(self, key: str, data: Dict, cache_type: str = "backtest_analytics"):
        """Cache analytics with appropriate TTL"""
        ttl = self.cache_ttl.get(cache_type, 3600)
        await self.redis.setex(f"analytics:{key}", ttl, json.dumps(data, default=str))
```

### 3.4 Real-time Processing

```python
# Kafka event processing for live analytics

class LiveAnalyticsProcessor:
    def __init__(self, kafka_consumer, analytics_service):
        self.consumer = kafka_consumer
        self.analytics = analytics_service
        
    async def process_trade_execution(self, trade_event: Dict):
        """Process new trade for live analytics update"""
        session_id = trade_event['session_id']
        
        # Update live metrics
        updated_metrics = await self.analytics.recalculate_live_metrics(session_id)
        
        # Stream to connected WebSocket clients
        await self.stream_to_clients(session_id, updated_metrics)
        
        # Check for alert conditions
        await self.check_performance_alerts(session_id, updated_metrics)
    
    async def process_portfolio_update(self, portfolio_event: Dict):
        """Process portfolio value changes"""
        session_id = portfolio_event['session_id']
        
        # Update drawdown calculations
        await self.analytics.update_drawdown_tracking(session_id, portfolio_event['total_value'])
        
        # Update risk metrics
        risk_metrics = await self.analytics.calculate_real_time_risk(session_id)
        
        # Stream updates
        await self.stream_risk_updates(session_id, risk_metrics)
```

---

## 4. Implementation Priorities

### Phase 1: Core Analytics (Weeks 1-2)
1. **Key Performance Metrics**: CAGR, Sharpe, Sortino, Information Ratio
2. **Basic Risk Metrics**: Max drawdown, volatility
3. **Trading Analytics**: Win rate, trade counts, profit factor
4. **REST API Endpoints**: Basic analytics retrieval

### Phase 2: Advanced Analytics (Weeks 3-4)
1. **Performance Attribution**: Alpha, beta, capture ratios
2. **Returns Analysis**: Monthly/annual breakdowns, distributions
3. **Drawdown Analysis**: Underwater curves, recovery periods
4. **Real-time Processing**: Kafka event handling

### Phase 3: Live Analytics (Weeks 5-6)
1. **Forward Testing Integration**: Real-time metric calculation
2. **WebSocket Streaming**: Live analytics updates
3. **Risk Management**: Real-time risk assessment
4. **Performance Alerts**: Threshold-based notifications

### Phase 4: Optimization (Weeks 7-8)
1. **Caching Layer**: Redis implementation for performance
2. **Batch Processing**: Historical analytics computation
3. **Advanced Visualizations**: Rolling statistics, correlation analysis
4. **Performance Monitoring**: Service metrics and health checks

---

## 5. Technical Considerations

### 5.1 Performance Requirements
- **Live Analytics**: Sub-second response times for real-time updates
- **Backtest Analytics**: Complete analysis within 30 seconds for 1-year backtests
- **Concurrent Users**: Support 100+ simultaneous live analytics streams
- **Data Retention**: 2 years of minute-level analytics data

### 5.2 Scalability Architecture
- **Horizontal Scaling**: Stateless service design for multiple instances
- **Event Processing**: Kafka consumer groups for distributed processing
- **Database Optimization**: Time-series database for historical analytics
- **Caching Strategy**: Multi-layer caching (Redis + in-memory)

### 5.3 Error Handling
- **Graceful Degradation**: Fallback to cached analytics if real-time fails
- **Data Validation**: Input validation for all analytics calculations
- **Monitoring**: Comprehensive logging and alerting for service health
- **Recovery**: Automatic retry mechanisms for failed calculations

This specification provides the complete foundation for implementing the Beta2 Analytics Service with full feature parity to Beta1, plus enhanced real-time capabilities and scalable architecture.