## Agent skills

### Issue tracker

Issues are tracked as local Markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage-role labels. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses a single-context domain documentation layout. See `docs/agents/domain.md`.

### Documentation entry

处理客户小程序接入、身份、设备范围、业务探索或历史计划时，先读 `docs/README.md`，再按其中任务入口进入权威文档。历史编号计划只作证据，不得覆盖当前生产主线。

### Git 规范

- 开始任何跨目录迁移或批量修改前，先执行 `git status --short --branch`、`git log -5 --oneline` 和 `git diff --stat`，确认基线、分支和未提交内容；未提交内容不得直接当作可信基线。
- 迁移必须保持单向来源：先确定原实现基线，再把共享实现同步到客户版；禁止为了通过逐字节 parity 检查反向修改原实现。
- 进行大范围操作前先建立可回溯的 Git checkpoint（优先使用明确的 `wip:` 提交）；checkpoint 之后再做恢复或重构，禁止直接 `reset --hard`、`clean -fd` 或删除未跟踪文件来“整理”工作区。
- 每个真实业务闭环完成后提交一个语义明确的 commit；测试、文档和构建修复应与对应业务闭环同批提交，避免长期堆积无法审查的工作区差异。
- 恢复文件时只使用精确路径和已确认的来源提交（如 `git restore --source=<commit> -- <path>`）；不得用整目录覆盖掩盖来源不明的差异。
- 提交前必须检查 `git diff --check`、`git status --short` 和提交内容；禁止把构建产物、临时日志、个人工具状态或 `.zcode` 临时计划混入业务提交，除非该文件明确属于项目源代码或文档。
- 禁止未经明确要求执行 `git push --force`、`git reset --hard`、`git clean -fd`、删除分支或覆盖远端历史；需要远端同步时使用普通 push，并在提交前保留本地可回退点。
