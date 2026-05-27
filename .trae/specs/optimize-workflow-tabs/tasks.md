# Tasks
- [x] Task 1: 设计分步工作流结构与步骤状态。
  - [x] SubTask 1.1: 梳理现有组件与操作，确定步骤分组：导入、背景、清理规范化、切帧重组、导出
  - [x] SubTask 1.2: 定义步骤 ID、标题、说明、前置条件和默认步骤
  - [x] SubTask 1.3: 确定公共区域应保留的画布、缩放、背景预览和网格控制

- [x] Task 2: 实现侧边 Tab 工作流布局。
  - [x] SubTask 2.1: 新增侧边步骤导航组件，展示步骤名称、顺序和可用状态
  - [x] SubTask 2.2: 在顶层应用中维护当前步骤状态并支持切换
  - [x] SubTask 2.3: 将原有长面板调整为“当前步骤内容”渲染模式

- [x] Task 3: 抽取公共预览与跨步骤工具组件。
  - [x] SubTask 3.1: 抽取公共画布预览区域，确保取色、橡皮擦和预览渲染仍可用
  - [x] SubTask 3.2: 将缩放、处理分辨率、背景预览、网格显示等跨步骤控制集中到公共工具区
  - [x] SubTask 3.3: 保持公共工具区在步骤切换时状态不丢失

- [x] Task 4: 按步骤整理现有功能面板。
  - [x] SubTask 4.1: 导入步骤展示说明、推荐流程和文件导入
  - [x] SubTask 4.2: 背景步骤展示取色、容差、背景去除、去背景色边和背景预览说明
  - [x] SubTask 4.3: 清理规范化步骤展示裁剪、自动去毛刺、像素网格对齐、色彩量化和橡皮擦
  - [x] SubTask 4.4: 切帧步骤展示网格行列配置与切分帧列表
  - [x] SubTask 4.5: 切帧重组步骤展示多行序列、动画预览和播放速度
  - [x] SubTask 4.6: 导出步骤展示导出背景模式、导出颜色和导出按钮

- [x] Task 5: 补充样式与响应式体验。
  - [x] SubTask 5.1: 为侧边栏、步骤内容和公共工具区添加样式
  - [x] SubTask 5.2: 保持现有视觉风格，并确保小屏幕下步骤导航可用
  - [x] SubTask 5.3: 避免画布和控制项互相遮挡，保持取色可见性

- [x] Task 6: 验证交互优化结果。
  - [x] SubTask 6.1: 运行 TypeScript 诊断检查
  - [x] SubTask 6.2: 运行 `npm run build`
  - [x] SubTask 6.3: 核对主要流程：导入、取色去背景、背景预览、网格辅助、清理规范化、切帧重组和导出

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 2 and Task 3
- Task 5 depends on Task 4
- Task 6 depends on Task 5
