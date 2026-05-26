import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type LoadedImage = {
  imageData: ImageData;
  sourceImageData: ImageData;
  name: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
};

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const RESOLUTION_SCALE_OPTIONS = [1, 0.75, 0.5, 0.25] as const;
const DEFAULT_RESOLUTION_SCALE = 1;
const MIN_BRUSH_SIZE = 1;
const MAX_BRUSH_SIZE = 32;
const DEFAULT_BRUSH_SIZE = 4;
const DEFAULT_BACKGROUND_COLOR = '#ffffff';
const DEFAULT_BACKGROUND_TOLERANCE = 12;
const MAX_BACKGROUND_TOLERANCE = 80;
const DEFAULT_PREVIEW_BACKGROUND_COLOR = '#2f6f7e';
const DEFAULT_EXPORT_BACKGROUND_COLOR = '#ffffff';
const DEFAULT_GRID_ROWS = 4;
const DEFAULT_GRID_COLUMNS = 4;
const MIN_GRID_SIZE = 1;
const MAX_GRID_SIZE = 12;
const DEFAULT_ANIMATION_FRAME_INTERVAL_MS = 180;
const MIN_ANIMATION_FRAME_INTERVAL_MS = 60;
const MAX_ANIMATION_FRAME_INTERVAL_MS = 1000;

type ExportBackgroundMode = 'transparent' | 'solid';
type ResolutionScale = (typeof RESOLUTION_SCALE_OPTIONS)[number];

type RgbColor = {
  red: number;
  green: number;
  blue: number;
};

type CanvasPoint = {
  x: number;
  y: number;
};

type SpriteFrame = {
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

type FinalSequenceFrame = {
  id: string;
  sourceFrameId: string;
};

type FinalSequenceRow = {
  id: string;
  frames: FinalSequenceFrame[];
};

type CopiedFrameSource = {
  frameIndex: number;
  row: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceImageName: string;
};

function hexToRgb(hexColor: string): RgbColor {
  const normalizedColor = hexColor.replace('#', '');
  const colorNumber = Number.parseInt(normalizedColor, 16);

  return {
    red: (colorNumber >> 16) & 255,
    green: (colorNumber >> 8) & 255,
    blue: colorNumber & 255,
  };
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

function readBitmapImageData(bitmap: ImageBitmap) {
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = bitmap.width;
  sourceCanvas.height = bitmap.height;

  const context = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas context is not available.');
  }

  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, bitmap.width, bitmap.height);
}

function resizeImageData(sourceImageData: ImageData, resolutionScale: ResolutionScale) {
  if (resolutionScale === 1) {
    return new ImageData(
      new Uint8ClampedArray(sourceImageData.data),
      sourceImageData.width,
      sourceImageData.height,
    );
  }

  const targetWidth = Math.max(1, Math.round(sourceImageData.width * resolutionScale));
  const targetHeight = Math.max(1, Math.round(sourceImageData.height * resolutionScale));
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sourceImageData.width;
  sourceCanvas.height = sourceImageData.height;

  const sourceContext = sourceCanvas.getContext('2d');
  if (!sourceContext) {
    throw new Error('Canvas context is not available.');
  }

  sourceContext.putImageData(sourceImageData, 0, 0);

  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = targetWidth;
  targetCanvas.height = targetHeight;

  const targetContext = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!targetContext) {
    throw new Error('Canvas context is not available.');
  }

  targetContext.imageSmoothingEnabled = false;
  targetContext.clearRect(0, 0, targetWidth, targetHeight);
  targetContext.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

  return targetContext.getImageData(0, 0, targetWidth, targetHeight);
}

function parseResolutionScale(value: string): ResolutionScale {
  const numericValue = Number(value);
  return (
    RESOLUTION_SCALE_OPTIONS.find((resolutionScale) => resolutionScale === numericValue) ??
    DEFAULT_RESOLUTION_SCALE
  );
}

function formatResolutionScale(resolutionScale: ResolutionScale) {
  return `${Math.round(resolutionScale * 100)}%`;
}

function renderScaledImageDataToCanvas(
  canvas: HTMLCanvasElement,
  imageData: ImageData,
  scale: number,
) {
  canvas.width = imageData.width * scale;
  canvas.height = imageData.height * scale;

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = imageData.width;
  sourceCanvas.height = imageData.height;

  const sourceContext = sourceCanvas.getContext('2d');
  if (!sourceContext) {
    return;
  }

  sourceContext.putImageData(imageData, 0, 0);
  context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
}

function removeMatchingBackground(
  sourceImageData: ImageData,
  backgroundColor: string,
  tolerance: number,
) {
  const targetColor = hexToRgb(backgroundColor);
  const pixels = new Uint8ClampedArray(sourceImageData.data);
  let transparentPixelCount = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const isMatchingBackground =
      Math.abs(pixels[index] - targetColor.red) <= tolerance &&
      Math.abs(pixels[index + 1] - targetColor.green) <= tolerance &&
      Math.abs(pixels[index + 2] - targetColor.blue) <= tolerance &&
      pixels[index + 3] > 0;

    if (isMatchingBackground) {
      pixels[index + 3] = 0;
      transparentPixelCount += 1;
    }
  }

  return {
    imageData: new ImageData(pixels, sourceImageData.width, sourceImageData.height),
    transparentPixelCount,
  };
}

function erasePixelsAlongPath(
  sourceImageData: ImageData,
  fromPoint: CanvasPoint,
  toPoint: CanvasPoint,
  brushSize: number,
) {
  const pixels = new Uint8ClampedArray(sourceImageData.data);
  const radius = Math.max(0.5, brushSize / 2);
  const radiusSquared = radius * radius;
  const stepCount = Math.max(
    Math.abs(toPoint.x - fromPoint.x),
    Math.abs(toPoint.y - fromPoint.y),
    1,
  );
  let erasedPixelCount = 0;

  function eraseAt(centerX: number, centerY: number) {
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(sourceImageData.width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(sourceImageData.height - 1, Math.ceil(centerY + radius));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distanceX = x - centerX;
        const distanceY = y - centerY;

        if (distanceX * distanceX + distanceY * distanceY > radiusSquared) {
          continue;
        }

        const alphaIndex = (y * sourceImageData.width + x) * 4 + 3;
        if (pixels[alphaIndex] > 0) {
          pixels[alphaIndex] = 0;
          erasedPixelCount += 1;
        }
      }
    }
  }

  for (let step = 0; step <= stepCount; step += 1) {
    const progress = step / stepCount;
    eraseAt(
      fromPoint.x + (toPoint.x - fromPoint.x) * progress,
      fromPoint.y + (toPoint.y - fromPoint.y) * progress,
    );
  }

  return {
    erasedPixelCount,
    imageData: new ImageData(pixels, sourceImageData.width, sourceImageData.height),
  };
}

