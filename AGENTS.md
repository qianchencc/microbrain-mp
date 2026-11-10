## Agent skills

### Issue tracker

Issues are tracked as local Markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage-role labels. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses a single-context domain documentation layout. See `docs/agents/domain.md`.
Architecture terms and the accepted Agent page module decision are in [GLOSSARY.md](./GLOSSARY.md) and [docs/adr/0008-agent-page-deep-module-architecture.md](./docs/adr/0008-agent-page-deep-module-architecture.md).

### Documentation entry

处理客户小程序接入、身份、设备范围、业务探索或历史计划时，先读 `docs/README.md`，再按其中任务入口进入权威文档。历史编号计划只作证据，不得覆盖当前生产主线。

### 实现取舍

- 以基础业务可靠闭环为目标，保持状态明确、设计简洁；不为未要求的边缘或高压场景增加复杂机制。
- 任务和通知只向后端读写；前端快照仅作展示，不自行判定任务成功。生命周期变更对照[基础闭环设计](../iot-agent-backend/.scratch/agent-business-recovery/task-lifecycle.md)。
- 公司设备目录的旧值展示使用后端 `cache.updatedAt` 标注同步时间；`stale` 保留待更新提示，不能把同步时间解释为设备采样时间，准备中不能展示成空目录。后端本地同步实施入口为 `../iot-agent-backend/.scratch/local-data-sync/`。

### 上游访问底线（强制）

- 前端所有操作只读写后端，由后端本地事实提供数据；交互请求不得直接或经后端穿透访问客户上游，GET／只读请求也不例外。
- 设备权限、范围、能力、控制绑定和状态核验只消费后端已有数据，不现场拉取上游；本地数据缺失或未就绪时明确返回相应状态，不补拉、不兜底穿透。
- 上游数据读取只由既定后台同步与监控承担；诊断、验收、刷新、任务启停不能作为新增例外。用户已明确：已确认任务的真实控制下发保持原样，排除于本轮读取／核验改造，但不得借此附带现场读取或设备核验。详细落点同时遵循 `../iot-agent-backend/AGENTS.md`，本底线优先于历史文档中的宽松约定。

### Git 规范

- 开始任何跨目录迁移或批量修改前，先执行 `git status --short --branch`、`git log -5 --oneline` 和 `git diff --stat`，确认基线、分支和未提交内容；未提交内容不得直接当作可信基线。
- 迁移必须保持单向来源：先确定原实现基线，再把共享实现同步到客户版；禁止为了通过逐字节 parity 检查反向修改原实现。
- 进行大范围操作前先建立可回溯的 Git checkpoint（优先使用明确的 `wip:` 提交）；checkpoint 之后再做恢复或重构，禁止直接 `reset --hard`、`clean -fd` 或删除未跟踪文件来“整理”工作区。
- 每个真实业务闭环完成后提交一个语义明确的 commit；测试、文档和构建修复应与对应业务闭环同批提交，避免长期堆积无法审查的工作区差异。
- 恢复文件时只使用精确路径和已确认的来源提交（如 `git restore --source=<commit> -- <path>`）；不得用整目录覆盖掩盖来源不明的差异。
- 提交前必须检查 `git diff --check`、`git status --short` 和提交内容；禁止把构建产物、临时日志、个人工具状态或 `.zcode` 临时计划混入业务提交，除非该文件明确属于项目源代码或文档。
- 禁止未经明确要求执行 `git push --force`、`git reset --hard`、`git clean -fd`、删除分支或覆盖远端历史；需要远端同步时使用普通 push，并在提交前保留本地可回退点。

## 客户交付边界

本仓库同时存放生产源码与技能工作产物。客户仓库是 `origin`（`microbrain/mp.git`）的 `新世纪办公室` 分支，当前为纯小程序源码树（330 个文件，无 `plan/`、`docs/`、`.scratch/`、`tools/`、`AGENTS.md`、`CONTEXT.md`）。交付时必须只带程序本身的内容。

禁止进入客户仓库：`plan/`（计划与 handoff）、`docs/`（研究、ADR、验收底稿）、`.scratch/`（票据与规格）、`tools/`（交付与检查脚本）、`AGENTS.md`（含各目录下的）、`CONTEXT.md`、`README.md`、`pages/agent/prototypes/`（交互原型）。回归测试 `test/` 属于程序内容，随源码交付（`package.json` 的 `test:agent` 指向它），但 `test/AGENTS.md` 仍排除。

