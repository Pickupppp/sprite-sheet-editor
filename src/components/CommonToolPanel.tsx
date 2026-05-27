import React from 'react';
import {
  MAX_SCALE,
  MIN_SCALE,
  RESOLUTION_SCALE_OPTIONS,
} from '../constants';
import { formatResolutionScale } from '../imageProcessing';
import type { LoadedImage, ResolutionScale } from '../types';

type CommonToolPanelProps = {
  image: LoadedImage | null;
  scale: number;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  resolutionScale: ResolutionScale;
  handleResolutionScaleChange: (value: string) => void;
  isBackgroundPreviewEnabled: boolean;
  setIsBackgroundPreviewEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  previewBackgroundColor: string;
  setPreviewBackgroundColor: React.Dispatch<React.SetStateAction<string>>;
  isGridOverlayEnabled: boolean;
  setIsGridOverlayEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  gridOverlaySize: number;
  setGridOverlaySize: React.Dispatch<React.SetStateAction<number>>;
};

export function CommonToolPanel({
  image,
  scale,
  setScale,
  resolutionScale,
  handleResolutionScaleChange,
  isBackgroundPreviewEnabled,
  setIsBackgroundPreviewEnabled,
  previewBackgroundColor,
  setPreviewBackgroundColor,
  isGridOverlayEnabled,
  setIsGridOverlayEnabled,
  gridOverlaySize,
  setGridOverlaySize,
}: CommonToolPanelProps) {
  return (
    <section className="common-tools" aria-label="跨步骤预览工具">
      <div className="common-tools__header">
        <div>
          <p className="eyebrow">Preview Tools</p>
          <h2>公共预览工具</h2>
        </div>
        <p className="common-tools__summary">缩放、处理分辨率、背景预览和辅助网格会在步骤切换时保留。</p>
      </div>

      <div className="common-tools__controls">
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
    </section>
  );
}
