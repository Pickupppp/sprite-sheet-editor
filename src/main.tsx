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
  sourceType: 'image' | 'video';
  extractedFrameCount?: number;
  sourceFrameWidth?: number;
  sourceFrameHeight?: number;
};

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const RESOLUTION_SCALE_OPTIONS = [1, 0.75, 0.5, 0.25] as const;
const DEFAULT_RESOLUTION_SCALE = 1;
const MAX_VIDEO_FRAME_COUNT = 30;
const MAX_VIDEO_SPRITE_SHEET_WIDTH = 30000;
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
const MAX_GRID_SIZE = 30;
const DEFAULT_ALPHA_THRESHOLD = 8;
const DEFAULT_MIN_NEIGHBOR_COUNT = 1;
const DEFAULT_MIN_COMPONENT_SIZE = 4;
const DEFAULT_FRINGE_TOLERANCE = 72;
const DEFAULT_FRINGE_RADIUS = 1;
const DEFAULT_GRID_OVERLAY_SIZE = 16;
const DEFAULT_ANIMATION_FRAME_INTERVAL_MS = 180;
const MIN_ANIMATION_FRAME_INTERVAL_MS = 60;
const MAX_ANIMATION_FRAME_INTERVAL_MS = 1000;
const DEFAULT_PIXEL_BLOCK_SIZE = 4;
const MIN_PIXEL_BLOCK_SIZE = 1;
const MAX_PIXEL_BLOCK_SIZE = 32;
const DEFAULT_SNAP_ALPHA_THRESHOLD = 32;
const MAX_SNAP_ALPHA_THRESHOLD = 128;
const DEFAULT_QUANTIZE_COLOR_COUNT = 16;
const MIN_QUANTIZE_COLOR_COUNT = 2;
const MAX_QUANTIZE_COLOR_COUNT = 256;

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

type CropInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type CropInsetKey = keyof CropInsets;

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

function waitForVideoEvent(video: HTMLVideoElement, eventName: keyof HTMLMediaElementEventMap) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(eventName, handleEvent);
      video.removeEventListener('error', handleError);
    };
    const handleEvent = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Video could not be decoded.'));
    };

    video.addEventListener(eventName, handleEvent, { once: true });
    video.addEventListener('error', handleError, { once: true });
  });
}

function seekVideoTo(video: HTMLVideoElement, timestamp: number) {
  if (Math.abs(video.currentTime - timestamp) < 0.001 && video.readyState >= 2) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };
    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Video seek failed.'));
    };
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Video seek timed out.'));
    }, 8000);

    video.addEventListener('seeked', handleSeeked, { once: true });
    video.addEventListener('error', handleError, { once: true });
    video.currentTime = timestamp;
  });
}

async function readVideoSpriteSheetImageData(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  try {
    video.src = objectUrl;
    video.load();
    await waitForVideoEvent(video, 'loadedmetadata');

    const frameWidth = video.videoWidth;
    const frameHeight = video.videoHeight;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;

    if (frameWidth <= 0 || frameHeight <= 0) {
      throw new Error('Video dimensions are not available.');
    }

    if (video.readyState < 2) {
      await waitForVideoEvent(video, 'loadeddata');
    }

    const maxFrameCountByCanvasWidth = Math.max(
      1,
      Math.floor(MAX_VIDEO_SPRITE_SHEET_WIDTH / frameWidth),
    );
    const extractedFrameCount =
      duration > 0 ? Math.min(MAX_VIDEO_FRAME_COUNT, maxFrameCountByCanvasWidth) : 1;
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = frameWidth * extractedFrameCount;
    spriteCanvas.height = frameHeight;

    const spriteContext = spriteCanvas.getContext('2d', { willReadFrequently: true });
    if (!spriteContext) {
      throw new Error('Canvas context is not available.');
    }

    spriteContext.imageSmoothingEnabled = false;
    spriteContext.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height);

    for (let frameIndex = 0; frameIndex < extractedFrameCount; frameIndex += 1) {
      const timestamp =
        duration > 0
          ? Math.min(Math.max(duration - 0.001, 0), (duration * frameIndex) / extractedFrameCount)
          : 0;
      await seekVideoTo(video, timestamp);
      spriteContext.drawImage(video, frameIndex * frameWidth, 0, frameWidth, frameHeight);
    }

    return {
      duration,
      extractedFrameCount,
      frameHeight,
      frameWidth,
      imageData: spriteContext.getImageData(0, 0, spriteCanvas.width, spriteCanvas.height),
    };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
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

function createDefaultCropInsets(): CropInsets {
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
}

function clampCropValue(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function sanitizeCropInsets(cropInsets: CropInsets, width: number, height: number): CropInsets {
  const top = Math.min(clampCropValue(cropInsets.top), Math.max(0, height - 1));
  const bottom = Math.min(clampCropValue(cropInsets.bottom), Math.max(0, height - top - 1));
  const left = Math.min(clampCropValue(cropInsets.left), Math.max(0, width - 1));
  const right = Math.min(clampCropValue(cropInsets.right), Math.max(0, width - left - 1));

  return {
    top,
    right,
    bottom,
    left,
  };
}

function cropImageData(sourceImageData: ImageData, cropInsets: CropInsets) {
  const sanitizedCropInsets = sanitizeCropInsets(
    cropInsets,
    sourceImageData.width,
    sourceImageData.height,
  );
  const targetWidth = sourceImageData.width - sanitizedCropInsets.left - sanitizedCropInsets.right;
  const targetHeight = sourceImageData.height - sanitizedCropInsets.top - sanitizedCropInsets.bottom;

  if (
    targetWidth === sourceImageData.width &&
    targetHeight === sourceImageData.height &&
    sanitizedCropInsets.top === 0 &&
    sanitizedCropInsets.left === 0
  ) {
    return {
      cropInsets: sanitizedCropInsets,
      imageData: new ImageData(
        new Uint8ClampedArray(sourceImageData.data),
        sourceImageData.width,
        sourceImageData.height,
      ),
    };
  }

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sourceImageData.width;
  sourceCanvas.height = sourceImageData.height;

  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) {
    throw new Error('Canvas context is not available.');
  }

  sourceContext.putImageData(sourceImageData, 0, 0);

  return {
    cropInsets: sanitizedCropInsets,
    imageData: sourceContext.getImageData(
      sanitizedCropInsets.left,
      sanitizedCropInsets.top,
      targetWidth,
      targetHeight,
    ),
  };
}

function prepareImageData(
  sourceImageData: ImageData,
  resolutionScale: ResolutionScale,
  cropInsets: CropInsets,
) {
  const resizedImageData = resizeImageData(sourceImageData, resolutionScale);
  return cropImageData(resizedImageData, cropInsets);
}

function scaleCropInsets(
  cropInsets: CropInsets,
  currentResolutionScale: ResolutionScale,
  nextResolutionScale: ResolutionScale,
): CropInsets {
  const ratio = nextResolutionScale / currentResolutionScale;

  return {
    top: Math.round(cropInsets.top * ratio),
    right: Math.round(cropInsets.right * ratio),
    bottom: Math.round(cropInsets.bottom * ratio),
    left: Math.round(cropInsets.left * ratio),
  };
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

function drawGridOverlay(canvas: HTMLCanvasElement, imageData: ImageData, scale: number, cellSize: number) {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const scaledCellSize = Math.max(1, cellSize) * scale;
  context.save();
  context.strokeStyle = 'rgba(229, 183, 121, 0.36)';
  context.lineWidth = 1;

  for (let x = 0; x <= imageData.width * scale; x += scaledCellSize) {
    context.beginPath();
    context.moveTo(Math.round(x) + 0.5, 0);
    context.lineTo(Math.round(x) + 0.5, imageData.height * scale);
    context.stroke();
  }

  for (let y = 0; y <= imageData.height * scale; y += scaledCellSize) {
    context.beginPath();
    context.moveTo(0, Math.round(y) + 0.5);
    context.lineTo(imageData.width * scale, Math.round(y) + 0.5);
    context.stroke();
  }

  context.restore();
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

function getColorDistanceToRgb(data: Uint8ClampedArray, pixelIndex: number, color: RgbColor) {
  const redDistance = data[pixelIndex] - color.red;
  const greenDistance = data[pixelIndex + 1] - color.green;
  const blueDistance = data[pixelIndex + 2] - color.blue;

  return Math.sqrt(redDistance * redDistance + greenDistance * greenDistance + blueDistance * blueDistance);
}

function getAlphaIndex(width: number, x: number, y: number) {
  return (y * width + x) * 4 + 3;
}

function isNearTransparentPixel(imageData: ImageData, x: number, y: number, radius: number) {
  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) {
        continue;
      }

      const nextX = x + offsetX;
      const nextY = y + offsetY;
      if (
        nextX >= 0 &&
        nextY >= 0 &&
        nextX < imageData.width &&
        nextY < imageData.height &&
        imageData.data[getAlphaIndex(imageData.width, nextX, nextY)] === 0
      ) {
        return true;
      }
    }
  }

  return false;
}

