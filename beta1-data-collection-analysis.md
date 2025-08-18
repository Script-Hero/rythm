# Beta1 Data Collection Architecture Analysis

## Overview
This document provides a comprehensive analysis of the data collection mechanisms in AlgoTrade Beta1, tracing the complete flow from frontend to backend for both backtesting and forward testing functionality.

---

## 1. Complete Data Flow Mapping

### 1.1 Backtesting Data Collection Flow

#### Frontend Layer (`frontend/src/`)
**Entry Point:** `pages/backtest/hooks/useBacktestExecution.js`
- **API Call:** Direct `fetch()` to `http://localhost:5000/run_backtest`
- **Request Structure:**
  ```javascript
  {
    ticker: string,
    fromDate: Date,
    toDate: Date,
    interval: string,
    strategy_id?: string,  // For saved strategies
    strategy?: string,     // For template strategies
    type: 'custom' | 'template'
  }
  ```

**API Service:** `services/api.ts`
- **Method:** `runBacktest(BacktestRequest)` → `BacktestResponse`
- **Response Structure:**
  ```typescript
  {
    bar_data: string,  // JSON string
    analytics: any
  }
  ```

#### Backend Layer (`backend/`)
**Route Handler:** `core/server_handlers.py:BacktestHandlers.run_backtest()`
1. **Request Validation:** `utils/validation.py:validate_backtest_request()`
2. **Strategy Loading:** `BacktestHandlers._load_strategy()`
3. **Market Data Service:** `data/market_data_service.py:get_market_data_service()`
4. **Data Fetching:** `market_data_service.get_historical_data()`
5. **Backtest Execution:** `backtesting/backtest.py:run_backtest()`

#### Data Sources Layer
**Primary Source:** `data/data_manager.py:DataSourceManager`
- **CCXT Integration:** `ccxt.coinbase()` for historical OHLCV data
- **Caching:** File-based cache (`market_data_cache.json`)
- **Fallback Logic:** Default symbol/date range on failure

**Data Flow:**
```
Frontend Request → API Validation → Strategy Compilation → 
Market Data Service → CCXT Exchange → Historical OHLCV Data → 
Backtest Engine → Results Processing → Frontend Response
```

### 1.2 Forward Testing Data Collection Flow

#### Frontend Layer (`frontend/src/`)
**Context Manager:** `contexts/ForwardTestingContext.tsx`
- **WebSocket Connection:** Socket.io client to `http://localhost:5000`
- **Multi-Session State:** Manages multiple concurrent testing sessions
- **API Integration:** Through `services/api.ts`

**Session Management Methods:**
```typescript
createSession(name, strategy, settings) → session_id
startTest(sessionId) → boolean
pauseTest/resumeTest/stopTest(sessionId) → void
```

**Data Reception:** WebSocket event handlers
- `forward_test_update` - General session updates
- `price_update` - Real-time price data
- `portfolio_update` - Portfolio value changes
- `trade_executed` - Trade execution notifications
- `chart_data_restored` - Historical chart data restoration

#### Backend Layer (`backend/`)
**Route Handlers:** `core/server_handlers.py:ForwardTestingHandlers`
- Session CRUD operations: `/api/forward-test/session/*`
- Real-time management: start/pause/resume/stop endpoints
- Data persistence: `/api/forward-test/restore`

**Service Architecture:**
1. **Service Manager:** `services/forward_test_service_manager.py:ForwardTestServiceManager`
2. **Real-time Processor:** `services/realtime_data_processor.py:RealTimeDataProcessor`
3. **Strategy Executor:** `services/strategy_execution_service.py:StrategyExecutionService`
4. **Event Publisher:** `services/session_event_publisher.py:SessionEventPublisher`
5. **Database Handler:** `database/session_handler.py:SessionDatabaseHandler`

#### Live Data Sources
**Primary Source:** `data/coinbase_client.py:CoinbaseAdvancedTradeClient`
- **WebSocket Feed:** Real-time ticker data from Coinbase Pro
- **REST API:** Current price/volume via HTTP requests
- **Mock Mode:** `MockCoinbaseClient` for testing

**Data Flow:**
```
Coinbase WebSocket → RealTimeDataProcessor → Strategy Execution →
Event Publisher → SocketIO → Frontend WebSocket → Chart Updates
```

---

## 2. Key Components Analysis

### 2.1 Data Storage & Caching

