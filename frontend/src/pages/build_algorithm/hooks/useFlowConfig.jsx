import React, { useState, useCallback, useMemo } from 'react';
import { applyEdgeChanges, applyNodeChanges, addEdge } from '@xyflow/react';
import { nodeTypes } from '../config/nodeTypes';

export const useFlowConfig = (initialConfig = { nodes: [], edges: [] }) => {
  const [flowConfig, setFlowConfig] = useState(initialConfig);
  const { nodes, edges } = flowConfig;

  const onNodesChange = useCallback(
    (changes) => setFlowConfig((cfg) => ({
      ...cfg,
      nodes: applyNodeChanges(changes, cfg.nodes),
    })),
    []
  );

  const onEdgesChange = useCallback(
    (changes) => setFlowConfig((cfg) => ({
      ...cfg,
      edges: applyEdgeChanges(changes, cfg.edges),
    })),
    []
  );

  const onConnect = useCallback(
    (connection) => setFlowConfig((cfg) => ({
      ...cfg,
      edges: addEdge(connection, cfg.edges),
    })),
    []
  );

  const updateNodeData = useCallback((nodeId, newData) => {
    setFlowConfig((cfg) => ({
      ...cfg,
      nodes: cfg.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node
      ),
    }));
  }, []);

  // Create nodeTypes with updateNodeData injected - memoized to prevent recreating on every render
  const nodeTypesWithData = useMemo(() => {
    const typesWithData = {};
    Object.entries(nodeTypes).forEach(([key, Component]) => {
      typesWithData[key] = (props) => (<Component {...props} updateNodeData={updateNodeData} />);
    });
    return typesWithData;
  }, [updateNodeData]);

  const resetFlow = useCallback(() => {
    setFlowConfig({ nodes: [], edges: [] });
  }, []);

  const loadFlow = useCallback((config) => {
    setFlowConfig(config);
  }, []);

  const addNode = useCallback((newNode) => {
    setFlowConfig((cfg) => ({
      ...cfg,
      nodes: [...cfg.nodes, newNode],
    }));
  }, []);

  return {
    nodes,
    edges,
    flowConfig,
    setFlowConfig,
    onNodesChange,
    onEdgesChange,
    onConnect,
    updateNodeData,
    nodeTypesWithData,
    resetFlow,
    loadFlow,
    addNode,
  };
};