import { useState, memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function PositionSizeNode({ data, id, updateNodeData }) {
  const [sizingMethod, setSizingMethod] = useState(data.sizingMethod || 'fixed_percent');
  const [riskPercent, setRiskPercent] = useState(data.riskPercent || 2);
  const [maxPosition, setMaxPosition] = useState(data.maxPosition || 10000);
  const [kellyEnabled, setKellyEnabled] = useState(data.kellyEnabled || false);
  const [kellyFraction, setKellyFraction] = useState(data.kellyFraction || 0.25);

  const handleSizingMethodChange = (value) => {
    setSizingMethod(value);
    updateNodeData?.(id, { sizingMethod: value });
  };

  const handleRiskPercentChange = (value) => {
    setRiskPercent(value);
    updateNodeData?.(id, { riskPercent: value });
  };

  const handleMaxPositionChange = (value) => {
    setMaxPosition(value);
    updateNodeData?.(id, { maxPosition: value });
  };

  const handleKellyEnabledChange = (value) => {
    setKellyEnabled(value);
    updateNodeData?.(id, { kellyEnabled: value });
  };

  const handleKellyFractionChange = (value) => {
    setKellyFraction(value);
    updateNodeData?.(id, { kellyFraction: value });
  };

  return (
    <div className="bg-purple-100 border-2 border-purple-300 rounded-lg p-3 min-w-36">
      <div className="font-semibold text-purple-800 mb-2">Position Size</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Method</label>
          <select
            value={sizingMethod}
            onChange={(e) => handleSizingMethodChange(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            <option value="fixed_percent">Fixed % Risk</option>
            <option value="fixed_amount">Fixed Amount</option>
            <option value="volatility_adjusted">Volatility Adj.</option>
            <option value="kelly_criterion">Kelly Criterion</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">
            Risk {sizingMethod === 'fixed_percent' ? '(% of Portfolio)' : '($)'}
          </label>
          <input
            type="number"
            value={riskPercent}
            onChange={(e) => handleRiskPercentChange(parseFloat(e.target.value))}
            className="w-full px-2 py-1 text-xs border rounded"
            step="0.1"
            min="0.1"
            max={sizingMethod === 'fixed_percent' ? 20 : undefined}
          />
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Max Position ($)</label>
          <input
            type="number"
            value={maxPosition}
            onChange={(e) => handleMaxPositionChange(parseFloat(e.target.value))}
            className="w-full px-2 py-1 text-xs border rounded"
            min="100"
          />
        </div>
        
        {sizingMethod === 'kelly_criterion' && (
          <>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={kellyEnabled}
                onChange={(e) => handleKellyEnabledChange(e.target.checked)}
                className="w-3 h-3"
              />
              <label className="text-xs text-gray-600">Enable Kelly</label>
            </div>
            
            <div>
              <label className="text-xs text-gray-600 block">Kelly Fraction</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={kellyFraction}
                onChange={(e) => handleKellyFractionChange(parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-500">{kellyFraction}</span>
            </div>
          </>
        )}
      </div>
      
      <Handle
        type="target"
        position={Position.Left}
        id="signal-in"
        className="w-3 h-3 bg-orange-500"
        style={{ top: '20%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="portfolio-value-in"
        className="w-3 h-3 bg-blue-500"
        style={{ top: '40%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="volatility-in"
        className="w-3 h-3 bg-green-500"
        style={{ top: '60%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="win-rate-in"
        className="w-3 h-3 bg-yellow-500"
        style={{ top: '80%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="position-size-out"
        className="w-3 h-3 bg-purple-500"
      />
    </div>
  );
}

export default memo(PositionSizeNode);