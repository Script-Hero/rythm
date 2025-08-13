import React from 'react';
import { Database, BarChart3, Settings, Zap, Hash } from "lucide-react";
import { nodeTemplates, nodeCategories } from '../config/nodeTemplates';

const NodeToolbar = () => {
  const categoryIcons = {
    data: Database,
    indicators: BarChart3,
    logic: Settings,
    actions: Zap,
    other: Hash
  };

  const categoryColors = {
    data: 'bg-blue-500 hover:bg-blue-600',
    indicators: 'bg-green-500 hover:bg-green-600', 
    logic: 'bg-yellow-500 hover:bg-yellow-600',
    actions: 'bg-red-500 hover:bg-red-600',
    other: 'bg-gray-600 hover:bg-gray-700'
  };

  // Group nodes by category
  const groupedNodes = nodeTemplates.reduce((acc, node) => {
    if (!acc[node.category]) acc[node.category] = [];
    acc[node.category].push(node);
    return acc;
  }, {});

  const onDragStart = (event, nodeData) => {
    event.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({
        type: nodeData.type,
        data: {},
      })
    );
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto z-50">
      <div className="p-2">
        <div className="text-xs font-semibold text-gray-600 mb-2">Node Library</div>
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(groupedNodes).map(([category, nodes]) => {
            const IconComponent = categoryIcons[category];
            const colorClass = categoryColors[category];
            
            return (
              <div key={category} className="space-y-1">
                <div className="text-xs font-medium text-gray-700 capitalize text-center">
                  {category}
                </div>
                {nodes.map((nodeTemplate) => (
                  <div
                    key={nodeTemplate.type}
                    className={`${colorClass} text-white px-2 py-1 rounded text-xs cursor-move transition-colors duration-200 text-center`}
                    draggable
                    onDragStart={(event) => onDragStart(event, nodeTemplate)}
                    title={nodeTemplate.label}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <IconComponent size={12} />
                      <span className="truncate">{nodeTemplate.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NodeToolbar;