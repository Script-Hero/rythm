import React, { useCallback, useRef } from 'react';
import { useReactFlow, ReactFlow, Background, Controls } from '@xyflow/react';
import { NodeContextMenu } from '../../../components/strategies/NodeContextMenu';
import { toast } from 'sonner';

const FlowCanvas = ({ 
  nodes, 
  edges, 
  nodeTypesWithData, 
  onNodesChange, 
  onEdgesChange, 
  onConnect,
  contextMenu,
  setContextMenu,
  addNode,
  updateFlowConfig 
}) => {
  const reactFlowWrapper = useRef(null);
  const { screenToFlowPosition, project } = useReactFlow();

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const nodeData = JSON.parse(event.dataTransfer.getData('application/reactflow'));
      if (!nodeData) return;

      const position = screenToFlowPosition
        ? screenToFlowPosition({ x: event.clientX, y: event.clientY })
        : project({ x: event.clientX, y: event.clientY });

      const newNode = {
        id: crypto.randomUUID(),
        type: nodeData.type,
        position,
        data: { ...nodeData.data },
      };

      addNode(newNode);
    }, 
    [screenToFlowPosition, project, addNode]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();
      setContextMenu({
        nodeId: node.id,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [setContextMenu]
  );

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, [setContextMenu]);

  const onEdgeClick = useCallback((event, edge) => {
    event.preventDefault();
    // Delete the clicked edge
    updateFlowConfig(cfg => ({
      ...cfg,
      edges: cfg.edges.filter(e => e.id !== edge.id),
    }));
    toast.success('Edge deleted');
  }, [updateFlowConfig]);

  const handleCopyNode = useCallback((nodeId) => {
    const nodeToCopy = nodes.find(node => node.id === nodeId);
    if (nodeToCopy) {
      const newNode = {
        ...nodeToCopy,
        id: `${nodeToCopy.type}-${Date.now()}`,
        position: {
          x: nodeToCopy.position.x + 50,
          y: nodeToCopy.position.y + 50,
        },
      };
      
      addNode(newNode);
      toast.success('Node copied');
    }
  }, [nodes, addNode]);

  const handleDeleteNode = useCallback((nodeId) => {
    // Remove the node and any connected edges
    updateFlowConfig(cfg => ({
      nodes: cfg.nodes.filter(node => node.id !== nodeId),
      edges: cfg.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId),
    }));
    
    toast.success('Node deleted');
  }, [updateFlowConfig]);

  return (
    <div 
      className="flex-1 overflow-hidden relative"
      onClick={() => setContextMenu(null)} // Close context menu on click
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypesWithData}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView
        className="w-full h-full"
        deleteKeyCode={46} // Enable delete key for nodes
        multiSelectionKeyCode={17} // Enable Ctrl for multi-selection
      >
        <Background />
        <Controls />
      </ReactFlow>
      
      {/* Context Menu */}
      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onCopyNode={handleCopyNode}
          onDeleteNode={handleDeleteNode}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

export default FlowCanvas;