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

const StrategyHeader = ({ 
  currentStrategyMeta, 
  currentStrategyId, 
  savedStrategies, 
  nodes, 
  edges, 
  onLoadStrategy, 
  onSaveStrategy, 
  onOpenLoadDialog, 
  onOpenTemplateDialog,
  loadSavedStrategies,
  setCurrentStrategyId,
  setCurrentStrategyMeta 
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
            await loadSavedStrategies(); // Refresh the dropdown
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
    <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-white">
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
                  <span className="text-xs text-gray-500 truncate w-full">
                    {strategy.description}
                  </span>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-2 py-4 text-sm text-gray-500 text-center">
              No saved strategies yet
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onOpenLoadDialog(true)}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Browse All Strategies
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenTemplateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Load Template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Right side - Action buttons */}
      <div className="flex items-center space-x-3">
        <Button 
          variant="outline" 
          onClick={onSaveStrategy}
          className="flex items-center space-x-2"
        >
          <Save className="h-4 w-4" />
          <span>Save</span>
        </Button>
        
        <Button 
          onClick={handleTestStrategy}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
        >
          <TrendingUp className="h-4 w-4" />
          <span>Test Strategy</span>
        </Button>
      </div>
    </div>
  );
};

export default StrategyHeader;