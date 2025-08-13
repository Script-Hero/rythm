import { useState, memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function DivergenceNode({ data, id }) {
  const [lookbackPeriod, setLookbackPeriod] = useState(data.lookbackPeriod || 20);
  const [divergenceType, setDivergenceType] = useState(data.divergenceType || 'regular');
  const [sensitivity, setSensitivity] = useState(data.sensitivity || 0.5);

  return (
    <div className="bg-yellow-100 border-2 border-yellow-300 rounded-lg p-3 min-w-36">
      <div className="font-semibold text-yellow-800 mb-2">Divergence</div>
      <div className="text-xs text-gray-600 mb-2">Price vs Indicator</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Lookback</label>
          <input
            type="number"
            value={lookbackPeriod}
            onChange={(e) => setLookbackPeriod(parseInt(e.target.value))}
            className="w-full px-2 py-1 text-xs border rounded"
            min="5"
            max="100"
          />
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Type</label>
          <select
            value={divergenceType}
            onChange={(e) => setDivergenceType(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            <option value="regular">Regular</option>
            <option value="hidden">Hidden</option>
            <option value="both">Both</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Sensitivity</label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={sensitivity}
            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            className="w-full"
          />
          <span className="text-xs text-gray-500">{sensitivity}</span>
        </div>
      </div>
      
      <Handle
        type="target"
        position={Position.Left}
        id="price-in"
        className="w-3 h-3 bg-blue-500"
        style={{ top: '30%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="indicator-in"
        className="w-3 h-3 bg-green-500"
        style={{ top: '70%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="bullish-div-out"
        className="w-3 h-3 bg-green-500"
        style={{ top: '40%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="bearish-div-out"
        className="w-3 h-3 bg-red-500"
        style={{ top: '60%' }}
      />
    </div>
  );
}

export default memo(DivergenceNode);