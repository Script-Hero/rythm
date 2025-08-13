import { useState, useCallback } from 'react';
import { Copy, Trash2 } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  onCopyNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onClose: () => void;
}

export function NodeContextMenu({
  x,
  y,
  nodeId,
  onCopyNode,
  onDeleteNode,
  onClose,
}: ContextMenuProps) {
  const handleCopy = useCallback(() => {
    onCopyNode(nodeId);
    onClose();
  }, [nodeId, onCopyNode, onClose]);

  const handleDelete = useCallback(() => {
    onDeleteNode(nodeId);
    onClose();
  }, [nodeId, onDeleteNode, onClose]);

  return (
    <div
      className="fixed bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50 min-w-[140px]"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      <button
        className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm"
        onClick={handleCopy}
      >
        <Copy className="h-4 w-4" />
        Copy Node
      </button>
      <button
        className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4" />
        Delete Node
      </button>
    </div>
  );
}