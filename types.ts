export enum NodeType {
  Input = 'INPUT',
  Edit = 'EDIT',
  Output = 'OUTPUT',
  Crop = 'CROP',
  Resize = 'RESIZE',
  ColorAdjust = 'COLOR_ADJUST',
  AB = 'AB',
}

export interface NodeData {
  prompt?: string;
  imageBase64?: string | null;
  outputImageBase64?: string | null;
  fileName?: string;
  isLoading?: boolean;
  error?: string | null;
  mimeType?: string;
  maskImageBase64?: string | null;
  maskMimeType?: string;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  resize?: {
    width: number | null;
    height: number | null;
    preserveAspectRatio: boolean;
  };
  colorAdjust?: {
    brightness: number;
    contrast: number;
    saturation: number;
  };
  // For A/B Node display
  imageBase64A?: string;
  mimeTypeA?: string;
  imageBase64B?: string;
  mimeTypeB?: string;
}

export interface Node {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
  isLocked?: boolean;
}

export interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  targetHandleId?: string;
}

export interface ProcessedNode extends Node {
  children: ProcessedNode[];
}