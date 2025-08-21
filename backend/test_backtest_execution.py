#!/usr/bin/env python3
"""Test script to verify backtest execution generates realistic data"""

import asyncio
import sys
import os
from datetime import datetime, timedelta
from uuid import uuid4
sys.path.append('/home/neil/Programming/AlgoTrade/Beta2/backend/services/backtesting-service')

from app.services import BacktestEngine
from app.models import BacktestJob, BacktestRequest

async def test_backtest_execution():
    """Test that backtest execution generates realistic trading activity"""
    
    print("Testing backtest execution...")
    
    # Create test backtest job
    job_id = uuid4()
    user_id = uuid4() 
    
    request = BacktestRequest(
        strategy_id=uuid4(),
        symbol="BTC/USD", 
        start_date=datetime.now() - timedelta(days=30),
        end_date=datetime.now() - timedelta(days=1),
        interval="1d",
        initial_capital=100000,
        commission_rate=0.001,
        slippage_rate=0.0005
    )
    
    job = BacktestJob(
        job_id=job_id,
        user_id=user_id,
        request=request,
        strategy={},  # Empty strategy to trigger fallback
        status="running",
        created_at=datetime.now().timestamp()
    )
    
    # Run backtest
    engine = BacktestEngine()
    await engine.initialize()
    
    try:
        print(f"Running backtest for job {job_id}")
        results = await engine.run_backtest(job)
        
        print(f"\n📊 BACKTEST RESULTS:")
        print(f"Total Trades: {results.total_trades}")
        print(f"Winning Trades: {results.winning_trades}") 
        print(f"Losing Trades: {results.losing_trades}")
        print(f"Win Rate: {results.win_rate:.1f}%")
        print(f"Initial Capital: ${results.initial_portfolio_value}")
        print(f"Final Capital: ${results.final_portfolio_value}")
        print(f"Total Return: {results.total_return_percent:.2f}%")
        print(f"Sharpe Ratio: {results.sharpe_ratio}")
        print(f"Max Drawdown: {results.max_drawdown_percent:.2f}%")
        print(f"Execution Time: {results.execution_time_ms}ms")
        print(f"Data Points: {results.total_periods}")
        
        # Check if we have realistic data
        has_activity = (
            results.total_trades > 0 and
            results.execution_time_ms > 0 and
            results.total_periods > 0
        )
        
        if has_activity:
            print(f"\n🎉 SUCCESS: Backtest generated realistic trading activity!")
            print(f"   - Generated {results.total_trades} trades")
            print(f"   - Processed {results.total_periods} data points") 
            print(f"   - Execution took {results.execution_time_ms}ms")
        else:
            print(f"\n❌ ISSUE: Backtest still not generating activity")
            print(f"   - Trades: {results.total_trades}")
            print(f"   - Data points: {results.total_periods}")
            print(f"   - Execution time: {results.execution_time_ms}ms")
            
    except Exception as e:
        print(f"❌ Error during backtest execution: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        await engine.shutdown()

if __name__ == "__main__":
    asyncio.run(test_backtest_execution())