import { useState, memo, useEffect } from 'react';
import '@xyflow/react/dist/style.css';

function LabelNode({ data, id, updateNodeData }) {
  const [labelText, setLabelText] = useState(data.labelText || 'Label');

  // Sync local state with prop data changes
  useEffect(() => {
    if (data.labelText !== undefined && data.labelText !== labelText) {
      setLabelText(data.labelText);
    }
  }, [data.labelText, labelText]);

  const handleLabelTextChange = (newText) => {
    setLabelText(newText);
    updateNodeData?.(id, { labelText: newText });
  };

  return (
    <div className="bg-gray-600 border-2 border-gray-700 rounded-lg p-3 min-w-32">
      <div className="font-semibold text-gray-100 mb-2">Label</div>
      
      <div>
        <label className="text-xs text-gray-300 block">Text</label>
        <input
          type="text"
          value={labelText}
          onChange={(e) => handleLabelTextChange(e.target.value)}
          className="w-full px-2 py-1 text-xs border rounded bg-gray-700 text-gray-100 border-gray-600"
          placeholder="Enter label text"
        />
      </div>
    </div>
  );
}

export default memo(LabelNode);