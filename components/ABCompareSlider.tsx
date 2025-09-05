
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LeftRightIcon } from './icons';

interface ABCompareSliderProps {
  base64ImageA: string;
  mimeTypeA: string;
  base64ImageB: string;
  mimeTypeB: string;
}

const ABCompareSlider: React.FC<ABCompareSliderProps> = ({
  base64ImageA, mimeTypeA,
  base64ImageB, mimeTypeB
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    setSliderPosition(percent);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    handleMove(e.clientX);
  };
  
  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDragging.current = false;
    };
    
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      handleMove(e.clientX);
    };
    
    const handleGlobalTouchEnd = () => {
        isDragging.current = false;
    }
    
    const handleGlobalTouchMove = (e: TouchEvent) => {
        if (!isDragging.current) return;
        handleMove(e.touches[0].clientX);
    }

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('touchend', handleGlobalTouchEnd);
    window.addEventListener('touchmove', handleGlobalTouchMove);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
    };
  }, [handleMove]);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video rounded-md overflow-hidden select-none cursor-ew-resize"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <img
        src={`data:${mimeTypeA};base64,${base64ImageA}`}
        alt="Before"
        className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
        draggable="false"
      />
      <div
        className="absolute top-0 left-0 w-full h-full object-contain overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img
          src={`data:${mimeTypeB};base64,${base64ImageB}`}
          alt="After"
          className="w-full h-full object-contain"
          draggable="false"
        />
      </div>
      <div
        className="absolute top-0 h-full w-1 bg-white/70 pointer-events-none"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 bg-white/70 text-black rounded-full p-1.5 backdrop-blur-sm">
          <LeftRightIcon />
        </div>
      </div>
    </div>
  );
};

export default ABCompareSlider;
