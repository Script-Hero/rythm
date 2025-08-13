import { useState, memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function EMANode({ data, id }) {
  const [period, setPeriod] = useState(data.period || 12);

  return (
    <div className="bg-green-100 border-2 border-green-300 rounded-lg p-3 min-w-32">
      <div className="font-semibold text-green-800 mb-2">EMA</div>
      
      <div>
        <label className="text-xs text-gray-600 block">Period</label>
        <input
          type="number"
          value={period}
          onChange={(e) => setPeriod(parseInt(e.target.value))}
          className="w-full px-2 py-1 text-xs border rounded"
          min="1"
          max="200"
        />
      </div>
      
      <Handle
        type="target"
        position={Position.Left}
        id="price-in"
        className="w-4 h-4 bg-blue-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="ema-out"
        className="w-4 h-4 bg-green-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(EMANode);