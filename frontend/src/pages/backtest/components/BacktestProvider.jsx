import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from "react-router-dom";
import { getBasicTemplateList } from "../../build_algorithm/basic-templates";
import { getTemplateList } from "../../build_algorithm/complex-templates";
import { useBacktestValidation } from "../hooks/useBacktestValidation";
import { apiService } from '@/services/api';

const BacktestContext = createContext();

export const useBacktest = () => {
  const context = useContext(BacktestContext);
  if (!context) {
    throw new Error('useBacktest must be used within a BacktestProvider');
  }
  return context;
};

export const BacktestProvider = ({ children }) => {
  // State management
  const [chartData, setChartData] = useState([]);
  const [backtestResults, setBacktestResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ranBacktest, setRanBacktest] = useState(false);
  const [ticker, setTicker] = useState("BTC/USD");
  const [isLoadingDateRange, setIsLoadingDateRange] = useState(false);
  const [barInterval, setBarInterval] = useState("1d");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedStrategy, setSelectedStrategy] = useState("rsi");
  const [symbolDateRange, setSymbolDateRange] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });
  const [OVRPercent, setOVRPercent] = useState(0.0);

  const [searchParams] = useSearchParams();
  const hasInitialized = useRef(false);
  
  const basicTemplates = getBasicTemplateList();
  const complexTemplates = getTemplateList();
  const allTemplates = [...basicTemplates, ...complexTemplates];
  
  const { validateParams } = useBacktestValidation();

  // Poll backtest job until completion
  const pollBacktestJob = async (jobId, maxAttempts = 60, intervalMs = 5000) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Use ApiService with authentication headers
        const jobStatus = await apiService.getBacktestResult(jobId);
        console.log(`Backtest job ${jobId} status:`, jobStatus);

        if (jobStatus.status === 'completed') {
          // Validate that analytics are actually complete before returning
          const results = jobStatus.results;
          if (results && 
              results.sharpe_ratio !== null && 
              results.sharpe_ratio !== undefined &&
              results.sortino_ratio !== null &&
              results.sortino_ratio !== undefined) {
            console.log('Backtest completed with full analytics:', results);
            return jobStatus;
          } else {
            console.log('Status is completed but analytics not yet complete, continuing to poll...', {
              sharpe_ratio: results?.sharpe_ratio,
              sortino_ratio: results?.sortino_ratio,
              attempt: attempt + 1
            });
            // Continue polling until analytics are ready
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        } else if (jobStatus.status === 'failed') {
          throw new Error(jobStatus.error_message || 'Backtest job failed');
        } else if (jobStatus.status === 'cancelled') {
          throw new Error('Backtest job was cancelled');
        }

        // Still running or queued, wait before next poll
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        
      } catch (error) {
        console.error('Error polling backtest job:', error);
        throw error;
      }
    }
    
    throw new Error('Backtest job timed out');
  };

  const runBacktest = useCallback(async (overrideStrategy = null) => {
    setLoading(true);
    setValidationErrors([]);
    
    try {
      // Validate symbol and dates before running backtest
      const validation = await validateParams(ticker, fromDate, toDate);
      
      if (!validation.valid) {
        const errors = validation.errors || ['Invalid symbol or date range'];
        setValidationErrors(errors);
        
        // Show error modal
        setModalState({
          isOpen: true,
          title: "Cannot run backtest",
          message: errors.join('. '),
          type: 'error'
        });
        
        setLoading(false);
        return;
      }

      // Use override strategy if provided, otherwise use selectedStrategy
      const strategyToUse = overrideStrategy || selectedStrategy;
      
      // Build new job-based backtest request
      const backtestRequestBody = {
        strategy_id: strategyToUse, // Assumes UUID format for now
        symbol: ticker,
        start_date: new Date(fromDate + "T00:00:00.000Z").toISOString(),
        end_date: new Date(toDate + "T23:59:59.999Z").toISOString(),
        interval: barInterval,
        initial_capital: "100000",
        commission_rate: "0.001",
        slippage_rate: "0.0005"
      };

      console.log('Submitting backtest job:', backtestRequestBody);

      // Submit backtest job using ApiService with authentication
      const jobResponse = await apiService.runBacktest({
        strategy_id: backtestRequestBody.strategy_id,
        ticker: backtestRequestBody.symbol,
        fromDate: backtestRequestBody.start_date,
        toDate: backtestRequestBody.end_date,
        interval: backtestRequestBody.interval
      });
      
      console.log('Backtest job submitted:', jobResponse);

      if (!jobResponse.success) {
        throw new Error(jobResponse.message || 'Failed to submit backtest job');
      }

      // Start polling for job completion
      const jobId = jobResponse.job_id;
      const result = await pollBacktestJob(jobId);
      
      if (result && result.results) {
        // Process the completed backtest results
        const { results } = result;
        
        setBacktestResults({
          key_metrics: {
            // Core performance metrics
            win_rate: results.win_rate,
            total_return: parseFloat(results.total_return_percent),
            max_drawdown: parseFloat(results.max_drawdown_percent),
            sharpe_ratio: results.sharpe_ratio,
            sortino_ratio: results.sortino_ratio,
            calmar_ratio: results.calmar_ratio,
            total_trades: results.total_trades,
            
            // Trade analysis metrics from backend
            winning_trades: results.winning_trades,
            losing_trades: results.losing_trades,
            average_trade: parseFloat(results.average_trade || 0),
            largest_win: parseFloat(results.largest_win || 0), 
            largest_loss: parseFloat(results.largest_loss || 0),
            consecutive_wins: results.consecutive_wins,
            consecutive_losses: results.consecutive_losses,
            gross_profit: parseFloat(results.gross_profit || 0),
            gross_loss: parseFloat(results.gross_loss || 0),
            net_profit: parseFloat(results.net_profit || 0),
            profit_factor: results.profit_factor,
            
            // Portfolio metrics
            initial_portfolio_value: parseFloat(results.initial_portfolio_value || 100000),
            final_portfolio_value: parseFloat(results.final_portfolio_value || 100000),
            
            // Volatility and risk
            volatility: results.volatility,
            
            // Derived metrics for compatibility
            avg_win: results.winning_trades > 0 ? parseFloat(results.gross_profit) / results.winning_trades : 0,
            avg_loss: results.losing_trades > 0 ? Math.abs(parseFloat(results.gross_loss)) / results.losing_trades : 0,
            win_loss_ratio: results.losing_trades > 0 ? (parseFloat(results.gross_profit) / results.winning_trades) / (Math.abs(parseFloat(results.gross_loss)) / results.losing_trades) : 0,
            expectancy: parseFloat(results.average_trade || 0),
            
            // Missing metrics with placeholder values
            cagr: parseFloat(results.total_return_percent) / 100, // Approximation
            information_ratio: results.sharpe_ratio || 0, // Fallback to Sharpe
            turnover_ratio: 0, // Not calculated in backend yet
            trades_per_day: results.total_periods > 0 ? results.total_trades / results.total_periods : 0,
            capacity: 1000000, // Placeholder value
            kelly_criterion: 0 // Not calculated in backend yet
          },
          advanced_metrics: {
            sortino_ratio: results.sortino_ratio,
            calmar_ratio: results.calmar_ratio,
            profit_factor: results.profit_factor
          }
        });

        // Convert chart data format
        if (results.chart_data && results.chart_data.length > 0) {
          setChartData(results.chart_data);
        }

        setOVRPercent((results.win_rate * 100).toFixed(1));
        setRanBacktest(true);
      }

    } catch (err) {
      console.error('Backtest error:', err);
      setModalState({
        isOpen: true,
        title: "Backtest Failed",
        message: err.message || 'An error occurred while running the backtest',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [selectedStrategy, ticker, fromDate, toDate, barInterval]);

  // Fetch date range for a symbol
  const fetchDateRange = async (symbol) => {
    if (!symbol) return;
    
    setIsLoadingDateRange(true);
    try {
      // Use ApiService to get symbol date range with authentication
      const urlSafeSymbol = symbol.replace('/', '-');
      const dateRange = await apiService.getSymbolDateRange(urlSafeSymbol);
      
      setSymbolDateRange(dateRange);
      
      // Only set initial dates if they're not already set
      if (dateRange.available && (!fromDate || !toDate)) {
        // Set default to last 6 months if possible
        const endDate = new Date(dateRange.latest_date);
        const defaultStart = new Date(endDate);
        defaultStart.setMonth(defaultStart.getMonth() - 6);
        
        // Ensure start date is not before earliest available date
        const earliestDate = new Date(dateRange.earliest_date);
        const startDate = defaultStart < earliestDate ? earliestDate : defaultStart;
        
        setFromDate(startDate.toISOString().split('T')[0]);
        setToDate(dateRange.latest_date);
      }
      
    } catch (error) {
      console.error('Failed to fetch date range:', error);
      setSymbolDateRange({ available: false, error: error.message });
    } finally {
      setIsLoadingDateRange(false);
    }
  };
  
  // Fetch date range when ticker changes or on initial load
  useEffect(() => {
    if (ticker) {
      fetchDateRange(ticker);
    }
  }, [ticker]);

  // Handle URL parameters and auto-run - ONLY on initial page load
  useEffect(() => {
    // Only run this logic once when the component first mounts
    if (hasInitialized.current) return;
    
    const strategyParam = searchParams.get('strategy');
    const autoRunParam = searchParams.get('autoRun');
    
    if (strategyParam) {
      // Always set the strategy param, regardless of type
      setSelectedStrategy(strategyParam);
      
      // Auto-run if requested - but only after date range is available
      if (autoRunParam === 'true') {
        // Wait for date range to be fetched before running backtest
        const checkAndRun = () => {
          if (fromDate && toDate) {
            runBacktest(strategyParam);
          } else if (!isLoadingDateRange) {
            // If date range loading is complete but dates are still empty, wait a bit more
            setTimeout(checkAndRun, 100);
          } else {
            // Still loading, wait for it to complete
            setTimeout(checkAndRun, 100);
          }
        };
        setTimeout(checkAndRun, 100);
      }
    }
    
    // Mark as initialized so this never runs again
    hasInitialized.current = true;
  }, [runBacktest, searchParams, fromDate, toDate, isLoadingDateRange]); // Include date dependencies

  const clearChart = () => {
    setChartData([]);
    setRanBacktest(false);
    setOVRPercent(0.0);
    setBacktestResults({});
  };

  const value = {
    // State
    chartData,
    backtestResults,
    loading,
    ranBacktest,
    ticker,
    isLoadingDateRange,
    barInterval,
    fromDate,
    toDate,
    selectedStrategy,
    symbolDateRange,
    validationErrors,
    modalState,
    OVRPercent,
    
    // Setters
    setTicker,
    setFromDate,
    setToDate,
    setBarInterval,
    setSelectedStrategy,
    setSymbolDateRange,
    setModalState,
    
    // Actions
    runBacktest,
    clearChart,
    
    // Data
    allTemplates,
    basicTemplates,
    complexTemplates
  };

  return (
    <BacktestContext.Provider value={value}>
      {children}
    </BacktestContext.Provider>
  );
};

export default BacktestProvider;