function sliceSpriteSheet(sourceImageData: ImageData, rows: number, columns: number) {
  const frames: SpriteFrame[] = [];

  for (let row = 0; row < rows; row += 1) {
    const y = Math.floor((sourceImageData.height * row) / rows);
    const nextY = Math.floor((sourceImageData.height * (row + 1)) / rows);
    const height = Math.max(1, nextY - y);

    for (let column = 0; column < columns; column += 1) {
      const x = Math.floor((sourceImageData.width * column) / columns);
      const nextX = Math.floor((sourceImageData.width * (column + 1)) / columns);
      const width = Math.max(1, nextX - x);
      const framePixels = new Uint8ClampedArray(width * height * 4);

      for (let frameY = 0; frameY < height; frameY += 1) {
        for (let frameX = 0; frameX < width; frameX += 1) {
          const sourceIndex = ((y + frameY) * sourceImageData.width + x + frameX) * 4;
          const targetIndex = (frameY * width + frameX) * 4;
          framePixels[targetIndex] = sourceImageData.data[sourceIndex];
          framePixels[targetIndex + 1] = sourceImageData.data[sourceIndex + 1];
          framePixels[targetIndex + 2] = sourceImageData.data[sourceIndex + 2];
          framePixels[targetIndex + 3] = sourceImageData.data[sourceIndex + 3];
        }
      }

      frames.push({
        id: `${row}-${column}-${x}-${y}-${width}-${height}`,
        index: frames.length,
        row,
        column,
        x,
        y,
        width,
        height,
        imageData: new ImageData(framePixels, width, height),
      });
    }
  }

  return frames;
}

function countTransparentPixels(imageData: ImageData) {
  let transparentPixelCount = 0;

  for (let index = 3; index < imageData.data.length; index += 4) {
    if (imageData.data[index] === 0) {
      transparentPixelCount += 1;
    }
  }

  return transparentPixelCount;
}

function createInitialFinalSequenceRows(): FinalSequenceRow[] {
  return [{ id: 'sequence-row-1', frames: [] }];
}

function getFrameRowWidth(frames: SpriteFrame[]) {
  return frames.reduce((totalWidth, frame) => totalWidth + frame.width, 0);
}

function getFrameRowHeight(frames: SpriteFrame[]) {
  return Math.max(...frames.map((frame) => frame.height));
}

function getExportCanvasSize(frameRows: SpriteFrame[][]) {
  return {
    width: Math.max(...frameRows.map(getFrameRowWidth)),
    height: frameRows.reduce((totalHeight, frames) => totalHeight + getFrameRowHeight(frames), 0),
  };
}

function createExportCanvas(frameRows: SpriteFrame[][], backgroundColor: string | null) {
  const { width, height } = getExportCanvasSize(frameRows);
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;

  const exportContext = exportCanvas.getContext('2d');
  if (!exportContext) {
    throw new Error('Canvas context is not available.');
  }

  exportContext.imageSmoothingEnabled = false;
  exportContext.clearRect(0, 0, width, height);

  if (backgroundColor) {
    exportContext.fillStyle = backgroundColor;
    exportContext.fillRect(0, 0, width, height);
  }

  let offsetY = 0;
  frameRows.forEach((frames) => {
    let offsetX = 0;
    const rowHeight = getFrameRowHeight(frames);

    frames.forEach((frame) => {
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = frame.width;
      frameCanvas.height = frame.height;

      const frameContext = frameCanvas.getContext('2d');
      if (!frameContext) {
        throw new Error('Canvas context is not available.');
      }

      frameContext.imageSmoothingEnabled = false;
      frameContext.putImageData(frame.imageData, 0, 0);
      exportContext.drawImage(frameCanvas, offsetX, offsetY);
      offsetX += frame.width;
    });

    offsetY += rowHeight;
  });

  return exportCanvas;
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function getExportFileName(imageName: string, backgroundMode: ExportBackgroundMode) {
  const nameWithoutExtension = imageName.replace(/\.[^/.]+$/, '');
  const safeBaseName = nameWithoutExtension.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '');
  const modeSuffix = backgroundMode === 'transparent' ? 'transparent' : 'solid-bg';

  return `${safeBaseName || 'sprite-sequence'}-${modeSuffix}.png`;
}

function getCanvasPixelPoint(
  canvas: HTMLCanvasElement,
  image: LoadedImage,
  clientX: number,
  clientY: number,
) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((clientX - rect.left) / rect.width) * image.width);
  const y = Math.floor(((clientY - rect.top) / rect.height) * image.height);

  if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
    return null;
  }

  return { x, y };
}

function FramePreviewCanvas({
  frame,
  previewBackgroundColor,
  isBackgroundPreviewEnabled,
}: {
  frame: SpriteFrame;
  previewBackgroundColor: string;
  isBackgroundPreviewEnabled: boolean;
}) {
  const frameCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const previewStyle: React.CSSProperties | undefined = isBackgroundPreviewEnabled
    ? { backgroundColor: previewBackgroundColor, backgroundImage: 'none' }
    : undefined;

  React.useEffect(() => {
    const canvas = frameCanvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.width = frame.width;
    canvas.height = frame.height;

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.imageSmoothingEnabled = false;
    context.putImageData(frame.imageData, 0, 0);
  }, [frame]);

  return (
    <span className="frame-preview" style={previewStyle}>
      <canvas
        ref={frameCanvasRef}
        className="frame-canvas"
        aria-label={`第 ${frame.index + 1} 帧预览`}
      />
    </span>
  );
}

