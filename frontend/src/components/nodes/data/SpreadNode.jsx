import { useState, memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function SpreadNode({ data, id, updateNodeData }) {
  const [asset1, setAsset1] = useState(data.asset1 || 'BTC');
  const [asset2, setAsset2] = useState(data.asset2 || 'ETH');
  const [spreadType, setSpreadType] = useState(data.spreadType || 'ratio');

  const handleAsset1Change = (value) => {
    setAsset1(value);
    updateNodeData(id, { asset1: value });
  };

  const handleAsset2Change = (value) => {
    setAsset2(value);
    updateNodeData(id, { asset2: value });
  };

  const handleSpreadTypeChange = (value) => {
    setSpreadType(value);
    updateNodeData(id, { spreadType: value });
  };

  return (
    <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-3 min-w-36">
      <div className="font-semibold text-blue-800 mb-2">Spread Data</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Asset 1</label>
          <input
            type="text"
            value={asset1}
            onChange={(e) => handleAsset1Change(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
            placeholder="BTC"
          />
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Asset 2</label>
          <input
            type="text"
            value={asset2}
            onChange={(e) => handleAsset2Change(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
            placeholder="ETH"
          />
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Spread Type</label>
          <select
            value={spreadType}
            onChange={(e) => handleSpreadTypeChange(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            <option value="ratio">Price Ratio</option>
            <option value="difference">Price Difference</option>
            <option value="correlation">Correlation</option>
          </select>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        id="spread-out"
        className="w-3 h-3 bg-blue-500"
      />
    </div>
  );
}

export default memo(SpreadNode);