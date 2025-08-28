import { useState, memo, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function ConstantNode({ data, id, updateNodeData }) {
  const [value, setValue] = useState(
    data.value !== undefined ? data.value : 0
  );

  useEffect(() => {
    if (data.value !== undefined && data.value !== value) {
      setValue(data.value);
    }
  }, [data.value, value]);

  const handleValueChange = (newVal) => {
    const parsed = newVal === '' ? '' : isNaN(Number(newVal)) ? newVal : Number(newVal);
    setValue(parsed);
    updateNodeData?.(id, { value: parsed });
  };

  return (
    <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-3 min-w-32">
      <div className="font-semibold text-blue-800 mb-2">Constant</div>

      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Value</label>
          <input
            type="text"
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
            placeholder="0"
          />
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="value-out"
        className="w-3 h-3 bg-blue-500"
      />
    </div>
  );
}

export default memo(ConstantNode);

