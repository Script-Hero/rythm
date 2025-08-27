import { useState, useCallback } from 'react';
import { toast } from "sonner";
import { apiService } from '@/services/api';
// Import template registries to expand template keys into node graphs
import { BASIC_STRATEGY_TEMPLATES } from '../../build_algorithm/basic-templates';
import { STRATEGY_TEMPLATES } from '../../build_algorithm/complex-templates';

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
      } else {
        // It's a template key - expand to json_tree and send directly (no DB persistence)
        const key = selectedStrategy;
        const template = BASIC_STRATEGY_TEMPLATES[key] || STRATEGY_TEMPLATES[key];
        if (!template) {
          throw new Error(`Unknown template key: ${key}`);
        }
        const nodes = Array.isArray(template.initialNodes) ? template.initialNodes : [];
        const edges = Array.isArray(template.initialEdges) ? template.initialEdges : [];
        requestBody.json_tree = { nodes, edges };
      }

      console.log("Backtest request:", requestBody);

      // Use ApiService which includes authentication headers
      const result = await apiService.runBacktest({
        strategy_id: requestBody.strategy_id,
        ticker: requestBody.ticker,
        fromDate: requestBody.fromDate.toISOString(),
        toDate: requestBody.toDate.toISOString(),
        interval: requestBody.interval
      });
      
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
