import React, { useState, useCallback, useMemo } from 'react';
import type { Node, Connection, NodeData } from './types';
import { NodeType } from './types';
import NodeCanvas from './components/NodeCanvas';
import Toolbar from './components/Toolbar';
import { editImageWithNanoBanana } from './services/geminiService';
import { combineImagesSideBySide } from './utils/imageUtils';

const initialNodes: Node[] = [
  { id: 'input-1', type: NodeType.Input, position: { x: 50, y: 250 }, data: {}, isLocked: false },
  {
    id: 'edit-1',
    type: NodeType.Edit,
    position: { x: 400, y: 100 },
    data: { prompt: 'Make this picture pop with vibrant colors.' },
    isLocked: false,
  },
  { id: 'ab-1', type: NodeType.AB, position: { x: 750, y: 250 }, data: {}, isLocked: false },
  { id: 'output-1', type: NodeType.Output, position: { x: 1100, y: 250 }, data: {}, isLocked: false },
];

const initialConnections: Connection[] = [
  // Connect input to the edit node for processing
  { id: 'conn-1', sourceNodeId: 'input-1', targetNodeId: 'edit-1', targetHandleId: 'default' },
  // Connect original input to A/B node's 'A' input
  { id: 'conn-2', sourceNodeId: 'input-1', targetNodeId: 'ab-1', targetHandleId: 'A' },
  // Connect the edited image to A/B node's 'B' input
  { id: 'conn-3', sourceNodeId: 'edit-1', targetNodeId: 'ab-1', targetHandleId: 'B' },
  // Connect the A/B comparison result to the final output
  { id: 'conn-4', sourceNodeId: 'ab-1', targetNodeId: 'output-1', targetHandleId: 'default' },
];


