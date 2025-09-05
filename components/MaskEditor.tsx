import React, { useRef, useEffect, useState, useCallback } from 'react';
import { BrushIcon, EraserIcon, CloseIcon } from './icons';

interface MaskEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (maskBase64: string) => void;
  backgroundImageSrc?: string | null;
  backgroundImageMimeType?: string;
  initialMaskSrc?: string | null;
}

const MaskEditor: React.FC<MaskEditorProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    backgroundImageSrc, 
    backgroundImageMimeType, 
    initialMaskSrc 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [tool, setTool] = useState<'draw' | 'erase'>('draw');

  const drawOnCanvas = useCallback((ctx: CanvasRenderingContext2D, e: MouseEvent | TouchEvent) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if (e instanceof MouseEvent) {
        clientX = e.clientX;
        clientY = e.clientY;
    } else {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }

    const x = (clientX - rect.left) / rect.width * canvas.width;
    const y = (clientY - rect.top) / rect.height * canvas.height;

    ctx.fillStyle = tool === 'draw' ? 'white' : 'black';
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2 * (canvas.width / rect.width), 0, Math.PI * 2);
    ctx.fill();
  }, [tool, brushSize]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    drawOnCanvas(ctx, e.nativeEvent);
  }, [drawOnCanvas]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    drawOnCanvas(ctx, e.nativeEvent);
  }, [isDrawing, drawOnCanvas]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);
  
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    drawOnCanvas(ctx, e.nativeEvent);
  }, [drawOnCanvas]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    e.preventDefault();
    drawOnCanvas(ctx, e.nativeEvent);
  }, [isDrawing, drawOnCanvas]);

  useEffect(() => {
    if (!isOpen || !canvasRef.current || !backgroundImageSrc) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const bgImage = new Image();
    bgImage.onload = () => {
        canvas.width = bgImage.naturalWidth;
        canvas.height = bgImage.naturalHeight;
        
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (initialMaskSrc) {
            const maskImage = new Image();
            maskImage.onload = () => {
                ctx.drawImage(maskImage, 0, 0, canvas.width, canvas.height);
            };
            maskImage.src = `data:image/png;base64,${initialMaskSrc}`;
        }
    };
    bgImage.src = `data:${backgroundImageMimeType};base64,${backgroundImageSrc}`;

  }, [isOpen, backgroundImageSrc, backgroundImageMimeType, initialMaskSrc]);

  const handleSave = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    onSave(base64);
  };
  
  const handleClear = () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-4"
        aria-modal="true"
        role="dialog"
    >
      <div className="absolute top-4 right-4">
          <button onClick={onClose} className="p-2 rounded-full text-gray-300 hover:bg-gray-700 hover:text-white transition-colors" aria-label="Close mask editor">
            <CloseIcon />
          </button>
      </div>

      <div ref={containerRef} className="relative w-full h-[calc(100%-100px)] flex items-center justify-center">
        {backgroundImageSrc && (
            <img 
                src={`data:${backgroundImageMimeType};base64,${backgroundImageSrc}`}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-50"
                alt="Image background for masking"
            />
        )}
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
        />
      </div>

      <div className="flex-shrink-0 mt-4 p-3 bg-gray-800/80 border border-gray-600 rounded-lg shadow-lg backdrop-blur-md flex items-center gap-6 text-white">
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setTool('draw')} 
                className={`p-2 rounded-md transition-colors ${tool === 'draw' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}
                title="Brush Tool (Draw editable area)"
            >
                <BrushIcon />
            </button>
            <button 
                onClick={() => setTool('erase')} 
                className={`p-2 rounded-md transition-colors ${tool === 'erase' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}
                title="Eraser Tool (Draw protected area)"
            >
                <EraserIcon />
            </button>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="brushSize" className="text-sm">Brush Size</label>
          <input
            id="brushSize"
            type="range"
            min="2"
            max="150"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-32 accent-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
            <button onClick={handleClear} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors text-sm">Clear</button>
            <button onClick={onClose} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm">Save Mask</button>
        </div>
      </div>
    </div>
  );
};

export default MaskEditor;
