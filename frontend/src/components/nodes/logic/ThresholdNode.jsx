import { useState, memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function ThresholdNode({ data, id, updateNodeData }) {
  const [upperThreshold, setUpperThreshold] = useState(data.upperThreshold || 70);
  const [lowerThreshold, setLowerThreshold] = useState(data.lowerThreshold || 30);
  const [hysteresis, setHysteresis] = useState(data.hysteresis || 5);

  const handleUpperThresholdChange = (value) => {
    setUpperThreshold(value);
    updateNodeData?.(id, { upperThreshold: value });
  };

  const handleLowerThresholdChange = (value) => {
    setLowerThreshold(value);
    updateNodeData?.(id, { lowerThreshold: value });
  };

  const handleHysteresisChange = (value) => {
    setHysteresis(value);
    updateNodeData?.(id, { hysteresis: value });
  };

  return (
    <div className="bg-yellow-100 border-2 border-yellow-300 rounded-lg p-3 min-w-36">
      <div className="font-semibold text-yellow-800 mb-2">Threshold Filter</div>
      <div className="text-xs text-gray-600 mb-2">Prevents false signals</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Upper</label>
          <input
            type="number"
            value={upperThreshold}
            onChange={(e) => handleUpperThresholdChange(parseFloat(e.target.value))}
            className="w-full px-2 py-1 text-xs border rounded"
            step="0.1"
          />
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Lower</label>
          <input
            type="number"
            value={lowerThreshold}
            onChange={(e) => handleLowerThresholdChange(parseFloat(e.target.value))}
            className="w-full px-2 py-1 text-xs border rounded"
            step="0.1"
          />
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Hysteresis</label>
          <input
            type="number"
            value={hysteresis}
            onChange={(e) => handleHysteresisChange(parseFloat(e.target.value))}
            className="w-full px-2 py-1 text-xs border rounded"
            step="0.1"
            min="0"
          />
        </div>
      </div>
      
      <Handle
        type="target"
        position={Position.Left}
        id="value-in"
        className="w-3 h-3 bg-blue-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="overbought-out"
        className="w-3 h-3 bg-red-500"
        style={{ top: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="oversold-out"
        className="w-3 h-3 bg-green-500"
        style={{ top: '70%' }}
      />
    </div>
  );
}

export default memo(ThresholdNode);