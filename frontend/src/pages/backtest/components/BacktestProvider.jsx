import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from "react-router-dom";
import { getBasicTemplateList } from "../../build_algorithm/basic-templates";
import { getTemplateList } from "../../build_algorithm/complex-templates";
import { useBacktestValidation } from "../hooks/useBacktestValidation";
import { buildBacktestRequest } from "../utils/strategyUtils";

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
      const typeParam = searchParams.get('type');
      
      // Build backtest request using utility function
      const backtestRequestBody = buildBacktestRequest(
        ticker, fromDate, toDate, barInterval, strategyToUse, 
        basicTemplates, complexTemplates, typeParam
      );

      console.log(backtestRequestBody);

      const response = await fetch("http://localhost:8000/api/backtest/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backtestRequestBody),
      });

      if (!response.ok) {
        alert("Request failed");
        return;
      }

      const response_data = await response.json();
      console.log(response_data);

      const data = JSON.parse(response_data['bar_data']);

      setBacktestResults(response_data['analytics']);

      setChartData(
        Object.keys(data.Cash).map((i) => ({
          Datetime: data.Datetime[i],
          Cash: data.Cash[i],
          Close: data.Close[i],
          High: data.High[i],
          Low: data.Low[i],
          Open: data.Open[i],
          PortfolioValue: data["Portfolio Value"][i],
          Position: data.Position[i],
          Volume: data.Volume[i],
        }))
      );

      setOVRPercent((response_data['analytics']['key_metrics']['win_rate'] * 100).toFixed(1));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRanBacktest(true);
    }
  }, [selectedStrategy, ticker, fromDate, toDate, barInterval, backtestResults, OVRPercent]);

  // Fetch date range for a symbol
  const fetchDateRange = async (symbol) => {
    if (!symbol) return;
    
    setIsLoadingDateRange(true);
    try {
      // FAKE DATA FOR DEMO - TODO: Replace with real API call
      console.warn(`🔧 DEMO MODE: Using fake date range data for symbol ${symbol}`);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate fake date range (last 2 years)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(endDate.getFullYear() - 2);
      
      const dateRange = {
        available: true,
        earliest_date: startDate.toISOString().split('T')[0],
        latest_date: endDate.toISOString().split('T')[0],
        symbol: symbol,
        data_points: Math.floor(Math.random() * 1000) + 500, // Random number between 500-1500
        _fake_data: true
      };
      
      setSymbolDateRange(dateRange);
      
      // Only set initial dates if they're not already set
      if (dateRange.available && (!fromDate || !toDate)) {
        // Set default to last 6 months
        const defaultStart = new Date();
        defaultStart.setMonth(defaultStart.getMonth() - 6);
        setFromDate(defaultStart.toISOString().split('T')[0]);
        setToDate(dateRange.latest_date);
      }
      
    } catch (error) {
      console.error('Failed to fetch date range:', error);
      setSymbolDateRange({ available: false });
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
    const typeParam = searchParams.get('type');
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