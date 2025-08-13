import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { apiService } from '../../../services/api';
import { loadSavedStrategies, loadStrategyById } from '../utils/strategyActions';
import { STRATEGY_TEMPLATES } from '../complex-templates';
import { BASIC_STRATEGY_TEMPLATES } from '../basic-templates';

/**
 * StrategyStateManager - Manages all strategy-related state and operations
 * This component encapsulates strategy loading, saving, template management, and metadata
 */
export const useStrategyStateManager = () => {
  const [currentStrategyId, setCurrentStrategyId] = useState(null);
  const [currentStrategyMeta, setCurrentStrategyMeta] = useState(null);
  const [savedStrategies, setSavedStrategies] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState('rsi');
  
  // Dialog states
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  
  const [searchParams] = useSearchParams();

  // Load saved strategies and handle URL parameters on mount
  useEffect(() => {
    loadSavedStrategies(setSavedStrategies);
    const loadParam = searchParams.get('load');
    if (loadParam) {
      loadStrategyById(loadParam, onLoadStrategy);
    }
  }, [searchParams]);

  const onLoadStrategy = useCallback(async (strategy) => {
    console.log('Loading strategy:', strategy);
    try {
      let fullStrategy = strategy;
      if (!strategy.json_tree) {
        fullStrategy = await apiService.getStrategy(strategy.id);
      }
      
      const strategyData = {
        nodes: fullStrategy.json_tree?.nodes || [],
        edges: fullStrategy.json_tree?.edges || [],
      };
      
      setCurrentStrategyId(fullStrategy.id);
      setCurrentStrategyMeta({
        id: fullStrategy.id,
        name: fullStrategy.name,
        description: fullStrategy.description,
        category: fullStrategy.category,
        tags: fullStrategy.tags,
      });
      
      toast.success(`Loaded strategy: ${fullStrategy.name}`);
      return strategyData;
    } catch (error) {
      console.error('Error loading strategy:', error);
      toast.error('Failed to load strategy');
      return null;
    }
  }, []);

  const onLoadTemplate = useCallback((templateKey, isComplex) => {
    const template = isComplex ? STRATEGY_TEMPLATES[templateKey] : BASIC_STRATEGY_TEMPLATES[templateKey];
    if (template) {
      const templateData = {
        nodes: template.initialNodes,
        edges: template.initialEdges,
      };
      
      setCurrentStrategyId(null);
      setCurrentStrategyMeta(null);
      setSelectedStrategy(templateKey);
      
      return templateData;
    }
    return null;
  }, []);

  const handleNewStrategy = useCallback(() => {
    setCurrentStrategyId(null);
    setCurrentStrategyMeta(null);
    toast.success('Started new strategy');
    
    return {
      nodes: [],
      edges: [],
    };
  }, []);

  const handleSaveStrategy = useCallback(() => {
    setSaveDialogOpen(true);
  }, []);

  const handleLoadTemplate = useCallback(() => {
    setTemplateDialogOpen(true);
  }, []);

  const handleLoadDialog = useCallback(() => {
    setLoadDialogOpen(true);
  }, []);

  const refreshSavedStrategies = useCallback(() => {
    return loadSavedStrategies(setSavedStrategies);
  }, []);

  const preprocessFlowConfig = useCallback((flowConfig) => {
    const { nodes, edges } = flowConfig;

    // Initialize each node with empty inputs and outputs
    const nodeMap = nodes.reduce((acc, { id, type, data, position }) => {
      acc[id] = { id, type, data, position, inputs: [], outputs: [] };
      return acc;
    }, {});

    // Populate inputs and outputs based on edges
    edges.forEach(({ id, source, target, sourceHandle, targetHandle }) => {
      const outputName = sourceHandle || `${source}-out`;
      const inputName = targetHandle || `${target}-in`;

      if (nodeMap[source]) {
        nodeMap[source].outputs.push({ id, to: target, name: outputName });
      }
      if (nodeMap[target]) {
        nodeMap[target].inputs.push({ id, from: source, name: inputName });
      }
    });

    return Object.values(nodeMap);
  }, []);

  return {
    // State
    currentStrategyId,
    currentStrategyMeta,
    savedStrategies,
    selectedStrategy,
    saveDialogOpen,
    loadDialogOpen,
    templateDialogOpen,
    
    // Setters
    setCurrentStrategyId,
    setCurrentStrategyMeta,
    setSaveDialogOpen,
    setLoadDialogOpen,
    setTemplateDialogOpen,
    
    // Actions
    onLoadStrategy,
    onLoadTemplate,
    handleNewStrategy,
    handleSaveStrategy,
    handleLoadTemplate,
    handleLoadDialog,
    refreshSavedStrategies,
    preprocessFlowConfig,
  };
};