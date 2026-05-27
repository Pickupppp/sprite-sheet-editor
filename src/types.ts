export type LoadedImage = {
  imageData: ImageData;
  sourceImageData: ImageData;
  name: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  sourceType: 'image' | 'video';
  extractedFrameCount?: number;
  sourceFrameWidth?: number;
  sourceFrameHeight?: number;
};

export type ExportBackgroundMode = 'transparent' | 'solid';
export type ResolutionScale = 1 | 0.75 | 0.5 | 0.25;

export type RgbColor = {
  red: number;
  green: number;
  blue: number;
};

export type CanvasPoint = {
  x: number;
  y: number;
};

export type CropInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type CropInsetKey = keyof CropInsets;

export type SpriteFrame = {
  id: string;
  index: number;
  row: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
  imageData: ImageData;
};

export type FinalSequenceFrame = {
  id: string;
  sourceFrameId: string;
};

export type FinalSequenceRow = {
  id: string;
  frames: FinalSequenceFrame[];
};

export type CopiedFrameSource = {
  frameIndex: number;
  row: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceImageName: string;
};
