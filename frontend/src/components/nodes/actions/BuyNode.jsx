import { useState, useEffect, memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function BuyNode({ data, id, updateNodeData }) {
  const [quantity, setQuantity] = useState(data.quantity || 100);
  const [orderType, setOrderType] = useState(data.orderType || 'market');

  // Sync with loaded data when it changes
  useEffect(() => {
    setQuantity(data.quantity || 100);
    setOrderType(data.orderType || 'market');
  }, [data.quantity, data.orderType]);

  return (
    <div className="bg-red-100 border-2 border-red-300 rounded-lg p-3 min-w-32">
      <div className="font-semibold text-red-800 mb-2">Buy Order</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Quantity</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              setQuantity(value);
              updateNodeData && updateNodeData(id, { quantity: value });
            }}
            className="w-full px-2 py-1 text-xs border rounded"
            min="1"
          />
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Order Type</label>
          <select
            value={orderType}
            onChange={(e) => {
              const value = e.target.value;
              setOrderType(value);
              updateNodeData && updateNodeData(id, { orderType: value });
            }}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            <option value="market">Market</option>
            <option value="limit">Limit</option>
            <option value="stop">Stop</option>
            <option value="stop-limit">Stop Limit</option>
          </select>
        </div>
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

export default memo(BuyNode);