#### File-Based Cache
**Location:** `backend/cache/market_data/` + `market_data_cache.json`
- **Format:** Pickle files for OHLCV data, JSON for metadata
- **Expiration:** Configurable (disabled in MVP: `_cache_expiry = None`)
- **Validation:** Symbol data availability checks

#### SQLite Database
**Location:** `backend/database/strategies.db`
- **Tables:** strategies, forward_test_sessions, session_data, trades
- **Handler:** `database/database.py` + `database/session_handler.py`
- **Auto-cleanup:** 7-day retention policy

### 2.2 Real-time Data Architecture

#### Threading Model
**Price Feeds:** One thread per active session (`_price_feed_worker`)
**Event Processing:** Separate threads for WebSocket handling
**Session Management:** Thread-safe state transitions

#### WebSocket Infrastructure
**Server:** Flask-SocketIO with threading async mode
**Events:** Typed event system with session-specific routing
**Client:** Socket.io with automatic reconnection

### 2.3 Market Data Providers

#### CCXT Integration
**Exchange:** `ccxt.coinbase()` for historical data
**Rate Limiting:** Built-in exchange rate limits
**Error Handling:** Retry logic with fallback data

#### Coinbase Advanced Trade
**Authentication:** API key/secret for private endpoints
**Public Data:** Ticker/chart data without authentication
**WebSocket:** Live price feeds for forward testing

---

## 3. Critical Assessment & Issues

### 3.1 Architectural Weaknesses

#### 1. **Tight Coupling Between Services**
```python
# Problematic: Direct service dependencies
class RealTimeDataProcessor:
    def __init__(self, event_publisher, repository):
        self.event_publisher = event_publisher  # Tight coupling
        self.repository = repository           # Tight coupling
```
**Issue:** Makes testing difficult and reduces modularity.

#### 2. **Mixed Synchronous/Asynchronous Patterns**
```python
# Inconsistent: Threading + async patterns
def _price_feed_worker(self, session_id):  # Threading
    while self.active_feeds[session_id]['is_running']:  # Polling
```
**Issue:** Should use async/await consistently for better resource management.

#### 3. **File-Based Caching Limitations**
```python
# Problematic: File I/O for each cache operation
def _save_cache(self):
    with open(self._cache_file, 'w') as f:  # Blocking I/O
        json.dump(self._cache, f, indent=2)
```
**Issue:** No concurrent access control, potential corruption, poor scalability.

#### 4. **Single Data Provider Dependency**
```python
# Risk: Single point of failure
self.ccxt_exchange = ccxt.coinbase()  # Only Coinbase
```
**Issue:** No redundancy or failover mechanisms.

### 3.2 Data Quality Issues

#### 1. **No Data Validation Pipeline**
- Missing price sanity checks (outliers, gaps)
- No data quality metrics or alerts
- No historical data completeness validation

#### 2. **Inconsistent Timestamping**
```typescript
// Frontend: Inconsistent timestamp handling
time: typeof point.timestamp === 'number' ? 
  new Date(point.timestamp * 1000).toISOString() : 
  (point.time || point.timestamp)
```

#### 3. **Limited Error Recovery**
- WebSocket disconnections cause data loss
- No automatic session recovery mechanisms
- Missing data backfill capabilities

### 3.3 Performance Bottlenecks

#### 1. **Inefficient State Management**
```typescript
// Frontend: Unnecessary re-renders
const [sessionChartData, setSessionChartData] = useState<Record<string, ChartData>>({});
// Every update triggers full re-render of all charts
```

#### 2. **Blocking Database Operations**
```python
# Backend: Synchronous DB operations
def create_strategy(self, name, description, json_tree, template_type):
    cursor.execute(...)  # Blocks entire thread
```

#### 3. **Memory Inefficient Data Storage**
```python
# Unlimited chart data accumulation
def limitChartData(data, maxPoints):
    return data[-maxPoints:] if len(data) > maxPoints else data
```

### 3.4 Scalability Limitations

#### 1. **Single-Process Architecture**
- All sessions run in single Python process
- No horizontal scaling capabilities
- SQLite limitations for concurrent access

#### 2. **In-Memory Session State**
```python
# Non-persistent session state
self.active_sessions = {}  # Lost on restart
```

#### 3. **WebSocket Session Limits**
- Flask-SocketIO has connection limits
- No session persistence across server restarts

---

## 4. Recommendations for Beta2