function SequencePreviewCanvas({
  frames,
  previewBackgroundColor,
  isBackgroundPreviewEnabled,
}: {
  frames: SpriteFrame[];
  previewBackgroundColor: string;
  isBackgroundPreviewEnabled: boolean;
}) {
  const sequenceCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const previewStyle: React.CSSProperties | undefined = isBackgroundPreviewEnabled
    ? { backgroundColor: previewBackgroundColor, backgroundImage: 'none' }
    : undefined;

  React.useEffect(() => {
    const canvas = sequenceCanvasRef.current;
    if (!canvas || frames.length === 0) {
      return;
    }

    const width = frames.reduce((totalWidth, frame) => totalWidth + frame.width, 0);
    const height = Math.max(...frames.map((frame) => frame.height));
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, width, height);

    let offsetX = 0;
    frames.forEach((frame) => {
      context.putImageData(frame.imageData, offsetX, 0);
      offsetX += frame.width;
    });
  }, [frames]);

  return (
    <div className="sequence-preview" style={previewStyle}>
      <canvas
        ref={sequenceCanvasRef}
        className="sequence-canvas"
        aria-label={`最终帧序列重组预览，共 ${frames.length} 帧`}
      />
    </div>
  );
}

function AnimationPreviewCanvas({
  frames,
  rowNumber,
  isPlaying,
  frameIntervalMs,
  previewBackgroundColor,
  isBackgroundPreviewEnabled,
  onTogglePlayback,
}: {
  frames: SpriteFrame[];
  rowNumber: number;
  isPlaying: boolean;
  frameIntervalMs: number;
  previewBackgroundColor: string;
  isBackgroundPreviewEnabled: boolean;
  onTogglePlayback: () => void;
}) {
  const animationCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const [frameIndex, setFrameIndex] = React.useState(0);
  const previewStyle: React.CSSProperties | undefined = isBackgroundPreviewEnabled
    ? { backgroundColor: previewBackgroundColor, backgroundImage: 'none' }
    : undefined;

  const previewWidth = React.useMemo(() => {
    return Math.max(...frames.map((frame) => frame.width));
  }, [frames]);

  const previewHeight = React.useMemo(() => {
    return Math.max(...frames.map((frame) => frame.height));
  }, [frames]);

  React.useEffect(() => {
    setFrameIndex(0);
  }, [frames]);

  React.useEffect(() => {
    if (!isPlaying || frames.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setFrameIndex((currentIndex) => (currentIndex + 1) % frames.length);
    }, frameIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [frameIntervalMs, frames.length, isPlaying]);

  React.useEffect(() => {
    const canvas = animationCanvasRef.current;
    const frame = frames[frameIndex] ?? frames[0];
    if (!canvas || !frame) {
      return;
    }

    canvas.width = previewWidth;
    canvas.height = previewHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, previewWidth, previewHeight);
    context.putImageData(
      frame.imageData,
      Math.floor((previewWidth - frame.width) / 2),
      Math.floor((previewHeight - frame.height) / 2),
    );
  }, [frameIndex, frames, previewHeight, previewWidth]);

  return (
    <div className="animation-preview-panel">
      <div className="animation-preview__header">
        <div>
          <p className="label">第 {rowNumber} 行动画预览</p>
          <strong>
            帧 {Math.min(frameIndex + 1, frames.length)} / {frames.length} · {frameIntervalMs}ms
          </strong>
        </div>
        <button
          type="button"
          className={isPlaying ? 'mini-button mini-button--active' : 'mini-button'}
          onClick={onTogglePlayback}
          aria-pressed={isPlaying}
        >
          {isPlaying ? '暂停' : '播放'}
        </button>
      </div>
      <div className="animation-preview" style={previewStyle}>
        <canvas
          ref={animationCanvasRef}
          className="animation-canvas"
          aria-label={`最终序列第 ${rowNumber} 行循环动画预览`}
        />
      </div>
    </div>
  );
}

