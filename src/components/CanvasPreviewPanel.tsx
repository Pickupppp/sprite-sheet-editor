import React from 'react';
import type { LoadedImage } from '../types';

type CanvasPreviewPanelProps = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  image: LoadedImage | null;
  scale: number;
  transparentPreviewStyle: React.CSSProperties | undefined;
  isEraserMode: boolean;
  handleCanvasPick: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  handleCanvasPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  stopErasing: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  backgroundTransparentPixelCount: number;
  currentTransparentPixelCount: number;
};

export function CanvasPreviewPanel({
  canvasRef,
  image,
  scale,
  transparentPreviewStyle,
  isEraserMode,
  handleCanvasPick,
  handleCanvasPointerDown,
  handleCanvasPointerMove,
  stopErasing,
  backgroundTransparentPixelCount,
  currentTransparentPixelCount,
}: CanvasPreviewPanelProps) {
  return (
    <>
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
          · 处理尺寸 {image.width} × {image.height}px · canvas 显示尺寸 {image.width * scale} ×{' '}
          {image.height * scale}px · 预计可透明化 {backgroundTransparentPixelCount} 个像素 ·
          当前图片透明像素 {currentTransparentPixelCount} 个
        </p>
      ) : null}
    </>
  );
}
