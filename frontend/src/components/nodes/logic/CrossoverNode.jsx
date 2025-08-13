import { useState, memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function CrossoverNode({ data, id }) {
  const [crossType, setCrossType] = useState(data.crossType || 'above');

  return (
    <div className="bg-purple-100 border-2 border-purple-300 rounded-lg p-3 min-w-36">
      <div className="font-semibold text-purple-800 mb-2">Crossover</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Cross Type</label>
          <select
            value={crossType}
            onChange={(e) => setCrossType(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            <option value="above">Cross Above</option>
            <option value="below">Cross Below</option>
            <option value="any">Any Cross</option>
          </select>
        </div>
      </div>
      
      <div className="text-xs text-gray-600 mt-2">
        Fast line {crossType === 'above' ? '↗' : crossType === 'below' ? '↘' : '↕'} Slow line
      </div>
      
      {/* Input handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="fast-in"
        className="w-3 h-3 bg-green-500"
        style={{ top: '30%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="slow-in"
        className="w-3 h-3 bg-green-500"
        style={{ top: '70%' }}
      />
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="cross-out"
        className="w-3 h-3 bg-red-500"
      />
      
      {/* Labels for inputs */}
      <div className="absolute -left-8 top-6 text-xs text-gray-500">Fast</div>
      <div className="absolute -left-8 bottom-6 text-xs text-gray-500">Slow</div>
    </div>
  );
}

export default memo(CrossoverNode);