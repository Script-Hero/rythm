import { toast } from 'sonner';
import { apiService } from '../../../services/api';

export const loadSavedStrategies = async (setSavedStrategies) => {
  try {
    const response = await apiService.listStrategies({ include_templates: false });
    console.log('Loaded saved strategies:', response.strategies);
    setSavedStrategies(response.strategies);
  } catch (error) {
    console.error('Failed to load saved strategies:', error);
    toast.error('Failed to load saved strategies');
  }
};

export const loadStrategyById = async (strategyId, onLoadStrategy) => {
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
};