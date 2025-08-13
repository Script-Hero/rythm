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
  console.log('🔄 loadStrategyById called with ID:', strategyId, typeof strategyId);
  
  if (!strategyId || strategyId === 'undefined') {
    console.error('❌ Invalid strategy ID provided:', strategyId);
    toast.error('Invalid strategy ID');
    return;
  }
  
  try {
    console.log('📡 Calling getStrategy API with ID:', strategyId);
    const strategy = await apiService.getStrategy(strategyId);
    console.log('📦 getStrategy response:', strategy);
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