import { useState, memo, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function CompareNode({ data, id, updateNodeData }) {
  const [operator, setOperator] = useState(data.operator || '>');
  const [value, setValue] = useState(data.value || 0);

  // Sync local state with prop data changes
  useEffect(() => {
    if (data.operator !== undefined && data.operator !== operator) {
      setOperator(data.operator);
    }
  }, [data.operator, operator]);

  useEffect(() => {
    if (data.value !== undefined && data.value !== value) {
      setValue(data.value);
    }
  }, [data.value, value]);

  const handleOperatorChange = (newOperator) => {
    setOperator(newOperator);
    updateNodeData?.(id, { operator: newOperator });
  };

  const handleValueChange = (newValue) => {
    setValue(newValue);
    updateNodeData?.(id, { value: newValue });
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
            <option value=">">Greater than</option>
            <option value="<">Less than</option>
            <option value=">=">Greater or equal</option>
            <option value="<=">Less or equal</option>
            <option value="==">Equal to</option>
            <option value="!=">Not equal to</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Value</label>
          <input
            type="number"
            value={value}
            onChange={(e) => handleValueChange(parseFloat(e.target.value))}
            className="w-full px-2 py-1 text-xs border rounded"
            step="0.01"
          />
        </div>
      </div>
      
      <Handle
        type="target"
        position={Position.Left}
        id="value-in"
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
