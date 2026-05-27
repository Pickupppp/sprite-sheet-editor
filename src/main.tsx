import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { ImportGuidePanel } from './components/ImportGuidePanel';
import { MainControlPanel } from './components/MainControlPanel';
import { SpriteAssemblyPanel } from './components/SpriteAssemblyPanel';
import { WorkflowStepNav } from './components/WorkflowStepNav';
import {
  DEFAULT_ALPHA_THRESHOLD,
  DEFAULT_ANIMATION_FRAME_INTERVAL_MS,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_TOLERANCE,
  DEFAULT_BRUSH_SIZE,
  DEFAULT_EXPORT_BACKGROUND_COLOR,
  DEFAULT_FRINGE_RADIUS,
  DEFAULT_FRINGE_TOLERANCE,
  DEFAULT_GRID_COLUMNS,
  DEFAULT_GRID_OVERLAY_SIZE,
  DEFAULT_GRID_ROWS,
  DEFAULT_MIN_COMPONENT_SIZE,
  DEFAULT_MIN_NEIGHBOR_COUNT,
  DEFAULT_PIXEL_BLOCK_SIZE,
  DEFAULT_PREVIEW_BACKGROUND_COLOR,
  DEFAULT_QUANTIZE_COLOR_COUNT,
  DEFAULT_RESOLUTION_SCALE,
  DEFAULT_SNAP_ALPHA_THRESHOLD,
  DEFAULT_VIDEO_FRAME_COUNT,
  MAX_IMAGE_HISTORY_ENTRIES,
  MAX_GRID_SIZE,
  MAX_VIDEO_FRAME_COUNT,
  MIN_GRID_SIZE,
  VIDEO_FRAME_COUNT_OPTIONS,
} from './constants';
import {
  alignSpriteFramesBottomCenter,
  clampCropValue,
  cleanPixelNoise,
  createAnimatedGifBlob,
  countTransparentPixels,
  countUniqueOpaqueColors,
  createDefaultCropInsets,
  createExportCanvas,
  createInitialFinalSequenceRows,
  detectPixelBlockSize,
  downloadBlob,
  drawGridOverlay,
  erasePixelsAlongPath,
  formatResolutionScale,
  getCanvasPixelPoint,
  getExportCanvasSize,
  getExportFileName,
  getGifExportFileName,
  getBackgroundBorderCropInsets,
  getTransparentBoundsCropInsets,
  parseResolutionScale,
  prepareImageData,
  quantizeColors,
  readBitmapImageData,
  readVideoSpriteSheetImageData,
  removeBackgroundFringe,
  removeConnectedBackground,
  removeMatchingBackground,
  renderScaledImageDataToCanvas,
  rgbToHex,
  scaleCropInsets,
  sliceSpriteSheet,
  snapToPixelGrid,
} from './imageProcessing';
import type {
  CanvasPoint,
  CopiedFrameSource,
  CropInsetKey,
  CropInsets,
  BackgroundRemovalMode,
  ExportFormat,
  ExportBackgroundMode,
  FinalSequenceFrame,
  FinalSequenceRow,
  ImageHistoryEntry,
  LoadedImage,
  ResolutionScale,
  SpriteFrame,
  VideoExtractionOptions,
} from './types';
import type { WorkflowStepId } from './workflowSteps';

type PixelNormalizePreview = {
  kind: 'snap' | 'quantize';
  imageData: ImageData;
  status: string;
  applyStatus: string;
};

