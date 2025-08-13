import React, { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { SaveStrategyDialog } from '../../components/strategies/SaveStrategyDialog';
import { TemplateBrowserDialog } from '../../components/strategies/TemplateBrowserDialog';
import { useFlowConfig } from './hooks/useFlowConfig';
import { useStrategyStateManager } from './components/StrategyStateManager';
import { STRATEGY_TEMPLATES } from './complex-templates';
import { BASIC_STRATEGY_TEMPLATES } from './basic-templates';

// New Components
import FlowControls from './components/FlowControls';
import FlowCanvas from './components/FlowCanvas';
import NodePalette from './components/NodePalette';





function InnerPage() {
  const [contextMenu, setContextMenu] = useState(null);

  // Initialize flow configuration hook
  const {
    nodes,
    edges,
    flowConfig,
    setFlowConfig,
    onNodesChange,
    onEdgesChange,
    onConnect,
    nodeTypesWithData,
    loadFlow,
    addNode,
  } = useFlowConfig();

  // Initialize strategy state management
  const {
    currentStrategyId,
    currentStrategyMeta,
    savedStrategies,
    saveDialogOpen,
    templateDialogOpen,
    setCurrentStrategyId,
    setCurrentStrategyMeta,
    setSaveDialogOpen,
    setTemplateDialogOpen,
    onLoadStrategy: originalOnLoadStrategy,
    onLoadTemplate: originalOnLoadTemplate,
    handleNewStrategy: originalHandleNewStrategy,
    handleSaveStrategy,
    handleLoadTemplate,
    refreshSavedStrategies,
    preprocessFlowConfig,
  } = useStrategyStateManager();

  // Debug logging for flow config changes
  useEffect(() => {
    console.log(preprocessFlowConfig(flowConfig));
  }, [flowConfig, preprocessFlowConfig]);

  // Wrap strategy actions to integrate with flow management
  const onLoadStrategy = async (strategy) => {
    const strategyData = await originalOnLoadStrategy(strategy);
    if (strategyData) {
      loadFlow(strategyData);
    }
  };

  const onLoadTemplate = (templateKey, isComplex) => {
    const templateData = originalOnLoadTemplate(templateKey, isComplex);
    if (templateData) {
      loadFlow(templateData);
    }
  };

  const handleNewStrategy = () => {
    const newStrategyData = originalHandleNewStrategy();
    loadFlow(newStrategyData);
  };


  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Flow Controls - Top header with strategy management */}
      <FlowControls
        currentStrategyMeta={currentStrategyMeta}
        currentStrategyId={currentStrategyId}
        savedStrategies={savedStrategies}
        nodes={nodes}
        edges={edges}
        onLoadStrategy={onLoadStrategy}
        onSaveStrategy={handleSaveStrategy}
        onLoadTemplate={handleLoadTemplate}
        onNewStrategy={handleNewStrategy}
        setCurrentStrategyId={setCurrentStrategyId}
        setCurrentStrategyMeta={setCurrentStrategyMeta}
        refreshSavedStrategies={refreshSavedStrategies}
      />
      
      {/* Flow Canvas - Main ReactFlow area */}
      <FlowCanvas
        nodes={nodes}
        edges={edges}
        nodeTypesWithData={nodeTypesWithData}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        addNode={addNode}
        updateFlowConfig={setFlowConfig}
      />
      
      {/* Node Palette - Bottom toolbar with drag-and-drop nodes */}
      <NodePalette />

      {/* Strategy Management Dialogs */}
      <SaveStrategyDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        nodes={nodes}
        edges={edges}
        existingStrategy={currentStrategyMeta}
        setCurrentStrategyId={setCurrentStrategyId}
        setCurrentStrategyMeta={setCurrentStrategyMeta}
        onSaved={refreshSavedStrategies}
      />

      <TemplateBrowserDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        basicTemplates={BASIC_STRATEGY_TEMPLATES}
        complexTemplates={STRATEGY_TEMPLATES}
        onLoadTemplate={onLoadTemplate}
      />
    </div>
  );
}

export default function BuildAlgorithmPage() {
  return (
    <div className="h-full w-full overflow-hidden">
      <ReactFlowProvider>
        <InnerPage />
      </ReactFlowProvider>
    </div>
  );
}
