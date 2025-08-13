import { useState, memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function TimeNode({ data, id }) {
  const [timeFrame, setTimeFrame] = useState(data.timeFrame || '1h');
  const [startTime, setStartTime] = useState(data.startTime || '09:30');
  const [endTime, setEndTime] = useState(data.endTime || '16:00');
  const [timezone, setTimezone] = useState(data.timezone || 'EST');

  return (
    <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-3 min-w-36">
      <div className="font-semibold text-blue-800 mb-2">Time Filter</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Timeframe</label>
          <select
            value={timeFrame}
            onChange={(e) => setTimeFrame(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            <option value="1m">1 Minute</option>
            <option value="5m">5 Minutes</option>
            <option value="15m">15 Minutes</option>
            <option value="1h">1 Hour</option>
            <option value="4h">4 Hours</option>
            <option value="1d">1 Day</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Start Time</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          />
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">End Time</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          />
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            <option value="EST">EST</option>
            <option value="PST">PST</option>
            <option value="UTC">UTC</option>
            <option value="GMT">GMT</option>
          </select>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        id="time-out"
        className="w-3 h-3 bg-blue-500"
      />
    </div>
  );
}

export default memo(TimeNode);