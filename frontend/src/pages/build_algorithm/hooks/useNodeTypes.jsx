import React, { useMemo } from 'react';
import { nodeTypes } from '../config/nodeTypes';

export const useNodeTypes = (updateNodeData) => {
  // Create nodeTypes with updateNodeData injected - memoized to prevent recreating on every render
  const nodeTypesWithData = useMemo(() => {
    const typesWithData = {};
    Object.entries(nodeTypes).forEach(([key, Component]) => {
      typesWithData[key] = (props) => <Component {...props} updateNodeData={updateNodeData} />;
    });
    return typesWithData;
  }, [updateNodeData]);

  return nodeTypesWithData;
};