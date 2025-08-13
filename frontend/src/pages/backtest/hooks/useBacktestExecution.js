import { useState, useCallback } from 'react';
import { toast } from "sonner";

export const useBacktestExecution = () => {
  const [loading, setLoading] = useState(false);
  const [backtestResults, setBacktestResults] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [ranBacktest, setRanBacktest] = useState(false);

  const runBacktest = useCallback(async (params) => {
    const { ticker, fromDate, toDate, barInterval, selectedStrategy, loadingRef } = params;
    
    setLoading(true);
    if (loadingRef?.current) {
      loadingRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    try {
      // Check if strategyToUse is a UUID (saved strategy) or template name
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedStrategy);
      
      let requestBody = {
        ticker,
        fromDate: new Date(fromDate + "T05:00:00.000Z"),
        toDate: new Date(toDate + "T05:00:00.000Z"),
        interval: barInterval
      };
      
      if (isUuid) {
        // It's a saved strategy ID
        requestBody.strategy_id = selectedStrategy;
        requestBody.type = 'custom';
      } else {
        // It's a template strategy
        requestBody.strategy = selectedStrategy;
        requestBody.type = 'template';
      }

      console.log("Backtest request:", requestBody);

      const response = await fetch("http://localhost:8000/api/backtest/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Backtest response:", result);

      if (result.success) {
        setBacktestResults(result.data);
        setChartData(result.chart_data || []);
        setRanBacktest(true);
        toast.success("Backtest completed successfully!");
      } else {
        throw new Error(result.error || "Backtest failed");
      }
    } catch (error) {
      console.error("Error running backtest:", error);
      toast.error(`Failed to run backtest: ${error.message}`);
      setBacktestResults([]);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const resetBacktest = useCallback(() => {
    setBacktestResults([]);
    setChartData([]);
    setRanBacktest(false);
  }, []);

  return {
    loading,
    backtestResults,
    chartData,
    ranBacktest,
    runBacktest,
    resetBacktest,
  };
};