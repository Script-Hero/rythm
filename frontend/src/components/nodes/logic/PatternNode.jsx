import { useState, memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function PatternNode({ data, id }) {
  const [patternType, setPatternType] = useState(data.patternType || 'double_top');
  const [confidence, setConfidence] = useState(data.confidence || 0.8);
  const [lookbackBars, setLookbackBars] = useState(data.lookbackBars || 50);

  const patterns = [
    { value: 'double_top', label: 'Double Top' },
    { value: 'double_bottom', label: 'Double Bottom' },
    { value: 'head_shoulders', label: 'Head & Shoulders' },
    { value: 'inverse_head_shoulders', label: 'Inverse H&S' },
    { value: 'triangle', label: 'Triangle' },
    { value: 'flag', label: 'Flag' },
    { value: 'pennant', label: 'Pennant' },
    { value: 'wedge', label: 'Wedge' }
  ];

  return (
    <div className="bg-yellow-100 border-2 border-yellow-300 rounded-lg p-3 min-w-36">
      <div className="font-semibold text-yellow-800 mb-2">Pattern</div>
      <div className="text-xs text-gray-600 mb-2">Chart Patterns</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Pattern</label>
          <select
            value={patternType}
            onChange={(e) => setPatternType(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            {patterns.map(pattern => (
              <option key={pattern.value} value={pattern.value}>
                {pattern.label}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Min Confidence</label>
          <input
            type="range"
            min="0.5"
            max="1"
            step="0.05"
            value={confidence}
            onChange={(e) => setConfidence(parseFloat(e.target.value))}
            className="w-full"
          />
          <span className="text-xs text-gray-500">{(confidence * 100).toFixed(0)}%</span>
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Lookback Bars</label>
          <input
            type="number"
            value={lookbackBars}
            onChange={(e) => setLookbackBars(parseInt(e.target.value))}
            className="w-full px-2 py-1 text-xs border rounded"
            min="20"
            max="200"
          />
        </div>
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
        id="pattern-out"
        className="w-3 h-3 bg-yellow-500"
      />
    </div>
  );
}

export default memo(PatternNode);