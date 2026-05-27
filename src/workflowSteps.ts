export type WorkflowStepId =
  | 'import'
  | 'background'
  | 'cleanup'
  | 'slicing'
  | 'export';

export type WorkflowStep = {
  id: WorkflowStepId;
  title: string;
  description: string;
};

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'import',
    title: '导入',
    description: '选择素材并查看推荐流程',
  },
  {
    id: 'background',
    title: '背景',
    description: '取色、容差和透明化',
  },
  {
    id: 'cleanup',
    title: '清理规范化',
    description: '裁剪、去毛刺和像素整理',
  },
  {
    id: 'slicing',
    title: '切帧重组',
    description: '选帧、编排序列和预览动画',
  },
  {
    id: 'export',
    title: '导出',
    description: '设置背景并导出 PNG',
  },
];
