# API Integration Mapping - Frontend to Backend

This document tracks the integration status between the React frontend and the backend services.

## Current Frontend API Base URL Issue

**CRITICAL:** The frontend is currently configured to use `http://localhost:5000` (legacy Flask backend) but the current backend architecture uses `http://localhost:8000` (API Gateway).

**File:** `AlgoTradeFrontend/src/services/api.ts:38`
**Current:** `const API_BASE_URL = 'http://localhost:5000';`
**Should be:** `const API_BASE_URL = 'http://localhost:8000';`

## Route Analysis & Mapping Status

### 1. STRATEGY MANAGEMENT

#### ✅ Routes Available on Backend (via API Gateway → Strategy Service)
- `GET /api/strategies/` - List strategies
- `POST /api/strategies/` - Create strategy  
- `GET /api/strategies/{id}` - Get strategy
- `PUT /api/strategies/{id}` - Update strategy
- `DELETE /api/strategies/{id}` - Delete strategy
- `POST /api/strategies/{id}/duplicate` - Duplicate strategy
- `GET /api/strategies/search` - Search strategies
- `GET /api/strategies/stats` - Get strategy statistics
- `GET /api/strategies/templates` - Get templates
- `POST /api/strategies/templates/{name}/create` - Create from template

#### 🔄 Frontend Implementation Status
**File:** `AlgoTradeFrontend/src/services/api.ts`

- ❌ `POST /save_strategy` (Line 72) → Should be `POST /api/strategies/`
- ❌ `GET /strategy/{id}` (Line 79) → Should be `GET /api/strategies/{id}`
- ❌ `GET /strategies` (Line 93) → Should be `GET /api/strategies/`
- ❌ `PUT /strategy/{id}` (Line 97) → Should be `PUT /api/strategies/{id}`
- ❌ `DELETE /strategy/{id}` (Line 104) → Should be `DELETE /api/strategies/{id}`
- ❌ `POST /strategy/{id}/duplicate` (Line 110) → Should be `POST /api/strategies/{id}/duplicate`
- ❌ `GET /strategies/search` (Line 118) → Should be `GET /api/strategies/search`
- ❌ `GET /strategies/stats` (Line 127) → Should be `GET /api/strategies/stats`

### 2. BACKTESTING

#### ❌ Backend Not Yet Implemented
The API Gateway references `backtesting.router` but no backtesting service exists yet.

#### 🔄 Frontend Implementation
**Files:** 
- `AlgoTradeFrontend/src/services/api.ts:131` - `POST /run_backtest`
- `AlgoTradeFrontend/src/pages/backtest/hooks/useBacktestExecution.js:41` - `POST http://localhost:5000/run_backtest`

**Needs:** Backend to implement backtesting service at `POST /api/backtest/run`

### 3. FORWARD TESTING

#### ✅ Backend Available (Forward Test Service)
- `POST /api/forward-test/` - Create session
- `GET /api/forward-test/` - List sessions  
- `GET /api/forward-test/{session_id}` - Get session details
- `POST /api/forward-test/{session_id}/start` - Start session
- `POST /api/forward-test/{session_id}/stop` - Stop session
- `GET /api/forward-test/{session_id}/portfolio` - Get portfolio
- `GET /api/forward-test/{session_id}/metrics` - Get metrics
- `GET /api/forward-test/{session_id}/trades` - Get trades
- `GET /api/forward-test/{session_id}/chart` - Get chart data

#### 🔄 Frontend Implementation Status  
**File:** `AlgoTradeFrontend/src/services/api.ts:139-271`

Frontend paths are mostly correct but need base URL fix:
- ✅ `/api/forward-test/session/create` → `/api/forward-test/` (POST)
- ✅ `/api/forward-test/session/{id}/start` → `/api/forward-test/{id}/start`
- ✅ `/api/forward-test/session/{id}/pause` → **MISSING** (Backend has stop, not pause)
- ✅ `/api/forward-test/session/{id}/resume` → **MISSING** (Backend has start, not resume)
- ✅ `/api/forward-test/session/{id}/stop` → `/api/forward-test/{id}/stop`
- ✅ `/api/forward-test/session/{id}/status` → `/api/forward-test/{id}` (GET)
- ✅ `/api/forward-test/session/{id}` (DELETE) → **MISSING ON BACKEND**
- ✅ `/api/forward-test/symbols` → **MISSING** (Should use Market Data Service)
- ✅ `/api/forward-test/sessions` → `/api/forward-test/` (GET)
- ✅ `/api/forward-test/restore` → **MISSING ON BACKEND**

### 4. MARKET DATA

#### ✅ Backend Available (Market Data Service)
- `GET /api/market/symbols/{symbol}/latest` - Get latest prices (Redis sliding window)
- `GET /api/market/symbols` - List available symbols
- `GET /api/market/symbols/search` - Search symbols
- `POST /api/market/symbols/{symbol}/subscribe` - Subscribe to real-time data
- `DELETE /api/market/symbols/{symbol}/unsubscribe` - Unsubscribe
- `POST /api/market/historical` - Get historical data

#### 🔄 Frontend Implementation
**File:** `AlgoTradeFrontend/src/components/forms/crypto-symbol-selector.jsx`

- ❌ `GET http://localhost:5000/api/market/symbols` (Line 57) → Should be `http://localhost:8000/api/market/symbols`
- ❌ `GET http://localhost:5000/api/market/currencies/base` (Line 75) → **MISSING ON BACKEND**
- ❌ `GET http://localhost:5000/api/market/currencies/quote` (Line 76) → **MISSING ON BACKEND** 
- ❌ `GET http://localhost:5000/api/market/symbols/search` (Line 100) → Should be `http://localhost:8000/api/market/symbols/search`

