import React from 'react';
import {
  MAX_ANIMATION_FRAME_INTERVAL_MS,
  MAX_GRID_SIZE,
  MIN_ANIMATION_FRAME_INTERVAL_MS,
  MIN_GRID_SIZE,
} from '../constants';
import type {
  CopiedFrameSource,
  ExportFormat,
  ExportBackgroundMode,
  FinalSequenceFrame,
  FinalSequenceRow,
  LoadedImage,
  SpriteFrame,
} from '../types';
import type { WorkflowStepId } from '../workflowSteps';
import { AnimationPreviewCanvas, FramePreviewCanvas, SequencePreviewCanvas } from './PreviewCanvases';

type FinalSequenceRowWithItems = {
  row: FinalSequenceRow;
  items: Array<{ sequenceFrame: FinalSequenceFrame; frame: SpriteFrame }>;
};

type ExportCanvasSize = {
  width: number;
  height: number;
};

type SpriteAssemblyPanelProps = {
  currentStep: WorkflowStepId;
  image: LoadedImage | null;
  gridRows: number;
  setGridRows: React.Dispatch<React.SetStateAction<number>>;
  gridColumns: number;
  setGridColumns: React.Dispatch<React.SetStateAction<number>>;
  handleGridSizeChange: (setter: React.Dispatch<React.SetStateAction<number>>, value: string) => void;
  spriteFrames: SpriteFrame[];
  selectedFrame: SpriteFrame | null;
  setSelectedFrameId: React.Dispatch<React.SetStateAction<string | null>>;
  previewBackgroundColor: string;
  isBackgroundPreviewEnabled: boolean;
  copiedFrameSource: CopiedFrameSource | null;
  handleAddSelectedFrameToSequence: () => void;
  finalSequenceRowsWithItems: FinalSequenceRowWithItems[];
  selectedSequenceRow: FinalSequenceRow | undefined;
  finalSequenceRows: FinalSequenceRow[];
  totalFinalSequenceFrameCount: number;
  selectedSequenceRowNumber: number;
  handleAddSequenceRow: () => void;
  animationFrameIntervalMs: number;
  setAnimationFrameIntervalMs: React.Dispatch<React.SetStateAction<number>>;
  setSelectedSequenceRowId: React.Dispatch<React.SetStateAction<string>>;
  handleRemoveSequenceRow: (rowId: string) => void;
  handleMoveSequenceFrame: (rowId: string, sequenceFrameId: string, direction: -1 | 1) => void;
  handleRemoveSequenceFrame: (rowId: string, sequenceFrameId: string) => void;
  playingSequenceRowIds: Set<string>;
  handleToggleSequenceRowPlayback: (rowId: string) => void;
  exportCanvasSize: ExportCanvasSize | null;
  finalSequenceFrameRowsForExport: SpriteFrame[][];
  handleExportFinalSequence: () => void;
  exportFormat: ExportFormat;
  setExportFormat: React.Dispatch<React.SetStateAction<ExportFormat>>;
  exportBackgroundMode: ExportBackgroundMode;
  setExportBackgroundMode: React.Dispatch<React.SetStateAction<ExportBackgroundMode>>;
  exportBackgroundColor: string;
  setExportBackgroundColor: React.Dispatch<React.SetStateAction<string>>;
  exportStatus: string;
};

