import { useState, memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function StopLossNode({ data, id }) {
  const [stopType, setStopType] = useState(data.stopType || 'fixed_percent');
  const [stopValue, setStopValue] = useState(data.stopValue || 2);
  const [trailingEnabled, setTrailingEnabled] = useState(data.trailingEnabled || false);
  const [trailingDistance, setTrailingDistance] = useState(data.trailingDistance || 1);

  return (
    <div className="bg-red-100 border-2 border-red-300 rounded-lg p-3 min-w-36">
      <div className="font-semibold text-red-800 mb-2">Stop Loss</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Type</label>
          <select
            value={stopType}
            onChange={(e) => setStopType(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            <option value="fixed_percent">Fixed %</option>
            <option value="fixed_amount">Fixed $</option>
            <option value="atr_multiple">ATR Multiple</option>
            <option value="support_resistance">S/R Level</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">
            Value {stopType === 'fixed_percent' ? '(%)' : stopType === 'atr_multiple' ? '(x)' : '($)'}
          </label>
          <input
            type="number"
            value={stopValue}
            onChange={(e) => setStopValue(parseFloat(e.target.value))}
            className="w-full px-2 py-1 text-xs border rounded"
            step="0.1"
            min="0.1"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={trailingEnabled}
            onChange={(e) => setTrailingEnabled(e.target.checked)}
            className="w-3 h-3"
          />
          <label className="text-xs text-gray-600">Trailing Stop</label>
        </div>
        
        {trailingEnabled && (
          <div>
            <label className="text-xs text-gray-600 block">Trail Distance (%)</label>
            <input
              type="number"
              value={trailingDistance}
              onChange={(e) => setTrailingDistance(parseFloat(e.target.value))}
              className="w-full px-2 py-1 text-xs border rounded"
              step="0.1"
              min="0.1"
            />
          </div>
        )}
      </div>
      
      <Handle
        type="target"
        position={Position.Left}
        id="trigger-in"
        className="w-3 h-3 bg-orange-500"
        style={{ top: '20%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="price-in"
        className="w-3 h-3 bg-blue-500"
        style={{ top: '50%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="atr-in"
        className="w-3 h-3 bg-green-500"
        style={{ top: '80%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="stop-triggered"
        className="w-3 h-3 bg-red-500"
      />
    </div>
  );
}

export default memo(StopLossNode);