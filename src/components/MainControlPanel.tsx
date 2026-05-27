import React from 'react';
import {
  MAX_BACKGROUND_TOLERANCE,
  MAX_BRUSH_SIZE,
  MAX_PIXEL_BLOCK_SIZE,
  MAX_QUANTIZE_COLOR_COUNT,
  MAX_SNAP_ALPHA_THRESHOLD,
  MIN_BRUSH_SIZE,
  MIN_PIXEL_BLOCK_SIZE,
  MIN_QUANTIZE_COLOR_COUNT,
} from '../constants';
import type { CropInsetKey, CropInsets, LoadedImage, ResolutionScale } from '../types';
import type { WorkflowStepId } from '../workflowSteps';
import { CanvasPreviewPanel } from './CanvasPreviewPanel';
import { CommonToolPanel } from './CommonToolPanel';

type ProcessingSize = {
  width: number;
  height: number;
};

type MainControlPanelProps = {
  currentStep: WorkflowStepId;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  image: LoadedImage | null;
  scale: number;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  resolutionScale: ResolutionScale;
  handleResolutionScaleChange: (value: string) => void;
  transparentPreviewStyle: React.CSSProperties | undefined;
  isEraserMode: boolean;
  handleCanvasPick: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  handleCanvasPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  stopErasing: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  backgroundTransparentPixelCount: number;
  currentTransparentPixelCount: number;
  currentBaseProcessingSize: ProcessingSize | null;
  totalCroppedPixelCount: number;
  cropInsets: CropInsets;
  handleCropInsetChange: (cropInsetKey: CropInsetKey, value: string) => void;
  handleResetCrop: () => void;
  cropStatus: string;
  backgroundColor: string;
  setBackgroundColor: React.Dispatch<React.SetStateAction<string>>;
  hasBackgroundColorSelection: boolean;
  setHasBackgroundColorSelection: React.Dispatch<React.SetStateAction<boolean>>;
  backgroundTolerance: number;
  setBackgroundTolerance: React.Dispatch<React.SetStateAction<number>>;
  isBackgroundPreviewEnabled: boolean;
  setIsBackgroundPreviewEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  previewBackgroundColor: string;
  setPreviewBackgroundColor: React.Dispatch<React.SetStateAction<string>>;
  handleApplyBackgroundRemoval: () => void;
  backgroundRemovalStatus: string;
  alphaThreshold: number;
  setAlphaThreshold: React.Dispatch<React.SetStateAction<number>>;
  minNeighborCount: number;
  setMinNeighborCount: React.Dispatch<React.SetStateAction<number>>;
  minComponentSize: number;
  setMinComponentSize: React.Dispatch<React.SetStateAction<number>>;
  fringeTolerance: number;
  setFringeTolerance: React.Dispatch<React.SetStateAction<number>>;
  fringeRadius: number;
  setFringeRadius: React.Dispatch<React.SetStateAction<number>>;
  handleRemoveBackgroundFringe: () => void;
  handleCleanPixelNoise: () => void;
  handleAlignFramesBottomCenter: () => void;
  isGridOverlayEnabled: boolean;
  setIsGridOverlayEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  gridOverlaySize: number;
  setGridOverlaySize: React.Dispatch<React.SetStateAction<number>>;
  pixelCleanupStatus: string;
  currentUniqueColorCount: number;
  pixelBlockSize: number;
  setPixelBlockSize: React.Dispatch<React.SetStateAction<number>>;
  handleDetectPixelBlockSize: () => void;
  snapAlphaThreshold: number;
  setSnapAlphaThreshold: React.Dispatch<React.SetStateAction<number>>;
  handleSnapToPixelGrid: () => void;
  quantizeColorCount: number;
  setQuantizeColorCount: React.Dispatch<React.SetStateAction<number>>;
  handleQuantizeColors: () => void;
  pixelNormalizeStatus: string;
  hasPixelNormalizePreview: boolean;
  handleApplyPixelNormalizePreview: () => void;
  handleCancelPixelNormalizePreview: () => void;
  brushSize: number;
  setBrushSize: React.Dispatch<React.SetStateAction<number>>;
  setIsEraserMode: React.Dispatch<React.SetStateAction<boolean>>;
};