### 4.1 Microservices Architecture

#### **Proposed Services:**
1. **API Gateway Service** (Port 8000)
2. **Market Data Service** (Port 8001) - Centralized data collection
3. **Strategy Service** (Port 8002) - Strategy compilation/execution  
4. **Forward Testing Service** (Port 8003) - Session management
5. **Backtesting Service** (Port 8004) - Historical analysis
6. **Notification Service** (Port 8005) - WebSocket management
7. **Analytics Service** (Port 8006) - Performance metrics

#### **Benefits:**
- Independent scaling of services
- Fault isolation
- Technology stack flexibility
- Better testing/deployment

### 4.2 Event-Driven Data Architecture

#### **Kafka Integration:**
```yaml
# Proposed Kafka Topics
market-data-updates:    # Real-time price feeds
strategy-signals:       # Trading decisions  
trade-executions:       # Order completions
portfolio-updates:      # Position changes
session-events:         # Lifecycle events
```

#### **Redis Sliding Windows:**
```python
# Centralized market data cache
# Beta2 Innovation: Redis streams with sliding windows
GET /api/market/symbols/BTCUSD/latest?limit=100
# Sub-millisecond latency, eliminates per-strategy data management
```

### 4.3 Data Collection Improvements

#### **Multi-Provider Strategy:**
```python
# Redundant data sources
providers = [
    FinnhubProvider(),      # Primary
    CoinbaseProvider(),     # Secondary  
    YahooFinanceProvider()  # Fallback
]
```

#### **Data Quality Pipeline:**
```python
# Validation pipeline
data_pipeline = [
    OutlierDetector(),
    GapFiller(),
    ConsistencyChecker(),
    QualityScorer()
]
```

#### **Enhanced Caching:**
```python
# Redis-based caching with TTL
@cached(ttl=300, key="market_data:{symbol}:{timeframe}")
def get_market_data(symbol, timeframe):
    return fetch_from_provider(symbol, timeframe)
```

### 4.4 Real-time Data Optimization

#### **WebSocket Connection Pooling:**
```typescript
// Efficient connection management
class WebSocketManager {
    private connectionPool = new Map<string, WebSocket>();
    private subscribers = new Map<string, Set<Function>>();
}
```

#### **Data Compression:**
```python
# Efficient data serialization
import msgpack

def serialize_market_data(data):
    return msgpack.packb(data, use_bin_type=True)
```

#### **Event Sourcing:**
```python
# Persistent event log
class EventStore:
    def append(self, stream_id, events):
        # Append-only event storage
        
    def replay(self, stream_id, from_version=0):
        # Event replay for session recovery
```

### 4.5 Database Architecture

#### **PostgreSQL Migration:**
```sql
-- Scalable relational storage
CREATE TABLE strategies (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    nodes JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_strategies_user_id ON strategies(user_id);
CREATE INDEX idx_strategies_nodes_gin ON strategies USING gin(nodes);
```

#### **Time-Series Data:**
```sql
-- Optimized for time-series queries
CREATE TABLE market_data (
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8) NOT NULL,
    PRIMARY KEY (symbol, timestamp)
) PARTITION BY RANGE (timestamp);
```

---

## 5. Migration Strategy

### 5.1 Phase 1: Infrastructure
1. **Container Setup:** Docker + docker-compose
2. **Message Queue:** Kafka broker setup
3. **Database Migration:** SQLite → PostgreSQL
4. **Redis Setup:** Caching + session storage

### 5.2 Phase 2: Service Extraction
1. **Market Data Service:** Extract data collection logic
2. **Notification Service:** WebSocket management
3. **API Gateway:** Request routing + auth

### 5.3 Phase 3: Enhanced Features
1. **Multi-provider data:** Redundancy + quality
2. **Advanced caching:** Redis sliding windows
3. **Event sourcing:** Session recovery
4. **Performance monitoring:** Metrics + alerting

---

## 6. Conclusion

Beta1's data collection architecture, while functional, suffers from significant scalability and maintainability issues. The proposed Beta2 architecture addresses these concerns through:

1. **Microservices decomposition** for better scalability
2. **Event-driven architecture** for loose coupling
3. **Redis sliding windows** for sub-millisecond data access
4. **Multi-provider redundancy** for reliability
5. **Enhanced caching strategies** for performance

The migration to Beta2 will provide a robust foundation for handling thousands of concurrent trading strategies with real-time execution capabilities.