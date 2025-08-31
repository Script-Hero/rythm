-- Migration to update trades table schema to match TradeResponse model
-- This fixes the database schema mismatch

-- Drop the existing table (this will lose any existing trade data)
-- In production, you'd want to backup data first
DROP TABLE IF EXISTS trades CASCADE;

-- Recreate with correct schema matching TradeResponse model
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trades_session_id ON trades(session_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_executed_at ON trades(executed_at);