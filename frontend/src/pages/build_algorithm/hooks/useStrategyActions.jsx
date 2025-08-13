import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiService } from '../../../services/api';

export const useStrategyActions = (flowConfig, loadFlow) => {
  const [savedStrategies, setSavedStrategies] = useState([]);
  const [currentStrategyId, setCurrentStrategyId] = useState(null);
  const [currentStrategyMeta, setCurrentStrategyMeta] = useState(null);

  const loadSavedStrategies = useCallback(async () => {
    try {
      const response = await apiService.listStrategies({ include_templates: false });
      console.log('Loaded saved strategies:', response.strategies);
      setSavedStrategies(response.strategies);
    } catch (error) {
      console.error('Failed to load saved strategies:', error);
      toast.error('Failed to load saved strategies');
    }
  }, []);

  const loadStrategyById = useCallback(async (strategyId) => {
    try {
      const strategy = await apiService.getStrategy(strategyId);
      if (strategy) {
        onLoadStrategy(strategy);
      } else {
        toast.error('Strategy not found');
      }
    } catch (error) {
      toast.error('Failed to load strategy');
      console.error('Failed to load strategy:', error);
    }
  }, []);

  const onLoadStrategy = useCallback((strategy) => {
    try {
      // Parse the strategy configuration
      const config = typeof strategy.configuration === 'string' 
        ? JSON.parse(strategy.configuration) 
        : strategy.configuration;

      if (config && config.nodes && config.edges) {
        loadFlow({
          nodes: config.nodes,
          edges: config.edges,
        });
        
        setCurrentStrategyId(strategy.id);
        setCurrentStrategyMeta({
          name: strategy.name,
          description: strategy.description,
          created_at: strategy.created_at,
          updated_at: strategy.updated_at,
        });
        
        toast.success(`Strategy "${strategy.name}" loaded successfully`);
      } else {
        toast.error('Invalid strategy format');
      }
    } catch (error) {
      console.error('Error loading strategy:', error);
      toast.error('Failed to load strategy');
    }
  }, [loadFlow]);

  const onSaveStrategy = useCallback(async (strategyData) => {
    try {
      const payload = {
        name: strategyData.name,
        description: strategyData.description,
        configuration: JSON.stringify(flowConfig),
        tags: strategyData.tags || [],
      };

      let response;
      if (currentStrategyId) {
        // Update existing strategy
        response = await apiService.updateStrategy(currentStrategyId, payload);
        toast.success('Strategy updated successfully');
      } else {
        // Create new strategy
        response = await apiService.saveStrategy(payload);
        setCurrentStrategyId(response.id);
        toast.success('Strategy saved successfully');
      }

      setCurrentStrategyMeta({
        name: payload.name,
        description: payload.description,
        created_at: response.created_at || new Date().toISOString(),
        updated_at: response.updated_at || new Date().toISOString(),
      });

      // Refresh the list of saved strategies
      await loadSavedStrategies();
      
      return response;
    } catch (error) {
      console.error('Error saving strategy:', error);
      toast.error('Failed to save strategy');
      throw error;
    }
  }, [flowConfig, currentStrategyId, loadSavedStrategies]);

  const resetStrategy = useCallback(() => {
    setCurrentStrategyId(null);
    setCurrentStrategyMeta(null);
  }, []);

  const testStrategy = useCallback(async () => {
    try {
      if (!flowConfig.nodes || !flowConfig.edges) {
        toast.error('No strategy to test');
        return;
      }

      const testResult = await apiService.testStrategy({
        configuration: JSON.stringify(flowConfig),
      });
      
      toast.success('Strategy test completed');
      return testResult;
    } catch (error) {
      console.error('Error testing strategy:', error);
      toast.error('Failed to test strategy');
      throw error;
    }
  }, [flowConfig]);

  return {
    savedStrategies,
    currentStrategyId,
    currentStrategyMeta,
    setCurrentStrategyId,
    setCurrentStrategyMeta,
    loadSavedStrategies,
    loadStrategyById,
    onLoadStrategy,
    onSaveStrategy,
    resetStrategy,
    testStrategy,
  };
};