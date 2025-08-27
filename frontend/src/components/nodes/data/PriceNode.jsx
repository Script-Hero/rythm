import { useState, memo, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function PriceNode({ data, id, updateNodeData }) {
  const [priceType, setPriceType] = useState(data.priceType || 'close');

  // Sync local state with prop data changes
  useEffect(() => {
    if (data.priceType !== undefined && data.priceType !== priceType) {
      setPriceType(data.priceType);
    }
  }, [data.priceType, priceType]);

  const handlePriceTypeChange = (newPriceType) => {
    setPriceType(newPriceType);
    updateNodeData?.(id, { priceType: newPriceType });
  };

  return (
    <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-3 min-w-32">
      <div className="font-semibold text-blue-800 mb-2">Price Data</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Price Type</label>
          <select
            value={priceType}
            onChange={(e) => handlePriceTypeChange(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            <option value="open">Open</option>
            <option value="high">High</option>
            <option value="low">Low</option>
            <option value="close">Close</option>
          </select>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        id="price-out"
        className="w-3 h-3 bg-blue-500"
      />
    </div>
  );
}

export default memo(PriceNode);
