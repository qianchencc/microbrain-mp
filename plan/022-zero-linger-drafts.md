# 022 草案零滞留：消息落库即退役，删除修订路径

- 日期：2026-09-16
- 票据：.scratch/conversation-phase-machine/issues/08（done）
- 提交：iot-agent-runtime 489296c（已部署 3200 并真实模型 smoke）

## 决策（用户定稿，取代"放行但收敛"的修订语义）

草案必须即刻处理、不能滞留：用户输入下一条消息的那一刻，当前待确认草案（无论是否过期）即终态化为已取消；文字补充（"排除机房那台"）是新的意图表达，模型基于会话历史重新起草完整草案，旧草案没有保留价值。修订入口整体删除——模型只做"新草案"一种事。确认只可能发生在草案仍是最后一轮时，因此执行结果注入模型上下文永远时序正确（旧实现中"草案挂第 1 轮、纯文本走到第 3 轮后回头确认"的乱序注入隐患从根上消除）。重新核验窗口收窄为"过期且仍是最后一轮且无新消息"。

## 实现

- 消息路由：入队即退役——`PENDING_CONFIRMATION/EXPIRED → CANCELLED`（同一循环内逐条审计 `ACTION_DRAFT_CANCELLED(reason=superseded_by_message)`），run.started 后逐条发 `action.resolved CANCELLED`（前端历史轮次即时转只读，复用闭环 1 的跨轮同步）。
- 删除：`propose_action_draft` 的 `draftId`/`expectedRevision` 参数与全部修订分支、提案取代事务（退役已前移至消息入口，事务失去触发场景）、`ActionDraftContext.draft` 字段（上下文只剩 `lastExecution`）、提示词中的修订引导（改写为零滞留语义）。
- 提案落库回归单条 INSERT（turn_id 写入保留），revision 恒为 1。

## 验证

- runtime 67/67：643 号测试重写为"文字补充退役旧草案并重新起草"（断言新 draftId、流内 action.resolved、旧草案 confirm 409）；"过期即死"场景改为断言 CANCELLED 终态。
- 真实模型（glm-5.3-flash）smoke：「打开空调制冷24度」→ 草案1；「改成制冷22度，并打开26楼会议室的灯」→ 流内 `action.resolved(CANCELLED, 草案1)` + 新草案（4 设备：空调 + 会议室灯）；restore：turn1=CANCELLED、turn2=PENDING、phase=awaiting_confirmation。会话已清理。
- 前端无需改动（跨轮 action.resolved 同步与 EXPIRED 只在末轮展示的既有行为正好匹配）。

## 代价说明

文字补充会丢失用户在旧草案面板上的手动勾选/参数修改（模型重起草按推荐选择）——已在决策中接受。
