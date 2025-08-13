import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function NotNode({ data, id }) {
  return (
    <div className="bg-yellow-100 border-2 border-yellow-300 rounded-lg p-3 min-w-28">
      <div className="font-semibold text-yellow-800 mb-2 text-center">NOT</div>
      
      <div className="text-xs text-gray-600 text-center mb-2">
        Inverts the input
      </div>
      
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input-in"
        className="w-3 h-3 bg-red-500"
      />
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="result-out"
        className="w-3 h-3 bg-red-500"
      />
      
      {/* Visual indicator */}
      <div className="text-center mt-2 text-xs">
        <span className="text-yellow-700">!</span>
      </div>
    </div>
  );
}

export default memo(NotNode);