export function MainControlPanel({
  currentStep,
  canvasRef,
  image,
  scale,
  setScale,
  resolutionScale,
  handleResolutionScaleChange,
  transparentPreviewStyle,
  isEraserMode,
  handleCanvasPick,
  handleCanvasPointerDown,
  handleCanvasPointerMove,
  stopErasing,
  backgroundTransparentPixelCount,
  currentTransparentPixelCount,
  currentBaseProcessingSize,
  totalCroppedPixelCount,
  cropInsets,
  handleCropInsetChange,
  handleResetCrop,
  cropStatus,
  backgroundColor,
  setBackgroundColor,
  hasBackgroundColorSelection,
  setHasBackgroundColorSelection,
  backgroundTolerance,
  setBackgroundTolerance,
  isBackgroundPreviewEnabled,
  setIsBackgroundPreviewEnabled,
  previewBackgroundColor,
  setPreviewBackgroundColor,
  handleApplyBackgroundRemoval,
  backgroundRemovalStatus,
  alphaThreshold,
  setAlphaThreshold,
  minNeighborCount,
  setMinNeighborCount,
  minComponentSize,
  setMinComponentSize,
  fringeTolerance,
  setFringeTolerance,
  fringeRadius,
  setFringeRadius,
  handleRemoveBackgroundFringe,
  handleCleanPixelNoise,
  handleAlignFramesBottomCenter,
  isGridOverlayEnabled,
  setIsGridOverlayEnabled,
  gridOverlaySize,
  setGridOverlaySize,
  pixelCleanupStatus,
  currentUniqueColorCount,
  pixelBlockSize,
  setPixelBlockSize,
  handleDetectPixelBlockSize,
  snapAlphaThreshold,
  setSnapAlphaThreshold,
  handleSnapToPixelGrid,
  quantizeColorCount,
  setQuantizeColorCount,
  handleQuantizeColors,
  pixelNormalizeStatus,
  hasPixelNormalizePreview,
  handleApplyPixelNormalizePreview,
  handleCancelPixelNormalizePreview,
  brushSize,
  setBrushSize,
  setIsEraserMode,
}: MainControlPanelProps) {
  return (
      <section className="panel preview-panel">
        <CommonToolPanel
          image={image}
          scale={scale}
          setScale={setScale}
          resolutionScale={resolutionScale}
          handleResolutionScaleChange={handleResolutionScaleChange}
          isBackgroundPreviewEnabled={isBackgroundPreviewEnabled}
          setIsBackgroundPreviewEnabled={setIsBackgroundPreviewEnabled}
          previewBackgroundColor={previewBackgroundColor}
          setPreviewBackgroundColor={setPreviewBackgroundColor}
          isGridOverlayEnabled={isGridOverlayEnabled}
          setIsGridOverlayEnabled={setIsGridOverlayEnabled}
          gridOverlaySize={gridOverlaySize}
          setGridOverlaySize={setGridOverlaySize}
        />

        <CanvasPreviewPanel
          canvasRef={canvasRef}
          image={image}
          scale={scale}
          transparentPreviewStyle={transparentPreviewStyle}
          isEraserMode={isEraserMode}
          handleCanvasPick={handleCanvasPick}
          handleCanvasPointerDown={handleCanvasPointerDown}
          handleCanvasPointerMove={handleCanvasPointerMove}
          stopErasing={stopErasing}
          backgroundTransparentPixelCount={backgroundTransparentPixelCount}
          currentTransparentPixelCount={currentTransparentPixelCount}
        />
        {currentStep === 'cleanup' ? (
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
        ) : null}

        {currentStep === 'background' ? (
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
              <span>在公共预览工具开启背景预览色，更容易发现透明边缘和残留底色。</span>
            </li>
            <li>
              <strong>4. 应用透明</strong>
              <span>预览效果满意后，再写入当前图片数据。</span>
            </li>
            <li>
              <strong>5. 去背景色边</strong>
              <span>透明化后如仍有描边残色，可用当前背景色继续修边。</span>
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
          </div>

          <p className="hint">
            取色和调容差会先更新预览，不会立刻改原图；背景预览开关和预览色集中在公共预览工具中，点击“应用为透明”后，当前匹配的背景像素才会写入并参与切帧、重组和导出。
          </p>
          {backgroundRemovalStatus ? (
            <p className="background-status">{backgroundRemovalStatus}</p>
          ) : null}
        </section>
        ) : null}

        {currentStep === 'cleanup' ? (
        <>
        <section className="pixel-cleanup-panel" aria-label="像素清理与对齐">
          <div className="pixel-cleanup-panel__header">
            <div>
              <p className="eyebrow">Pixel Cleanup</p>
              <h2>像素清理与对齐</h2>
            </div>
            <p className="pixel-cleanup-panel__summary">
              {image
                ? `当前透明像素 ${currentTransparentPixelCount} 个，可继续裁剪、去毛刺或规范化像素`
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
              className="tool-button pixel-cleanup-button"
              onClick={handleAlignFramesBottomCenter}
              disabled={!image}
            >
              按帧底部居中对齐
            </button>
          </div>

          <p className="hint">
            建议先“自动去毛刺”清理孤立噪点和小色块；如果动作帧播放抖动，可先确认切帧行列数，再执行“按帧底部居中对齐”；之后再用像素网格对齐与色彩量化统一像素风格。
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
              预览网格对齐
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
              预览色彩量化
            </button>
          </div>

          <p className="hint">
            AI 生成的像素图常出现"伪像素"（大小不一、带抗锯齿、未对齐网格）和颜色过多（同一区域几十种相近色）。点击预览后只会临时更新画布，确认满意后再应用到图片；如果效果不对，可以取消预览并调整参数重试。
          </p>
          {hasPixelNormalizePreview ? (
            <div className="pixel-normalize-preview-actions" aria-label="像素规范化预览确认">
              <button
                type="button"
                className="tool-button pixel-normalize-button"
                onClick={handleApplyPixelNormalizePreview}
              >
                确认应用预览
              </button>
              <button
                type="button"
                className="tool-button"
                onClick={handleCancelPixelNormalizePreview}
              >
                取消预览
              </button>
            </div>
          ) : null}
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
        </>
        ) : null}
      </section>
  );
}
