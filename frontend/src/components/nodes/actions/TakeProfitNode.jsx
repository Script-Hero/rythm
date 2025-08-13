import { useState, memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function TakeProfitNode({ data, id }) {
  const [profitType, setProfitType] = useState(data.profitType || 'fixed_percent');
  const [profitValue, setProfitValue] = useState(data.profitValue || 5);
  const [partialProfits, setPartialProfits] = useState(data.partialProfits || false);
  const [firstTarget, setFirstTarget] = useState(data.firstTarget || 3);
  const [secondTarget, setSecondTarget] = useState(data.secondTarget || 6);

  return (
    <div className="bg-green-100 border-2 border-green-300 rounded-lg p-3 min-w-36">
      <div className="font-semibold text-green-800 mb-2">Take Profit</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Type</label>
          <select
            value={profitType}
            onChange={(e) => setProfitType(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            <option value="fixed_percent">Fixed %</option>
            <option value="fixed_amount">Fixed $</option>
            <option value="rr_ratio">Risk/Reward</option>
            <option value="resistance_level">Resistance</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">
            Value {profitType === 'fixed_percent' ? '(%)' : profitType === 'rr_ratio' ? '(R)' : '($)'}
          </label>
          <input
            type="number"
            value={profitValue}
            onChange={(e) => setProfitValue(parseFloat(e.target.value))}
            className="w-full px-2 py-1 text-xs border rounded"
            step="0.1"
            min="0.1"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={partialProfits}
            onChange={(e) => setPartialProfits(e.target.checked)}
            className="w-3 h-3"
          />
          <label className="text-xs text-gray-600">Partial Profits</label>
        </div>
        
        {partialProfits && (
          <>
            <div>
              <label className="text-xs text-gray-600 block">1st Target (%)</label>
              <input
                type="number"
                value={firstTarget}
                onChange={(e) => setFirstTarget(parseFloat(e.target.value))}
                className="w-full px-2 py-1 text-xs border rounded"
                step="0.1"
                min="0.1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block">2nd Target (%)</label>
              <input
                type="number"
                value={secondTarget}
                onChange={(e) => setSecondTarget(parseFloat(e.target.value))}
                className="w-full px-2 py-1 text-xs border rounded"
                step="0.1"
                min="0.1"
              />
            </div>
          </>
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
        style={{ top: '60%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="profit-triggered"
        className="w-3 h-3 bg-green-500"
      />
    </div>
  );
}

export default memo(TakeProfitNode);