export function SpriteAssemblyPanel({
  currentStep,
  image,
  gridRows,
  setGridRows,
  gridColumns,
  setGridColumns,
  handleGridSizeChange,
  spriteFrames,
  selectedFrame,
  setSelectedFrameId,
  previewBackgroundColor,
  isBackgroundPreviewEnabled,
  copiedFrameSource,
  handleAddSelectedFrameToSequence,
  finalSequenceRowsWithItems,
  selectedSequenceRow,
  finalSequenceRows,
  totalFinalSequenceFrameCount,
  selectedSequenceRowNumber,
  handleAddSequenceRow,
  animationFrameIntervalMs,
  setAnimationFrameIntervalMs,
  setSelectedSequenceRowId,
  handleRemoveSequenceRow,
  handleMoveSequenceFrame,
  handleRemoveSequenceFrame,
  playingSequenceRowIds,
  handleToggleSequenceRowPlayback,
  exportCanvasSize,
  finalSequenceFrameRowsForExport,
  handleExportFinalSequence,
  exportFormat,
  setExportFormat,
  exportBackgroundMode,
  setExportBackgroundMode,
  exportBackgroundColor,
  setExportBackgroundColor,
  exportStatus,
}: SpriteAssemblyPanelProps) {
  return (
      <section className="panel frames-panel">
        {currentStep === 'slicing' ? (
        <>
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
        </>
        ) : null}

        {image ? (
          <>
            {currentStep === 'slicing' ? (
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
              </div>
            ) : null}
            </>
            ) : null}

            {currentStep === 'slicing' || currentStep === 'export' ? (
            <section className="sequence-panel" aria-label="最终帧序列">
              {currentStep === 'slicing' ? (
              <>
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

              {selectedFrame ? (
                <div className="selected-frame-panel">
                  <div>
                    <p className="label">待加入帧</p>
                    <strong>
                      帧 {selectedFrame.index + 1} · 第 {selectedFrame.row + 1} 行 / 第{' '}
                      {selectedFrame.column + 1} 列
                    </strong>
                    <p>
                    可直接在上方帧列表切换目标帧，然后添加到当前编辑行。
                    </p>
                  </div>
                  <button type="button" className="tool-button" onClick={handleAddSelectedFrameToSequence}>
                    添加到当前行
                  </button>
                </div>
              ) : null}

              {copiedFrameSource ? (
                <div className="copy-source-panel">
                  <p className="label">最近添加来源</p>
                  <p>
                    {copiedFrameSource.sourceImageName} · 帧 {copiedFrameSource.frameIndex + 1} · 第{' '}
                    {copiedFrameSource.row + 1} 行 / 第 {copiedFrameSource.column + 1} 列 · 区域
                    x:{copiedFrameSource.x}, y:{copiedFrameSource.y}, {copiedFrameSource.width} ×{' '}
                    {copiedFrameSource.height}px
                  </p>
                </div>
              ) : null}

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
              </>
              ) : null}

              {currentStep === 'export' ? (
              exportCanvasSize ? (
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
                        {exportFormat === 'gif' ? '导出 GIF 动画' : '导出多行 PNG'}
                      </button>
                    </div>

                    <div className="export-controls">
                      <label className="radio-control">
                        <input
                          type="radio"
                          name="export-format"
                          value="png"
                          checked={exportFormat === 'png'}
                          onChange={() => setExportFormat('png')}
                        />
                        <span>PNG 长图</span>
                      </label>

                      <label className="radio-control">
                        <input
                          type="radio"
                          name="export-format"
                          value="gif"
                          checked={exportFormat === 'gif'}
                          onChange={() => setExportFormat('gif')}
                        />
                        <span>GIF 动画</span>
                      </label>

                      <label className="radio-control">
                        <input
                          type="radio"
                          name="export-background-mode"
                          value="transparent"
                          checked={exportBackgroundMode === 'transparent'}
                          onChange={() => setExportBackgroundMode('transparent')}
                        />
                        <span>透明背景</span>
                      </label>

                      <label className="radio-control">
                        <input
                          type="radio"
                          name="export-background-mode"
                          value="solid"
                          checked={exportBackgroundMode === 'solid'}
                          onChange={() => setExportBackgroundMode('solid')}
                        />
                        <span>填充背景色</span>
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
                <div className="empty-state sequence-empty-state">
                  请先在切帧重组步骤添加至少一帧到最终序列行，再导出 PNG。
                </div>
              )
              ) : null}
            </section>
            ) : null}
          </>
        ) : (
          <div className="empty-state frame-empty-state">请选择图片以生成 4 × 4 默认帧预览</div>
        )}
      </section>
  );
}