- 生成交付内容：`node tools/deliver.mjs`，以 `.gitattributes` 的 `export-ignore` 为唯一规则导出干净单提交仓库，并核对禁止路径必须为 0。合并/推送客户仓库按它打印的命令执行。
- 合并前预检：`node tools/check-delivery.mjs --base origin/新世纪办公室`，列出会进入客户仓库的禁止路径。
- 直接复制工作区交付时：`node tools/check-delivery.mjs --worktree`（含未跟踪文件）。
- 原型 `pages/agent/prototypes/` 与 `deploy/h5player/AGENTS.md` 就在生产目录内，整目录复制最容易把它们顺带带过去，必须按文件复制或按上面的检查兜底。
- 这些内部产物按项目文档规范继续留在本仓库，不因交付边界删除。

## 验收证据（硬规则）

**严禁以 `curl` 返回 200、NDJSON 事件齐全、或单元/契约测试全绿作为任何案例的通过依据。**

- 每个案例的完成证据必须是**前端业务真实可完成**：小程序（微信开发者工具/真机）同一账号走完该案例的操作路径，界面出现预期业务结果（设备清单、状态、草案卡片、任务确认单、报告卡片等）。
- 单测/契约测试只能证明局部不回归，不能替代前端证据；缺前端证据的案例一律记为“未验收”。
- 本地验收先跑新后端；失败时对照原 Runtime 源码、契约及既有案例修复。本轮不切换或测试生产后端，生产正常作为用户已验证的基准事实。
- 证据落盘：`.scratch/<feature>/evidence/<CASE-ID>/`（前端截图、操作结果及脱敏诊断），并链接进票据。
- 草案可生成但不执行，任务可提案但不创建；生产侧禁止确认下发、创建任务、发送通知。

## 开发版公网预览（2026-10-14 实测）

> 2026-10-23 起 Runtime 与视频播放器直接部署在 `38.76.215.138`，发布规范见 `plan/2026-10-23-runtime-cloud-release-spec.md`；以下 2026-10-14 的本机 frpc 链路为历史记录。

- develop 构建的 Agent API 使用 `https://mp-agent.qianc.ltd/api`；trial/release 仍走客户网关 `ncim.577119.com/micro-api/api/ai`。
- 链路：Cloudflare → frps → 本机第二个 frpc（`~/frp/frpc-agent.toml`，0600，密钥仅在本地配置不落仓库）→ 本机安全代理 `~/frp/agent-public-proxy.mjs`（127.0.0.1:9416）→ 唯一 Runtime 3200。
- 代理只放行 `/api/agent/*` 并要求真实 Bearer+tenantcode 身份；`local-development`/`local-test`/tenant `LOCAL` 一律 401，`/api/admin/*` 及其他路径 404，`/healthz` 返回代理自身固定标记不透传 Runtime 配置。
- 公网隧道/真实鉴权/NDJSON 分块传输已实测通过；真实问候 run 以 `run.failed` 结束，Runtime 记录错误『模型未返回可展示的消息』，业务对话尚未验收成功，根因未定位。
- 真机移动网络、未备案域名调试与视频播放另行验收；`mp-video` 隧道本地 9415 服务当前停止，不在本轮范围。
- 已验证工具链：Node 22 `/opt/homebrew/opt/node@22/bin/node`；HBuilderX 编译：`/Applications/HBuilderX.app/Contents/MacOS/cli launch mp-weixin --project '/Users/qianchen/works/新发展/mp' --compile true`。
- 微信发行编译使用HBuilderX内置uniapp-cli-vite时，从该插件目录运行bin入口并显式指定UNI_INPUT_DIR/UNI_OUTPUT_DIR；项目目录启动会丢失官方解析上下文并报vue无法解析，勿为此新增Vue依赖。
- Runtime 侧已固定 `HOST=127.0.0.1` 回环（2026-10-15），公网路径不依赖 Mac 局域网 IP，也绝不把小程序 agentUrl 指向手机 localhost；局域网直连预览才需要 `0.0.0.0`。
