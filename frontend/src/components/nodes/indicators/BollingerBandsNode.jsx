import { useState, memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function BollingerBandsNode({ data, id }) {
  const [period, setPeriod] = useState(data.period || 20);
  const [deviation, setDeviation] = useState(data.deviation || 2);

  return (
    <div className="bg-green-100 border-2 border-green-300 rounded-lg p-3 min-w-36">
      <div className="font-semibold text-green-800 mb-2">Bollinger Bands</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Period</label>
          <input
            type="number"
            value={period}
            onChange={(e) => setPeriod(parseInt(e.target.value))}
            className="w-full px-2 py-1 text-xs border rounded"
            min="5"
            max="100"
          />
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Std Dev</label>
          <input
            type="number"
            value={deviation}
            onChange={(e) => setDeviation(parseFloat(e.target.value))}
            className="w-full px-2 py-1 text-xs border rounded"
            min="0.1"
            max="5"
            step="0.1"
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
        id="upper-out"
        className="w-4 h-4 bg-green-500 border-2 border-white"
        style={{ top: '25%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="middle-out"
        className="w-4 h-4 bg-green-500 border-2 border-white"
        style={{ top: '50%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="lower-out"
        className="w-4 h-4 bg-green-500 border-2 border-white"
        style={{ top: '75%' }}
      />
      
      <div className="absolute -right-12 top-4 text-xs text-gray-500">
        <div>Upper</div>
        <div>Middle</div>
        <div>Lower</div>
      </div>
    </div>
  );
}

export default memo(BollingerBandsNode);