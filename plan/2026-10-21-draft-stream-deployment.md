# 远端草稿通道（B2 有序条目流）发布

日期：2026-10-21。沿既有 releases/current 原子切换惯例，在 meter-snapshot 发布脚本基础上适配执行。

## 发布范围与版本

- 远端旧版：`releases/20261021-b501d11`。
- 新版目录：`/vol2/1000/Plugins/iot-agent-runtime/releases/20261021-fc46c6e`，`current` 已原子切换。
- 发布内容（b501d11..fc46c6e 共 2 提交）：
  - `d9ba834` 电表快照首刷失败在重试窗内如实传播，不再把失败吞成永久 preparing；恢复期测试改轮询等待。
  - `fc46c6e` B2 草稿通道：assistant 正文增量实时以 `message.delta{phase:"draft"}` 公开；含工具调用的消息在 `message_end` 补发 `message.reclassified{to:"process",content}` 折叠进处理记录；`message.completed` 仍是终稿收口；提案失败消息抑制谓词直播/收口两侧共用，不发草稿不发 reclassified；reclassified 持久化进 events_json 供恢复重放。
- 依赖零变化：staging 复用上一 release 的 `node_modules`，远端 Node 22.23.2 构建。
- 数据库无表结构变更；复用主 SQLite。

## 源码验证（发布前）

- `fc46c6e` 在干净 worktree 由 `e3712b4` cherry-pick 到 `d9ba834` 得到（主线当时已含能耗修复 `d9ba834`，一并随本次上线而非留下分叉）。
- 全量测试 325/325 通过（含 `final-answer-channel`、`model-timing`、能耗快照回归）；typecheck、build、`git diff --check` 均干净。
- 合回主线用 stash→cherry-pick→pop，`apps/runtime/src/AGENTS.md` 的 Company 照明 locationPaths WIP 与协议段并存，全部未提交 WIP 原样保留。

## 切换与门禁

- 切换工具 `releases/switch-draft-stream.py`（沿 meter-snapshot 脚本适配）：门禁 5 项全 0（运行中会话/执行中草案/执行中阶段/近到期阶段/近到期计划），SIGTERM 优雅退出旧 PID 10274。
- SQLite backup 主库+sessions 至 `shared/backups/draft-stream-20261021T134335Z`，quick_check ok，目录 0700、文件 0600。
- 新 PID 103654，cwd 核对为新 release，唯一 3210 监听，Node v22.23.2；`deployment.json` 记录于备份目录与 `shared/draft-stream-deployment.json`。
- 切换时间：2026-10-21 21:43:36 +08:00；tmux 会话 `iot-agent-runtime` 重建，健康检查通过（脚本内置失败自动回滚未触发）。

## 发布前后验证（真实鉴权，公网）

- 公网 `mp-agent` 与 `iot-agent` 两别名 healthz 均 200：iotMode=production、devIdentityOverride=false、GLM-5.3-Flash。
- 鉴权接口 `GET /api/agent/conversations/current` 带真实身份 200。
- 真实模型无工具问答（office 会话，自我介绍）：`run.started` → 24 个 `message.delta{phase:"draft"}`（seq 2–25）→ `message.completed` → `run.completed`。草稿增量实时公开。
- 真实模型只读工具轮（说明思路再查环境传感器）：草稿增量 seq 2–6 流出前导文字 → `message.reclassified{to:"process",content 39字}` seq 7 → `tool.started/progress/completed` → 后序草稿增量 → `message.completed` → `run.completed`。折叠事件按序发出。
- 恢复重放：同会话 `/current` 持久化事件与直播逐条一致（seq/type/phase 全等，含 `message.reclassified`）。
- 另一只读轮（直接查在线状态）模型未发前导文字，无 reclassified——符合协议（无草稿可折叠）。
- 未执行设备控制；未重新登录任何账号；探测未泄露 thinking 内容。

## 回滚

停止并核对在途任务后，将 `current` 原子指回 `releases/20261021-b501d11`，用 `shared/run-runtime.sh` 重建 `iot-agent-runtime` tmux 会话并验证公网。本次无表结构变更，回退无副作用。

## 边界

- 小程序前端 `d54b065`（有序 item 流渲染）在 mp 主线，微信真机渲染与人眼验收不在本次后端发布范围；票 04 保持「implemented — pending user miniapp acceptance」。
- 能耗前端 `preparing` 消费改造（`preparing-read.mjs` 等）为独立未完成工作，未随本次上线。
- 本轮验证基于 office 来源两次真实问答样本；不声称覆盖全部身份、来源与设备控制场景。
