# Git 版本管理说明

## 目标
本项目使用 Git 管理像素精灵表编辑器的代码版本，便于记录功能迭代、回退问题改动，并在后续需要时接入远程仓库协作。

## 日常流程
1. 查看当前改动：
   ```bash
   git status
   ```
2. 查看具体差异：
   ```bash
   git diff
   ```
3. 暂存准备提交的文件：
   ```bash
   git add <file>
   ```
4. 创建提交：
   ```bash
   git commit -m "描述本次改动"
   ```
5. 查看提交历史：
   ```bash
   git log --oneline --decorate
   ```

## 提交建议
- 每次提交聚焦一个主题，例如“优化去背景交互”或“修复橡皮擦即时预览”。
- 提交前运行构建检查：
  ```bash
  npm run build
  ```
- 不提交依赖目录和构建产物，例如 `node_modules`、`dist`。
- 不提交本地敏感配置，例如 `.env`、`.env.local`。

## 分支建议
- `main`：稳定主分支，保留可运行版本。
- `feature/<name>`：开发新功能，例如 `feature/animation-preview`。
- `fix/<name>`：修复问题，例如 `fix/eraser-render-delay`。

## 远程仓库
如果后续创建了远程仓库，可以执行：
```bash
git remote add origin <your-repository-url>
git branch -M main
git push -u origin main
```

## 回退参考
查看某次提交内容：
```bash
git show <commit-id>
```

撤销工作区未暂存改动前，建议先确认差异：
```bash
git diff
```

如需回退某次已提交改动，优先使用：
```bash
git revert <commit-id>
```
