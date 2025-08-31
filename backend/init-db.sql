-- AlgoTrade Microservices Database Schema
-- Designed with proper relationship modeling

-- Users and Authentication
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Strategies (owned by users)
CREATE TABLE IF NOT EXISTS strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'custom',
    tags TEXT[], -- Array of tags
    json_tree JSONB NOT NULL, -- React Flow nodes and edges
    compilation_report JSONB,
    is_template BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    parent_strategy_id UUID REFERENCES strategies(id), -- For strategy versioning
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure user owns their strategies
    CONSTRAINT strategies_user_name_unique UNIQUE(user_id, name)
);

-- Forward Testing Sessions (user runs strategy in session)
CREATE TABLE IF NOT EXISTS forward_test_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(100) UNIQUE NOT NULL, -- ft_{timestamp} format
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL, -- Keep historical data if strategy deleted
    name VARCHAR(255) NOT NULL,
    strategy_name VARCHAR(255) NOT NULL, -- Snapshot in case strategy deleted
    strategy_snapshot JSONB, -- Full strategy backup
    symbol VARCHAR(50) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'STOPPED' CHECK (status IN ('STOPPED', 'RUNNING', 'PAUSED', 'ERROR', 'COMPLETED')),
    settings JSONB NOT NULL, -- All session settings
    initial_balance DECIMAL(15,2) NOT NULL,
    current_balance DECIMAL(15,2),
    total_pnl DECIMAL(15,2) DEFAULT 0,
    trade_count INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0,
    max_drawdown DECIMAL(5,2) DEFAULT 0,
    sharpe_ratio DECIMAL(8,4) DEFAULT 0,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Portfolio Positions (current holdings in forward test sessions)
CREATE TABLE IF NOT EXISTS portfolio_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(100) NOT NULL REFERENCES forward_test_sessions(session_id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    quantity DECIMAL(20,8) NOT NULL,
    average_price DECIMAL(20,8) NOT NULL,
    current_price DECIMAL(20,8),
    unrealized_pnl DECIMAL(20,8) DEFAULT 0,
    side VARCHAR(10) NOT NULL CHECK (side IN ('LONG', 'SHORT')),
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- One position per symbol per session
    CONSTRAINT portfolio_positions_session_symbol_unique UNIQUE(session_id, symbol)
);

-- Trades (executed in forward test sessions)
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(100) NOT NULL REFERENCES forward_test_sessions(session_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trade_id VARCHAR(100) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('BUY', 'SELL')),
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    filled_quantity DECIMAL(20,8) NOT NULL,
    commission DECIMAL(20,8) DEFAULT 0,
    slippage DECIMAL(20,8) DEFAULT 0,
    total_cost DECIMAL(20,8) NOT NULL,
    status VARCHAR(20) DEFAULT 'FILLED' CHECK (status IN ('FILLED', 'CANCELLED', 'PARTIAL', 'REJECTED')),
    strategy_signal JSONB,
    executed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure trade_id is unique within session
    CONSTRAINT trades_session_trade_id_unique UNIQUE(session_id, trade_id)
);

-- Backtest Results (user backtests strategy)
CREATE TABLE IF NOT EXISTS backtest_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL, -- Keep historical data
    strategy_name VARCHAR(255) NOT NULL, -- Snapshot in case strategy deleted
    strategy_snapshot JSONB, -- Full strategy backup
    symbol VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    interval VARCHAR(10) NOT NULL,
    initial_balance DECIMAL(15,2) NOT NULL,
    final_balance DECIMAL(15,2) NOT NULL,
    total_return DECIMAL(8,4) NOT NULL,
    sharpe_ratio DECIMAL(8,4),
    max_drawdown DECIMAL(5,2),
    trade_count INTEGER,
    win_rate DECIMAL(5,2),
    analytics JSONB, -- Full analytics data
    s3_result_key VARCHAR(500), -- S3 path for detailed results
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chart Data Storage (time series data for forward testing sessions)
CREATE TABLE IF NOT EXISTS chart_data (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL REFERENCES forward_test_sessions(session_id) ON DELETE CASCADE,
    data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('price', 'portfolio', 'drawdown', 'volume', 'pnl')),
    timestamp BIGINT NOT NULL, -- Unix timestamp
    value DECIMAL(20,8) NOT NULL,
    metadata JSONB, -- Additional data (volume, bid/ask, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Market Data Symbols (available trading symbols)
CREATE TABLE IF NOT EXISTS market_symbols (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(50) UNIQUE NOT NULL,
    base_currency VARCHAR(20) NOT NULL,
    quote_currency VARCHAR(20) NOT NULL,
    exchange VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    min_order_size DECIMAL(20,8),
    price_precision INTEGER,
    size_precision INTEGER,
    last_price DECIMAL(20,8),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User API Keys (for future live trading integration)
CREATE TABLE IF NOT EXISTS user_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exchange VARCHAR(50) NOT NULL,
    key_name VARCHAR(100) NOT NULL,
    encrypted_api_key TEXT NOT NULL,
    encrypted_api_secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    permissions JSONB, -- What this key can do
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT user_api_keys_user_exchange_unique UNIQUE(user_id, exchange, key_name)
);

-- System Configuration
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics Cache (for expensive calculations)
CREATE TABLE IF NOT EXISTS analytics_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    data JSONB NOT NULL,
    ttl TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_strategies_user_id ON strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_strategies_user_active ON strategies(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_strategies_category ON strategies(category);
CREATE INDEX IF NOT EXISTS idx_strategies_template ON strategies(is_template) WHERE is_template = true;

CREATE INDEX IF NOT EXISTS idx_forward_test_sessions_user_id ON forward_test_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_forward_test_sessions_user_status ON forward_test_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_forward_test_sessions_strategy_id ON forward_test_sessions(strategy_id) WHERE strategy_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portfolio_positions_session_id ON portfolio_positions(session_id);
CREATE INDEX IF NOT EXISTS idx_trades_session_id ON trades(session_id);
CREATE INDEX IF NOT EXISTS idx_trades_session_execution_time ON trades(session_id, execution_time);

CREATE INDEX IF NOT EXISTS idx_backtest_results_user_id ON backtest_results(user_id);
CREATE INDEX IF NOT EXISTS idx_backtest_results_strategy_id ON backtest_results(strategy_id) WHERE strategy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_backtest_results_user_created ON backtest_results(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_chart_data_session_type ON chart_data(session_id, data_type);
CREATE INDEX IF NOT EXISTS idx_chart_data_session_timestamp ON chart_data(session_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_market_symbols_active ON market_symbols(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_market_symbols_exchange ON market_symbols(exchange, is_active);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_ttl ON analytics_cache(ttl);

-- Default system configuration
INSERT INTO system_config (key, value, description) VALUES
('max_forward_test_sessions_per_user', '5', 'Maximum concurrent forward testing sessions per user'),
('max_backtest_duration_days', '365', 'Maximum backtest duration in days'),
('redis_sliding_window_size', '1000', 'Number of recent ticks to keep in Redis sliding window'),
('market_data_cache_ttl_seconds', '300', 'Market data cache TTL in seconds'),
('max_strategy_versions_per_user', '50', 'Maximum strategy versions to keep per user'),
('paper_trading_slippage_pct', '0.001', 'Default slippage percentage for paper trading'),
('paper_trading_fee_pct', '0.005', 'Default fee percentage for paper trading')
ON CONFLICT (key) DO NOTHING;