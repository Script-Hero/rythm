import React from 'react';
import { Database, BarChart3, Settings, Zap, Hash } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { nodeTemplates } from '../config/nodeTemplates';

/**
 * NodePalette - Enhanced node palette/toolbar component
 * Provides organized access to all node types with drag-and-drop functionality
 */
const NodePalette = () => {
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

  const categoryLabels = {
    data: 'Data',
    indicators: 'Indicators',
    logic: 'Logic',
    actions: 'Actions',
    other: 'Other'
  };

  // Group nodes by category for better organization
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
    <div className="h-20 flex justify-center items-center bg-gray-100 border-t border-gray-300 flex-shrink-0">
      <div className="flex flex-row items-center justify-center gap-4 p-3">
        {Object.entries(groupedNodes).map(([category, nodes]) => (
          <Popover key={category}>
            <PopoverTrigger asChild>
              <button
                className={`${categoryColors[category]} text-white px-4 py-1 rounded-lg shadow-md transition-all duration-200 flex items-center gap-2 font-medium text-sm`}
              >
                {React.createElement(categoryIcons[category], { size: 16 })}
                <span>{categoryLabels[category]}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto max-w-4xl p-4" side="top">
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {nodes.map((node) => (
                  <div
                    key={node.type}
                    draggable
                    onDragStart={(event) => onDragStart(event, node)}
                    className={`${categoryColors[category].replace(' hover:bg-', ' bg-').replace('-600', '-500')} text-white px-3 py-2 rounded shadow cursor-move hover:opacity-80 text-sm whitespace-nowrap text-center transition-opacity duration-150 min-w-[100px]`}
                  >
                    {node.label}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
};

export default NodePalette;