### 5. AUTHENTICATION

#### ✅ Backend Available (API Gateway)
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration  
- `GET /api/auth/profile` - Get user profile

#### ❌ Frontend Implementation
**Status:** Not implemented - No authentication in frontend yet

## Missing Backend Implementations Needed

### 1. Market Data Service Extensions
- `GET /api/market/currencies/base` - List base currencies
- `GET /api/market/currencies/quote` - List quote currencies

### 2. Forward Testing Service Extensions  
- `POST /api/forward-test/{session_id}/pause` - Pause session (currently missing)
- `POST /api/forward-test/{session_id}/resume` - Resume session (currently missing)
- `DELETE /api/forward-test/{session_id}` - Delete session
- `POST /api/forward-test/restore` - Restore session data
- `GET /api/forward-test/symbols` - Get available symbols for forward testing

### 3. Backtesting Service (Entire service missing)
- `POST /api/backtest/run` - Run backtest
- `GET /api/backtest/{id}` - Get backtest results
- `GET /api/backtest/` - List user backtests

## Data Field Mappings & Inconsistencies

### Forward Testing API Response Structure
**Frontend expects:** (api.ts:201-225)
```json
{
  "success": true,
  "session_detail": {
    "session": { "id", "name", "strategy", "status", "start_time", "symbol", "settings", "portfolioValue" },
    "portfolio": {},
    "metrics": {},
    "trades": []
  }
}
```

**Backend provides:** Different structure - needs alignment

### Strategy Response Structure
**Frontend expects:** Standard CRUD responses with `success`, `id`, `message` fields
**Backend provides:** Direct model responses - may need wrapper for frontend compatibility

## ✅ COMPLETED INTEGRATION WORK

### 1. Frontend Updates Completed
- ✅ **Changed base URL** from `http://localhost:5000` to `http://localhost:8000`
- ✅ **Updated all endpoint paths** to use correct API Gateway routes:
  - Strategy endpoints: `/save_strategy` → `/api/strategies`
  - Forward testing: `/api/forward-test/session/...` → `/api/forward-test/...`  
  - Market data: Fixed all endpoints to use port 8000
  - Backtesting: `/run_backtest` → `/api/backtest/run`

### 2. Backend Missing Endpoints Added
- ✅ **Market Data Service** - Added placeholder currency endpoints:
  - `GET /currencies/base` - Returns base currencies (BTC, ETH, etc.)
  - `GET /currencies/quote` - Returns quote currencies (USD, EUR, etc.)
- ✅ **Forward Testing Service** - Added missing endpoints:
  - `DELETE /{session_id}` - Delete session (placeholder)
  - `POST /restore` - Restore session data (placeholder)
- ✅ **Backtesting Service** - Created complete placeholder service:
  - `POST /run` - Run backtest with realistic placeholder data
  - `GET /{id}` - Get backtest results
  - `GET /` - List backtests

### 3. API Gateway Routing Completed
- ✅ **Created all missing router files**:
  - `routers/strategies.py` - Proxies to Strategy Service
  - `routers/forward_testing.py` - Proxies to Forward Testing Service
  - `routers/backtesting.py` - Proxies to Backtesting Service
  - `routers/market_data.py` - Proxies to Market Data Service
  - `routers/analytics.py` - Placeholder Analytics routes
- ✅ **Added supporting files**:
  - `middleware.py` - Request logging middleware
  - `services.py` - Database/Redis service placeholders

## Files Updated

### ✅ Frontend Files
- `AlgoTradeFrontend/src/services/api.ts:38` - Base URL changed
- `AlgoTradeFrontend/src/services/api.ts:72-127` - All strategy endpoints updated
- `AlgoTradeFrontend/src/services/api.ts:131` - Backtesting endpoint updated
- `AlgoTradeFrontend/src/services/api.ts:139-271` - Forward testing endpoints updated
- `AlgoTradeFrontend/src/components/forms/crypto-symbol-selector.jsx:57,75,100` - Market data URLs updated
- `AlgoTradeFrontend/src/pages/backtest/hooks/useBacktestExecution.js:41` - Backtesting URL updated

### ✅ Backend Files Created/Updated
- `backend/services/market-data-service/app/main.py:297-332` - Added currency endpoints
- `backend/services/forward-test-service/app/main.py:291-349` - Added missing endpoints
- `backend/services/backtesting-service/app/main.py` - **NEW** Complete service
- `backend/services/api-gateway/app/routers/strategies.py` - **NEW** Strategy proxy
- `backend/services/api-gateway/app/routers/forward_testing.py` - **NEW** Forward testing proxy
- `backend/services/api-gateway/app/routers/backtesting.py` - **NEW** Backtesting proxy
- `backend/services/api-gateway/app/routers/market_data.py` - **NEW** Market data proxy
- `backend/services/api-gateway/app/routers/analytics.py` - **NEW** Analytics placeholder
- `backend/services/api-gateway/app/middleware.py` - **NEW** Request logging
- `backend/services/api-gateway/app/services.py` - **NEW** Service placeholders

## 🔄 Next Steps for Full Implementation

### Remaining Work (Beyond Current Scope)
1. **Authentication Integration** - Add JWT auth to frontend
2. **Response Structure Alignment** - Ensure backend responses match frontend expectations
3. **Remove Placeholder Data** - Replace with real implementations
4. **Error Handling** - Improve error responses and frontend error handling
5. **Testing** - Add integration tests