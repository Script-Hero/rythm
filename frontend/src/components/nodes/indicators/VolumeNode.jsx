import { useState, memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function VolumeNode({ data, id }) {
  const [volumeType, setVolumeType] = useState(data.volumeType || 'raw');
  const [period, setPeriod] = useState(data.period || 20);

  return (
    <div className="bg-green-100 border-2 border-green-300 rounded-lg p-3 min-w-36">
      <div className="font-semibold text-green-800 mb-2">Volume</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Type</label>
          <select
            value={volumeType}
            onChange={(e) => setVolumeType(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            <option value="raw">Raw Volume</option>
            <option value="sma">Volume SMA</option>
            <option value="ratio">Volume Ratio</option>
            <option value="weighted">VWAP</option>
          </select>
        </div>
        
        {(volumeType === 'sma' || volumeType === 'ratio' || volumeType === 'weighted') && (
          <div>
            <label className="text-xs text-gray-600 block">Period</label>
            <input
              type="number"
              value={period}
              onChange={(e) => setPeriod(parseInt(e.target.value))}
              className="w-full px-2 py-1 text-xs border rounded"
              min="1"
              max="100"
            />
          </div>
        )}
      </div>
      
      <Handle
        type="target"
        position={Position.Left}
        id="data-in"
        className="w-4 h-4 bg-blue-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="volume-out"
        className="w-4 h-4 bg-green-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(VolumeNode);