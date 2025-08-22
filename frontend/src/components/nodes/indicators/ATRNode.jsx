import { useState, memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function ATRNode({ data, id, updateNodeData }) {
  const [period, setPeriod] = useState(data.period || 14);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    updateNodeData?.(id, { period: newPeriod });
  };

  return (
    <div className="bg-green-100 border-2 border-green-300 rounded-lg p-3 min-w-32">
      <div className="font-semibold text-green-800 mb-2">ATR</div>
      <div className="text-xs text-gray-600 mb-2">Average True Range</div>
      
      <div>
        <label className="text-xs text-gray-600 block">Period</label>
        <input
          type="number"
          value={period}
          onChange={(e) => handlePeriodChange(parseInt(e.target.value))}
          className="w-full px-2 py-1 text-xs border rounded"
          min="2"
          max="50"
        />
      </div>
      
      <Handle
        type="target"
        position={Position.Left}
        id="price-in"
        className="w-3 h-3 bg-blue-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="atr-out"
        className="w-3 h-3 bg-green-500"
      />
    </div>
  );
}

export default memo(ATRNode);