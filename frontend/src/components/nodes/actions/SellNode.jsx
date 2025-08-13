import { useState, memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function SellNode({ data, id }) {
  const [quantity, setQuantity] = useState(data.quantity || 100);
  const [orderType, setOrderType] = useState(data.orderType || 'market');
  const [sellType, setSellType] = useState(data.sellType || 'fixed');
  const [percentage, setPercentage] = useState(data.percentage || 100);

  return (
    <div className="bg-red-100 border-2 border-red-300 rounded-lg p-3 min-w-40">
      <div className="font-semibold text-red-800 mb-2">Sell Order</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Sell Type</label>
          <select
            value={sellType}
            onChange={(e) => setSellType(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            <option value="fixed">Fixed Quantity</option>
            <option value="percentage">Percentage of Position</option>
            <option value="all">Sell All</option>
          </select>
        </div>
        
        {sellType === 'fixed' && (
          <div>
            <label className="text-xs text-gray-600 block">Quantity</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              className="w-full px-2 py-1 text-xs border rounded"
              min="1"
            />
          </div>
        )}
        
        {sellType === 'percentage' && (
          <div>
            <label className="text-xs text-gray-600 block">Percentage (%)</label>
            <input
              type="number"
              value={percentage}
              onChange={(e) => setPercentage(parseFloat(e.target.value))}
              className="w-full px-2 py-1 text-xs border rounded"
              min="1"
              max="100"
              step="0.1"
            />
          </div>
        )}
        
        <div>
          <label className="text-xs text-gray-600 block">Order Type</label>
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            <option value="market">Market</option>
            <option value="limit">Limit</option>
            <option value="stop">Stop Loss</option>
            <option value="stop-limit">Stop Limit</option>
            <option value="trailing-stop">Trailing Stop</option>
          </select>
        </div>
        
        {(orderType === 'limit' || orderType === 'stop-limit') && (
          <div>
            <label className="text-xs text-gray-600 block">Limit Price</label>
            <input
              type="number"
              className="w-full px-2 py-1 text-xs border rounded"
              placeholder="Enter limit price"
              step="0.01"
            />
          </div>
        )}
        
        {(orderType === 'stop' || orderType === 'stop-limit' || orderType === 'trailing-stop') && (
          <div>
            <label className="text-xs text-gray-600 block">
              {orderType === 'trailing-stop' ? 'Trail Amount' : 'Stop Price'}
            </label>
            <input
              type="number"
              className="w-full px-2 py-1 text-xs border rounded"
              placeholder={orderType === 'trailing-stop' ? 'Trail amount' : 'Stop price'}
              step="0.01"
            />
          </div>
        )}
      </div>
      
      <Handle
        type="target"
        position={Position.Left}
        id="trigger-in"
        className="w-3 h-3 bg-red-500"
      />
    </div>
  );
}

export default memo(SellNode);
