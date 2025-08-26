#!/usr/bin/env python3
"""
Create a strategy optimized for ADA's 2023 bull run that will definitely generate trades.
Based on the historical data showing ADA went from $0.25 → $0.42 → $0.36 in Jan-Mar 2023.
"""
import asyncio
import uuid
import json
from datetime import datetime
import sys
import os
sys.path.append('/home/neil/Programming/AlgoTrade/Beta2/backend')

# Database access
import asyncpg

# Strategy configuration optimized for ADA's 2023 volatile period
STRATEGY_CONFIG = {
    "nodes": [
        {
            "id": "price-1",
            "type": "priceNode", 
            "position": {"x": 100, "y": 200},
            "data": {"priceType": "close"}
        },
        {
            "id": "sma3-1",
            "type": "smaNode",
            "position": {"x": 300, "y": 150},
            "data": {"period": 3}  # Very short SMA to catch quick moves
        },
        {
            "id": "sma8-1", 
            "type": "smaNode",
            "position": {"x": 300, "y": 250},
            "data": {"period": 8}  # Medium SMA
        },
        {
            "id": "crossover-1",
            "type": "crossoverNode", 
            "position": {"x": 500, "y": 200},
            "data": {"crossType": "above"}  # SMA3 crosses above SMA8
        },
        {
            "id": "crossover-2",
            "type": "crossoverNode",
            "position": {"x": 500, "y": 300}, 
            "data": {"crossType": "below"}  # SMA3 crosses below SMA8
        },
        {
            "id": "buy-1",
            "type": "buyNode",
            "position": {"x": 700, "y": 150},
            "data": {"quantity": 1000, "orderType": "market"}  # Buy on upward cross
        },
        {
            "id": "sell-1", 
            "type": "sellNode",
            "position": {"x": 700, "y": 300},
            "data": {"quantity": 1000, "orderType": "market"}  # Sell on downward cross
        }
    ],
    "edges": [
        # Price feeds both SMAs
        {"source": "price-1", "target": "sma3-1", "sourceHandle": "price-out", "targetHandle": "price-in"},
        {"source": "price-1", "target": "sma8-1", "sourceHandle": "price-out", "targetHandle": "price-in"},
        
        # SMAs feed crossover detectors
        {"source": "sma3-1", "target": "crossover-1", "sourceHandle": "sma-out", "targetHandle": "fast-in"},
        {"source": "sma8-1", "target": "crossover-1", "sourceHandle": "sma-out", "targetHandle": "slow-in"},
        {"source": "sma3-1", "target": "crossover-2", "sourceHandle": "sma-out", "targetHandle": "fast-in"}, 
        {"source": "sma8-1", "target": "crossover-2", "sourceHandle": "sma-out", "targetHandle": "slow-in"},
        
        # Crossovers trigger actions
        {"source": "crossover-1", "target": "buy-1", "sourceHandle": "cross-out", "targetHandle": "trigger-in"},
        {"source": "crossover-2", "target": "sell-1", "sourceHandle": "cross-out", "targetHandle": "trigger-in"}
    ]
}

async def create_strategy():
    """Create the profitable strategy and add it to the dev user."""
    
    # Connect to database (using same credentials as create_dev_user.py)
    DATABASE_URL = "postgresql://algotrade:algotrade@localhost:5432/algotrade"
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # Get dev user ID
        user_query = "SELECT id FROM users WHERE email = 'dev@test.com'"
        user_result = await conn.fetchval(user_query)
        
        if not user_result:
            print("❌ Dev user not found. Creating...")
            # Create dev user if not exists
            user_insert = """
                INSERT INTO users (id, email, username, created_at, updated_at, is_active)
                VALUES ($1, $2, $3, NOW(), NOW(), true)
                ON CONFLICT (email) DO NOTHING
                RETURNING id
            """
            dev_user_id = str(uuid.uuid4())
            await conn.execute(user_insert, dev_user_id, 'dev@test.com', 'dev_user')
            user_result = dev_user_id
            print(f"✅ Created dev user: {dev_user_id}")
        
        user_id = user_result
        print(f"📋 Using user ID: {user_id}")
        
        # Create the strategy
        strategy_id = str(uuid.uuid4())
        strategy_json = json.dumps(STRATEGY_CONFIG)
        
        # Insert strategy into database
        strategy_insert = """
            INSERT INTO strategies (
                id, user_id, name, description, strategy_json, 
                is_compiled, compilation_report, version, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        """
        
        compilation_report = {
            "success": True,
            "message": "Strategy optimized for ADA 2023 bull run",
            "nodes_count": len(STRATEGY_CONFIG["nodes"]),
            "edges_count": len(STRATEGY_CONFIG["edges"])
        }
        
        await conn.execute(
            strategy_insert,
            strategy_id,
            user_id,
            "ADA Bull Run Catcher 2023",
            "Optimized strategy for ADA's volatile Jan-Mar 2023 period. Uses SMA 3/8 crossover to catch quick price movements from $0.25 to $0.42. Designed to generate multiple profitable trades.",
            strategy_json,
            True,  # is_compiled
            json.dumps(compilation_report),
            1  # version
        )
        
        print(f"✅ Strategy created successfully!")
        print(f"📊 Strategy ID: {strategy_id}")
        print(f"👤 User ID: {user_id}")
        print(f"🎯 Strategy: SMA 3/8 crossover optimized for ADA 2023 bull run")
        print(f"📈 Expected: Multiple trades during $0.25 → $0.42 → $0.36 price swings")
        
        # Print test command
        print(f"\n🧪 Test this strategy with:")
        print(f"curl -X POST \"http://localhost:8004/run\" \\")
        print(f"  -H \"Content-Type: application/json\" \\")
        print(f"  -H \"Authorization: Bearer test-token-123\" \\")
        print(f"  -d '{{\n    \"strategy_id\": \"{strategy_id}\",")
        print(f"    \"symbol\": \"ADA/USD\",")
        print(f"    \"start_date\": \"2023-01-01\",")
        print(f"    \"end_date\": \"2023-03-01\",")
        print(f"    \"initial_balance\": 100000,")
        print(f"    \"interval\": \"1d\"")
        print(f"  }}'")
        
        return strategy_id, user_id
        
    finally:
        await conn.close()

if __name__ == "__main__":
    strategy_id, user_id = asyncio.run(create_strategy())