import React from 'react';

type ImportGuidePanelProps = {
  importStatus: string;
  error: string;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export function ImportGuidePanel({ importStatus, error, onFileChange }: ImportGuidePanelProps) {
  return (
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
          <input type="file" accept="image/*,video/*" onChange={onFileChange} />
        </label>

        {importStatus ? <p className="import-status">{importStatus}</p> : null}
        {error ? <p className="error-message">{error}</p> : null}
      </section>
  );
}
