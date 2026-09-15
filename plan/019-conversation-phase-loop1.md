# 019 会话相位状态机 · 闭环 1：单活草案与消息相位门

- 日期：2026-09-16
- 范围：iot-agent-runtime + apps/agent-miniapp
- 票据：.scratch/conversation-phase-machine/issues/01-03（均 done）

## 决策定稿

实现中暴露 spec 内在矛盾（"awaiting 期间发消息 409" vs "修订靠发消息"），用户拍板**放行但收敛**：待确认期间允许发消息（对话式修订是既定流程），仅 EXECUTING 封锁输入；单活草案由提案时的取代事务兜底。

## 后端（iot-agent-runtime）

- 提案落库为取代事务：新提案（无 draftId）与旧待确认草案的 CANCELLED 同事务完成，audit `ACTION_DRAFT_SUPERSEDED`，流内发 `action.resolved CANCELLED`（commit a06b327、7c029fe）。
- 消息相位门：EXECUTING 草案存在时 POST /messages 409 `CONVERSATION_AWAITING_CONFIRMATION`（带 draftId）；运行中/收尾中维持既有 409。
- 草案 TTL 收敛为 `draftTtlMs` 选项（默认 10 分钟，原 5 分钟）；恢复接口新增派生 `phase`（executing > awaiting_confirmation > running > idle）。
- 测试：conversation.test.ts 65/65（含"放行但收敛取代""执行中封锁"两个新场景；两个依赖旧默认 TTL 的测试显式钉住 5 分钟）。

## 前端（apps/agent-miniapp，commit b0a6288）

- streamMessage 非 2xx 分支还原响应体（复用 ndjson 解码器 `parseBufferedJson`），409 契约（code/draftId）不再丢失。
- runTurn 识别执行中 409：撤回乐观轮次 + toast「设备指令执行中，请稍候」+ restore，不进失败回合编辑/重试流程。
- 跨轮分发 `action.resolved`：被取代/退役草案所在的历史轮次即时转只读，无需等 restore。
- composer 不按待确认草案禁用（B 语义）；34/34 测试通过，微信构建通过。

## 真实模型验收

新 dist 已部署到 3200 进程（重启）。「打开空调制冷24度」→ 草案 rev1；待确认期间发「改成制冷22度」→ **同 draftId 修订为 rev2**（对话式修订路径真实走通，未触发取代）；restore：两轮映射同一草案、唯一 PENDING、phase=awaiting_confirmation。取代路径由确定性测试覆盖（faux 两轮新提案 → 旧 CANCELLED + action.resolved）。smoke 会话已清理，current 槽还原。

## 遗留 → 闭环 2-5

- 票 04 前沿检查（turn_id 回填 + 五路由 assertFrontier + 过期即死）。
- 票 05 相位持久化（conversations.phase 列 + 启动自愈，替代内存 activeRuns 权威）。
- 票 06 模型上下文收敛（drafts 数组 → 前沿单对象；注意修订路径 revision 语义保留）。
- 票 07 前端相位渲染权威 + 删除过渡补丁（staleRunSince 等）。
