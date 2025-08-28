import { useState, memo, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function CompareNode({ data, id, updateNodeData }) {
  const [operator, setOperator] = useState(data.operator || 'greater_than');

  // Sync local state with prop data changes
  useEffect(() => {
    if (data.operator !== undefined && data.operator !== operator) {
      setOperator(data.operator);
    }
  }, [data.operator, operator]);

  const handleOperatorChange = (newOperator) => {
    setOperator(newOperator);
    updateNodeData?.(id, { operator: newOperator });
  };

  return (
    <div className="bg-yellow-100 border-2 border-yellow-300 rounded-lg p-3 min-w-32">
      <div className="font-semibold text-yellow-800 mb-2">Compare</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Operator</label>
          <select
            value={operator}
            onChange={(e) => handleOperatorChange(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            <option value="greater_than">Greater than (&gt;)</option>
            <option value="less_than">Less than (&lt;)</option>
            <option value="greater_equal">Greater or equal (&ge;)</option>
            <option value="less_equal">Less or equal (&le;)</option>
            <option value="equal">Equal to (==)</option>
          </select>
        </div>
      </div>
      
      <Handle
        type="target"
        position={Position.Left}
        id="value1-in"
        className="w-3 h-3 bg-green-500"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="value2-in"
        style={{ top: 30 }}
        className="w-3 h-3 bg-green-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="result-out"
        className="w-3 h-3 bg-red-500"
      />
    </div>
  );
}

export default memo(CompareNode);