const App: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [isProcessing, setIsProcessing] = useState(false);

  const addNode = useCallback((type: NodeType) => {
    let nodeData: NodeData = {};
     switch(type) {
        case NodeType.Edit:
            nodeData = { prompt: '' };
            break;
        case NodeType.Crop:
            nodeData = { crop: { x: 0, y: 0, width: 100, height: 100 } };
            break;
        case NodeType.Resize:
            nodeData = { resize: { width: null, height: null, preserveAspectRatio: true } };
            break;
        case NodeType.ColorAdjust:
            nodeData = { colorAdjust: { brightness: 0, contrast: 0, saturation: 0 } };
            break;
        case NodeType.AB:
            nodeData = {};
            break;
        default:
            return;
    }

    const newNode: Node = {
      id: `${type.toLowerCase().replace('_', '-')}-${Date.now()}`,
      type: type,
      position: { x: Math.random() * 400 + 200, y: Math.random() * 200 + 100 },
      data: nodeData,
      isLocked: false,
    };
    setNodes(nds => [...nds, newNode]);
  }, []);

  const updateNodeData = useCallback((nodeId: string, data: Partial<NodeData>) => {
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
  }, []);
  
  const toggleNodeLock = useCallback((nodeId: string) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, isLocked: !n.isLocked } : n));
  }, []);

  const runWorkflow = useCallback(async () => {
    const inputNode = nodes.find(n => n.type === NodeType.Input);
    if (!inputNode || !inputNode.data.outputImageBase64 || !inputNode.data.mimeType) {
      alert("Please upload an image to the Input node first.");
      return;
    }
    
    setIsProcessing(true);
    // Reset status of all nodes
    setNodes(currentNodes => currentNodes.map(n => ({
      ...n,
      data: { 
        ...n.data,
        isLoading: n.type === NodeType.Input ? false : true, 
        error: null,
        ...(n.type !== NodeType.Input ? { outputImageBase64: null } : {}),
        ...(n.type === NodeType.AB ? { imageBase64A: undefined, imageBase64B: undefined } : {})
      }
    })));

    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    const adjList = new Map<string, string[]>();
    const inDegrees = new Map<string, number>();
    const queue: string[] = [];
    const processedOutputs = new Map<string, { base64: string, mimeType: string }>();
    
    // Initialize graph structures
    nodes.forEach(node => {
      adjList.set(node.id, []);
      inDegrees.set(node.id, 0);
    });

    connections.forEach(conn => {
      adjList.get(conn.sourceNodeId)?.push(conn.targetNodeId);
      inDegrees.set(conn.targetNodeId, (inDegrees.get(conn.targetNodeId) || 0) + 1);
    });

    // Find starting nodes (in-degree 0)
    nodes.forEach(node => {
      if (inDegrees.get(node.id) === 0) {
        queue.push(node.id);
      }
    });

    processedOutputs.set(inputNode.id, { base64: inputNode.data.outputImageBase64, mimeType: inputNode.data.mimeType });

    // Process nodes in topological order
    while (queue.length > 0) {
        const nodeId = queue.shift()!;
        const node = nodeMap.get(nodeId);
        if (!node) continue;

        try {
            let currentOutputBase64 = '';
            let currentMimeType = 'image/png'; // Default for processed images

            if (node.type === NodeType.Input) {
                // Input node is the source, its output is already set
                currentOutputBase64 = node.data.outputImageBase64!;
                currentMimeType = node.data.mimeType!;
            } else {
                 // Get inputs from parent nodes
                const parentConns = connections.filter(c => c.targetNodeId === nodeId);
                const parentOutputs = new Map<string, { base64: string, mimeType: string }>();

                for(const conn of parentConns) {
                    const output = processedOutputs.get(conn.sourceNodeId);
                    if (!output) throw new Error(`Parent node ${conn.sourceNodeId} has not been processed.`);
                    parentOutputs.set(conn.targetHandleId || 'default', output);
                }

                const defaultInput = parentOutputs.get('default');
                if (node.type !== NodeType.AB && !defaultInput) {
                    // For non-AB nodes, if there's no input, we can't proceed with them, but maybe they are not connected.
                    // This case should be handled by the in-degree logic. A node with no input connection will have in-degree 0.
                    // This might be an issue for nodes added but not connected.
                    if (parentConns.length > 0) throw new Error(`Node ${nodeId} is missing its input.`);
                    // If no parent conns, just skip it unless it's an output node waiting for something
                }
                
                let generatedPrompt = '';
                let useMask = false;
                
                switch (node.type) {
                    case NodeType.Edit:
                        if (!node.data.prompt?.trim()) throw new Error("Edit node has no prompt.");
                        if (inputNode.data.maskImageBase64) {
                            generatedPrompt = `Using the provided mask (second image), apply the following edit only to the unmasked (white) areas of the first image: ${node.data.prompt}`;
                            useMask = true;
                        } else {
                            generatedPrompt = node.data.prompt;
                        }
                        break;
                    case NodeType.Crop:
                        const { x, y, width, height } = node.data.crop || { x: 0, y: 0, width: 100, height: 100 };
                        if (width <= 0 || height <= 0) throw new Error("Crop dimensions must be positive.");
                        generatedPrompt = `Crop the image to a rectangle starting at ${x}% from the left and ${y}% from the top, with a width of ${width}% and a height of ${height}%.`;
                        break;
                    case NodeType.Resize:
                        const { width: w, height: h, preserveAspectRatio } = node.data.resize || { w: null, h: null, preserveAspectRatio: true };
                        if (!w && !h) throw new Error("Resize node requires at least width or height.");
                        let resizeParts = [];
                        if (w) resizeParts.push(`${w} pixels wide`);
                        if (h) resizeParts.push(`${h} pixels high`);
                        generatedPrompt = `Resize the image to ${resizeParts.join(' and ')}.`;
                        if (preserveAspectRatio) {
                            generatedPrompt += ' Maintain the original aspect ratio.';
                        } else {
                            generatedPrompt += ' Do not maintain the original aspect ratio.';
                        }
                        break;
                    case NodeType.ColorAdjust:
                        const { brightness, contrast, saturation } = node.data.colorAdjust || { brightness: 0, contrast: 0, saturation: 0 };
                        let adjustments = [];
                        if (brightness !== 0) adjustments.push(`${brightness > 0 ? 'increase' : 'decrease'} brightness by ${Math.abs(brightness)}%`);
                        if (contrast !== 0) adjustments.push(`${contrast > 0 ? 'increase' : 'decrease'} contrast by ${Math.abs(contrast)}%`);
                        if (saturation !== 0) adjustments.push(`${saturation > 0 ? 'increase' : 'decrease'} saturation by ${Math.abs(saturation)}%`);
                        
                        if (adjustments.length === 0) break;
                        generatedPrompt = `Adjust the image colors: ${adjustments.join(', ')}.`;
                        break;
                    case NodeType.AB:
                        const inputA = parentOutputs.get('A');
                        const inputB = parentOutputs.get('B');
                        if (!inputA || !inputB) throw new Error("A/B node requires both inputs to be connected.");
                        
                        // Store both images in the node's data for the slider component to use
                        updateNodeData(nodeId, {
                            imageBase64A: inputA.base64,
                            mimeTypeA: inputA.mimeType,
                            imageBase64B: inputB.base64,
                            mimeTypeB: inputB.mimeType,
                        });
                        
                        // The output of this node for downstream processing is the 'B' image
                        currentOutputBase64 = inputB.base64;
                        currentMimeType = inputB.mimeType;
                        break;
                    case NodeType.Output:
                        if (defaultInput) {
                            currentOutputBase64 = defaultInput.base64;
                            currentMimeType = defaultInput.mimeType;
                        } else if(parentConns.length > 0) {
                            throw new Error("Output node is connected but parent data is missing.");
                        }
                        break;
                }

                if (generatedPrompt && defaultInput) {
                    currentOutputBase64 = await editImageWithNanoBanana(
                        defaultInput.base64,
                        defaultInput.mimeType,
                        generatedPrompt,
                        useMask ? inputNode.data.maskImageBase64 : null,
                        useMask ? inputNode.data.maskMimeType : null
                    );
                } else if (parentConns.length > 0 && !currentOutputBase64 && !generatedPrompt) {
                     // Pass-through case for nodes like color adjust with no changes
                     if (defaultInput) {
                        currentOutputBase64 = defaultInput.base64;
                        currentMimeType = defaultInput.mimeType;
                     }
                }
            }
            
            if (currentOutputBase64) {
                 processedOutputs.set(nodeId, { base64: currentOutputBase64, mimeType: currentMimeType });
                 updateNodeData(nodeId, { isLoading: false, outputImageBase64: currentOutputBase64 });
            } else if (node.type !== NodeType.Input) {
                // If a node didn't produce an output, it might be an issue or just not fully configured.
                 updateNodeData(nodeId, { isLoading: false, error: 'Node did not produce an output.' });
            }


            // Decrement in-degree of children and add to queue if they are ready
            const children = adjList.get(nodeId) || [];
            for (const childId of children) {
                const newInDegree = (inDegrees.get(childId) || 0) - 1;
                inDegrees.set(childId, newInDegree);
                if (newInDegree === 0) {
                    queue.push(childId);
                }
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
            updateNodeData(nodeId, { isLoading: false, error: errorMessage });
            // Stop processing if a node fails? For now, we continue with other branches if possible.
        }
    }
    
    setIsProcessing(false);

  }, [nodes, connections, updateNodeData]);

  const canRun = useMemo(() => {
      const inputNode = nodes.find(n => n.type === NodeType.Input);
      return !!inputNode?.data.imageBase64;
  }, [nodes]);

  return (
    <div className="w-screen h-screen flex flex-col font-sans">
        <header className="flex-shrink-0 bg-gray-900/80 backdrop-blur-sm p-3 border-b border-gray-700 shadow-md z-20">
            <h1 className="text-xl font-bold text-center">
                <span className="text-yellow-400">Nano Banana</span> Node-Based Image Editor
            </h1>
        </header>
        <main className="flex-grow relative">
            <Toolbar 
              onAddNode={addNode} 
              onRunWorkflow={runWorkflow}
              isProcessing={isProcessing}
              canRun={canRun}
            />
            <NodeCanvas 
                nodes={nodes} 
                connections={connections} 
                setNodes={setNodes}
                setConnections={setConnections}
                onToggleLock={toggleNodeLock}
            />
        </main>
    </div>
  );
};

export default App;