# Tasks
- [x] Task 1: 盘点当前代码结构与重构边界，识别可安全拆分的类型、常量、纯函数、组件和样式区域。
  - [x] SubTask 1.1: 检查 `src/main.tsx` 中的类型、常量、图像处理函数、React 状态、事件处理和 JSX 区块
  - [x] SubTask 1.2: 确定不改变用户功能行为的模块拆分方案

- [x] Task 2: 拆分通用类型、常量和图像处理算法。
  - [x] SubTask 2.1: 将共享类型移动到独立类型模块
  - [x] SubTask 2.2: 将配置常量移动到独立常量模块
  - [x] SubTask 2.3: 将背景处理、擦除、裁剪、去毛刺、去边、像素网格对齐、色彩量化、切帧和导出相关纯函数移动到图像处理工具模块

- [x] Task 3: 拆分 UI 组件并收敛 `main.tsx` 职责。
  - [x] SubTask 3.1: 拆分导入/说明、画布预览、裁剪、背景处理、像素清理、像素规范化、橡皮擦、切帧、最终序列、动画预览和导出相关组件
  - [x] SubTask 3.2: 保持组件 props 明确，避免引入全局状态或隐藏副作用
  - [x] SubTask 3.3: 让 `main.tsx` 或顶层 App 主要负责状态编排和组件组合

- [x] Task 4: 清理冗余与不规范写法。
  - [x] SubTask 4.1: 移除重复逻辑或重复状态重置代码，提取必要的公共 helper
  - [x] SubTask 4.2: 统一命名、导入路径和模块边界
  - [x] SubTask 4.3: 保持现有 CSS class 和视觉表现，避免无关样式重写

- [x] Task 5: 验证重构结果。
  - [x] SubTask 5.1: 运行 TypeScript 诊断检查
  - [x] SubTask 5.2: 运行 `npm run build`
  - [x] SubTask 5.3: 手动核对主要用户流程：导入、取色去背景、擦除、像素规范化、切帧、重组、预览和导出

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 2 and Task 3
- Task 5 depends on Task 4
