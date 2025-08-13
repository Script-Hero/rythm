/**
 * Preprocess flow configuration for backend processing
 * Converts ReactFlow format to a more structured format with explicit inputs/outputs
 */
export const preprocessFlowConfig = (flowConfig) => {
  const { nodes, edges } = flowConfig;
  
  // Create a map of nodes for easy lookup
  const nodeMap = {};
  
  // Initialize nodes with empty inputs/outputs
  nodes.forEach(node => {
    nodeMap[node.id] = {
      id: node.id,
      type: node.type,
      data: node.data,
      position: node.position,
      inputs: [],
      outputs: []
    };
  });
  
  // Process edges to populate inputs/outputs
  edges.forEach(edge => {
    const { id, source, target, sourceHandle, targetHandle } = edge;
    
    // Construct meaningful names for the connections
    const outputName = sourceHandle || 'output';
    const inputName = targetHandle || 'input';
    
    // Add to source outputs
    if (nodeMap[source]) {
      nodeMap[source].outputs.push({ id, to: target, name: outputName });
    }
    // Add to target inputs
    if (nodeMap[target]) {
      nodeMap[target].inputs.push({ id, from: source, name: inputName });
    }
  });

  // Return as an array of node instances
  return Object.values(nodeMap);
};

/**
 * Validate flow configuration
 * Returns validation errors if any
 */
export const validateFlowConfig = (flowConfig) => {
  const errors = [];
  const { nodes, edges } = flowConfig;
  
  if (!nodes || nodes.length === 0) {
    errors.push('Strategy must contain at least one node');
    return errors;
  }
  
  // Check for isolated nodes (no connections)
  const connectedNodes = new Set();
  edges.forEach(edge => {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  });
  
  const isolatedNodes = nodes.filter(node => !connectedNodes.has(node.id));
  if (isolatedNodes.length > 0 && nodes.length > 1) {
    errors.push(`Found ${isolatedNodes.length} isolated node(s): ${isolatedNodes.map(n => n.data?.label || n.type).join(', ')}`);
  }
  
  // Check for required action nodes
  const actionNodes = nodes.filter(node => 
    ['buyNode', 'sellNode', 'holdNode'].includes(node.type)
  );
  
  if (actionNodes.length === 0) {
    errors.push('Strategy must contain at least one action node (Buy, Sell, or Hold)');
  }
  
  return errors;
};

/**
 * Get flow statistics
 */
export const getFlowStats = (flowConfig) => {
  const { nodes, edges } = flowConfig;
  
  const nodeTypeCount = {};
  nodes.forEach(node => {
    nodeTypeCount[node.type] = (nodeTypeCount[node.type] || 0) + 1;
  });
  
  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    nodeTypeCount,
    complexity: nodes.length + edges.length,
  };
};