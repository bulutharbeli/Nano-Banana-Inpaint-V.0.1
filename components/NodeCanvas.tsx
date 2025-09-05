import React, { useState, useCallback, useRef, useEffect, ChangeEvent } from 'react';
import type { Node as INode, Connection, NodeData } from '../types';
import { NodeType } from '../types';
import { fileToBase64 } from '../utils/fileUtils';
import Node from './Node';
import { TrashIcon } from './icons';
import MaskEditor from './MaskEditor';
import ABCompareSlider from './ABCompareSlider';

interface NodeCanvasProps {
  nodes: INode[];
  connections: Connection[];
  setNodes: React.Dispatch<React.SetStateAction<INode[]>>;
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
  onToggleLock: (nodeId: string) => void;
}

interface NodeDragState {
  type: 'node';
  nodeId: string;
  startNodePos: { x: number; y: number };
  startMousePos: { x: number; y: number };
}
interface ConnectorDragState {
  type: 'connector';
  sourceNodeId: string;
  startPos: { x: number; y: number };
}
type DraggingState = NodeDragState | ConnectorDragState | null;


const NodeCanvas: React.FC<NodeCanvasProps> = ({ nodes, connections, setNodes, setConnections, onToggleLock }) => {
  const [dragging, setDragging] = useState<DraggingState>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [newConnectionLine, setNewConnectionLine] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ startPan: { x: 0, y: 0 }, startMouse: { x: 0, y: 0 } });
  
  const [isMaskEditorOpen, setIsMaskEditorOpen] = useState(false);
  const [maskEditorNode, setMaskEditorNode] = useState<INode | null>(null);

  const updateNodeData = useCallback((nodeId: string, data: Partial<NodeData>) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
  }, [setNodes]);

  const onNodeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.isLocked) return;
    
    const target = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'BUTTON', 'LABEL', 'SELECT'].includes(target.tagName) || target.closest('button, label, input, .in-connector')) {
        return;
    }

    e.preventDefault();
    e.stopPropagation();
    setSelectedNodeId(nodeId);

    setDragging({
      type: 'node',
      nodeId,
      startNodePos: node.position,
      startMousePos: { x: e.clientX, y: e.clientY },
    });
  }, [nodes]);
  
  const screenToWorld = useCallback((screenPos: {x: number, y: number}) => {
    if (!canvasRef.current) return screenPos;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = (screenPos.x - canvasRect.left - pan.x) / zoom;
    const y = (screenPos.y - canvasRect.top - pan.y) / zoom;
    return { x, y };
  }, [pan, zoom]);

  const onConnectorMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, nodeId: string, type: 'in' | 'out') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'in') return;

    const sourceNode = nodes.find(n => n.id === nodeId);
    if (!sourceNode) return;
    
    const nodeEl = document.getElementById(`node-${nodeId}`);
    const nodeWidth = 288; // w-72
    const nodeHeight = nodeEl?.getBoundingClientRect().height ?? 150 * zoom;

    const startPos = {
        x: sourceNode.position.x + nodeWidth,
        y: sourceNode.position.y + (nodeHeight / zoom / 2)
    };

    setDragging({ type: 'connector', sourceNodeId: nodeId, startPos });

    const worldMousePos = screenToWorld({ x: e.clientX, y: e.clientY });
    setNewConnectionLine({
        x1: startPos.x,
        y1: startPos.y,
        x2: worldMousePos.x,
        y2: worldMousePos.y,
    });
  }, [nodes, screenToWorld, zoom]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
        const dx = e.clientX - panStartRef.current.startMouse.x;
        const dy = e.clientY - panStartRef.current.startMouse.y;
        setPan({
            x: panStartRef.current.startPan.x + dx,
            y: panStartRef.current.startPan.y + dy,
        });
        return;
    }
    
    if (!dragging) return;
    
    if (dragging.type === 'node') {
        const dx = (e.clientX - dragging.startMousePos.x) / zoom;
        const dy = (e.clientY - dragging.startMousePos.y) / zoom;
        const newPos = {
            x: dragging.startNodePos.x + dx,
            y: dragging.startNodePos.y + dy,
        };
        setNodes(nds => nds.map(n => n.id === dragging.nodeId ? { ...n, position: newPos } : n));
    } else if (dragging.type === 'connector' && newConnectionLine) {
        const worldMousePos = screenToWorld({ x: e.clientX, y: e.clientY });
        setNewConnectionLine({ ...newConnectionLine, x2: worldMousePos.x, y2: worldMousePos.y });
    }
  }, [dragging, isPanning, zoom, setNodes, screenToWorld, newConnectionLine]);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragging?.type === 'connector') {
        const targetEl = e.target as HTMLElement;
        const connectorEl = targetEl.closest('.in-connector');
        const targetNodeEl = targetEl.closest('[id^="node-"]');
        
        if (connectorEl && targetNodeEl) {
            const targetNodeId = targetNodeEl.id.replace('node-', '');
            const targetHandleId = connectorEl.getAttribute('data-handle-id');
            const targetNode = nodes.find(n => n.id === targetNodeId);

            if (targetNode && targetNode.id !== dragging.sourceNodeId && targetNode.type !== NodeType.Input && targetHandleId) {
                const existingConnection = connections.find(c => c.targetNodeId === targetNodeId && c.targetHandleId === targetHandleId);
                if (!existingConnection) {
                    setConnections(conns => [
                        ...conns,
                        { id: `conn-${Date.now()}`, sourceNodeId: dragging.sourceNodeId, targetNodeId, targetHandleId }
                    ]);
                }
            }
        }
    }
    setDragging(null);
    setIsPanning(false);
    setNewConnectionLine(null);
  }, [dragging, nodes, connections, setConnections]);
  
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      // Prevent panning when clicking on a node, but allow when clicking canvas or container
      if (target.closest('[id^="node-"]')) return;
      
      if (target === canvasRef.current || target.id === 'nodes-container') {
        setSelectedNodeId(null);
        setIsPanning(true);
        panStartRef.current = {
            startPan: pan,
            startMouse: { x: e.clientX, y: e.clientY },
        };
      }
  }, [pan]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomSpeed = 0.1;
    const newZoom = Math.max(0.2, Math.min(2, zoom + (e.deltaY > 0 ? -zoomSpeed : zoomSpeed)));
    
    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);
    
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [zoom, pan]);

  const onDeleteNode = useCallback((nodeId: string) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setConnections(conns => conns.filter(c => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId));
  }, [setNodes, setConnections]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>, nodeId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        updateNodeData(nodeId, { isLoading: true, error: null });
        const base64 = await fileToBase64(file);
        updateNodeData(nodeId, { imageBase64: base64, fileName: file.name, outputImageBase64: base64, isLoading: false, mimeType: file.type });
      } catch (error) {
        updateNodeData(nodeId, { error: 'Failed to load image.', isLoading: false });
      }
    }
  };
  
  const openMaskEditor = (nodeId: string) => {
      const nodeToEdit = nodes.find(n => n.id === nodeId);
      if (nodeToEdit && nodeToEdit.data.outputImageBase64) {
          setMaskEditorNode(nodeToEdit);
          setIsMaskEditorOpen(true);
      } else {
          alert("Please upload an image before creating a mask.");
      }
  };
  
  const handleSaveMask = (maskBase64: string) => {
      if(maskEditorNode) {
          updateNodeData(maskEditorNode.id, { maskImageBase64: maskBase64, maskMimeType: 'image/png' });
      }
      setIsMaskEditorOpen(false);
      setMaskEditorNode(null);
  };

  const removeMask = (nodeId: string) => {
    updateNodeData(nodeId, { maskImageBase64: null, maskMimeType: undefined });
  };

  const [connectionPaths, setConnectionPaths] = useState<string[]>([]);
  useEffect(() => {
    const nodeElements = new Map(nodes.map(n => [n.id, document.getElementById(`node-${n.id}`)]));
    const paths = connections.map(conn => {
        const sourceNode = nodes.find(n => n.id === conn.sourceNodeId);
        const targetNode = nodes.find(n => n.id === conn.targetNodeId);
        if (!sourceNode || !targetNode) return '';
        
        const sourceEl = nodeElements.get(sourceNode.id);
        const targetEl = nodeElements.get(targetNode.id);

        const nodeWidth = 288; // w-72
        const sourceHeight = (sourceEl?.offsetHeight || 150);
        const targetHeight = (targetEl?.offsetHeight || 150);

        const startX = sourceNode.position.x + nodeWidth;
        const startY = sourceNode.position.y + sourceHeight / 2;
        const endX = targetNode.position.x;
        let endY = targetNode.position.y + targetHeight / 2;

        if (targetNode.type === NodeType.AB) {
            if (conn.targetHandleId === 'A') {
                endY = targetNode.position.y + targetHeight / 3;
            } else if (conn.targetHandleId === 'B') {
                endY = targetNode.position.y + targetHeight * 2 / 3;
            }
        }

        const c1X = startX + Math.abs(endX - startX) / 2;
        const c2X = endX - Math.abs(endX - startX) / 2;

        return `M ${startX} ${startY} C ${c1X} ${startY}, ${c2X} ${endY}, ${endX} ${endY}`;
    }).filter(p => p);
    setConnectionPaths(paths);
  }, [connections, nodes, zoom, pan]);


  return (
    <>
    <div
      ref={canvasRef}
      className={`relative w-full h-full bg-gray-800 overflow-hidden bg-[radial-gradient(#4a5568_1px,transparent_1px)] [background-size:24px_24px] ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseDown={handleCanvasMouseDown}
      onWheel={handleWheel}
      onMouseLeave={() => { setDragging(null); setIsPanning(false); setNewConnectionLine(null); }}
    >
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <g style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            {connectionPaths.map((path, i) => (
              <path key={i} d={path} stroke="#9ca3af" strokeWidth="2" fill="none" />
            ))}
            {newConnectionLine && (
                <path d={`M ${newConnectionLine.x1} ${newConnectionLine.y1} L ${newConnectionLine.x2} ${newConnectionLine.y2}`} stroke="#facc15" strokeWidth={2 / zoom} fill="none" />
            )}
        </g>
      </svg>

      <div 
        id="nodes-container"
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
      >
        {nodes.map(node => (
          <div key={node.id} className="pointer-events-auto absolute" style={{left: node.position.x, top: node.position.y}}>
            <Node
              node={node}
              isSelected={selectedNodeId === node.id}
              onNodeMouseDown={onNodeMouseDown}
              onConnectorMouseDown={onConnectorMouseDown}
              onDeleteNode={onDeleteNode}
              onToggleLock={onToggleLock}
            >
            {node.type === NodeType.Input && (
              <div className="flex flex-col items-center">
                {node.data.isLoading ? (
                    <div className="text-gray-400">Loading...</div>
                ) : node.data.outputImageBase64 ? (
                  <img src={`data:${node.data.mimeType};base64,${node.data.outputImageBase64}`} alt="Input" className="w-full h-auto rounded-md" />
                ) : (
                  <div className="w-full h-32 border-2 border-dashed border-gray-500 rounded-md flex items-center justify-center text-gray-400">
                    No image loaded
                  </div>
                )}
                <label className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md cursor-pointer hover:bg-green-700 transition-colors w-full text-center">
                  {node.data.fileName ? 'Change Image' : 'Upload Image'}
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, node.id)} />
                </label>
                {node.data.error && <p className="text-red-500 text-xs mt-2">{node.data.error}</p>}
                
                <div className="mt-4 pt-4 border-t border-gray-700 w-full">
                    <h3 className="text-sm font-semibold text-gray-300 mb-2 text-center">Edit Mask (Optional)</h3>
                    {node.data.maskImageBase64 && (
                        <div className="relative mb-2">
                            <img 
                                src={`data:${node.data.maskMimeType};base64,${node.data.maskImageBase64}`} 
                                alt="Mask" 
                                className="w-full h-auto rounded-md bg-gray-800"
                                style={{
                                    backgroundImage: `url('data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect width="8" height="8" x="0" y="0" fill="%234a5568"/><rect width="8" height="8" x="8" y="8" fill="%234a5568"/></svg>')`,
                                    backgroundSize: '16px 16px'
                                }}
                            />
                            <button
                                onClick={() => removeMask(node.id)}
                                className="absolute top-1 right-1 p-1 bg-red-600/70 rounded-full text-white hover:bg-red-700"
                                title="Remove Mask"
                            >
                                <TrashIcon />
                            </button>
                        </div>
                    )}
                    <button 
                        onClick={() => openMaskEditor(node.id)}
                        disabled={!node.data.outputImageBase64}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md cursor-pointer hover:bg-gray-700 transition-colors w-full text-center block text-sm disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        {node.data.maskImageBase64 ? 'Edit Mask' : 'Create Mask'}
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">White areas are editable, black areas are protected.</p>
                </div>
              </div>
            )}
            {node.type === NodeType.Edit && (
              <div>
                <label htmlFor={`prompt-${node.id}`} className="block text-sm font-medium text-gray-300 mb-1">
                  Edit Prompt
                </label>
                <textarea
                  id={`prompt-${node.id}`}
                  aria-label="Edit prompt"
                  placeholder="e.g., add a party hat on the cat"
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  rows={3}
                  value={node.data.prompt || ''}
                  onChange={(e) => updateNodeData(node.id, { prompt: e.target.value })}
                />
                {node.data.isLoading ? (
                    <div className="mt-2 text-center text-gray-400">Processing...</div>
                ) : node.data.error ? (
                    <p className="text-red-500 text-xs mt-2">{node.data.error}</p>
                ) : node.data.outputImageBase64 && (
                    <img src={`data:image/png;base64,${node.data.outputImageBase64}`} alt="Edited" className="mt-2 w-full h-auto rounded-md" />
                )}
              </div>
            )}
            {node.type === NodeType.Crop && (
              <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                      <div>
                          <label htmlFor={`crop-x-${node.id}`} className="block text-xs font-medium text-gray-400">X (%)</label>
                          <input type="number" id={`crop-x-${node.id}`} value={node.data.crop?.x ?? 0}
                                onChange={(e) => updateNodeData(node.id, { crop: { ...node.data.crop!, x: parseInt(e.target.value) || 0 } })}
                                className="w-full mt-1 p-1 bg-gray-700 border border-gray-600 rounded-md text-sm" min="0" max="100"/>
                      </div>
                      <div>
                          <label htmlFor={`crop-y-${node.id}`} className="block text-xs font-medium text-gray-400">Y (%)</label>
                          <input type="number" id={`crop-y-${node.id}`} value={node.data.crop?.y ?? 0}
                                onChange={(e) => updateNodeData(node.id, { crop: { ...node.data.crop!, y: parseInt(e.target.value) || 0 } })}
                                className="w-full mt-1 p-1 bg-gray-700 border border-gray-600 rounded-md text-sm" min="0" max="100"/>
                      </div>
                      <div>
                          <label htmlFor={`crop-w-${node.id}`} className="block text-xs font-medium text-gray-400">Width (%)</label>
                          <input type="number" id={`crop-w-${node.id}`} value={node.data.crop?.width ?? 100}
                                onChange={(e) => updateNodeData(node.id, { crop: { ...node.data.crop!, width: parseInt(e.target.value) || 0 } })}
                                className="w-full mt-1 p-1 bg-gray-700 border border-gray-600 rounded-md text-sm" min="0" max="100"/>
                      </div>
                      <div>
                          <label htmlFor={`crop-h-${node.id}`} className="block text-xs font-medium text-gray-400">Height (%)</label>
                          <input type="number" id={`crop-h-${node.id}`} value={node.data.crop?.height ?? 100}
                                onChange={(e) => updateNodeData(node.id, { crop: { ...node.data.crop!, height: parseInt(e.target.value) || 0 } })}
                                className="w-full mt-1 p-1 bg-gray-700 border border-gray-600 rounded-md text-sm" min="0" max="100"/>
                      </div>
                  </div>
                  {node.data.isLoading ? (
                      <div className="mt-2 text-center text-gray-400">Processing...</div>
                  ) : node.data.error ? (
                      <p className="text-red-500 text-xs mt-2">{node.data.error}</p>
                  ) : node.data.outputImageBase64 && (
                      <img src={`data:image/png;base64,${node.data.outputImageBase64}`} alt="Cropped" className="mt-2 w-full h-auto rounded-md" />
                  )}
              </div>
            )}
            {node.type === NodeType.Resize && (
              <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                      <div>
                          <label htmlFor={`resize-w-${node.id}`} className="block text-xs font-medium text-gray-400">Width (px)</label>
                          <input type="number" id={`resize-w-${node.id}`} value={node.data.resize?.width ?? ''}
                                placeholder="auto"
                                onChange={(e) => updateNodeData(node.id, { resize: { ...node.data.resize!, width: e.target.value ? parseInt(e.target.value) : null } })}
                                className="w-full mt-1 p-1 bg-gray-700 border border-gray-600 rounded-md text-sm"/>
                      </div>
                      <div>
                          <label htmlFor={`resize-h-${node.id}`} className="block text-xs font-medium text-gray-400">Height (px)</label>
                          <input type="number" id={`resize-h-${node.id}`} value={node.data.resize?.height ?? ''}
                                placeholder="auto"
                                onChange={(e) => updateNodeData(node.id, { resize: { ...node.data.resize!, height: e.target.value ? parseInt(e.target.value) : null } })}
                                className="w-full mt-1 p-1 bg-gray-700 border border-gray-600 rounded-md text-sm"/>
                      </div>
                  </div>
                  <div className="flex items-center">
                      <input type="checkbox" id={`resize-aspect-${node.id}`} checked={node.data.resize?.preserveAspectRatio ?? true}
                            onChange={(e) => updateNodeData(node.id, { resize: { ...node.data.resize!, preserveAspectRatio: e.target.checked } })}
                            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"/>
                      <label htmlFor={`resize-aspect-${node.id}`} className="ml-2 block text-sm text-gray-300">Preserve Aspect Ratio</label>
                  </div>
                  {node.data.isLoading ? (
                      <div className="mt-2 text-center text-gray-400">Processing...</div>
                  ) : node.data.error ? (
                      <p className="text-red-500 text-xs mt-2">{node.data.error}</p>
                  ) : node.data.outputImageBase64 && (
                      <img src={`data:image/png;base64,${node.data.outputImageBase64}`} alt="Resized" className="mt-2 w-full h-auto rounded-md" />
                  )}
              </div>
            )}
            {node.type === NodeType.ColorAdjust && (
              <div className="space-y-2">
                  <div>
                      <label htmlFor={`ca-bright-${node.id}`} className="flex justify-between text-xs font-medium text-gray-400">
                          <span>Brightness</span>
                          <span>{node.data.colorAdjust?.brightness ?? 0}</span>
                      </label>
                      <input type="range" id={`ca-bright-${node.id}`} min="-100" max="100" value={node.data.colorAdjust?.brightness ?? 0}
                            onChange={(e) => updateNodeData(node.id, { colorAdjust: { ...node.data.colorAdjust!, brightness: parseInt(e.target.value) } })}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"/>
                  </div>
                  <div>
                      <label htmlFor={`ca-contrast-${node.id}`} className="flex justify-between text-xs font-medium text-gray-400">
                          <span>Contrast</span>
                          <span>{node.data.colorAdjust?.contrast ?? 0}</span>
                      </label>
                      <input type="range" id={`ca-contrast-${node.id}`} min="-100" max="100" value={node.data.colorAdjust?.contrast ?? 0}
                            onChange={(e) => updateNodeData(node.id, { colorAdjust: { ...node.data.colorAdjust!, contrast: parseInt(e.target.value) } })}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"/>
                  </div>
                  <div>
                      <label htmlFor={`ca-saturation-${node.id}`} className="flex justify-between text-xs font-medium text-gray-400">
                          <span>Saturation</span>
                          <span>{node.data.colorAdjust?.saturation ?? 0}</span>
                      </label>
                      <input type="range" id={`ca-saturation-${node.id}`} min="-100" max="100" value={node.data.colorAdjust?.saturation ?? 0}
                            onChange={(e) => updateNodeData(node.id, { colorAdjust: { ...node.data.colorAdjust!, saturation: parseInt(e.target.value) } })}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"/>
                  </div>
                  {node.data.isLoading ? (
                      <div className="mt-2 text-center text-gray-400">Processing...</div>
                  ) : node.data.error ? (
                      <p className="text-red-500 text-xs mt-2">{node.data.error}</p>
                  ) : node.data.outputImageBase64 && (
                      <img src={`data:image/png;base64,${node.data.outputImageBase64}`} alt="Color Adjusted" className="mt-2 w-full h-auto rounded-md" />
                  )}
              </div>
            )}
             {node.type === NodeType.AB && (
                <div className="flex flex-col items-center">
                    {node.data.isLoading ? (
                        <div className="w-full aspect-video flex items-center justify-center text-gray-400">Comparing...</div>
                    ) : node.data.error ? (
                        <p className="text-red-500 text-sm mt-2">{node.data.error}</p>
                    ) : (node.data.imageBase64A && node.data.imageBase64B && node.data.mimeTypeA && node.data.mimeTypeB) ? (
                        <ABCompareSlider
                            base64ImageA={node.data.imageBase64A}
                            mimeTypeA={node.data.mimeTypeA}
                            base64ImageB={node.data.imageBase64B}
                            mimeTypeB={node.data.mimeTypeB}
                        />
                    ) : (
                    <div className="w-full aspect-video border-2 border-dashed border-gray-500 rounded-md flex items-center justify-center text-gray-400">
                        Awaiting comparison
                    </div>
                    )}
                </div>
            )}
            {node.type === NodeType.Output && (
              <div className="flex flex-col items-center">
                {node.data.isLoading ? (
                    <div className="w-full h-32 flex items-center justify-center text-gray-400">Processing...</div>
                ) : node.data.error ? (
                    <p className="text-red-500 text-sm mt-2">{node.data.error}</p>
                ) : node.data.outputImageBase64 ? (
                  <img src={`data:image/png;base64,${node.data.outputImageBase64}`} alt="Final Output" className="w-full h-auto rounded-md" />
                ) : (
                  <div className="w-full h-32 border-2 border-dashed border-gray-500 rounded-md flex items-center justify-center text-gray-400">
                    Awaiting output
                  </div>
                )}
              </div>
            )}
            </Node>
          </div>
        ))}
      </div>
    </div>
    {isMaskEditorOpen && maskEditorNode && (
        <MaskEditor
            isOpen={isMaskEditorOpen}
            onClose={() => setIsMaskEditorOpen(false)}
            onSave={handleSaveMask}
            backgroundImageSrc={maskEditorNode.data.outputImageBase64}
            backgroundImageMimeType={maskEditorNode.data.mimeType}
            initialMaskSrc={maskEditorNode.data.maskImageBase64}
        />
    )}
    </>
  );
};

export default NodeCanvas;