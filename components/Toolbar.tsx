
import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon, AddIcon, ChevronDownIcon } from './icons';
import { NodeType } from '../types';

interface ToolbarProps {
  onAddNode: (type: NodeType) => void;
  onRunWorkflow: () => void;
  isProcessing: boolean;
  canRun: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({ onAddNode, onRunWorkflow, isProcessing, canRun }) => {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addableNodeTypes = [
      { type: NodeType.Edit, label: 'Edit (Prompt)' },
      { type: NodeType.Crop, label: 'Crop' },
      { type: NodeType.Resize, label: 'Resize' },
      { type: NodeType.ColorAdjust, label: 'Color Adjust' },
      { type: NodeType.AB, label: 'A/B Compare' },
  ];

  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-2 p-2 bg-gray-800/70 border border-gray-600 rounded-lg shadow-lg backdrop-blur-md">
       <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsAddMenuOpen(prev => !prev)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
          disabled={isProcessing}
          title="Add a new node"
        >
          <AddIcon />
          Add Node
          <ChevronDownIcon />
        </button>
        {isAddMenuOpen && (
          <div className="absolute top-full mt-2 w-48 bg-gray-700 border border-gray-600 rounded-md shadow-lg py-1">
            {addableNodeTypes.map(({ type, label }) => (
                <button
                    key={type}
                    onClick={() => {
                        onAddNode(type);
                        setIsAddMenuOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-blue-600"
                >
                    {label}
                </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onRunWorkflow}
        disabled={!canRun || isProcessing}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
      >
        <PlayIcon />
        {isProcessing ? 'Processing...' : 'Run Workflow'}
      </button>
    </div>
  );
};

export default Toolbar;