function removeBackgroundFringe(
  sourceImageData: ImageData,
  backgroundColor: string,
  fringeTolerance: number,
  edgeRadius: number,
) {
  const targetColor = hexToRgb(backgroundColor);
  const pixels = new Uint8ClampedArray(sourceImageData.data);
  let transparentPixelCount = 0;
  let recoloredPixelCount = 0;

  for (let y = 0; y < sourceImageData.height; y += 1) {
    for (let x = 0; x < sourceImageData.width; x += 1) {
      const pixelIndex = (y * sourceImageData.width + x) * 4;
      if (sourceImageData.data[pixelIndex + 3] === 0) {
        continue;
      }

      if (!isNearTransparentPixel(sourceImageData, x, y, edgeRadius)) {
        continue;
      }

      const distanceToBackground = getColorDistanceToRgb(sourceImageData.data, pixelIndex, targetColor);
      if (distanceToBackground <= fringeTolerance) {
        pixels[pixelIndex + 3] = 0;
        transparentPixelCount += 1;
        continue;
      }

      let redTotal = 0;
      let greenTotal = 0;
      let blueTotal = 0;
      let sampleCount = 0;

      for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
        for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (
            (offsetX === 0 && offsetY === 0) ||
            nextX < 0 ||
            nextY < 0 ||
            nextX >= sourceImageData.width ||
            nextY >= sourceImageData.height
          ) {
            continue;
          }

          const sampleIndex = (nextY * sourceImageData.width + nextX) * 4;
          if (
            sourceImageData.data[sampleIndex + 3] === 0 ||
            isNearTransparentPixel(sourceImageData, nextX, nextY, edgeRadius) ||
            getColorDistanceToRgb(sourceImageData.data, sampleIndex, targetColor) <= fringeTolerance
          ) {
            continue;
          }

          redTotal += sourceImageData.data[sampleIndex];
          greenTotal += sourceImageData.data[sampleIndex + 1];
          blueTotal += sourceImageData.data[sampleIndex + 2];
          sampleCount += 1;
        }
      }

      if (sampleCount > 0 && distanceToBackground <= fringeTolerance * 1.8) {
        pixels[pixelIndex] = Math.round(redTotal / sampleCount);
        pixels[pixelIndex + 1] = Math.round(greenTotal / sampleCount);
        pixels[pixelIndex + 2] = Math.round(blueTotal / sampleCount);
        recoloredPixelCount += 1;
      }
    }
  }

  return {
    imageData: new ImageData(pixels, sourceImageData.width, sourceImageData.height),
    recoloredPixelCount,
    transparentPixelCount,
  };
}

function cleanPixelNoise(
  sourceImageData: ImageData,
  alphaThreshold: number,
  minNeighborCount: number,
  minComponentSize: number,
) {
  const width = sourceImageData.width;
  const height = sourceImageData.height;
  const pixels = new Uint8ClampedArray(sourceImageData.data);
  let removedPixelCount = 0;

  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] > 0 && pixels[index] <= alphaThreshold) {
      pixels[index] = 0;
      removedPixelCount += 1;
    }
  }

  const alphaSnapshot = new Uint8ClampedArray(pixels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alphaIndex = getAlphaIndex(width, x, y);
      if (alphaSnapshot[alphaIndex] === 0) {
        continue;
      }

      let neighborCount = 0;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) {
            continue;
          }

          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (
            nextX >= 0 &&
            nextY >= 0 &&
            nextX < width &&
            nextY < height &&
            alphaSnapshot[getAlphaIndex(width, nextX, nextY)] > 0
          ) {
            neighborCount += 1;
          }
        }
      }

      if (neighborCount < minNeighborCount) {
        pixels[alphaIndex] = 0;
        removedPixelCount += 1;
      }
    }
  }

  const visited = new Uint8Array(width * height);
  const queue: CanvasPoint[] = [];
  const component: CanvasPoint[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = y * width + x;
      if (visited[pixelOffset] || pixels[getAlphaIndex(width, x, y)] === 0) {
        continue;
      }

      queue.length = 0;
      component.length = 0;
      visited[pixelOffset] = 1;
      queue.push({ x, y });

      while (queue.length > 0) {
        const point = queue.shift()!;
        component.push(point);

        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (offsetX === 0 && offsetY === 0) {
              continue;
            }

            const nextX = point.x + offsetX;
            const nextY = point.y + offsetY;
            const nextOffset = nextY * width + nextX;
            if (
              nextX >= 0 &&
              nextY >= 0 &&
              nextX < width &&
              nextY < height &&
              !visited[nextOffset] &&
              pixels[getAlphaIndex(width, nextX, nextY)] > 0
            ) {
              visited[nextOffset] = 1;
              queue.push({ x: nextX, y: nextY });
            }
          }
        }
      }

      if (component.length < minComponentSize) {
        component.forEach((point) => {
          const alphaIndex = getAlphaIndex(width, point.x, point.y);
          if (pixels[alphaIndex] > 0) {
            pixels[alphaIndex] = 0;
            removedPixelCount += 1;
          }
        });
      }
    }
  }

  return {
    imageData: new ImageData(pixels, width, height),
    removedPixelCount,
  };
}

