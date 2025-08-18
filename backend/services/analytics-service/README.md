# Analytics Service

The Analytics Service provides real-time and historical performance analytics for AlgoTrade's trading strategies. It calculates comprehensive metrics for both forward testing sessions and backtest results.

## Features

### ✅ Implemented (Phase 1)

#### Core Infrastructure
- **SQLAlchemy Models**: Complete database models for analytics data
- **Database Integration**: Async PostgreSQL connection with proper session management
- **Redis Caching**: High-performance caching for frequently accessed analytics
- **Kafka Event Processing**: Real-time processing of trade executions and portfolio updates

#### Analytics Engine
- **Performance Metrics**: CAGR, total return, Sharpe ratio calculations
- **Risk Metrics**: Maximum drawdown, volatility, current drawdown tracking
- **Trading Metrics**: Win rate, profit factor, trade statistics
- **Portfolio Overview**: Real-time portfolio value and P&L tracking

#### REST API Endpoints
- `GET /api/analytics/forward-test/{session_id}/live` - Real-time analytics for forward testing
- `GET /api/analytics/forward-test/{session_id}/performance` - Performance scoring and ratings
- `GET /api/analytics/backtest/{backtest_id}/key-metrics` - Key metrics for backtests
- `GET /api/analytics/backtest/{backtest_id}/summary` - Complete backtest analytics
- `GET /health` - Service health check with dependency status

#### Error Handling & Resilience
- **Retry Mechanisms**: Exponential backoff for database and Kafka operations
- **Circuit Breakers**: Automatic failure detection and recovery
- **Graceful Degradation**: Service continues operation when cache is unavailable
- **Comprehensive Logging**: Structured logging with error context

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Analytics Service (Port 8006)               │
├─────────────────────────────────────────────────────────────────┤
│  Input Sources:                                                 │
│  • Forward Testing Service → Real-time portfolio updates        │
│  • Trade Executions → Kafka events for live calculation        │
│  • Backtest Results → Historical performance analysis          │
├─────────────────────────────────────────────────────────────────┤
│  Processing:                                                    │
│  • Analytics Engine → Core metric calculations                 │
│  • Cache Manager → Redis caching for performance              │
│  • Event Processor → Real-time Kafka message handling         │
├─────────────────────────────────────────────────────────────────┤
│  Output:                                                        │
│  • REST API → Analytics data for frontend                      │
│  • WebSocket Updates → Real-time metric streaming (future)     │
│  • Cached Results → Fast retrieval for repeated requests       │
└─────────────────────────────────────────────────────────────────┘
```

## Key Metrics Calculated

### Performance Metrics
- **CAGR (Compound Annual Growth Rate)**: Annualized return rate
- **Total Return**: Absolute and percentage returns
- **Sharpe Ratio**: Risk-adjusted return measure
- **Runtime Statistics**: Days/years of strategy execution

### Risk Metrics
- **Maximum Drawdown**: Largest peak-to-trough decline
- **Current Drawdown**: Real-time drawdown from peak
- **Volatility**: Annualized standard deviation of returns
- **Drawdown Periods**: Historical drawdown analysis

### Trading Metrics
- **Win Rate**: Percentage of profitable trades
- **Profit Factor**: Ratio of gross profits to gross losses
- **Trade Statistics**: Average win/loss, largest win/loss
- **Trade Frequency**: Trades per day/week/month

## Usage

### Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run service locally
uvicorn app.main:app --host 0.0.0.0 --port 8006 --reload

# Run tests and verification
python verify_structure.py
```

### Docker

```bash
# Build image
docker build -t algotrade-analytics .

# Run container
docker run -p 8006:8006 \
  -e DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/db" \
  -e REDIS_URL="redis://host:6379/0" \
  -e KAFKA_BOOTSTRAP_SERVERS="host:9092" \
  algotrade-analytics
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://algotrade:password@localhost:5432/algotrade` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka broker addresses | `localhost:9092` |
| `JWT_SECRET_KEY` | JWT secret for authentication | `your-secret-key` |
| `DEBUG` | Enable debug mode | `false` |

## API Examples

### Get Live Analytics
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:8006/api/analytics/forward-test/ft_123456/live
```

Response:
```json
{
  "session_id": "ft_123456",
  "calculated_at": "2024-01-01T12:00:00Z",
  "performance_metrics": {
    "total_return": 5000.0,
    "total_return_pct": 5.0,
    "cagr": 12.5,
    "sharpe_ratio": 1.8,
    "initial_balance": 100000.0,
    "current_balance": 105000.0,
    "runtime_days": 30,
    "runtime_years": 0.082
  },
  "risk_metrics": {
    "max_drawdown": 2500.0,
    "max_drawdown_pct": 2.5,
    "current_drawdown": 0.0,
    "current_drawdown_pct": 0.0,
    "volatility": 15.2
  },
  "trading_metrics": {
    "total_trades": 45,
    "winning_trades": 28,
    "losing_trades": 17,
    "win_rate": 62.2,
    "profit_factor": 1.8,
    "avg_win": 250.0,
    "avg_loss": -150.0
  },
  "portfolio_overview": {
    "total_value": 105000.0,
    "cash": 95000.0,
    "total_pnl": 5000.0,
    "symbol": "BTCUSD",
    "session_name": "My Strategy Test",
    "status": "RUNNING"
  }
}
```

### Get Performance Score
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:8006/api/analytics/forward-test/ft_123456/performance
```

Response:
```json
{
  "session_id": "ft_123456",
  "performance_score": 75.5,
  "rating": "Good",
  "sharpe_rating": "Good",
  "win_rate_rating": "Good",
  "drawdown_rating": "Excellent",
  "risk_level": "Low",
  "total_return_pct": 5.0,
  "sharpe_ratio": 1.8,
  "max_drawdown_pct": 2.5,
  "win_rate": 62.2,
  "total_trades": 45,
  "updated_at": "2024-01-01T12:00:00Z"
}
```

## Future Enhancements (Planned)

### Phase 2: Advanced Analytics
- **Sortino Ratio**: Downside deviation-based risk measure
- **Information Ratio**: Active return per unit of tracking error
- **Calmar Ratio**: CAGR to maximum drawdown ratio
- **Beta/Alpha**: Market correlation and excess return analysis

### Phase 3: Enhanced Risk Analytics
- **Value at Risk (VaR)**: Potential loss estimation
- **Conditional VaR**: Expected shortfall analysis
- **Correlation Analysis**: Portfolio correlation metrics
- **Stress Testing**: Scenario-based risk assessment

### Phase 4: Real-time Streaming
- **WebSocket Endpoints**: Real-time analytics streaming
- **Performance Alerts**: Threshold-based notifications
- **Dashboard Integration**: Live metric updates
- **Mobile Push Notifications**: Critical alert delivery

## Dependencies

- **FastAPI**: Modern async web framework
- **SQLAlchemy**: Database ORM with async support
- **Redis**: High-performance caching layer
- **Kafka**: Event streaming platform
- **NumPy/Pandas**: Mathematical computations
- **Pydantic**: Data validation and serialization

## Monitoring

The service exposes metrics and health checks:

- `/health` - Service health with dependency status
- Structured logging for debugging and monitoring
- Circuit breakers for automatic failure recovery
- Prometheus-compatible metrics (future)

## Security

- JWT-based authentication for all endpoints
- User ownership verification for data access
- Input validation and sanitization
- Rate limiting and CORS protection

---

This service is a core component of the AlgoTrade Beta2 platform, providing the analytical foundation for strategy evaluation and optimization.