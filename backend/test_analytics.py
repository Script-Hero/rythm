#!/usr/bin/env python3
"""Test script to verify real analytics data retrieval"""

import asyncio
import sys
import os
sys.path.append('/home/neil/Programming/AlgoTrade/Beta2/backend/services/backtesting-service')

from uuid import UUID
from app.services import DatabaseService

async def test_analytics_retrieval():
    """Test that analytics data is properly retrieved and populated"""
    
    # Initialize database service
    db_service = DatabaseService()
    await db_service.initialize()
    
    try:
        # Test job ID with real analytics data
        job_id = UUID('e9de3188-d3da-4336-ad4f-9c7532239947')
        user_id = UUID('550e8400-e29b-41d4-a716-446655440000')  # Sample user ID
        
        print("Testing analytics data retrieval...")
        print(f"Job ID: {job_id}")
        
        # Get backtest results
        results = await db_service.get_backtest_results(job_id)
        
        if results:
            print("\n✅ Successfully retrieved backtest results!")
            print(f"Total Trades: {results.total_trades}")
            print(f"Winning Trades: {results.winning_trades}")
            print(f"Losing Trades: {results.losing_trades}")
            print(f"Win Rate: {results.win_rate}%")
            print(f"Total Return: ${results.total_return}")
            print(f"Total Return %: {results.total_return_percent}%")
            print(f"Sharpe Ratio: {results.sharpe_ratio}")
            print(f"Max Drawdown: ${results.max_drawdown}")
            print(f"Max Drawdown %: {results.max_drawdown_percent}%")
            print(f"Gross Profit: ${results.gross_profit}")
            print(f"Gross Loss: ${results.gross_loss}")
            print(f"Net Profit: ${results.net_profit}")
            print(f"Profit Factor: {results.profit_factor}")
            print(f"Average Trade: ${results.average_trade}")
            print(f"Largest Win: ${results.largest_win}")
            print(f"Largest Loss: ${results.largest_loss}")
            print(f"Consecutive Wins: {results.consecutive_wins}")
            print(f"Consecutive Losses: {results.consecutive_losses}")
            print(f"Volatility: {results.volatility}")
            
            # Check if we have real data (not all zeros)
            has_real_data = (
                results.total_trades > 0 or
                results.winning_trades > 0 or 
                results.total_return_percent != 0 or
                results.sharpe_ratio != 0
            )
            
            if has_real_data:
                print("\n🎉 SUCCESS: Real analytics data is being returned!")
            else:
                print("\n❌ ISSUE: Still returning zero/empty values")
                
        else:
            print("❌ No results found for the given job ID")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        await db_service.shutdown()

if __name__ == "__main__":
    asyncio.run(test_analytics_retrieval())