function getOpaqueBounds(imageData: ImageData) {
  let minX = imageData.width;
  let minY = imageData.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      if (imageData.data[getAlphaIndex(imageData.width, x, y)] === 0) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return maxX >= 0 ? { minX, minY, maxX, maxY } : null;
}

function alignSpriteFramesBottomCenter(sourceImageData: ImageData, rows: number, columns: number) {
  const frames = sliceSpriteSheet(sourceImageData, rows, columns);
  const outputPixels = new Uint8ClampedArray(sourceImageData.width * sourceImageData.height * 4);
  let alignedFrameCount = 0;

  frames.forEach((frame) => {
    const bounds = getOpaqueBounds(frame.imageData);
    if (!bounds) {
      return;
    }

    const contentWidth = bounds.maxX - bounds.minX + 1;
    const contentHeight = bounds.maxY - bounds.minY + 1;
    const targetX = Math.floor((frame.width - contentWidth) / 2);
    const targetY = frame.height - contentHeight;
    const deltaX = targetX - bounds.minX;
    const deltaY = targetY - bounds.minY;

    if (deltaX !== 0 || deltaY !== 0) {
      alignedFrameCount += 1;
    }

    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const sourceIndex = (y * frame.width + x) * 4;
        if (frame.imageData.data[sourceIndex + 3] === 0) {
          continue;
        }

        const targetXInFrame = x + deltaX;
        const targetYInFrame = y + deltaY;
        if (
          targetXInFrame < 0 ||
          targetYInFrame < 0 ||
          targetXInFrame >= frame.width ||
          targetYInFrame >= frame.height
        ) {
          continue;
        }

        const targetIndex =
          ((frame.y + targetYInFrame) * sourceImageData.width + frame.x + targetXInFrame) * 4;
        outputPixels[targetIndex] = frame.imageData.data[sourceIndex];
        outputPixels[targetIndex + 1] = frame.imageData.data[sourceIndex + 1];
        outputPixels[targetIndex + 2] = frame.imageData.data[sourceIndex + 2];
        outputPixels[targetIndex + 3] = frame.imageData.data[sourceIndex + 3];
      }
    }
  });

  return {
    alignedFrameCount,
    imageData: new ImageData(outputPixels, sourceImageData.width, sourceImageData.height),
  };
}

function countUniqueOpaqueColors(sourceImageData: ImageData): number {
  const colorSet = new Set<number>();
  for (let i = 0; i < sourceImageData.data.length; i += 4) {
    if (sourceImageData.data[i + 3] === 0) continue;
    colorSet.add(
      (sourceImageData.data[i] << 16) |
      (sourceImageData.data[i + 1] << 8) |
      sourceImageData.data[i + 2],
    );
  }
  return colorSet.size;
}

function detectPixelBlockSize(sourceImageData: ImageData): number {
  const width = sourceImageData.width;
  const height = sourceImageData.height;
  const data = sourceImageData.data;
  const maxBlockSize = Math.min(16, Math.floor(Math.min(width, height) / 4));

  if (maxBlockSize < 2) return 1;

  let bestSize = 4;
  let bestScore = -1;

  for (let blockSize = 2; blockSize <= maxBlockSize; blockSize++) {
    let score = 0;
    let sampledBlocks = 0;
    const stepX = Math.max(1, Math.floor(width / blockSize / 8));
    const stepY = Math.max(1, Math.floor(height / blockSize / 8));

    for (let blockY = 0; blockY + blockSize <= height; blockY += blockSize * stepY) {
      for (let blockX = 0; blockX + blockSize <= width; blockX += blockSize * stepX) {
        sampledBlocks++;
        const colorCounts = new Map<number, number>();
        let totalPixels = 0;

        for (let dy = 0; dy < blockSize; dy++) {
          for (let dx = 0; dx < blockSize; dx++) {
            const idx = ((blockY + dy) * width + (blockX + dx)) * 4;
            if (data[idx + 3] === 0) continue;
            totalPixels++;
            const key =
              ((data[idx] >> 4) << 8) | ((data[idx + 1] >> 4) << 4) | (data[idx + 2] >> 4);
            colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
          }
        }

        if (totalPixels === 0) continue;

        let maxCount = 0;
        colorCounts.forEach((count) => {
          if (count > maxCount) maxCount = count;
        });

        const dominance = maxCount / totalPixels;
        if (dominance >= 0.6) {
          score += dominance;
        }
      }
    }

    const normalizedScore = sampledBlocks > 0 ? score / sampledBlocks : 0;
    if (normalizedScore > bestScore) {
      bestScore = normalizedScore;
      bestSize = blockSize;
    }
  }

  return bestSize;
}

function snapToPixelGrid(
  sourceImageData: ImageData,
  blockSize: number,
  alphaThreshold: number,
): { imageData: ImageData; snappedBlockCount: number } {
  const width = sourceImageData.width;
  const height = sourceImageData.height;
  const pixels = new Uint8ClampedArray(sourceImageData.data);
  let snappedBlockCount = 0;

  for (let blockY = 0; blockY < height; blockY += blockSize) {
    for (let blockX = 0; blockX < width; blockX += blockSize) {
      const colorCounts = new Map<number, { r: number; g: number; b: number; count: number }>();
      let opaqueCount = 0;
      let transparentCount = 0;
      const blockHeight = Math.min(blockSize, height - blockY);
      const blockWidth = Math.min(blockSize, width - blockX);

      for (let dy = 0; dy < blockHeight; dy++) {
        for (let dx = 0; dx < blockWidth; dx++) {
          const index = ((blockY + dy) * width + (blockX + dx)) * 4;
          if (sourceImageData.data[index + 3] < alphaThreshold) {
            transparentCount++;
            continue;
          }

          opaqueCount++;
          const r = sourceImageData.data[index];
          const g = sourceImageData.data[index + 1];
          const b = sourceImageData.data[index + 2];
          const key = (r << 16) | (g << 8) | b;
          const existing = colorCounts.get(key);
          if (existing) {
            existing.count++;
          } else {
            colorCounts.set(key, { r, g, b, count: 1 });
          }
        }
      }

      let dominantColor: { r: number; g: number; b: number } | null = null;
      let maxCount = 0;
      for (const entry of colorCounts.values()) {
        if (entry.count > maxCount) {
          maxCount = entry.count;
          dominantColor = entry;
        }
      }

      const makeTransparent = opaqueCount <= transparentCount;

      for (let dy = 0; dy < blockHeight; dy++) {
        for (let dx = 0; dx < blockWidth; dx++) {
          const index = ((blockY + dy) * width + (blockX + dx)) * 4;

          if (makeTransparent) {
            if (pixels[index + 3] > 0) {
              pixels[index] = 0;
              pixels[index + 1] = 0;
              pixels[index + 2] = 0;
              pixels[index + 3] = 0;
              snappedBlockCount++;
            }
          } else if (dominantColor) {
            if (
              pixels[index] !== dominantColor.r ||
              pixels[index + 1] !== dominantColor.g ||
              pixels[index + 2] !== dominantColor.b ||
              pixels[index + 3] < alphaThreshold
            ) {
              pixels[index] = dominantColor.r;
              pixels[index + 1] = dominantColor.g;
              pixels[index + 2] = dominantColor.b;
              pixels[index + 3] = 255;
              snappedBlockCount++;
            }
          }
        }
      }
    }
  }

  return { imageData: new ImageData(pixels, width, height), snappedBlockCount };
}

