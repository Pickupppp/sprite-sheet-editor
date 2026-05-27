import {
  DEFAULT_VIDEO_FRAME_COUNT,
  DEFAULT_RESOLUTION_SCALE,
  MAX_VIDEO_FRAME_COUNT,
  MAX_VIDEO_SPRITE_SHEET_WIDTH,
  RESOLUTION_SCALE_OPTIONS,
} from './constants';
import type {
  CanvasPoint,
  CropInsets,
  ExportBackgroundMode,
  FinalSequenceRow,
  LoadedImage,
  ResolutionScale,
  RgbColor,
  SpriteFrame,
  VideoExtractionOptions,
} from './types';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';

export function hexToRgb(hexColor: string): RgbColor {
  const normalizedColor = hexColor.replace('#', '');
  const colorNumber = Number.parseInt(normalizedColor, 16);

  return {
    red: (colorNumber >> 16) & 255,
    green: (colorNumber >> 8) & 255,
    blue: colorNumber & 255,
  };
}

export function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

export function readBitmapImageData(bitmap: ImageBitmap) {
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

export function waitForVideoEvent(video: HTMLVideoElement, eventName: keyof HTMLMediaElementEventMap) {
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

export function seekVideoTo(video: HTMLVideoElement, timestamp: number) {
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

function clampVideoExtractionOptions(
  options: Partial<VideoExtractionOptions> | undefined,
  duration: number,
  maxFrameCountByCanvasWidth: number,
): VideoExtractionOptions {
  const requestedFrameCount = Math.round(options?.frameCount ?? DEFAULT_VIDEO_FRAME_COUNT);
  const frameCount = Math.max(
    1,
    Math.min(MAX_VIDEO_FRAME_COUNT, maxFrameCountByCanvasWidth, requestedFrameCount),
  );
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const startTime = Math.max(0, Math.min(options?.startTime ?? 0, Math.max(0, safeDuration - 0.001)));
  const requestedEndTime = options?.endTime ?? safeDuration;
  const endTime = Math.max(
    startTime,
    Math.min(requestedEndTime, safeDuration > 0 ? safeDuration : startTime),
  );

  return {
    frameCount,
    startTime,
    endTime,
  };
}

export async function readVideoSpriteSheetImageData(
  file: File,
  options?: Partial<VideoExtractionOptions>,
) {
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
    const extractionOptions = clampVideoExtractionOptions(
      options,
      duration,
      maxFrameCountByCanvasWidth,
    );
    const extractedFrameCount = duration > 0 ? extractionOptions.frameCount : 1;
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
      const extractionDuration = Math.max(
        0,
        extractionOptions.endTime - extractionOptions.startTime,
      );
      const timestamp =
        duration > 0
          ? Math.min(
              Math.max(duration - 0.001, 0),
              extractionOptions.startTime + (extractionDuration * frameIndex) / extractedFrameCount,
            )
          : 0;
      await seekVideoTo(video, timestamp);
      spriteContext.drawImage(video, frameIndex * frameWidth, 0, frameWidth, frameHeight);
    }

    return {
      duration,
      extractionOptions,
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

export function resizeImageData(sourceImageData: ImageData, resolutionScale: ResolutionScale) {
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

export function parseResolutionScale(value: string): ResolutionScale {
  const numericValue = Number(value);
  return (
    RESOLUTION_SCALE_OPTIONS.find((resolutionScale) => resolutionScale === numericValue) ??
    DEFAULT_RESOLUTION_SCALE
  );
}

export function formatResolutionScale(resolutionScale: ResolutionScale) {
  return `${Math.round(resolutionScale * 100)}%`;
}

export function createDefaultCropInsets(): CropInsets {
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
}

export function clampCropValue(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

export function sanitizeCropInsets(cropInsets: CropInsets, width: number, height: number): CropInsets {
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

export function cropImageData(sourceImageData: ImageData, cropInsets: CropInsets) {
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

export function prepareImageData(
  sourceImageData: ImageData,
  resolutionScale: ResolutionScale,
  cropInsets: CropInsets,
) {
  const resizedImageData = resizeImageData(sourceImageData, resolutionScale);
  return cropImageData(resizedImageData, cropInsets);
}

export function scaleCropInsets(
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

export function renderScaledImageDataToCanvas(
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

export function drawGridOverlay(canvas: HTMLCanvasElement, imageData: ImageData, scale: number, cellSize: number) {
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

export function removeMatchingBackground(
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

export function removeConnectedBackground(
  sourceImageData: ImageData,
  startPoint: CanvasPoint,
  backgroundColor: string,
  tolerance: number,
) {
  const targetColor = hexToRgb(backgroundColor);
  const pixels = new Uint8ClampedArray(sourceImageData.data);
  const visited = new Uint8Array(sourceImageData.width * sourceImageData.height);
  const stack: CanvasPoint[] = [startPoint];
  let transparentPixelCount = 0;

  function isMatchingPixel(x: number, y: number) {
    if (x < 0 || y < 0 || x >= sourceImageData.width || y >= sourceImageData.height) {
      return false;
    }

    const pixelOffset = y * sourceImageData.width + x;
    if (visited[pixelOffset]) {
      return false;
    }

    const dataIndex = pixelOffset * 4;
    return (
      pixels[dataIndex + 3] > 0 &&
      Math.abs(pixels[dataIndex] - targetColor.red) <= tolerance &&
      Math.abs(pixels[dataIndex + 1] - targetColor.green) <= tolerance &&
      Math.abs(pixels[dataIndex + 2] - targetColor.blue) <= tolerance
    );
  }

  while (stack.length > 0) {
    const point = stack.pop();
    if (!point || !isMatchingPixel(point.x, point.y)) {
      continue;
    }

    const pixelOffset = point.y * sourceImageData.width + point.x;
    visited[pixelOffset] = 1;
    pixels[pixelOffset * 4 + 3] = 0;
    transparentPixelCount += 1;

    stack.push(
      { x: point.x + 1, y: point.y },
      { x: point.x - 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x, y: point.y - 1 },
    );
  }

  return {
    imageData: new ImageData(pixels, sourceImageData.width, sourceImageData.height),
    transparentPixelCount,
  };
}

export function getTransparentBoundsCropInsets(sourceImageData: ImageData): CropInsets {
  const bounds = getOpaqueBounds(sourceImageData);
  if (!bounds) {
    return createDefaultCropInsets();
  }

  return sanitizeCropInsets(
    {
      top: bounds.minY,
      right: sourceImageData.width - bounds.maxX - 1,
      bottom: sourceImageData.height - bounds.maxY - 1,
      left: bounds.minX,
    },
    sourceImageData.width,
    sourceImageData.height,
  );
}

export function getBackgroundBorderCropInsets(
  sourceImageData: ImageData,
  backgroundColor: string,
  tolerance: number,
): CropInsets {
  const targetColor = hexToRgb(backgroundColor);
  const { data, width, height } = sourceImageData;

  function isBackgroundLike(x: number, y: number) {
    const dataIndex = (y * width + x) * 4;
    return data[dataIndex + 3] === 0 || getColorDistanceToRgb(data, dataIndex, targetColor) <= tolerance;
  }

  function isBackgroundRow(y: number, left: number, right: number) {
    for (let x = left; x <= right; x += 1) {
      if (!isBackgroundLike(x, y)) {
        return false;
      }
    }
    return true;
  }

  function isBackgroundColumn(x: number, top: number, bottom: number) {
    for (let y = top; y <= bottom; y += 1) {
      if (!isBackgroundLike(x, y)) {
        return false;
      }
    }
    return true;
  }

  let top = 0;
  let bottom = 0;
  let left = 0;
  let right = 0;

  while (top < height - 1 && isBackgroundRow(top, 0, width - 1)) {
    top += 1;
  }

  while (bottom < height - top - 1 && isBackgroundRow(height - bottom - 1, 0, width - 1)) {
    bottom += 1;
  }

  while (left < width - 1 && isBackgroundColumn(left, top, height - bottom - 1)) {
    left += 1;
  }

  while (right < width - left - 1 && isBackgroundColumn(width - right - 1, top, height - bottom - 1)) {
    right += 1;
  }

  return sanitizeCropInsets({ top, right, bottom, left }, width, height);
}

export function erasePixelsAlongPath(
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

export function sliceSpriteSheet(sourceImageData: ImageData, rows: number, columns: number) {
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

export function countTransparentPixels(imageData: ImageData) {
  let transparentPixelCount = 0;

  for (let index = 3; index < imageData.data.length; index += 4) {
    if (imageData.data[index] === 0) {
      transparentPixelCount += 1;
    }
  }

  return transparentPixelCount;
}

export function getColorDistanceToRgb(data: Uint8ClampedArray, pixelIndex: number, color: RgbColor) {
  const redDistance = data[pixelIndex] - color.red;
  const greenDistance = data[pixelIndex + 1] - color.green;
  const blueDistance = data[pixelIndex + 2] - color.blue;

  return Math.sqrt(redDistance * redDistance + greenDistance * greenDistance + blueDistance * blueDistance);
}

export function getAlphaIndex(width: number, x: number, y: number) {
  return (y * width + x) * 4 + 3;
}

export function isNearTransparentPixel(imageData: ImageData, x: number, y: number, radius: number) {
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

export function removeBackgroundFringe(
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

export function cleanPixelNoise(
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

export function getOpaqueBounds(imageData: ImageData) {
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

export function alignSpriteFramesBottomCenter(sourceImageData: ImageData, rows: number, columns: number) {
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

export function countUniqueOpaqueColors(sourceImageData: ImageData): number {
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

export function detectPixelBlockSize(sourceImageData: ImageData): number {
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

export function snapToPixelGrid(
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

export function quantizeColors(
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

export function createInitialFinalSequenceRows(): FinalSequenceRow[] {
  return [{ id: 'sequence-row-1', frames: [] }];
}

export function getFrameRowWidth(frames: SpriteFrame[]) {
  return frames.reduce((totalWidth, frame) => totalWidth + frame.width, 0);
}

export function getFrameRowHeight(frames: SpriteFrame[]) {
  return Math.max(...frames.map((frame) => frame.height));
}

export function getExportCanvasSize(frameRows: SpriteFrame[][]) {
  return {
    width: Math.max(...frameRows.map(getFrameRowWidth)),
    height: frameRows.reduce((totalHeight, frames) => totalHeight + getFrameRowHeight(frames), 0),
  };
}

export function createExportCanvas(frameRows: SpriteFrame[][], backgroundColor: string | null) {
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

function createFrameImageDataForGif(
  frame: SpriteFrame,
  width: number,
  height: number,
  backgroundColor: string | null,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas context is not available.');
  }

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, width, height);

  if (backgroundColor) {
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);
  }

  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = frame.width;
  frameCanvas.height = frame.height;

  const frameContext = frameCanvas.getContext('2d');
  if (!frameContext) {
    throw new Error('Canvas context is not available.');
  }

  frameContext.imageSmoothingEnabled = false;
  frameContext.putImageData(frame.imageData, 0, 0);
  context.drawImage(
    frameCanvas,
    Math.floor((width - frame.width) / 2),
    Math.floor((height - frame.height) / 2),
  );

  return context.getImageData(0, 0, width, height);
}

export function createAnimatedGifBlob(
  frames: SpriteFrame[],
  backgroundColor: string | null,
  delayMs: number,
) {
  const width = Math.max(...frames.map((frame) => frame.width));
  const height = Math.max(...frames.map((frame) => frame.height));
  const gif = GIFEncoder();

  frames.forEach((frame) => {
    const frameImageData = createFrameImageDataForGif(frame, width, height, backgroundColor);
    const hasTransparentPixels = !backgroundColor && countTransparentPixels(frameImageData) > 0;
    const palette = quantize(frameImageData.data, 256, {
      format: hasTransparentPixels ? 'rgba4444' : 'rgb565',
      oneBitAlpha: hasTransparentPixels ? 127 : false,
    });
    const transparentIndex = hasTransparentPixels
      ? Math.max(0, palette.findIndex((color) => color[3] !== undefined && color[3] <= 127))
      : 0;
    const index = applyPalette(
      frameImageData.data,
      palette,
      hasTransparentPixels ? 'rgba4444' : 'rgb565',
    );

    gif.writeFrame(index, width, height, {
      delay: delayMs,
      palette,
      repeat: 0,
      transparent: hasTransparentPixels,
      transparentIndex,
    });
  });

  gif.finish();
  const bytes = gif.bytes();
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return new Blob([arrayBuffer], { type: 'image/gif' });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export function getExportFileName(imageName: string, backgroundMode: ExportBackgroundMode) {
  const nameWithoutExtension = imageName.replace(/\.[^/.]+$/, '');
  const safeBaseName = nameWithoutExtension.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '');
  const modeSuffix = backgroundMode === 'transparent' ? 'transparent' : 'solid-bg';

  return `${safeBaseName || 'sprite-sequence'}-${modeSuffix}.png`;
}

export function getGifExportFileName(imageName: string, rowIndex: number) {
  const nameWithoutExtension = imageName.replace(/\.[^/.]+$/, '');
  const safeBaseName = nameWithoutExtension.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${safeBaseName || 'sprite-sequence'}-row-${rowIndex + 1}.gif`;
}

export function getCanvasPixelPoint(
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
