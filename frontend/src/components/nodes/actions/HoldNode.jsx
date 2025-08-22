import { useState, memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function HoldNode({ data, id, updateNodeData }) {
  const [holdType, setHoldType] = useState(data.holdType || 'indefinite');
  const [duration, setDuration] = useState(data.duration || 1);
  const [unit, setUnit] = useState(data.unit || 'days');

  const handleHoldTypeChange = (value) => {
    setHoldType(value);
    updateNodeData(id, { holdType: value });
  };

  const handleDurationChange = (value) => {
    setDuration(value);
    updateNodeData(id, { duration: value });
  };

  const handleUnitChange = (value) => {
    setUnit(value);
    updateNodeData(id, { unit: value });
  };

  return (
    <div className="bg-gray-100 border-2 border-gray-300 rounded-lg p-3 min-w-36">
      <div className="font-semibold text-gray-800 mb-2">Hold Position</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Hold Type</label>
          <select
            value={holdType}
            onChange={(e) => handleHoldTypeChange(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            <option value="indefinite">Hold Indefinitely</option>
            <option value="duration">Hold for Duration</option>
            <option value="condition">Hold Until Condition</option>
          </select>
        </div>
        
        {holdType === 'duration' && (
          <>
            <div>
              <label className="text-xs text-gray-600 block">Duration</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => handleDurationChange(parseInt(e.target.value))}
                className="w-full px-2 py-1 text-xs border rounded"
                min="1"
              />
            </div>
            
            <div>
              <label className="text-xs text-gray-600 block">Unit</label>
              <select
                value={unit}
                onChange={(e) => handleUnitChange(e.target.value)}
                className="w-full px-2 py-1 text-xs border rounded"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="bars">Bars</option>
              </select>
            </div>
          </>
        )}
      </div>
      
      <Handle
        type="target"
        position={Position.Left}
        id="trigger-in"
        className="w-4 h-4 bg-red-500 border-2 border-white"
      />
      
      {holdType === 'condition' && (
        <Handle
          type="target"
          position={Position.Left}
          id="condition-in"
          className="w-4 h-4 bg-red-500 border-2 border-white"
          style={{ top: '70%' }}
        />
      )}
      
      <Handle
        type="source"
        position={Position.Right}
        id="hold-out"
        className="w-4 h-4 bg-gray-500 border-2 border-white"
      />
      
      {holdType === 'condition' && (
        <div className="absolute -left-16 bottom-4 text-xs text-gray-500">Exit Condition</div>
      )}
    </div>
  );
}

export default memo(HoldNode);