function quantizeColors(
  sourceImageData: ImageData,
  targetColorCount: number,
): { imageData: ImageData; originalColorCount: number; quantizedColorCount: number } {
  const data = sourceImageData.data;
  const colorMap = new Map<number, { r: number; g: number; b: number; count: number }>();

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorMap.set(key, { r: data[i], g: data[i + 1], b: data[i + 2], count: 1 });
    }
  }

  const originalColorCount = colorMap.size;

  if (originalColorCount <= targetColorCount) {
    return {
      imageData: new ImageData(
        new Uint8ClampedArray(data),
        sourceImageData.width,
        sourceImageData.height,
      ),
      originalColorCount,
      quantizedColorCount: originalColorCount,
    };
  }

  type ColorEntry = { r: number; g: number; b: number; count: number };
  const allColors: ColorEntry[] = Array.from(colorMap.values());

  type ColorBox = {
    entries: ColorEntry[];
    minR: number;
    maxR: number;
    minG: number;
    maxG: number;
    minB: number;
    maxB: number;
    totalCount: number;
  };

  function createBox(entries: ColorEntry[]): ColorBox {
    let minR = 255;
    let maxR = 0;
    let minG = 255;
    let maxG = 0;
    let minB = 255;
    let maxB = 0;
    let totalCount = 0;
    entries.forEach((e) => {
      minR = Math.min(minR, e.r);
      maxR = Math.max(maxR, e.r);
      minG = Math.min(minG, e.g);
      maxG = Math.max(maxG, e.g);
      minB = Math.min(minB, e.b);
      maxB = Math.max(maxB, e.b);
      totalCount += e.count;
    });
    return { entries, minR, maxR, minG, maxG, minB, maxB, totalCount };
  }

  let boxes: ColorBox[] = [createBox(allColors)];

  while (boxes.length < targetColorCount) {
    let maxVolume = -1;
    let splitIndex = -1;

    boxes.forEach((box, index) => {
      if (box.entries.length <= 1) return;
      const volume =
        (box.maxR - box.minR) * (box.maxG - box.minG) * (box.maxB - box.minB);
      if (volume > maxVolume) {
        maxVolume = volume;
        splitIndex = index;
      }
    });

    if (splitIndex === -1) break;

    const box = boxes[splitIndex];
    const rangeR = box.maxR - box.minR;
    const rangeG = box.maxG - box.minG;
    const rangeB = box.maxB - box.minB;

    if (rangeR >= rangeG && rangeR >= rangeB) {
      box.entries.sort((a, b) => a.r - b.r);
    } else if (rangeG >= rangeR && rangeG >= rangeB) {
      box.entries.sort((a, b) => a.g - b.g);
    } else {
      box.entries.sort((a, b) => a.b - b.b);
    }

    let cumulativeCount = 0;
    let medianIndex = 0;
    const halfCount = box.totalCount / 2;
    for (let i = 0; i < box.entries.length; i++) {
      cumulativeCount += box.entries[i].count;
      if (cumulativeCount >= halfCount) {
        medianIndex = i + 1;
        break;
      }
    }
    medianIndex = Math.max(1, Math.min(medianIndex, box.entries.length - 1));

    boxes.splice(
      splitIndex,
      1,
      createBox(box.entries.slice(0, medianIndex)),
      createBox(box.entries.slice(medianIndex)),
    );
  }

  const palette = boxes.map((box) => {
    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let totalCount = 0;
    box.entries.forEach((c) => {
      totalR += c.r * c.count;
      totalG += c.g * c.count;
      totalB += c.b * c.count;
      totalCount += c.count;
    });
    return totalCount > 0
      ? {
          r: Math.round(totalR / totalCount),
          g: Math.round(totalG / totalCount),
          b: Math.round(totalB / totalCount),
        }
      : { r: 0, g: 0, b: 0 };
  });

  const pixels = new Uint8ClampedArray(data);
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;

    let minDist = Infinity;
    let nearestR = 0;
    let nearestG = 0;
    let nearestB = 0;
    for (const color of palette) {
      const dr = pixels[i] - color.r;
      const dg = pixels[i + 1] - color.g;
      const db = pixels[i + 2] - color.b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < minDist) {
        minDist = dist;
        nearestR = color.r;
        nearestG = color.g;
        nearestB = color.b;
      }
    }

    pixels[i] = nearestR;
    pixels[i + 1] = nearestG;
    pixels[i + 2] = nearestB;
  }

  return {
    imageData: new ImageData(pixels, sourceImageData.width, sourceImageData.height),
    originalColorCount,
    quantizedColorCount: palette.length,
  };
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
  const [cropInsets, setCropInsets] = React.useState<CropInsets>(createDefaultCropInsets);
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
  const [alphaThreshold, setAlphaThreshold] = React.useState(DEFAULT_ALPHA_THRESHOLD);
  const [minNeighborCount, setMinNeighborCount] = React.useState(DEFAULT_MIN_NEIGHBOR_COUNT);
  const [minComponentSize, setMinComponentSize] = React.useState(DEFAULT_MIN_COMPONENT_SIZE);
  const [fringeTolerance, setFringeTolerance] = React.useState(DEFAULT_FRINGE_TOLERANCE);
  const [fringeRadius, setFringeRadius] = React.useState(DEFAULT_FRINGE_RADIUS);
  const [isGridOverlayEnabled, setIsGridOverlayEnabled] = React.useState(false);
  const [gridOverlaySize, setGridOverlaySize] = React.useState(DEFAULT_GRID_OVERLAY_SIZE);
  const [backgroundRemovalStatus, setBackgroundRemovalStatus] = React.useState('');
  const [cropStatus, setCropStatus] = React.useState('');
  const [pixelCleanupStatus, setPixelCleanupStatus] = React.useState('');
  const [pixelBlockSize, setPixelBlockSize] = React.useState(DEFAULT_PIXEL_BLOCK_SIZE);
  const [snapAlphaThreshold, setSnapAlphaThreshold] = React.useState(DEFAULT_SNAP_ALPHA_THRESHOLD);
  const [quantizeColorCount, setQuantizeColorCount] = React.useState(DEFAULT_QUANTIZE_COLOR_COUNT);
  const [pixelNormalizeStatus, setPixelNormalizeStatus] = React.useState('');
  const [importStatus, setImportStatus] = React.useState('');
  const [exportStatus, setExportStatus] = React.useState('');
  const [error, setError] = React.useState('');

  const currentTransparentPixelCount = React.useMemo(() => {
    return image ? countTransparentPixels(image.imageData) : 0;
  }, [image]);

  const currentUniqueColorCount = React.useMemo(() => {
    return image ? countUniqueOpaqueColors(image.imageData) : 0;
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
  const currentBaseProcessingSize = React.useMemo(() => {
    return image
      ? {
          width: Math.max(1, Math.round(image.sourceImageData.width * resolutionScale)),
          height: Math.max(1, Math.round(image.sourceImageData.height * resolutionScale)),
        }
      : null;
  }, [image, resolutionScale]);
  const totalCroppedPixelCount =
    currentBaseProcessingSize && image
      ? currentBaseProcessingSize.width * currentBaseProcessingSize.height -
        image.width * image.height
      : 0;

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
    if (isGridOverlayEnabled) {
      drawGridOverlay(canvas, processedImageData.imageData, scale, gridOverlaySize);
    }
  }, [gridOverlaySize, image, isGridOverlayEnabled, processedImageData, scale]);

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
    setImportStatus('');

    if (!file) {
      return;
    }

    const isImageFile = file.type.startsWith('image/');
    const isVideoFile = file.type.startsWith('video/');

    if (!isImageFile && !isVideoFile) {
      setError('请选择有效的图片或视频文件。');
      event.target.value = '';
      return;
    }

    try {
      setImportStatus(isVideoFile ? `正在从视频中抽取最多 ${MAX_VIDEO_FRAME_COUNT} 帧...` : '');
      let sourceImageData: ImageData;
      let originalWidth: number;
      let originalHeight: number;
      let sourceType: LoadedImage['sourceType'];
      let extractedFrameCount: number | undefined;
      let sourceFrameWidth: number | undefined;
      let sourceFrameHeight: number | undefined;

      if (isVideoFile) {
        const videoSpriteSheet = await readVideoSpriteSheetImageData(file);
        sourceImageData = videoSpriteSheet.imageData;
        originalWidth = videoSpriteSheet.imageData.width;
        originalHeight = videoSpriteSheet.imageData.height;
        sourceType = 'video';
        extractedFrameCount = videoSpriteSheet.extractedFrameCount;
        sourceFrameWidth = videoSpriteSheet.frameWidth;
        sourceFrameHeight = videoSpriteSheet.frameHeight;
      } else {
        const bitmap = await createImageBitmap(file);
        sourceImageData = readBitmapImageData(bitmap);
        originalWidth = bitmap.width;
        originalHeight = bitmap.height;
        sourceType = 'image';
        bitmap.close();
      }

      const defaultCropInsets = createDefaultCropInsets();
      const preparedImage = prepareImageData(
        sourceImageData,
        DEFAULT_RESOLUTION_SCALE,
        defaultCropInsets,
      );
      setImage({
        imageData: preparedImage.imageData,
        sourceImageData,
        name: file.name,
        width: preparedImage.imageData.width,
        height: preparedImage.imageData.height,
        originalWidth,
        originalHeight,
        sourceType,
        extractedFrameCount,
        sourceFrameWidth,
        sourceFrameHeight,
      });
      setResolutionScale(DEFAULT_RESOLUTION_SCALE);
      setCropInsets(preparedImage.cropInsets);
      setGridRows(sourceType === 'video' ? 1 : DEFAULT_GRID_ROWS);
      setGridColumns(extractedFrameCount ?? DEFAULT_GRID_COLUMNS);
      resetFrameAssembly();
      setHasBackgroundColorSelection(false);
      setBackgroundRemovalStatus('');
      setCropStatus('');
      setPixelCleanupStatus('');
      setPixelNormalizeStatus('');
      setImportStatus(
        sourceType === 'video' && extractedFrameCount
          ? `已抽取 ${extractedFrameCount} 帧，并组合为 ${preparedImage.imageData.width} × ${preparedImage.imageData.height}px 单行长图。`
          : '',
      );
      setExportStatus('');
    } catch {
      setImportStatus('');
      setError(
        isVideoFile
          ? '视频解码或抽帧失败，请换一个浏览器支持的视频重试。'
          : '图片解码失败，请换一张图片重试。',
      );
    }
  }

  function handleResolutionScaleChange(value: string) {
    const nextResolutionScale = parseResolutionScale(value);

    if (!image) {
      setResolutionScale(nextResolutionScale);
      return;
    }

    try {
      const nextCropInsets = scaleCropInsets(cropInsets, resolutionScale, nextResolutionScale);
      const preparedImage = prepareImageData(
        image.sourceImageData,
        nextResolutionScale,
        nextCropInsets,
      );
      setResolutionScale(nextResolutionScale);
      setCropInsets(preparedImage.cropInsets);
      setImage({
        ...image,
        imageData: preparedImage.imageData,
        width: preparedImage.imageData.width,
        height: preparedImage.imageData.height,
      });
      resetFrameAssembly();
      setHasBackgroundColorSelection(false);
      setBackgroundRemovalStatus(
        nextResolutionScale === 1
          ? '已恢复原始处理分辨率，请重新取色。'
          : `已将处理分辨率缩小到 ${formatResolutionScale(nextResolutionScale)}，请重新取色。`,
      );
      setCropStatus('处理分辨率已变化，裁剪数值已按比例调整。');
      setPixelCleanupStatus('');
      setPixelNormalizeStatus('');
      setExportStatus('');
    } catch {
      setError('调整处理分辨率失败，当前浏览器无法重新采样图片。');
    }
  }

  function handleCropInsetChange(cropInsetKey: CropInsetKey, value: string) {
    if (!image) {
      return;
    }

    const nextCropInsets = {
      ...cropInsets,
      [cropInsetKey]: clampCropValue(Number(value)),
    };

    try {
      const preparedImage = prepareImageData(
        image.sourceImageData,
        resolutionScale,
        nextCropInsets,
      );
      setCropInsets(preparedImage.cropInsets);
      setImage({
        ...image,
        imageData: preparedImage.imageData,
        width: preparedImage.imageData.width,
        height: preparedImage.imageData.height,
      });
      resetFrameAssembly();
      setHasBackgroundColorSelection(false);
      setBackgroundRemovalStatus('');
      setCropStatus(
        `已裁剪为 ${preparedImage.imageData.width} × ${preparedImage.imageData.height}px，切分前请重新取色。`,
      );
      setPixelCleanupStatus('');
      setPixelNormalizeStatus('');
      setExportStatus('');
    } catch {
      setError('调整裁剪区域失败，当前浏览器无法重新生成图片。');
    }
  }

  function handleResetCrop() {
    if (!image) {
      return;
    }

    try {
      const defaultCropInsets = createDefaultCropInsets();
      const preparedImage = prepareImageData(
        image.sourceImageData,
        resolutionScale,
        defaultCropInsets,
      );
      setCropInsets(preparedImage.cropInsets);
      setImage({
        ...image,
        imageData: preparedImage.imageData,
        width: preparedImage.imageData.width,
        height: preparedImage.imageData.height,
      });
      resetFrameAssembly();
      setHasBackgroundColorSelection(false);
      setBackgroundRemovalStatus('');
      setCropStatus('已清除裁剪，恢复当前处理分辨率下的完整画布。');
      setPixelCleanupStatus('');
      setPixelNormalizeStatus('');
      setExportStatus('');
    } catch {
      setError('重置裁剪失败，当前浏览器无法重新生成图片。');
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
    imageDataRef.current = removedBackground.imageData;
    setBackgroundRemovalStatus(
      `已将 ${removedBackground.transparentPixelCount} 个背景像素变为透明。`,
    );
    setPixelCleanupStatus('');
    setPixelNormalizeStatus('');
  }

  function handleCleanPixelNoise() {
    if (!image) {
      return;
    }

    const cleaned = cleanPixelNoise(
      image.imageData,
      alphaThreshold,
      minNeighborCount,
      minComponentSize,
    );

    if (cleaned.removedPixelCount === 0) {
      setPixelCleanupStatus('没有发现符合当前阈值的毛刺或小色块，可调高阈值后再试。');
      return;
    }

    setImage({
      ...image,
      imageData: cleaned.imageData,
    });
    imageDataRef.current = cleaned.imageData;
    resetFrameAssembly();
    setPixelCleanupStatus(`已清理 ${cleaned.removedPixelCount} 个疑似毛刺/小杂色像素。`);
    setExportStatus('');
  }

  function handleRemoveBackgroundFringe() {
    if (!image) {
      return;
    }

    if (!hasBackgroundColorSelection) {
      setPixelCleanupStatus('请先在“去背景色”区域取背景色，再执行去背景色边。');
      return;
    }

    const defringed = removeBackgroundFringe(
      image.imageData,
      backgroundColor,
      fringeTolerance,
      fringeRadius,
    );
    const changedPixelCount = defringed.transparentPixelCount + defringed.recoloredPixelCount;

    if (changedPixelCount === 0) {
      setPixelCleanupStatus('没有发现符合当前阈值的背景色边，可调高边缘容差或边缘范围后再试。');
      return;
    }

    setImage({
      ...image,
      imageData: defringed.imageData,
    });
    imageDataRef.current = defringed.imageData;
    resetFrameAssembly();
    setPixelCleanupStatus(
      `已处理背景色边：透明化 ${defringed.transparentPixelCount} 个像素，重染 ${defringed.recoloredPixelCount} 个边缘像素。`,
    );
    setExportStatus('');
  }

  function handleAlignFramesBottomCenter() {
    if (!image) {
      return;
    }

    const aligned = alignSpriteFramesBottomCenter(image.imageData, gridRows, gridColumns);
    if (aligned.alignedFrameCount === 0) {
      setPixelCleanupStatus('当前帧内容已经接近底部居中对齐，未移动任何帧。');
      return;
    }

    setImage({
      ...image,
      imageData: aligned.imageData,
    });
    imageDataRef.current = aligned.imageData;
    resetFrameAssembly();
    setPixelCleanupStatus(
      `已按当前 ${gridRows} × ${gridColumns} 切分配置，对齐 ${aligned.alignedFrameCount} 个非空帧。`,
    );
    setExportStatus('');
  }

  function handleDetectPixelBlockSize() {
    if (!image) return;
    const detected = detectPixelBlockSize(image.imageData);
    setPixelBlockSize(detected);
    setPixelNormalizeStatus(`自动检测到像素块大小为 ${detected}×${detected}，可调整后点击"对齐到网格"。`);
  }

  function handleSnapToPixelGrid() {
    if (!image) return;
    const snapped = snapToPixelGrid(image.imageData, pixelBlockSize, snapAlphaThreshold);
    if (snapped.snappedBlockCount === 0) {
      setPixelNormalizeStatus('当前图像已对齐到指定网格，无需调整。');
      return;
    }
    setImage({ ...image, imageData: snapped.imageData });
    imageDataRef.current = snapped.imageData;
    resetFrameAssembly();
    setPixelCleanupStatus('');
    setPixelNormalizeStatus(
      `已按 ${pixelBlockSize}×${pixelBlockSize} 网格对齐，修改了 ${snapped.snappedBlockCount} 个像素。`,
    );
    setExportStatus('');
  }

  function handleQuantizeColors() {
    if (!image) return;
    const quantized = quantizeColors(image.imageData, quantizeColorCount);
    if (quantized.originalColorCount <= quantizeColorCount) {
      setPixelNormalizeStatus(
        `当前仅有 ${quantized.originalColorCount} 种颜色，无需量化（目标 ${quantizeColorCount} 色）。`,
      );
      return;
    }
    setImage({ ...image, imageData: quantized.imageData });
    imageDataRef.current = quantized.imageData;
    resetFrameAssembly();
    setPixelCleanupStatus('');
    setPixelNormalizeStatus(
      `色彩量化完成：${quantized.originalColorCount} 种 → ${quantized.quantizedColorCount} 种颜色。`,
    );
    setExportStatus('');
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
      if (isGridOverlayEnabled) {
        drawGridOverlay(canvasRef.current, previewImageData, scale, gridOverlaySize);
      }
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
          导入本地像素精灵图或视频，处理背景和杂色后，按可调整网格生成独立帧并重组最终序列。
        </p>

        <section className="workflow-guide" aria-label="新手推荐处理流程">
          <div className="workflow-guide__header">
            <p className="eyebrow">Best Practice</p>
            <h2>新手推荐流程</h2>
          </div>

          <ol className="workflow-guide__steps">
            <li>
              <strong>1. 导入与裁剪</strong>
              <span>先导入素材，必要时裁掉四周空白或调整处理分辨率。</span>
            </li>
            <li>
              <strong>2. 去背景</strong>
              <span>点击背景取色，调容差，只在预览满意后点击"应用为透明"。</span>
            </li>
            <li>
              <strong>3. 像素规范化</strong>
              <span>AI 伪像素先"对齐到网格"，颜色过多再"色彩量化"。</span>
            </li>
            <li>
              <strong>4. 修边和清理</strong>
              <span>有红边先用"去背景色边"，有噪点再用"自动去毛刺"。</span>
            </li>
            <li>
              <strong>5. 对齐与切帧</strong>
              <span>确认行列数后，可用底部居中对齐减少动画抖动。</span>
            </li>
            <li>
              <strong>6. 重组与导出</strong>
              <span>把帧加入多行序列，播放检查动作，再导出 PNG。</span>
            </li>
          </ol>

          <div className="workflow-guide__tips">
            <p>
              <strong>伪像素：</strong>先用“自动检测块大小”或手动设 N，再点“对齐到网格”。
            </p>
            <p>
              <strong>颜色过多：</strong>设目标色数（如 16），点“色彩量化”用 Median Cut 降色。
            </p>
            <p>
              <strong>红边：</strong>先取背景色并应用透明，再点“去背景色边”。
            </p>
            <p>
              <strong>毛刺：</strong>先用低阈值自动去毛刺，避免误删细节。
            </p>
            <p>
              <strong>帧抖动：</strong>先确认切分网格，再执行底部居中对齐。
            </p>
          </div>
        </section>

        <label className="file-picker">
          <span>选择图片或视频</span>
          <input type="file" accept="image/*,video/*" onChange={handleFileChange} />
        </label>

        {importStatus ? <p className="import-status">{importStatus}</p> : null}
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
            {image.name} ·{' '}
            {image.sourceType === 'video' && image.extractedFrameCount
              ? `视频抽帧 ${image.extractedFrameCount} 帧，单帧 ${image.sourceFrameWidth} × ${image.sourceFrameHeight}px，长图尺寸 ${image.originalWidth} × ${image.originalHeight}px`
              : `导入尺寸 ${image.originalWidth} × ${image.originalHeight}px`}{' '}
            · 处理尺寸 {image.width} × {image.height}px · canvas 显示尺寸{' '}
            {image.width * scale} × {image.height * scale}px · 预计可透明化{' '}
            {backgroundTransparentPixelCount} 个像素 · 当前图片透明像素{' '}
            {currentTransparentPixelCount} 个
          </p>
        ) : null}
        <section className="crop-panel" aria-label="裁剪周围区域">
          <div className="crop-panel__header">
            <div>
              <p className="eyebrow">Crop Canvas</p>
              <h2>裁剪周围区域</h2>
            </div>
            <p className="crop-panel__summary">
              {image
                ? `已裁掉 ${totalCroppedPixelCount} 个像素，当前处理尺寸 ${image.width} × ${image.height}px`
                : '导入图片后可按像素裁掉四周空白'}
            </p>
          </div>

          <div className="crop-controls" aria-label="四周裁剪像素">
            <label className="number-control">
              <span>
                <span className="label">上</span>
                <strong>{cropInsets.top}px</strong>
              </span>
              <input
                type="number"
                min="0"
                max={
                  currentBaseProcessingSize
                    ? Math.max(0, currentBaseProcessingSize.height - cropInsets.bottom - 1)
                    : 0
                }
                value={cropInsets.top}
                onChange={(event) => handleCropInsetChange('top', event.target.value)}
                disabled={!image}
                aria-label="裁剪顶部像素"
              />
            </label>

            <label className="number-control">
              <span>
                <span className="label">右</span>
                <strong>{cropInsets.right}px</strong>
              </span>
              <input
                type="number"
                min="0"
                max={
                  currentBaseProcessingSize
                    ? Math.max(0, currentBaseProcessingSize.width - cropInsets.left - 1)
                    : 0
                }
                value={cropInsets.right}
                onChange={(event) => handleCropInsetChange('right', event.target.value)}
                disabled={!image}
                aria-label="裁剪右侧像素"
              />
            </label>

            <label className="number-control">
              <span>
                <span className="label">下</span>
                <strong>{cropInsets.bottom}px</strong>
              </span>
              <input
                type="number"
                min="0"
                max={
                  currentBaseProcessingSize
                    ? Math.max(0, currentBaseProcessingSize.height - cropInsets.top - 1)
                    : 0
                }
                value={cropInsets.bottom}
                onChange={(event) => handleCropInsetChange('bottom', event.target.value)}
                disabled={!image}
                aria-label="裁剪底部像素"
              />
            </label>

            <label className="number-control">
              <span>
                <span className="label">左</span>
                <strong>{cropInsets.left}px</strong>
              </span>
              <input
                type="number"
                min="0"
                max={
                  currentBaseProcessingSize
                    ? Math.max(0, currentBaseProcessingSize.width - cropInsets.right - 1)
                    : 0
                }
                value={cropInsets.left}
                onChange={(event) => handleCropInsetChange('left', event.target.value)}
                disabled={!image}
                aria-label="裁剪左侧像素"
              />
            </label>

            <button
              type="button"
              className="tool-button crop-reset-button"
              onClick={handleResetCrop}
              disabled={
                !image ||
                (cropInsets.top === 0 &&
                  cropInsets.right === 0 &&
                  cropInsets.bottom === 0 &&
                  cropInsets.left === 0)
              }
            >
              重置裁剪
            </button>
          </div>

          <p className="hint">
            裁剪会改变后续取色、去背景、切帧和导出的处理尺寸；调整后最终序列会被清空。
          </p>
          {cropStatus ? <p className="crop-status">{cropStatus}</p> : null}
        </section>

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

        <section className="pixel-cleanup-panel" aria-label="像素清理与对齐">
          <div className="pixel-cleanup-panel__header">
            <div>
              <p className="eyebrow">Pixel Cleanup</p>
              <h2>像素清理与对齐</h2>
            </div>
            <p className="pixel-cleanup-panel__summary">
              {image
                ? `当前透明像素 ${currentTransparentPixelCount} 个，按 ${gridRows} × ${gridColumns} 帧网格处理`
                : '导入图片后可清理毛刺、对齐动作帧并显示辅助网格'}
            </p>
          </div>

          <div className="pixel-cleanup-controls">
            <label className="tolerance-control">
              <span>
                <span className="label">Alpha 阈值</span>
                <strong>{alphaThreshold}</strong>
              </span>
              <input
                type="range"
                min="0"
                max="80"
                step="1"
                value={alphaThreshold}
                onChange={(event) => setAlphaThreshold(Number(event.target.value))}
                aria-label="Alpha 透明阈值"
              />
            </label>

            <label className="tolerance-control">
              <span>
                <span className="label">邻居下限</span>
                <strong>{minNeighborCount}</strong>
              </span>
              <input
                type="range"
                min="0"
                max="4"
                step="1"
                value={minNeighborCount}
                onChange={(event) => setMinNeighborCount(Number(event.target.value))}
                aria-label="孤立像素邻居下限"
              />
            </label>

            <label className="tolerance-control">
              <span>
                <span className="label">小色块阈值</span>
                <strong>{minComponentSize}px</strong>
              </span>
              <input
                type="range"
                min="1"
                max="24"
                step="1"
                value={minComponentSize}
                onChange={(event) => setMinComponentSize(Number(event.target.value))}
                aria-label="小连通色块阈值"
              />
            </label>

            <label className="tolerance-control">
              <span>
                <span className="label">边缘容差</span>
                <strong>{fringeTolerance}</strong>
              </span>
              <input
                type="range"
                min="0"
                max="160"
                step="1"
                value={fringeTolerance}
                onChange={(event) => setFringeTolerance(Number(event.target.value))}
                aria-label="背景色边缘容差"
              />
            </label>

            <label className="number-control">
              <span>
                <span className="label">边缘范围</span>
                <strong>{fringeRadius}px</strong>
              </span>
              <input
                type="number"
                min="1"
                max="3"
                value={fringeRadius}
                onChange={(event) =>
                  setFringeRadius(Math.max(1, Math.min(3, Math.round(Number(event.target.value) || 1))))
                }
                aria-label="背景色边缘处理范围"
              />
            </label>

            <button
              type="button"
              className="tool-button pixel-cleanup-button"
              onClick={handleRemoveBackgroundFringe}
              disabled={!image || !hasBackgroundColorSelection}
            >
              去背景色边
            </button>

            <button
              type="button"
              className="tool-button pixel-cleanup-button"
              onClick={handleCleanPixelNoise}
              disabled={!image}
            >
              自动去毛刺
            </button>

            <button
              type="button"
              className="tool-button"
              onClick={handleAlignFramesBottomCenter}
              disabled={!image}
            >
              按帧底部居中对齐
            </button>

            <label className="switch-control">
              <span>
                <span className="label">显示网格</span>
                <strong>{isGridOverlayEnabled ? '开启' : '关闭'}</strong>
              </span>
              <input
                type="checkbox"
                checked={isGridOverlayEnabled}
                onChange={(event) => setIsGridOverlayEnabled(event.target.checked)}
                aria-label="是否显示像素辅助网格"
              />
            </label>

            <label className="number-control">
              <span>
                <span className="label">网格间距</span>
                <strong>{gridOverlaySize}px</strong>
              </span>
              <input
                type="number"
                min="1"
                max="128"
                value={gridOverlaySize}
                onChange={(event) =>
                  setGridOverlaySize(Math.max(1, Math.min(128, Math.round(Number(event.target.value) || 1))))
                }
                disabled={!isGridOverlayEnabled}
                aria-label="像素辅助网格间距"
              />
            </label>
          </div>

          <p className="hint">
            建议先“自动去毛刺”清理孤立噪点和小色块，再按当前切分行列执行“底部居中对齐”；如果担心误删细节，请先用较小阈值尝试。
          </p>
          {pixelCleanupStatus ? <p className="pixel-cleanup-status">{pixelCleanupStatus}</p> : null}
        </section>

        <section className="pixel-normalize-panel" aria-label="像素规范化">
          <div className="pixel-normalize-panel__header">
            <div>
              <p className="eyebrow">Pixel Normalize</p>
              <h2>像素规范化</h2>
            </div>
            <p className="pixel-normalize-panel__summary">
              {image
                ? `当前 ${currentUniqueColorCount} 种颜色，按 ${pixelBlockSize}×${pixelBlockSize} 块处理`
                : '导入图片后可将伪像素对齐到统一网格并减少颜色数'}
            </p>
          </div>

          <div className="pixel-normalize-controls">
            <label className="number-control">
              <span>
                <span className="label">像素块大小</span>
                <strong>{pixelBlockSize}×{pixelBlockSize}</strong>
              </span>
              <input
                type="number"
                min={MIN_PIXEL_BLOCK_SIZE}
                max={MAX_PIXEL_BLOCK_SIZE}
                value={pixelBlockSize}
                onChange={(event) =>
                  setPixelBlockSize(
                    Math.max(MIN_PIXEL_BLOCK_SIZE, Math.min(MAX_PIXEL_BLOCK_SIZE, Math.round(Number(event.target.value) || 1))),
                  )
                }
                disabled={!image}
                aria-label="像素块大小"
              />
            </label>

            <button
              type="button"
              className="tool-button"
              onClick={handleDetectPixelBlockSize}
              disabled={!image}
            >
              自动检测块大小
            </button>

            <label className="tolerance-control">
              <span>
                <span className="label">透明阈值</span>
                <strong>{snapAlphaThreshold}</strong>
              </span>
              <input
                type="range"
                min="0"
                max={MAX_SNAP_ALPHA_THRESHOLD}
                step="1"
                value={snapAlphaThreshold}
                onChange={(event) => setSnapAlphaThreshold(Number(event.target.value))}
                aria-label="网格对齐透明阈值"
              />
            </label>

            <button
              type="button"
              className="tool-button pixel-normalize-button"
              onClick={handleSnapToPixelGrid}
              disabled={!image}
            >
              对齐到网格
            </button>

            <label className="number-control">
              <span>
                <span className="label">目标颜色数</span>
                <strong>{quantizeColorCount} 色</strong>
              </span>
              <input
                type="number"
                min={MIN_QUANTIZE_COLOR_COUNT}
                max={MAX_QUANTIZE_COLOR_COUNT}
                value={quantizeColorCount}
                onChange={(event) =>
                  setQuantizeColorCount(
                    Math.max(MIN_QUANTIZE_COLOR_COUNT, Math.min(MAX_QUANTIZE_COLOR_COUNT, Math.round(Number(event.target.value) || 2))),
                  )
                }
                disabled={!image}
                aria-label="色彩量化目标颜色数"
              />
            </label>

            <button
              type="button"
              className="tool-button pixel-normalize-button"
              onClick={handleQuantizeColors}
              disabled={!image}
            >
              色彩量化
            </button>
          </div>

          <p className="hint">
            AI 生成的像素图常出现"伪像素"（大小不一、带抗锯齿、未对齐网格）和颜色过多（同一区域几十种相近色）。"对齐到网格"将每个 N×N 块统一为主色并消除半透明；"色彩量化"用 Median Cut 算法将颜色数降到目标值。建议先去背景，再对齐网格，最后量化色彩。
          </p>
          {pixelNormalizeStatus ? <p className="pixel-normalize-status">{pixelNormalizeStatus}</p> : null}
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