function App() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const imageDataRef = React.useRef<ImageData | null>(null);
  const sequenceFrameCounterRef = React.useRef(0);
  const sequenceRowCounterRef = React.useRef(1);
  const isErasingRef = React.useRef(false);
  const lastErasePointRef = React.useRef<CanvasPoint | null>(null);
  const [image, setImage] = React.useState<LoadedImage | null>(null);
  const [scale, setScale] = React.useState(2);
  const [resolutionScale, setResolutionScale] = React.useState<ResolutionScale>(
    DEFAULT_RESOLUTION_SCALE,
  );
  const [isEraserMode, setIsEraserMode] = React.useState(false);
  const [brushSize, setBrushSize] = React.useState(DEFAULT_BRUSH_SIZE);
  const [backgroundColor, setBackgroundColor] = React.useState(DEFAULT_BACKGROUND_COLOR);
  const [hasBackgroundColorSelection, setHasBackgroundColorSelection] = React.useState(false);
  const [backgroundTolerance, setBackgroundTolerance] = React.useState(
    DEFAULT_BACKGROUND_TOLERANCE,
  );
  const [isBackgroundPreviewEnabled, setIsBackgroundPreviewEnabled] = React.useState(false);
  const [previewBackgroundColor, setPreviewBackgroundColor] = React.useState(
    DEFAULT_PREVIEW_BACKGROUND_COLOR,
  );
  const [gridRows, setGridRows] = React.useState(DEFAULT_GRID_ROWS);
  const [gridColumns, setGridColumns] = React.useState(DEFAULT_GRID_COLUMNS);
  const [selectedFrameId, setSelectedFrameId] = React.useState<string | null>(null);
  const [finalSequenceRows, setFinalSequenceRows] = React.useState<FinalSequenceRow[]>(
    createInitialFinalSequenceRows,
  );
  const [selectedSequenceRowId, setSelectedSequenceRowId] = React.useState('sequence-row-1');
  const [playingSequenceRowIds, setPlayingSequenceRowIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [animationFrameIntervalMs, setAnimationFrameIntervalMs] = React.useState(
    DEFAULT_ANIMATION_FRAME_INTERVAL_MS,
  );
  const [copiedFrameSource, setCopiedFrameSource] = React.useState<CopiedFrameSource | null>(null);
  const [exportBackgroundMode, setExportBackgroundMode] =
    React.useState<ExportBackgroundMode>('transparent');
  const [exportBackgroundColor, setExportBackgroundColor] = React.useState(
    DEFAULT_EXPORT_BACKGROUND_COLOR,
  );
  const [backgroundRemovalStatus, setBackgroundRemovalStatus] = React.useState('');
  const [exportStatus, setExportStatus] = React.useState('');
  const [error, setError] = React.useState('');

  const currentTransparentPixelCount = React.useMemo(() => {
    return image ? countTransparentPixels(image.imageData) : 0;
  }, [image]);

  const processedImageData = React.useMemo(() => {
    if (!image) {
      return null;
    }

    if (!hasBackgroundColorSelection) {
      return {
        imageData: image.imageData,
        transparentPixelCount: 0,
      };
    }

    return removeMatchingBackground(image.imageData, backgroundColor, backgroundTolerance);
  }, [backgroundColor, backgroundTolerance, hasBackgroundColorSelection, image]);

  const backgroundTransparentPixelCount = processedImageData?.transparentPixelCount ?? 0;
  const transparentPreviewStyle: React.CSSProperties | undefined = isBackgroundPreviewEnabled
    ? { backgroundColor: previewBackgroundColor }
    : undefined;

  const spriteFrames = React.useMemo(() => {
    return processedImageData
      ? sliceSpriteSheet(processedImageData.imageData, gridRows, gridColumns)
      : [];
  }, [gridColumns, gridRows, processedImageData]);

  const selectedFrame =
    spriteFrames.find((frame) => frame.id === selectedFrameId) ?? spriteFrames[0] ?? null;

  const finalSequenceRowsWithItems = React.useMemo(() => {
    return finalSequenceRows.map((row) => ({
      row,
      items: row.frames
        .map((sequenceFrame) => {
          const frame = spriteFrames.find(
            (spriteFrame) => spriteFrame.id === sequenceFrame.sourceFrameId,
          );
          return frame ? { sequenceFrame, frame } : null;
        })
        .filter((item): item is { sequenceFrame: FinalSequenceFrame; frame: SpriteFrame } =>
          Boolean(item),
        ),
    }));
  }, [finalSequenceRows, spriteFrames]);

  const selectedSequenceRow =
    finalSequenceRows.find((row) => row.id === selectedSequenceRowId) ?? finalSequenceRows[0];

  const selectedSequenceRowNumber = Math.max(
    1,
    finalSequenceRows.findIndex((row) => row.id === selectedSequenceRow?.id) + 1,
  );

  const finalSequenceFrameRowsForExport = React.useMemo(() => {
    return finalSequenceRowsWithItems
      .map(({ items }) => items.map((item) => item.frame))
      .filter((frames) => frames.length > 0);
  }, [finalSequenceRowsWithItems]);

  const exportCanvasSize = React.useMemo(() => {
    return finalSequenceFrameRowsForExport.length > 0
      ? getExportCanvasSize(finalSequenceFrameRowsForExport)
      : null;
  }, [finalSequenceFrameRowsForExport]);

  const totalFinalSequenceFrameCount = React.useMemo(() => {
    return finalSequenceRows.reduce((total, row) => total + row.frames.length, 0);
  }, [finalSequenceRows]);

  React.useEffect(() => {
    imageDataRef.current = image?.imageData ?? null;
  }, [image]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) {
      return;
    }

    if (!processedImageData) {
      return;
    }

    renderScaledImageDataToCanvas(canvas, processedImageData.imageData, scale);
  }, [image, processedImageData, scale]);

  React.useEffect(() => {
    const currentRowIds = new Set(finalSequenceRows.map((row) => row.id));

    setPlayingSequenceRowIds((currentPlayingRowIds) => {
      const nextPlayingRowIds = new Set<string>();
      currentPlayingRowIds.forEach((rowId) => {
        if (currentRowIds.has(rowId)) {
          nextPlayingRowIds.add(rowId);
        }
      });

      return nextPlayingRowIds.size === currentPlayingRowIds.size
        ? currentPlayingRowIds
        : nextPlayingRowIds;
    });
  }, [finalSequenceRows]);

  function resetFrameAssembly() {
    setSelectedFrameId(null);
    sequenceFrameCounterRef.current = 0;
    sequenceRowCounterRef.current = 1;
    setFinalSequenceRows(createInitialFinalSequenceRows());
    setSelectedSequenceRowId('sequence-row-1');
    setPlayingSequenceRowIds(new Set());
    setCopiedFrameSource(null);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError('');

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('请选择有效的图片文件。');
      event.target.value = '';
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const sourceImageData = readBitmapImageData(bitmap);
      const imageData = resizeImageData(sourceImageData, DEFAULT_RESOLUTION_SCALE);
      const originalWidth = bitmap.width;
      const originalHeight = bitmap.height;
      bitmap.close();
      setImage({
        imageData,
        sourceImageData,
        name: file.name,
        width: imageData.width,
        height: imageData.height,
        originalWidth,
        originalHeight,
      });
      setResolutionScale(DEFAULT_RESOLUTION_SCALE);
      resetFrameAssembly();
      setHasBackgroundColorSelection(false);
      setBackgroundRemovalStatus('');
      setExportStatus('');
    } catch {
      setError('图片解码失败，请换一张图片重试。');
    }
  }

  function handleResolutionScaleChange(value: string) {
    const nextResolutionScale = parseResolutionScale(value);
    setResolutionScale(nextResolutionScale);

    if (!image) {
      return;
    }

    try {
      const imageData = resizeImageData(image.sourceImageData, nextResolutionScale);
      setImage({
        ...image,
        imageData,
        width: imageData.width,
        height: imageData.height,
      });
      resetFrameAssembly();
      setHasBackgroundColorSelection(false);
      setBackgroundRemovalStatus(
        nextResolutionScale === 1
          ? '已恢复原始处理分辨率，请重新取色。'
          : `已将处理分辨率缩小到 ${formatResolutionScale(nextResolutionScale)}，请重新取色。`,
      );
      setExportStatus('');
    } catch {
      setError('调整处理分辨率失败，当前浏览器无法重新采样图片。');
    }
  }

  function handleCanvasPick(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!image || isEraserMode) {
      return;
    }

    const point = getCanvasPixelPoint(event.currentTarget, image, event.clientX, event.clientY);
    if (!point) {
      return;
    }

    const pixelIndex = (point.y * image.width + point.x) * 4;
    const { data } = image.imageData;
    const alpha = data[pixelIndex + 3];

    if (alpha === 0) {
      setHasBackgroundColorSelection(false);
      setBackgroundRemovalStatus('点击的位置已经是透明像素，无需再按白色去背景。');
      return;
    }

    setBackgroundColor(rgbToHex(data[pixelIndex], data[pixelIndex + 1], data[pixelIndex + 2]));
    setHasBackgroundColorSelection(true);
    setBackgroundRemovalStatus('已取色，可根据预览调节容差后应用去背景。');
  }

  function handleApplyBackgroundRemoval() {
    if (!image) {
      return;
    }

    if (!hasBackgroundColorSelection) {
      setBackgroundRemovalStatus('请先点击一个不透明的背景像素取色。');
      return;
    }

    const removedBackground = removeMatchingBackground(
      image.imageData,
      backgroundColor,
      backgroundTolerance,
    );

    if (removedBackground.transparentPixelCount === 0) {
      setBackgroundRemovalStatus('没有找到匹配的不透明背景像素，请重新取色或调高容差。');
      return;
    }

    setImage({
      ...image,
      imageData: removedBackground.imageData,
    });
    setBackgroundRemovalStatus(
      `已将 ${removedBackground.transparentPixelCount} 个背景像素变为透明。`,
    );
  }

  function applyEraser(fromPoint: CanvasPoint, toPoint: CanvasPoint) {
    if (!image) {
      return;
    }

    const sourceImageData = imageDataRef.current ?? image.imageData;
    const erased = erasePixelsAlongPath(sourceImageData, fromPoint, toPoint, brushSize);

    if (erased.erasedPixelCount === 0) {
      return;
    }

    imageDataRef.current = erased.imageData;

    const previewImageData = hasBackgroundColorSelection
      ? removeMatchingBackground(erased.imageData, backgroundColor, backgroundTolerance).imageData
      : erased.imageData;
    if (canvasRef.current) {
      renderScaledImageDataToCanvas(canvasRef.current, previewImageData, scale);
    }

    setImage((currentImage) =>
      currentImage
        ? {
            ...currentImage,
            imageData: erased.imageData,
          }
        : currentImage,
    );
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!image || !isEraserMode) {
      return;
    }

    const point = getCanvasPixelPoint(event.currentTarget, image, event.clientX, event.clientY);
    if (!point) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    isErasingRef.current = true;
    lastErasePointRef.current = point;
    applyEraser(point, point);
  }

  function handleCanvasPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!image || !isEraserMode || !isErasingRef.current) {
      return;
    }

    const point = getCanvasPixelPoint(event.currentTarget, image, event.clientX, event.clientY);
    if (!point) {
      return;
    }

    event.preventDefault();
    applyEraser(lastErasePointRef.current ?? point, point);
    lastErasePointRef.current = point;
  }

  function stopErasing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    isErasingRef.current = false;
    lastErasePointRef.current = null;
  }

  function handleGridSizeChange(
    setter: React.Dispatch<React.SetStateAction<number>>,
    value: string,
  ) {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    setter(Math.min(MAX_GRID_SIZE, Math.max(MIN_GRID_SIZE, Math.round(nextValue))));
    setSelectedFrameId(null);
    sequenceFrameCounterRef.current = 0;
    sequenceRowCounterRef.current = 1;
    setFinalSequenceRows(createInitialFinalSequenceRows());
    setSelectedSequenceRowId('sequence-row-1');
    setPlayingSequenceRowIds(new Set());
    setCopiedFrameSource(null);
  }

  function handleCopySelectedFrameSource() {
    if (!selectedFrame || !image) {
      return;
    }

    setCopiedFrameSource({
      frameIndex: selectedFrame.index,
      row: selectedFrame.row,
      column: selectedFrame.column,
      x: selectedFrame.x,
      y: selectedFrame.y,
      width: selectedFrame.width,
      height: selectedFrame.height,
      sourceImageName: image.name,
    });
  }

  function handleAddSelectedFrameToSequence() {
    if (!selectedFrame) {
      return;
    }

    sequenceFrameCounterRef.current += 1;
    const targetRowId = selectedSequenceRow?.id ?? 'sequence-row-1';
    setFinalSequenceRows((currentRows) =>
      currentRows.map((row) =>
        row.id === targetRowId
          ? {
              ...row,
              frames: [
                ...row.frames,
                {
                  id: `sequence-${sequenceFrameCounterRef.current}`,
                  sourceFrameId: selectedFrame.id,
                },
              ],
            }
          : row,
      ),
    );
    setSelectedSequenceRowId(targetRowId);
    handleCopySelectedFrameSource();
  }

  function handleAddSequenceRow() {
    sequenceRowCounterRef.current += 1;
    const nextRow: FinalSequenceRow = {
      id: `sequence-row-${sequenceRowCounterRef.current}`,
      frames: [],
    };

    setFinalSequenceRows((currentRows) => [...currentRows, nextRow]);
    setSelectedSequenceRowId(nextRow.id);
  }

  function handleRemoveSequenceRow(rowId: string) {
    setFinalSequenceRows((currentRows) => {
      if (currentRows.length <= 1) {
        return currentRows;
      }

      const removedRowIndex = currentRows.findIndex((row) => row.id === rowId);
      const nextRows = currentRows.filter((row) => row.id !== rowId);

      if (rowId === selectedSequenceRowId) {
        const nextSelectedIndex = Math.max(0, Math.min(removedRowIndex, nextRows.length - 1));
        setSelectedSequenceRowId(nextRows[nextSelectedIndex].id);
      }

      return nextRows;
    });
  }

  function handleToggleSequenceRowPlayback(rowId: string) {
    setPlayingSequenceRowIds((currentPlayingRowIds) => {
      const nextPlayingRowIds = new Set(currentPlayingRowIds);
      if (nextPlayingRowIds.has(rowId)) {
        nextPlayingRowIds.delete(rowId);
      } else {
        nextPlayingRowIds.add(rowId);
      }

      return nextPlayingRowIds;
    });
  }

  function handleRemoveSequenceFrame(rowId: string, sequenceFrameId: string) {
    setFinalSequenceRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              frames: row.frames.filter((sequenceFrame) => sequenceFrame.id !== sequenceFrameId),
            }
          : row,
      ),
    );
  }

  function handleMoveSequenceFrame(rowId: string, sequenceFrameId: string, direction: -1 | 1) {
    setFinalSequenceRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        const currentIndex = row.frames.findIndex(
          (sequenceFrame) => sequenceFrame.id === sequenceFrameId,
        );
        const targetIndex = currentIndex + direction;

        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= row.frames.length) {
          return row;
        }

        const nextFrames = [...row.frames];
        [nextFrames[currentIndex], nextFrames[targetIndex]] = [
          nextFrames[targetIndex],
          nextFrames[currentIndex],
        ];
        return { ...row, frames: nextFrames };
      }),
    );
  }

  function handleExportFinalSequence() {
    setExportStatus('');

    if (!image || finalSequenceFrameRowsForExport.length === 0) {
      setExportStatus('请先添加至少一帧到任意最终序列行。');
      return;
    }

    try {
      const exportCanvas = createExportCanvas(
        finalSequenceFrameRowsForExport,
        exportBackgroundMode === 'solid' ? exportBackgroundColor : null,
      );

      exportCanvas.toBlob((blob) => {
        if (!blob) {
          setExportStatus('导出失败，请重试。');
          return;
        }

        downloadBlob(blob, getExportFileName(image.name, exportBackgroundMode));
        setExportStatus(
          `已生成 ${exportCanvas.width} × ${exportCanvas.height}px PNG，保留 ${finalSequenceFrameRowsForExport.length} 行布局与行内帧顺序。`,
        );
      }, 'image/png');
    } catch {
      setExportStatus('导出失败，当前浏览器无法创建 PNG。');
    }
  }

  return (
    <main className="app-shell">
      <section className="panel intro-panel">
        <p className="eyebrow">Sprite Sheet Editor · Task 11</p>
        <h1>背景处理、切帧与重组</h1>
        <p className="intro-copy">
          导入本地像素精灵图，处理背景和杂色后，按可调整网格生成独立帧并重组最终序列。
        </p>

        <label className="file-picker">
          <span>选择图片</span>
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </label>

        {error ? <p className="error-message">{error}</p> : null}
      </section>

      <section className="panel preview-panel">
        <div className="toolbar">
          <label className="toolbar-control toolbar-control--range">
            <span>
              <span className="label">预览缩放</span>
              <strong>{scale}x</strong>
            </span>
            <input
              type="range"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step="1"
              value={scale}
              onChange={(event) => setScale(Number(event.target.value))}
              aria-label="预览缩放"
            />
          </label>

          <label className="toolbar-control toolbar-control--select">
            <span>
              <span className="label">处理分辨率</span>
              <strong>{formatResolutionScale(resolutionScale)}</strong>
            </span>
            <select
              value={String(resolutionScale)}
              onChange={(event) => handleResolutionScaleChange(event.target.value)}
              disabled={!image}
              aria-label="处理分辨率"
            >
              {RESOLUTION_SCALE_OPTIONS.map((resolutionScaleOption) => (
                <option key={resolutionScaleOption} value={resolutionScaleOption}>
                  {formatResolutionScale(resolutionScaleOption)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section className="background-workflow" aria-label="去背景流程">
          <div className="background-workflow__header">
            <div>
              <p className="eyebrow">Remove Background</p>
              <h2>去背景色</h2>
            </div>
            <p className="background-workflow__summary">
              {image
                ? `当前预计可透明化 ${backgroundTransparentPixelCount} 个像素`
                : '导入图片后，点击画布背景即可取色'}
            </p>
          </div>

          <ol className="background-steps" aria-label="去背景操作步骤">
            <li>
              <strong>1. 取背景色</strong>
              <span>关闭橡皮擦后，点击画布里的背景区域。</span>
            </li>
            <li>
              <strong>2. 调整容差</strong>
              <span>先用较小值，背景没清干净再逐步调高。</span>
            </li>
            <li>
              <strong>3. 检查预览</strong>
              <span>开启背景预览色，更容易发现角色边缘杂色。</span>
            </li>
            <li>
              <strong>4. 应用透明</strong>
              <span>预览效果满意后，再写入当前图片数据。</span>
            </li>
          </ol>

          <div className="background-controls" aria-label="背景色处理设置">
            <label className="color-control">
              <span>
                <span className="label">待去除背景色</span>
                <strong>{backgroundColor}</strong>
              </span>
              <input
                type="color"
                value={backgroundColor}
                onChange={(event) => {
                  setBackgroundColor(event.target.value);
                  setHasBackgroundColorSelection(true);
                }}
                aria-label="待去除背景色"
              />
            </label>

            <label className="tolerance-control">
              <span>
                <span className="label">去背景容差</span>
                <strong>{backgroundTolerance}</strong>
              </span>
              <input
                type="range"
                min="0"
                max={MAX_BACKGROUND_TOLERANCE}
                step="1"
                value={backgroundTolerance}
                onChange={(event) => setBackgroundTolerance(Number(event.target.value))}
                aria-label="去背景颜色容差"
              />
            </label>

            <label className="switch-control switch-control--preview">
              <span>
                <span className="label">背景预览</span>
                <strong>{isBackgroundPreviewEnabled ? '开启' : '关闭'}</strong>
              </span>
              <input
                type="checkbox"
                checked={isBackgroundPreviewEnabled}
                onChange={(event) => setIsBackgroundPreviewEnabled(event.target.checked)}
                aria-label="是否开启背景预览色"
              />
            </label>

            <label className="color-control">
              <span>
                <span className="label">背景预览色</span>
                <strong>{previewBackgroundColor}</strong>
              </span>
              <input
                type="color"
                value={previewBackgroundColor}
                onChange={(event) => setPreviewBackgroundColor(event.target.value)}
                disabled={!isBackgroundPreviewEnabled}
                aria-label="背景预览色"
              />
            </label>

            <button
              type="button"
              className="tool-button background-apply-button"
              onClick={handleApplyBackgroundRemoval}
              disabled={
                !image || !hasBackgroundColorSelection || backgroundTransparentPixelCount === 0
              }
            >
              {!image
                ? '先导入图片'
                : !hasBackgroundColorSelection
                  ? '先取不透明背景色'
                  : backgroundTransparentPixelCount === 0
                  ? '无可应用像素'
                  : `应用为透明（${backgroundTransparentPixelCount} 像素）`}
            </button>
          </div>

          <p className="hint">
            取色和调容差会先更新预览，不会立刻改原图；只有点击“应用为透明”后，才会把当前匹配的背景像素写入为透明并参与切帧、重组和导出。
          </p>
          {backgroundRemovalStatus ? (
            <p className="background-status">{backgroundRemovalStatus}</p>
          ) : null}
        </section>

        <div className="eraser-controls" aria-label="橡皮擦设置">
          <button
            type="button"
            className={isEraserMode ? 'tool-button tool-button--active' : 'tool-button'}
            onClick={() => setIsEraserMode((currentMode) => !currentMode)}
            aria-pressed={isEraserMode}
          >
            {isEraserMode ? '橡皮擦已开启' : '开启橡皮擦'}
          </button>

          <label className="brush-control">
            <span>
              <span className="label">笔刷大小</span>
              <strong>{brushSize}px</strong>
            </span>
            <input
              type="range"
              min={MIN_BRUSH_SIZE}
              max={MAX_BRUSH_SIZE}
              step="1"
              value={brushSize}
              onChange={(event) => setBrushSize(Number(event.target.value))}
              aria-label="橡皮擦笔刷大小"
            />
          </label>

          <p className="hint">
            橡皮擦模式下拖动画布会把当前图片数据中的对应像素转为透明，并保留给后续处理流程使用。
          </p>
        </div>

        <div className="canvas-stage">
          {image ? (
            <div className="canvas-frame" style={transparentPreviewStyle}>
              <canvas
                ref={canvasRef}
                className={isEraserMode ? 'pixel-canvas pixel-canvas--eraser' : 'pixel-canvas'}
                onClick={handleCanvasPick}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={stopErasing}
                onPointerCancel={stopErasing}
                onPointerLeave={stopErasing}
                aria-label={
                  isEraserMode
                    ? `${image.name} 橡皮擦画布，拖动可擦除像素`
                    : `${image.name} 背景透明化预览，点击像素可取色`
                }
              />
            </div>
          ) : (
            <div className="empty-state">请选择一张图片开始预览</div>
          )}
        </div>

        {image ? (
          <p className="meta">
            {image.name} · 导入尺寸 {image.originalWidth} × {image.originalHeight}px · 处理尺寸{' '}
            {image.width} × {image.height}px · canvas 显示尺寸 {image.width * scale} ×{' '}
            {image.height * scale}px · 预计可透明化{' '}
            {backgroundTransparentPixelCount} 个像素 · 当前图片透明像素{' '}
            {currentTransparentPixelCount} 个
          </p>
        ) : null}
      </section>

      <section className="panel frames-panel">
        <div className="frames-header">
          <div>
            <p className="eyebrow">Sprite Slicing</p>
            <h2>精灵表切分</h2>
          </div>
          <p className="frames-summary">
            {image
              ? `${gridRows} 行 × ${gridColumns} 列，已生成 ${spriteFrames.length} 帧`
              : '导入图片后将按默认 4 行 4 列切分'}
          </p>
        </div>

        <div className="grid-controls" aria-label="精灵表切分设置">
          <label className="number-control">
            <span>
              <span className="label">行数</span>
              <strong>{gridRows}</strong>
            </span>
            <input
              type="number"
              min={MIN_GRID_SIZE}
              max={MAX_GRID_SIZE}
              value={gridRows}
              onChange={(event) => handleGridSizeChange(setGridRows, event.target.value)}
              aria-label="切分行数"
            />
          </label>

          <label className="number-control">
            <span>
              <span className="label">列数</span>
              <strong>{gridColumns}</strong>
            </span>
            <input
              type="number"
              min={MIN_GRID_SIZE}
              max={MAX_GRID_SIZE}
              value={gridColumns}
              onChange={(event) => handleGridSizeChange(setGridColumns, event.target.value)}
              aria-label="切分列数"
            />
          </label>

          <p className="hint">
            帧预览基于当前 ImageData 生成，会包含背景透明化结果与橡皮擦修改；调整行列数会清空当前最终序列。
          </p>
        </div>

        {image ? (
          <>
            <div className="frame-grid" aria-label="独立帧预览列表">
              {spriteFrames.map((frame) => {
                const isSelected = frame.id === selectedFrame?.id;

                return (
                  <button
                    type="button"
                    key={frame.id}
                    className={isSelected ? 'frame-card frame-card--selected' : 'frame-card'}
                    onClick={() => setSelectedFrameId(frame.id)}
                    aria-pressed={isSelected}
                  >
                    <FramePreviewCanvas
                      frame={frame}
                      previewBackgroundColor={previewBackgroundColor}
                      isBackgroundPreviewEnabled={isBackgroundPreviewEnabled}
                    />
                    <span className="frame-card__title">帧 {frame.index + 1}</span>
                    <span className="frame-card__meta">
                      第 {frame.row + 1} 行 / 第 {frame.column + 1} 列 · {frame.width} ×{' '}
                      {frame.height}px
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedFrame ? (
              <div className="selected-frame-panel">
                <div>
                  <p className="label">当前选择</p>
                  <strong>
                    帧 {selectedFrame.index + 1} · 第 {selectedFrame.row + 1} 行 / 第{' '}
                    {selectedFrame.column + 1} 列
                  </strong>
                  <p>
                    来源区域 x:{selectedFrame.x}, y:{selectedFrame.y}, 尺寸{' '}
                    {selectedFrame.width} × {selectedFrame.height}px
                  </p>
                </div>
                <button type="button" className="tool-button" onClick={handleAddSelectedFrameToSequence}>
                  添加到当前行
                </button>
              </div>
            ) : null}

            {copiedFrameSource ? (
              <div className="copy-source-panel">
                <p className="label">最近复制来源</p>
                <p>
                  {copiedFrameSource.sourceImageName} · 帧 {copiedFrameSource.frameIndex + 1} · 第{' '}
                  {copiedFrameSource.row + 1} 行 / 第 {copiedFrameSource.column + 1} 列 · 区域
                  x:{copiedFrameSource.x}, y:{copiedFrameSource.y}, {copiedFrameSource.width} ×{' '}
                  {copiedFrameSource.height}px
                </p>
              </div>
            ) : null}

            <section className="sequence-panel" aria-label="最终帧序列">
              <div className="sequence-header">
                <div>
                  <p className="eyebrow">Final Sequence</p>
                  <h2>多行最终帧序列</h2>
                </div>
                <p className="frames-summary">
                  共 {finalSequenceRows.length} 行 / {totalFinalSequenceFrameCount} 帧，当前编辑第{' '}
                  {selectedSequenceRowNumber} 行
                </p>
              </div>

              <div className="sequence-row-toolbar">
                <button type="button" className="tool-button" onClick={handleAddSequenceRow}>
                  新增最终序列行
                </button>
                <label className="animation-interval-control">
                  <span>
                    <span className="label">全局帧间隔</span>
                    <strong>{animationFrameIntervalMs}ms</strong>
                  </span>
                  <input
                    type="range"
                    min={MIN_ANIMATION_FRAME_INTERVAL_MS}
                    max={MAX_ANIMATION_FRAME_INTERVAL_MS}
                    step="20"
                    value={animationFrameIntervalMs}
                    onChange={(event) => setAnimationFrameIntervalMs(Number(event.target.value))}
                    aria-label="动画全局帧间隔"
                  />
                </label>
                <p className="hint">
                  点击“添加到当前行”会把选中的切分帧加入当前编辑行；每行可独立播放或暂停动画预览，导出会保留所有非空行的多行布局。
                </p>
              </div>

              <div className="sequence-rows" aria-label="最终序列行列表">
                {finalSequenceRowsWithItems.map(({ row, items }, rowIndex) => {
                  const isSelectedRow = row.id === selectedSequenceRow?.id;

                  return (
                    <article
                      className={
                        isSelectedRow
                          ? 'sequence-row sequence-row--selected'
                          : 'sequence-row'
                      }
                      key={row.id}
                    >
                      <div className="sequence-row__header">
                        <div>
                          <p className="label">最终序列行 {rowIndex + 1}</p>
                          <strong>
                            {items.length} 帧{isSelectedRow ? ' · 当前编辑行' : ''}
                          </strong>
                        </div>
                        <div className="sequence-row__actions">
                          <button
                            type="button"
                            className="mini-button"
                            onClick={() => setSelectedSequenceRowId(row.id)}
                            disabled={isSelectedRow}
                          >
                            设为当前行
                          </button>
                          <button
                            type="button"
                            className="mini-button mini-button--danger"
                            onClick={() => handleRemoveSequenceRow(row.id)}
                            disabled={finalSequenceRows.length === 1}
                          >
                            删除行
                          </button>
                        </div>
                      </div>

                      {items.length > 0 ? (
                        <>
                          <div className="sequence-list" aria-label={`最终序列第 ${rowIndex + 1} 行帧列表`}>
                            {items.map(({ sequenceFrame, frame }, sequenceIndex) => (
                              <article className="sequence-card" key={sequenceFrame.id}>
                                <FramePreviewCanvas
                                  frame={frame}
                                  previewBackgroundColor={previewBackgroundColor}
                                  isBackgroundPreviewEnabled={isBackgroundPreviewEnabled}
                                />
                                <div className="sequence-card__body">
                                  <strong>序列 {sequenceIndex + 1}</strong>
                                  <span>
                                    来源帧 {frame.index + 1} · 第 {frame.row + 1} 行 / 第{' '}
                                    {frame.column + 1} 列
                                  </span>
                                </div>
                                <div className="sequence-actions">
                                  <button
                                    type="button"
                                    className="mini-button"
                                    onClick={() => handleMoveSequenceFrame(row.id, sequenceFrame.id, -1)}
                                    disabled={sequenceIndex === 0}
                                  >
                                    上移
                                  </button>
                                  <button
                                    type="button"
                                    className="mini-button"
                                    onClick={() => handleMoveSequenceFrame(row.id, sequenceFrame.id, 1)}
                                    disabled={sequenceIndex === items.length - 1}
                                  >
                                    下移
                                  </button>
                                  <button
                                    type="button"
                                    className="mini-button mini-button--danger"
                                    onClick={() => handleRemoveSequenceFrame(row.id, sequenceFrame.id)}
                                  >
                                    删除
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>

                          <div className="sequence-preview-panel">
                            <p className="label">第 {rowIndex + 1} 行重组预览</p>
                            <SequencePreviewCanvas
                              frames={items.map((item) => item.frame)}
                              previewBackgroundColor={previewBackgroundColor}
                              isBackgroundPreviewEnabled={isBackgroundPreviewEnabled}
                            />
                          </div>

                          <AnimationPreviewCanvas
                            frames={items.map((item) => item.frame)}
                            rowNumber={rowIndex + 1}
                            isPlaying={playingSequenceRowIds.has(row.id)}
                            frameIntervalMs={animationFrameIntervalMs}
                            previewBackgroundColor={previewBackgroundColor}
                            isBackgroundPreviewEnabled={isBackgroundPreviewEnabled}
                            onTogglePlayback={() => handleToggleSequenceRowPlayback(row.id)}
                          />
                        </>
                      ) : (
                        <div className="empty-state sequence-empty-state">
                          选择任意切分帧后点击“添加到当前行”，可多次添加同一帧并调整顺序。
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {exportCanvasSize ? (
                <>
                  <div className="export-panel" aria-label="导出成品图设置">
                    <div className="export-header">
                      <div>
                        <p className="label">导出多行成品图</p>
                        <strong>
                          {exportCanvasSize.width} × {exportCanvasSize.height}px ·{' '}
                          {finalSequenceFrameRowsForExport.length} 行
                        </strong>
                      </div>
                      <button
                        type="button"
                        className="tool-button export-button"
                        onClick={handleExportFinalSequence}
                      >
                        导出多行 PNG
                      </button>
                    </div>

                    <div className="export-controls">
                      <label className="radio-control">
                        <input
                          type="radio"
                          name="export-background-mode"
                          value="transparent"
                          checked={exportBackgroundMode === 'transparent'}
                          onChange={() => setExportBackgroundMode('transparent')}
                        />
                        <span>透明背景 PNG</span>
                      </label>

                      <label className="radio-control">
                        <input
                          type="radio"
                          name="export-background-mode"
                          value="solid"
                          checked={exportBackgroundMode === 'solid'}
                          onChange={() => setExportBackgroundMode('solid')}
                        />
                        <span>填充背景色后导出</span>
                      </label>

                      <label className="color-control export-color-control">
                        <span>
                          <span className="label">导出背景色</span>
                          <strong>{exportBackgroundColor}</strong>
                        </span>
                        <input
                          type="color"
                          value={exportBackgroundColor}
                          onChange={(event) => setExportBackgroundColor(event.target.value)}
                          disabled={exportBackgroundMode !== 'solid'}
                          aria-label="导出背景色"
                        />
                      </label>
                    </div>

                    {exportStatus ? <p className="export-status">{exportStatus}</p> : null}
                  </div>
                </>
              ) : (
                null
              )}
            </section>
          </>
        ) : (
          <div className="empty-state frame-empty-state">请选择图片以生成 4 × 4 默认帧预览</div>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
