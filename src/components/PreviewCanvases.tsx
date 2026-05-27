import React from 'react';
import type { SpriteFrame } from '../types';

export function FramePreviewCanvas({
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

export function SequencePreviewCanvas({
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

export function AnimationPreviewCanvas({
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
