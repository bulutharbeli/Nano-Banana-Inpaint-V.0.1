import React, { useCallback } from 'react';
import type { Node as NodeType, Node as INode } from '../types';
import { NodeType as NodeTypeEnum } from '../types';
import { TrashIcon, LockClosedIcon, LockOpenIcon } from './icons';

interface NodeProps {
  node: INode;
  isSelected: boolean;
  onNodeMouseDown: (e: React.MouseEvent<HTMLDivElement>, nodeId: string) => void;
  onConnectorMouseDown: (e: React.MouseEvent<HTMLDivElement>, nodeId: string, type: 'in' | 'out') => void;
  onDeleteNode: (nodeId: string) => void;
  onToggleLock: (nodeId: string) => void;
  children: React.ReactNode;
}

const Node: React.FC<NodeProps> = ({ node, isSelected, onNodeMouseDown, onConnectorMouseDown, onDeleteNode, onToggleLock, children }) => {
  const nodeTypeStyles: { [key in NodeTypeEnum]: string } = {
    [NodeTypeEnum.Input]: 'border-green-500 bg-green-900/50',
    [NodeTypeEnum.Edit]: 'border-blue-500 bg-blue-900/50',
    [NodeTypeEnum.Output]: 'border-purple-500 bg-purple-900/50',
    [NodeTypeEnum.Crop]: 'border-orange-500 bg-orange-900/50',
    [NodeTypeEnum.Resize]: 'border-teal-500 bg-teal-900/50',
    [NodeTypeEnum.ColorAdjust]: 'border-indigo-500 bg-indigo-900/50',
    [NodeTypeEnum.AB]: 'border-yellow-500 bg-yellow-900/50',
  };

  const nodeHeaderStyles: { [key in NodeTypeEnum]: string } = {
    [NodeTypeEnum.Input]: 'bg-green-600/70',
    [NodeTypeEnum.Edit]: 'bg-blue-600/70',
    [NodeTypeEnum.Output]: 'bg-purple-600/70',
    [NodeTypeEnum.Crop]: 'bg-orange-600/70',
    [NodeTypeEnum.Resize]: 'bg-teal-600/70',
    [NodeTypeEnum.ColorAdjust]: 'bg-indigo-600/70',
    [NodeTypeEnum.AB]: 'bg-yellow-600/70',
  };
  
  const handleConnectorMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, type: 'in' | 'out') => {
    e.stopPropagation();
    onConnectorMouseDown(e, node.id, type);
  }, [node.id, onConnectorMouseDown]);

  const formattedTitle = node.type
    .replace('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div
      id={`node-${node.id}`}
      className={`relative w-72 rounded-lg shadow-xl backdrop-blur-md border ${nodeTypeStyles[node.type]} ${isSelected ? 'ring-2 ring-yellow-400' : ''} ${node.isLocked ? 'cursor-default' : ''}`}
      onMouseDown={(e) => onNodeMouseDown(e, node.id)}
    >
      {node.type === NodeTypeEnum.AB ? (
        <>
            <div 
                className="absolute -left-2.5 top-1/3 -translate-y-1/2 w-5 h-5 bg-gray-600 rounded-full border-2 border-gray-400 hover:bg-yellow-400 cursor-crosshair in-connector flex items-center justify-center text-xs font-mono"
                data-handle-id="A"
                title="Input A"
            >A</div>
            <div 
                className="absolute -left-2.5 top-2/3 -translate-y-1/2 w-5 h-5 bg-gray-600 rounded-full border-2 border-gray-400 hover:bg-yellow-400 cursor-crosshair in-connector flex items-center justify-center text-xs font-mono"
                data-handle-id="B"
                title="Input B"
            >B</div>
        </>
      ) : node.type !== NodeTypeEnum.Input && (
        <div 
          className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-gray-600 rounded-full border-2 border-gray-400 hover:bg-yellow-400 cursor-crosshair in-connector"
          data-handle-id="default"
        />
      )}
      
      <div className={`p-2 rounded-t-lg font-bold text-sm flex justify-between items-center ${nodeHeaderStyles[node.type]} ${node.isLocked ? 'opacity-80' : ''}`}>
        <span>{formattedTitle} Node</span>
        <div className="flex items-center gap-1">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleLock(node.id);
                }}
                className="p-1 rounded-full hover:bg-yellow-500/50 text-gray-300 hover:text-white transition-colors"
                title={node.isLocked ? "Unlock Node" : "Lock Node"}
            >
                {node.isLocked ? <LockClosedIcon /> : <LockOpenIcon />}
            </button>
            {node.type !== NodeTypeEnum.Input && node.type !== NodeTypeEnum.Output && (
                 <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNode(node.id);
                    }}
                    className="p-1 rounded-full hover:bg-red-500/50 text-gray-300 hover:text-white transition-colors"
                    title="Delete Node"
                >
                    <TrashIcon />
                </button>
            )}
        </div>
      </div>

      <div className="p-4">
        {children}
      </div>

      {node.type !== NodeTypeEnum.Output && (
        <div 
          className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-gray-600 rounded-full border-2 border-gray-400 hover:bg-yellow-400 cursor-crosshair"
          onMouseDown={(e) => handleConnectorMouseDown(e, 'out')}
        />
      )}
    </div>
  );
};

export default React.memo(Node);