function cloneImageData(imageData: ImageData) {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

function cloneLoadedImage(image: LoadedImage): LoadedImage {
  return {
    ...image,
    imageData: cloneImageData(image.imageData),
    sourceImageData: cloneImageData(image.sourceImageData),
  };
}

function App() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const imageDataRef = React.useRef<ImageData | null>(null);
  const sequenceFrameCounterRef = React.useRef(0);
  const sequenceRowCounterRef = React.useRef(1);
  const isErasingRef = React.useRef(false);
  const isEraserHistoryCapturedRef = React.useRef(false);
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
  const [backgroundSamplePoint, setBackgroundSamplePoint] = React.useState<CanvasPoint | null>(null);
  const [backgroundRemovalMode, setBackgroundRemovalMode] =
    React.useState<BackgroundRemovalMode>('global');
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
  const [videoSourceFile, setVideoSourceFile] = React.useState<File | null>(null);
  const [videoDuration, setVideoDuration] = React.useState(0);
  const [videoExtractionOptions, setVideoExtractionOptions] =
    React.useState<VideoExtractionOptions>({
      frameCount: DEFAULT_VIDEO_FRAME_COUNT,
      startTime: 0,
      endTime: 0,
    });
  const [copiedFrameSource, setCopiedFrameSource] = React.useState<CopiedFrameSource | null>(null);
  const [exportBackgroundMode, setExportBackgroundMode] =
    React.useState<ExportBackgroundMode>('transparent');
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>('png');
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
  const [pixelNormalizePreview, setPixelNormalizePreview] =
    React.useState<PixelNormalizePreview | null>(null);
  const [importStatus, setImportStatus] = React.useState('');
  const [exportStatus, setExportStatus] = React.useState('');
  const [error, setError] = React.useState('');
  const [currentStep, setCurrentStep] = React.useState<WorkflowStepId>('import');
  const [undoStack, setUndoStack] = React.useState<ImageHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = React.useState<ImageHistoryEntry[]>([]);

  const currentTransparentPixelCount = React.useMemo(() => {
    return image ? countTransparentPixels(image.imageData) : 0;
  }, [image]);

  const currentUniqueColorCount = React.useMemo(() => {
    return image ? countUniqueOpaqueColors(image.imageData) : 0;
  }, [image]);

  function getBackgroundRemovalResult(sourceImageData: ImageData) {
    if (!hasBackgroundColorSelection) {
      return {
        imageData: sourceImageData,
        transparentPixelCount: 0,
      };
    }

    if (backgroundRemovalMode === 'connected') {
      return backgroundSamplePoint
        ? removeConnectedBackground(
            sourceImageData,
            backgroundSamplePoint,
            backgroundColor,
            backgroundTolerance,
          )
        : {
            imageData: sourceImageData,
            transparentPixelCount: 0,
          };
    }

    return removeMatchingBackground(sourceImageData, backgroundColor, backgroundTolerance);
  }

  const processedImageData = React.useMemo(() => {
    if (!image) {
      return null;
    }

    return getBackgroundRemovalResult(image.imageData);
  }, [
    backgroundColor,
    backgroundRemovalMode,
    backgroundSamplePoint,
    backgroundTolerance,
    hasBackgroundColorSelection,
    image,
  ]);

  const previewProcessedImageData = React.useMemo(() => {
    if (!image) {
      return null;
    }

    const previewSourceImageData = pixelNormalizePreview?.imageData ?? image.imageData;

    return getBackgroundRemovalResult(previewSourceImageData);
  }, [
    backgroundColor,
    backgroundRemovalMode,
    backgroundSamplePoint,
    backgroundTolerance,
    hasBackgroundColorSelection,
    image,
    pixelNormalizePreview,
  ]);

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

  const availableStepIds = React.useMemo(() => {
    const nextAvailableStepIds = new Set<WorkflowStepId>(['import']);

    if (image) {
      nextAvailableStepIds.add('background');
      nextAvailableStepIds.add('cleanup');
      nextAvailableStepIds.add('slicing');
    }

    if (totalFinalSequenceFrameCount > 0) {
      nextAvailableStepIds.add('export');
    }

    return nextAvailableStepIds;
  }, [image, totalFinalSequenceFrameCount]);

  React.useEffect(() => {
    if (!availableStepIds.has(currentStep)) {
      setCurrentStep(image ? 'background' : 'import');
    }
  }, [availableStepIds, currentStep, image]);

  React.useEffect(() => {
    imageDataRef.current = image?.imageData ?? null;
  }, [image]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) {
      return;
    }

    if (!previewProcessedImageData) {
      return;
    }

    renderScaledImageDataToCanvas(canvas, previewProcessedImageData.imageData, scale);
    if (isGridOverlayEnabled) {
      drawGridOverlay(canvas, previewProcessedImageData.imageData, scale, gridOverlaySize);
    }
  }, [gridOverlaySize, image, isGridOverlayEnabled, previewProcessedImageData, scale]);

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

  function resetSequenceAssembly() {
    setSelectedFrameId(null);
    sequenceFrameCounterRef.current = 0;
    sequenceRowCounterRef.current = 1;
    setFinalSequenceRows(createInitialFinalSequenceRows());
    setSelectedSequenceRowId('sequence-row-1');
    setPlayingSequenceRowIds(new Set());
    setCopiedFrameSource(null);
  }

  function clearPixelProcessingStatuses() {
    setPixelCleanupStatus('');
    setPixelNormalizeStatus('');
  }

  function clearPixelNormalizePreview() {
    setPixelNormalizePreview(null);
  }

  function createImageHistoryEntry(label: string): ImageHistoryEntry | null {
    if (!image) {
      return null;
    }

    return {
      label,
      image: cloneLoadedImage(image),
      resolutionScale,
      cropInsets,
      backgroundColor,
      hasBackgroundColorSelection,
      backgroundSamplePoint,
    };
  }

  function pushImageHistory(label: string) {
    const historyEntry = createImageHistoryEntry(label);
    if (!historyEntry) {
      return;
    }

    setUndoStack((currentStack) => [
      ...currentStack.slice(Math.max(0, currentStack.length - MAX_IMAGE_HISTORY_ENTRIES + 1)),
      historyEntry,
    ]);
    setRedoStack([]);
  }

  function restoreImageHistoryEntry(historyEntry: ImageHistoryEntry) {
    setImage(cloneLoadedImage(historyEntry.image));
    imageDataRef.current = cloneImageData(historyEntry.image.imageData);
    setResolutionScale(historyEntry.resolutionScale);
    setCropInsets(historyEntry.cropInsets);
    setBackgroundColor(historyEntry.backgroundColor);
    setHasBackgroundColorSelection(historyEntry.hasBackgroundColorSelection);
    setBackgroundSamplePoint(historyEntry.backgroundSamplePoint);
    clearPixelNormalizePreview();
    resetSequenceAssembly();
    setBackgroundRemovalStatus(`已恢复到“${historyEntry.label}”之前的图像状态。`);
    setCropStatus('');
    clearPixelProcessingStatuses();
    setExportStatus('');
  }

  function handleUndoImageOperation() {
    const previousEntry = undoStack[undoStack.length - 1];
    const currentEntry = createImageHistoryEntry(previousEntry?.label ?? '撤销前状态');
    if (!previousEntry || !currentEntry) {
      return;
    }

    setUndoStack((currentStack) => currentStack.slice(0, -1));
    setRedoStack((currentStack) => [
      ...currentStack.slice(Math.max(0, currentStack.length - MAX_IMAGE_HISTORY_ENTRIES + 1)),
      currentEntry,
    ]);
    restoreImageHistoryEntry(previousEntry);
  }

  function handleRedoImageOperation() {
    const nextEntry = redoStack[redoStack.length - 1];
    const currentEntry = createImageHistoryEntry(nextEntry?.label ?? '重做前状态');
    if (!nextEntry || !currentEntry) {
      return;
    }

    setRedoStack((currentStack) => currentStack.slice(0, -1));
    setUndoStack((currentStack) => [
      ...currentStack.slice(Math.max(0, currentStack.length - MAX_IMAGE_HISTORY_ENTRIES + 1)),
      currentEntry,
    ]);
    restoreImageHistoryEntry(nextEntry);
  }

  function applyPreparedImage(currentImage: LoadedImage, preparedImage: ReturnType<typeof prepareImageData>) {
    setCropInsets(preparedImage.cropInsets);
    setImage({
      ...currentImage,
      imageData: preparedImage.imageData,
      width: preparedImage.imageData.width,
      height: preparedImage.imageData.height,
    });
    resetSequenceAssembly();
    setHasBackgroundColorSelection(false);
    setBackgroundSamplePoint(null);
    clearPixelNormalizePreview();
  }

  function updateCurrentImageData(nextImageData: ImageData, shouldResetSequence = true) {
    setImage((currentImage) =>
      currentImage
        ? {
            ...currentImage,
            imageData: nextImageData,
          }
        : currentImage,
    );
    imageDataRef.current = nextImageData;
    clearPixelNormalizePreview();

    if (shouldResetSequence) {
      resetSequenceAssembly();
    }
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
        const videoSpriteSheet = await readVideoSpriteSheetImageData(file, {
          frameCount: DEFAULT_VIDEO_FRAME_COUNT,
          startTime: 0,
          endTime: Number.POSITIVE_INFINITY,
        });
        sourceImageData = videoSpriteSheet.imageData;
        originalWidth = videoSpriteSheet.imageData.width;
        originalHeight = videoSpriteSheet.imageData.height;
        sourceType = 'video';
        extractedFrameCount = videoSpriteSheet.extractedFrameCount;
        sourceFrameWidth = videoSpriteSheet.frameWidth;
        sourceFrameHeight = videoSpriteSheet.frameHeight;
        setVideoSourceFile(file);
        setVideoDuration(videoSpriteSheet.duration);
        setVideoExtractionOptions(videoSpriteSheet.extractionOptions);
      } else {
        const bitmap = await createImageBitmap(file);
        sourceImageData = readBitmapImageData(bitmap);
        originalWidth = bitmap.width;
        originalHeight = bitmap.height;
        sourceType = 'image';
        bitmap.close();
        setVideoSourceFile(null);
        setVideoDuration(0);
        setVideoExtractionOptions({
          frameCount: DEFAULT_VIDEO_FRAME_COUNT,
          startTime: 0,
          endTime: 0,
        });
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
      resetSequenceAssembly();
      setUndoStack([]);
      setRedoStack([]);
      setHasBackgroundColorSelection(false);
      setBackgroundSamplePoint(null);
      setBackgroundRemovalStatus('');
      setCropStatus('');
      clearPixelProcessingStatuses();
      clearPixelNormalizePreview();
      setImportStatus(
        sourceType === 'video' && extractedFrameCount
          ? `已抽取 ${extractedFrameCount} 帧，并组合为 ${preparedImage.imageData.width} × ${preparedImage.imageData.height}px 单行长图。`
          : '',
      );
      setExportStatus('');
      setCurrentStep('background');
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
      pushImageHistory('调整处理分辨率');
      setResolutionScale(nextResolutionScale);
      applyPreparedImage(image, preparedImage);
      setBackgroundRemovalStatus(
        nextResolutionScale === 1
          ? '已恢复原始处理分辨率，请重新取色。'
          : `已将处理分辨率缩小到 ${formatResolutionScale(nextResolutionScale)}，请重新取色。`,
      );
      setCropStatus('处理分辨率已变化，裁剪数值已按比例调整。');
      clearPixelProcessingStatuses();
      setExportStatus('');
    } catch {
      setError('调整处理分辨率失败，当前浏览器无法重新采样图片。');
    }
  }

  async function handleReextractVideoFrames() {
    if (!image || !videoSourceFile || image.sourceType !== 'video') {
      return;
    }

    try {
      setImportStatus('正在按当前设置重新抽取视频帧...');
      const videoSpriteSheet = await readVideoSpriteSheetImageData(
        videoSourceFile,
        videoExtractionOptions,
      );
      const defaultCropInsets = createDefaultCropInsets();
      const preparedImage = prepareImageData(
        videoSpriteSheet.imageData,
        DEFAULT_RESOLUTION_SCALE,
        defaultCropInsets,
      );

      pushImageHistory('重新抽取视频帧');
      setImage({
        ...image,
        imageData: preparedImage.imageData,
        sourceImageData: videoSpriteSheet.imageData,
        width: preparedImage.imageData.width,
        height: preparedImage.imageData.height,
        originalWidth: videoSpriteSheet.imageData.width,
        originalHeight: videoSpriteSheet.imageData.height,
        extractedFrameCount: videoSpriteSheet.extractedFrameCount,
        sourceFrameWidth: videoSpriteSheet.frameWidth,
        sourceFrameHeight: videoSpriteSheet.frameHeight,
      });
      imageDataRef.current = preparedImage.imageData;
      setResolutionScale(DEFAULT_RESOLUTION_SCALE);
      setCropInsets(preparedImage.cropInsets);
      setVideoDuration(videoSpriteSheet.duration);
      setVideoExtractionOptions(videoSpriteSheet.extractionOptions);
      setGridRows(1);
      setGridColumns(videoSpriteSheet.extractedFrameCount);
      resetSequenceAssembly();
      setHasBackgroundColorSelection(false);
      setBackgroundSamplePoint(null);
      setBackgroundRemovalStatus('');
      setCropStatus('');
      clearPixelProcessingStatuses();
      clearPixelNormalizePreview();
      setImportStatus(
        `已重新抽取 ${videoSpriteSheet.extractedFrameCount} 帧，并组合为 ${preparedImage.imageData.width} × ${preparedImage.imageData.height}px 单行长图。`,
      );
      setExportStatus('');
    } catch {
      setImportStatus('');
      setError('重新抽帧失败，请检查起止时间或换一个浏览器支持的视频重试。');
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
      pushImageHistory('手动裁剪');
      applyPreparedImage(image, preparedImage);
      setBackgroundRemovalStatus('');
      setCropStatus(
        `已裁剪为 ${preparedImage.imageData.width} × ${preparedImage.imageData.height}px，切分前请重新取色。`,
      );
      clearPixelProcessingStatuses();
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
      pushImageHistory('重置裁剪');
      applyPreparedImage(image, preparedImage);
      setBackgroundRemovalStatus('');
      setCropStatus('已清除裁剪，恢复当前处理分辨率下的完整画布。');
      clearPixelProcessingStatuses();
      setExportStatus('');
    } catch {
      setError('重置裁剪失败，当前浏览器无法重新生成图片。');
    }
  }

  function applyCurrentImageCrop(nextCropInsets: CropInsets, label: string, emptyStatus: string) {
    if (!image) {
      return;
    }

    if (
      nextCropInsets.top === 0 &&
      nextCropInsets.right === 0 &&
      nextCropInsets.bottom === 0 &&
      nextCropInsets.left === 0
    ) {
      setCropStatus(emptyStatus);
      return;
    }

    try {
      const cropped = prepareImageData(image.imageData, DEFAULT_RESOLUTION_SCALE, nextCropInsets);
      pushImageHistory(label);
      const nextImage = {
        ...image,
        imageData: cropped.imageData,
        sourceImageData: cloneImageData(cropped.imageData),
        width: cropped.imageData.width,
        height: cropped.imageData.height,
      };
      setImage(nextImage);
      imageDataRef.current = nextImage.imageData;
      setResolutionScale(DEFAULT_RESOLUTION_SCALE);
      setCropInsets(createDefaultCropInsets());
      resetSequenceAssembly();
      setHasBackgroundColorSelection(false);
      setBackgroundSamplePoint(null);
      setBackgroundRemovalStatus('');
      setCropStatus(`已裁剪为 ${cropped.imageData.width} × ${cropped.imageData.height}px，并设为新的处理基准。`);
      clearPixelProcessingStatuses();
      clearPixelNormalizePreview();
      setExportStatus('');
    } catch {
      setError('自动裁剪失败，当前浏览器无法重新生成图片。');
    }
  }

  function handleAutoCropTransparentEdges() {
    if (!image) {
      return;
    }

    applyCurrentImageCrop(
      getTransparentBoundsCropInsets(image.imageData),
      '一键裁透明边',
      '当前图片四周没有可裁掉的透明边。',
    );
  }

  function handleAutoCropBackgroundEdges() {
    if (!image) {
      return;
    }

    if (!hasBackgroundColorSelection) {
      setCropStatus('请先在“去背景色”步骤取背景色，再一键裁背景色边。');
      return;
    }

    applyCurrentImageCrop(
      getBackgroundBorderCropInsets(image.imageData, backgroundColor, backgroundTolerance),
      '一键裁背景色边',
      '当前图片四周没有符合当前背景色和容差的可裁区域。',
    );
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
      setBackgroundSamplePoint(null);
      setBackgroundRemovalStatus('点击的位置已经是透明像素，无需再按白色去背景。');
      return;
    }

    setBackgroundColor(rgbToHex(data[pixelIndex], data[pixelIndex + 1], data[pixelIndex + 2]));
    setHasBackgroundColorSelection(true);
    setBackgroundSamplePoint(point);
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

    const removedBackground = getBackgroundRemovalResult(image.imageData);

    if (removedBackground.transparentPixelCount === 0) {
      setBackgroundRemovalStatus('没有找到匹配的不透明背景像素，请重新取色或调高容差。');
      return;
    }

    pushImageHistory(backgroundRemovalMode === 'connected' ? '魔棒连通去背景' : '全图容差去背景');
    updateCurrentImageData(removedBackground.imageData, false);
    setBackgroundRemovalStatus(
      `已将 ${removedBackground.transparentPixelCount} 个背景像素变为透明。`,
    );
    clearPixelProcessingStatuses();
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

    pushImageHistory('自动去毛刺');
    updateCurrentImageData(cleaned.imageData);
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

    pushImageHistory('去背景色边');
    updateCurrentImageData(defringed.imageData);
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

    pushImageHistory('按帧底部居中对齐');
    updateCurrentImageData(aligned.imageData);
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
      clearPixelNormalizePreview();
      return;
    }
    setPixelCleanupStatus('');
    setPixelNormalizePreview({
      kind: 'snap',
      imageData: snapped.imageData,
      status: `正在预览 ${pixelBlockSize}×${pixelBlockSize} 网格对齐效果，预计修改 ${snapped.snappedBlockCount} 个像素。满意后点击“确认应用预览”。`,
      applyStatus: `已按 ${pixelBlockSize}×${pixelBlockSize} 网格对齐，修改了 ${snapped.snappedBlockCount} 个像素。`,
    });
    setPixelNormalizeStatus(
      `正在预览 ${pixelBlockSize}×${pixelBlockSize} 网格对齐效果，预计修改 ${snapped.snappedBlockCount} 个像素。`,
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
      clearPixelNormalizePreview();
      return;
    }
    setPixelCleanupStatus('');
    setPixelNormalizePreview({
      kind: 'quantize',
      imageData: quantized.imageData,
      status: `正在预览色彩量化效果：${quantized.originalColorCount} 种 → ${quantized.quantizedColorCount} 种颜色。满意后点击“确认应用预览”。`,
      applyStatus: `色彩量化完成：${quantized.originalColorCount} 种 → ${quantized.quantizedColorCount} 种颜色。`,
    });
    setPixelNormalizeStatus(
      `正在预览色彩量化效果：${quantized.originalColorCount} 种 → ${quantized.quantizedColorCount} 种颜色。`,
    );
    setExportStatus('');
  }

  function handleApplyPixelNormalizePreview() {
    if (!pixelNormalizePreview) {
      return;
    }

    const applyStatus = pixelNormalizePreview.applyStatus;
    pushImageHistory(pixelNormalizePreview.kind === 'snap' ? '确认网格对齐预览' : '确认色彩量化预览');
    updateCurrentImageData(pixelNormalizePreview.imageData);
    setPixelCleanupStatus('');
    setPixelNormalizeStatus(applyStatus);
    setExportStatus('');
  }

  function handleCancelPixelNormalizePreview() {
    if (!pixelNormalizePreview) {
      return;
    }

    clearPixelNormalizePreview();
    setPixelNormalizeStatus('已取消预览，图片保持未应用前的状态。');
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

    const previewImageData = getBackgroundRemovalResult(erased.imageData).imageData;
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
    if (!isEraserHistoryCapturedRef.current) {
      pushImageHistory('橡皮擦擦除');
      isEraserHistoryCapturedRef.current = true;
    }
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
    isEraserHistoryCapturedRef.current = false;
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
    resetSequenceAssembly();
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
      if (exportFormat === 'gif') {
        finalSequenceFrameRowsForExport.forEach((frames, rowIndex) => {
          const gifBlob = createAnimatedGifBlob(
            frames,
            exportBackgroundMode === 'solid' ? exportBackgroundColor : null,
            animationFrameIntervalMs,
          );
          downloadBlob(gifBlob, getGifExportFileName(image.name, rowIndex));
        });
        setExportStatus(
          `已导出 ${finalSequenceFrameRowsForExport.length} 个 GIF 动画文件，帧间隔 ${animationFrameIntervalMs}ms。`,
        );
        return;
      }

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
      <WorkflowStepNav
        currentStep={currentStep}
        availableStepIds={availableStepIds}
        onStepChange={setCurrentStep}
      />

      <div className="workflow-content">
        {currentStep === 'import' ? (
          <ImportGuidePanel
            importStatus={importStatus}
            error={error}
            onFileChange={handleFileChange}
          />
        ) : null}

        {currentStep !== 'import' ? (
          <MainControlPanel
            currentStep={currentStep}
            canvasRef={canvasRef}
            image={image}
            scale={scale}
            setScale={setScale}
            resolutionScale={resolutionScale}
            handleResolutionScaleChange={handleResolutionScaleChange}
            transparentPreviewStyle={transparentPreviewStyle}
            isEraserMode={isEraserMode}
            handleCanvasPick={handleCanvasPick}
            handleCanvasPointerDown={handleCanvasPointerDown}
            handleCanvasPointerMove={handleCanvasPointerMove}
            stopErasing={stopErasing}
            backgroundTransparentPixelCount={backgroundTransparentPixelCount}
            currentTransparentPixelCount={currentTransparentPixelCount}
            currentBaseProcessingSize={currentBaseProcessingSize}
            totalCroppedPixelCount={totalCroppedPixelCount}
            cropInsets={cropInsets}
            handleCropInsetChange={handleCropInsetChange}
            handleResetCrop={handleResetCrop}
            cropStatus={cropStatus}
            backgroundColor={backgroundColor}
            setBackgroundColor={setBackgroundColor}
            hasBackgroundColorSelection={hasBackgroundColorSelection}
            setHasBackgroundColorSelection={setHasBackgroundColorSelection}
            backgroundTolerance={backgroundTolerance}
            setBackgroundTolerance={setBackgroundTolerance}
            isBackgroundPreviewEnabled={isBackgroundPreviewEnabled}
            setIsBackgroundPreviewEnabled={setIsBackgroundPreviewEnabled}
            previewBackgroundColor={previewBackgroundColor}
            setPreviewBackgroundColor={setPreviewBackgroundColor}
            handleApplyBackgroundRemoval={handleApplyBackgroundRemoval}
            backgroundRemovalStatus={backgroundRemovalStatus}
            alphaThreshold={alphaThreshold}
            setAlphaThreshold={setAlphaThreshold}
            minNeighborCount={minNeighborCount}
            setMinNeighborCount={setMinNeighborCount}
            minComponentSize={minComponentSize}
            setMinComponentSize={setMinComponentSize}
            fringeTolerance={fringeTolerance}
            setFringeTolerance={setFringeTolerance}
            fringeRadius={fringeRadius}
            setFringeRadius={setFringeRadius}
            handleRemoveBackgroundFringe={handleRemoveBackgroundFringe}
            handleCleanPixelNoise={handleCleanPixelNoise}
            handleAlignFramesBottomCenter={handleAlignFramesBottomCenter}
            isGridOverlayEnabled={isGridOverlayEnabled}
            setIsGridOverlayEnabled={setIsGridOverlayEnabled}
            gridOverlaySize={gridOverlaySize}
            setGridOverlaySize={setGridOverlaySize}
            canUndoImageOperation={undoStack.length > 0}
            canRedoImageOperation={redoStack.length > 0}
            undoLabel={undoStack[undoStack.length - 1]?.label ?? null}
            redoLabel={redoStack[redoStack.length - 1]?.label ?? null}
            onUndoImageOperation={handleUndoImageOperation}
            onRedoImageOperation={handleRedoImageOperation}
            pixelCleanupStatus={pixelCleanupStatus}
            currentUniqueColorCount={currentUniqueColorCount}
            pixelBlockSize={pixelBlockSize}
            setPixelBlockSize={setPixelBlockSize}
            handleDetectPixelBlockSize={handleDetectPixelBlockSize}
            snapAlphaThreshold={snapAlphaThreshold}
            setSnapAlphaThreshold={setSnapAlphaThreshold}
            handleSnapToPixelGrid={handleSnapToPixelGrid}
            quantizeColorCount={quantizeColorCount}
            setQuantizeColorCount={setQuantizeColorCount}
            handleQuantizeColors={handleQuantizeColors}
            pixelNormalizeStatus={pixelNormalizeStatus}
            hasPixelNormalizePreview={Boolean(pixelNormalizePreview)}
            handleApplyPixelNormalizePreview={handleApplyPixelNormalizePreview}
            handleCancelPixelNormalizePreview={handleCancelPixelNormalizePreview}
            brushSize={brushSize}
            setBrushSize={setBrushSize}
            setIsEraserMode={setIsEraserMode}
            handleAutoCropTransparentEdges={handleAutoCropTransparentEdges}
            handleAutoCropBackgroundEdges={handleAutoCropBackgroundEdges}
            backgroundRemovalMode={backgroundRemovalMode}
            setBackgroundRemovalMode={setBackgroundRemovalMode}
            hasConnectedBackgroundPoint={Boolean(backgroundSamplePoint)}
            videoDuration={videoDuration}
            videoExtractionOptions={videoExtractionOptions}
            setVideoExtractionOptions={setVideoExtractionOptions}
            handleReextractVideoFrames={handleReextractVideoFrames}
            importStatus={importStatus}
          />
        ) : null}

        {currentStep === 'slicing' || currentStep === 'export' ? (
          <SpriteAssemblyPanel
            currentStep={currentStep}
            image={image}
            gridRows={gridRows}
            setGridRows={setGridRows}
            gridColumns={gridColumns}
            setGridColumns={setGridColumns}
            handleGridSizeChange={handleGridSizeChange}
            spriteFrames={spriteFrames}
            selectedFrame={selectedFrame}
            setSelectedFrameId={setSelectedFrameId}
            previewBackgroundColor={previewBackgroundColor}
            isBackgroundPreviewEnabled={isBackgroundPreviewEnabled}
            copiedFrameSource={copiedFrameSource}
            handleAddSelectedFrameToSequence={handleAddSelectedFrameToSequence}
            finalSequenceRowsWithItems={finalSequenceRowsWithItems}
            selectedSequenceRow={selectedSequenceRow}
            finalSequenceRows={finalSequenceRows}
            totalFinalSequenceFrameCount={totalFinalSequenceFrameCount}
            selectedSequenceRowNumber={selectedSequenceRowNumber}
            handleAddSequenceRow={handleAddSequenceRow}
            animationFrameIntervalMs={animationFrameIntervalMs}
            setAnimationFrameIntervalMs={setAnimationFrameIntervalMs}
            setSelectedSequenceRowId={setSelectedSequenceRowId}
            handleRemoveSequenceRow={handleRemoveSequenceRow}
            handleMoveSequenceFrame={handleMoveSequenceFrame}
            handleRemoveSequenceFrame={handleRemoveSequenceFrame}
            playingSequenceRowIds={playingSequenceRowIds}
            handleToggleSequenceRowPlayback={handleToggleSequenceRowPlayback}
            exportCanvasSize={exportCanvasSize}
            finalSequenceFrameRowsForExport={finalSequenceFrameRowsForExport}
            handleExportFinalSequence={handleExportFinalSequence}
            exportFormat={exportFormat}
            setExportFormat={setExportFormat}
            exportBackgroundMode={exportBackgroundMode}
            setExportBackgroundMode={setExportBackgroundMode}
            exportBackgroundColor={exportBackgroundColor}
            setExportBackgroundColor={setExportBackgroundColor}
            exportStatus={exportStatus}
          />
        ) : null}
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
