# 028 · Langfuse 观测闭环 + 确认竞态诊断（2026-09-17）

本闭环的实现与证据都在 runtime 仓（`plan/027` 及三个提交），本文是 mp 侧交接索引：发生了什么、修了什么、还没修什么、怎么用。

## 成果一览

- **双环境轨迹上线**：3200（iotfake）与 3201（真实网关）的智能体轨迹已进 Langfuse（`https://langfuse2.qianc.ltd`，密钥在 runtime `.env`，已 gitignore）。每轮对话一棵 agent-run 树（每模型轮一个 generation：耗时/token/完整上下文；工具 span），每次确认一棵 draft-confirm 树（逐指令 span + 回读）。3201 已用真实只读查询验证完整落库。
- **选型结论（重要坑）**：自托管服务端 v4 events_only **拒收 v3 SDK ingestion**；必须 `@langfuse/tracing`+`@langfuse/otel`+NodeSDK（OTLP）。不注册全局 context manager 则 sessionId 全空。详见 runtime `plan/027`。
- **客户端加固**：run/confirm 完成点强制 flush（字节级抓到过 1/220 批内短发后加的）。
- **开放问题（服务端，未解）**：langfuse 与 langfuse2 同库同管线，OTLP 异步摄取存在**行滞后数分钟 + 约 2-4 成会话永久缺行**；`sessionId=` 过滤比时间窗查询更不可靠。丢行批次 job 样本在 runtime `plan/027` 附录一，可供部署侧查 worker。

## 确认竞态 bug（本闭环诊断的副产物）

**症状**：确认草案→灯已开→界面翻回"待确认"→卡片操作报 409 英文 toast→退出后瞬间正常。

**根因（三层）**：
1. 服务端 confirm 在 `loadDeviceCatalog`（真实网关秒级）**之后**才提交 EXECUTING——窗口期内轮询读到旧 PENDING；
2. 前端 confirm 在途时 1.5s 轮询 `restore()` 整表替换 turns，把陈旧 PENDING 冻结成活视图，且 `confirmDraft` 闭包把结果写进孤儿对象；
3. 用户后续操作打在幻觉草案上被 409 拒绝。

**修复落点**：①服务端已在 runtime `376754f` 落地（EXECUTING 前置提交）；②mp 前端修复（restore 让路/活轮次重解析/请求超时）在 `apps/agent-miniapp` 的**未提交文件**中（并行会话工作，见 `pages/agent/AGENTS.md`）——**尚未提交，验收时注意**。

## token 与身份工作流（用户裁定，勿违反）

专属开发账号 17276261949（5 区域）的 token 唯一权威存放 runtime `var/agent-identity.json`（0600，~2.5 年）；**禁止任何入口为取 token 重新登录**（单会话顶号）。3201 配方：`AGENT_DEV_IDENTITY="$(cat var/agent-identity.json)"`。万一被顶：先 ps 正则回收确认，经用户同意后唯一一次重登。

## 轨迹研究范式（下一步会话直接用）

- 查询：REST v2 时间窗（`fromStartTime/toStartTime`）优于 sessionId 过滤；Basic pk:sk；带自定义 UA（默认 python UA 被 403）；"查不到"等 5 分钟再判。
- 树重建：按 `traceId` 聚类、`parentObservationId` 建树、`startTime` 排序；generation 看 `latency`/`usageDetails`/input（当轮完整上下文）。
- 对账/调试工具已入库 runtime `scripts/obs-audit.py`（每轮闭环数观测）与 `scripts/otlp-proxy.mjs`（本地 9600 记录代理，配合 `LANGFUSE_BASE_URL` 指向）。
- 实例：3200=iotfake（本机直连）、3201=真实网关（0.0.0.0，受保护会话 eec895fb 勿删）。

## 相关提交

runtime：`dc772f6`（接入）→ `376754f`/`c8a59dc`（并行会话：竞态服务端修复+范围裁定）→ `f683ee1`（token 工作流）→ `b42828d`（flush 加固+post-mortem）→ `c2aca3d`（langfuse2 切换记录）。mp：仅本文档。
