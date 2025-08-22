import { useState, memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function StochasticNode({ data, id, updateNodeData }) {
  const [kPeriod, setKPeriod] = useState(data.kPeriod || 14);
  const [dPeriod, setDPeriod] = useState(data.dPeriod || 3);
  const [smooth, setSmooth] = useState(data.smooth || 3);

  const handleKPeriodChange = (value) => {
    setKPeriod(value);
    updateNodeData?.(id, { kPeriod: value });
  };

  const handleDPeriodChange = (value) => {
    setDPeriod(value);
    updateNodeData?.(id, { dPeriod: value });
  };

  const handleSmoothChange = (value) => {
    setSmooth(value);
    updateNodeData?.(id, { smooth: value });
  };

  return (
    <div className="bg-green-100 border-2 border-green-300 rounded-lg p-3 min-w-36">
      <div className="font-semibold text-green-800 mb-2">Stochastic</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">%K Period</label>
          <input
            type="number"
            value={kPeriod}
            onChange={(e) => handleKPeriodChange(parseInt(e.target.value))}
            className="w-full px-2 py-1 text-xs border rounded"
            min="1"
            max="50"
          />
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">%D Period</label>
          <input
            type="number"
            value={dPeriod}
            onChange={(e) => handleDPeriodChange(parseInt(e.target.value))}
            className="w-full px-2 py-1 text-xs border rounded"
            min="1"
            max="20"
          />
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Smooth</label>
          <input
            type="number"
            value={smooth}
            onChange={(e) => handleSmoothChange(parseInt(e.target.value))}
            className="w-full px-2 py-1 text-xs border rounded"
            min="1"
            max="10"
          />
        </div>
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
        id="k-out"
        className="w-4 h-4 bg-green-500 border-2 border-white"
        style={{ top: '40%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="d-out"
        className="w-4 h-4 bg-green-500 border-2 border-white"
        style={{ top: '60%' }}
      />
      
      <div className="absolute -right-8 top-8 text-xs text-gray-500">
        <div>%K</div>
        <div>%D</div>
      </div>
    </div>
  );
}

export default memo(StochasticNode);