import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function OrNode({ data, id }) {
  return (
    <div className="bg-yellow-100 border-2 border-yellow-300 rounded-lg p-3 min-w-32">
      <div className="font-semibold text-yellow-800 mb-2 text-center">OR</div>
      
      <div className="text-xs text-gray-600 text-center mb-2">
        Either input can be true
      </div>
      
      {/* Input handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="input-a"
        className="w-3 h-3 bg-red-500"
        style={{ top: '30%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="input-b"
        className="w-3 h-3 bg-red-500"
        style={{ top: '70%' }}
      />
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="result-out"
        className="w-3 h-3 bg-red-500"
      />
      
      {/* Visual indicators for inputs */}
      <div className="flex justify-between items-center mt-2 text-xs">
        <span className="text-gray-500">A</span>
        <span className="text-yellow-700">||</span>
        <span className="text-gray-500">B</span>
      </div>
    </div>
  );
}

export default memo(OrNode);
