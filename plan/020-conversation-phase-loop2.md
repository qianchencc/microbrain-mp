# 020 会话相位状态机 · 闭环 2：前沿检查与过期即死

- 日期：2026-09-16
- 票据：.scratch/conversation-phase-machine/issues/04（done）
- 提交：iot-agent-runtime e774bb2（已部署 3200）

## 内容

- `action_drafts` 增加 `turn_id`：新提案与修订均写入当前轮次；启动时一次性回填（按 turns rowid 顺序，后写覆盖前写；早于 turns 表的死会话草案保持 NULL = 永久只读）。
- 前沿门 `frontierPendingId(conversationId)`（最新 PENDING，created_at+rowid 排序）应用于 selection / parameters / confirm / cancel：非前沿草案 409 `ACTION_DRAFT_NOT_FRONTIER`——正常数据取代事务已保证单活，此门兜底旧库多活草案与未来路径。
- 过期即死：revalidate 要求草案 `turn_id` 等于会话最新轮次（纯文本轮也算前进），否则 409"已有更新的对话轮次，请重新发起操作"；恢复接口检测到过期即落库（不再随 expires_at 抖动重算）。

## 验证

- conversation.test.ts 31/31、全仓 66/66：新增"过期即死"场景（草案过期 → 纯文本新轮 → revalidate 409、confirm 409、restore 显示 EXPIRED、phase idle）。
- 真实 dev 库迁移核验：近期草案已回填 turn_id；NULL 均属超期死会话。3200 已用新 dist 重启。

## 遗留 → 闭环 3-5

- 票 05 相位持久化（conversations.phase 列 + 启动自愈）。
- 票 06 模型上下文收敛（drafts 数组 → 前沿单对象 + 最近执行摘要；修订 revision 语义保留）。
- 票 07 前端相位渲染权威 + 删除过渡补丁。
