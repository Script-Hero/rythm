import { useState, useEffect, memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function MACDNode({ data, id, updateNodeData }) {
  const [fastPeriod, setFastPeriod] = useState(data.fastPeriod || 12);
  const [slowPeriod, setSlowPeriod] = useState(data.slowPeriod || 26);
  const [signalPeriod, setSignalPeriod] = useState(data.signalPeriod || 9);

  // Sync with loaded data when it changes
  useEffect(() => {
    setFastPeriod(data.fastPeriod || 12);
    setSlowPeriod(data.slowPeriod || 26);
    setSignalPeriod(data.signalPeriod || 9);
  }, [data.fastPeriod, data.slowPeriod, data.signalPeriod]);

  return (
    <div className="bg-green-100 border-2 border-green-300 rounded-lg p-3 min-w-36">
      <div className="font-semibold text-green-800 mb-2">MACD</div>
      
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block">Fast EMA</label>
          <input
            type="number"
            value={fastPeriod}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              setFastPeriod(value);
              updateNodeData && updateNodeData(id, { fastPeriod: value });
            }}
            className="w-full px-2 py-1 text-xs border rounded"
            min="1"
            max="50"
          />
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Slow EMA</label>
          <input
            type="number"
            value={slowPeriod}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              setSlowPeriod(value);
              updateNodeData && updateNodeData(id, { slowPeriod: value });
            }}
            className="w-full px-2 py-1 text-xs border rounded"
            min="1"
            max="100"
          />
        </div>
        
        <div>
          <label className="text-xs text-gray-600 block">Signal</label>
          <input
            type="number"
            value={signalPeriod}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              setSignalPeriod(value);
              updateNodeData && updateNodeData(id, { signalPeriod: value });
            }}
            className="w-full px-2 py-1 text-xs border rounded"
            min="1"
            max="50"
          />
        </div>
      </div>
      
      <Handle
        type="target"
        position={Position.Left}
        id="price-in"
        className="w-4 h-4 bg-blue-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="macd-out"
        className="w-4 h-4 bg-green-500 border-2 border-white"
        style={{ top: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="signal-out"
        className="w-4 h-4 bg-green-500 border-2 border-white"
        style={{ top: '50%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="histogram-out"
        className="w-4 h-4 bg-green-500 border-2 border-white"
        style={{ top: '70%' }}
      />
      
      <div className="absolute -right-12 top-6 text-xs text-gray-500">
        <div>MACD</div>
        <div>Signal</div>
        <div>Hist</div>
      </div>
    </div>
  );
}

export default memo(MACDNode);