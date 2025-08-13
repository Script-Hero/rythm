import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "../../../components/ui/dropdown-menu";
import { ChevronDown, Save, FolderOpen, Plus, TrendingUp } from "lucide-react";
import { toast } from 'sonner';
import { apiService } from '../../../services/api';

/**
 * FlowControls - Handles save, load, clear, validation controls
 * Provides the top header with strategy management and testing functionality
 */
const FlowControls = ({ 
  currentStrategyMeta, 
  currentStrategyId, 
  savedStrategies, 
  nodes, 
  edges, 
  onLoadStrategy, 
  onSaveStrategy, 
  onLoadTemplate,
  onNewStrategy,
  setCurrentStrategyId,
  setCurrentStrategyMeta,
  refreshSavedStrategies 
}) => {
  const navigate = useNavigate();

  const handleTestStrategy = async () => {
    try {
      // Check if we have nodes to test
      if (nodes.length === 0) {
        toast.error('Please add some nodes to test your strategy');
        return;
      }

      let strategyId = currentStrategyId;

      // If strategy is not saved yet, prompt to save it first
      if (!strategyId) {
        if (window.confirm('Strategy needs to be saved before testing. Save now?')) {
          // Auto-save the strategy with a default name
          const defaultName = `Test Strategy ${new Date().toLocaleString()}`;
          const saveData = {
            name: defaultName,
            description: 'Auto-saved for testing',
            category: 'custom',
            tags: ['test'],
            nodes,
            edges,
          };

          try {
            const result = await apiService.saveStrategy(saveData);
            strategyId = result.id;
            setCurrentStrategyId(strategyId);
            setCurrentStrategyMeta({
              id: strategyId,
              name: defaultName,
              description: 'Auto-saved for testing',
              category: 'custom',
              tags: ['test'],
            });
            await refreshSavedStrategies(); // Refresh the dropdown
            toast.success('Strategy auto-saved for testing');
          } catch (error) {
            toast.error('Failed to save strategy: ' + error.message);
            return;
          }
        } else {
          return; // User cancelled
        }
      }

      // Navigate to backtest page with the strategy ID and type parameter
      navigate(`/backtest?strategy=${strategyId}&type=custom&autoRun=true`);
    } catch (error) {
      toast.error('Failed to test strategy: ' + error.message);
    }
  };

  return (
    <div className="flex justify-between items-center p-4 border-b border-gray-200">
      {/* Left side - Strategy dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto p-0 flex flex-col items-start text-left hover:bg-transparent">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">
                {currentStrategyMeta ? currentStrategyMeta.name : 'New Strategy'}
              </h2>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </div>
            <p className="text-sm text-gray-600">
              {currentStrategyMeta ? currentStrategyMeta.description : 'Build your custom strategy'}
            </p>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80">
          <DropdownMenuLabel>My Strategies</DropdownMenuLabel>
          {savedStrategies.length > 0 ? (
            savedStrategies.map((strategy) => (
              <DropdownMenuItem key={strategy.id} onClick={() => onLoadStrategy(strategy)}>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{strategy.name}</span>
                  <span className="text-xs text-gray-500">{strategy.description || 'No description'}</span>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>
              <span className="text-xs text-gray-400">No saved strategies yet</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Right side - Action buttons */}
      <div className="flex flex-row gap-2">
        <Button 
          onClick={onNewStrategy}
          variant="outline"
          className="font-medium px-4 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
        >
          <Plus size={18} />
          New
        </Button>

        <Button 
          onClick={onLoadTemplate}
          variant="outline"
          className="font-medium px-4 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
        >
          <FolderOpen size={18} />
          Templates
        </Button>

        <Button 
          onClick={onSaveStrategy}
          className="bg-black text-white font-medium px-6 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
        >
          <Save size={18} />
          Save
        </Button>

        {/* Test button */}
        <Button 
          onClick={handleTestStrategy}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-6 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
        >
          <TrendingUp size={18} />
          Test Strategy Performance
        </Button>
      </div>
    </div>
  );
};

export default FlowControls;