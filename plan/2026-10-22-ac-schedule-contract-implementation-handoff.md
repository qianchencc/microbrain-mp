# 空调条件任务排程契约实施交接

日期：2026-10-22

## 结果

06 票据已完成。Company 空调条件任务现在明确区分：

- 单次检查：不带 `interval` 和 `cadenceMinutes`，只登记一个检查点；
- 窗口检查：带 `interval` 和明确的 `cadenceMinutes`，仅支持 15、30、60 分钟，由 Runtime 按 `[start, end)` 展开；
- 窗口缺少频率：返回结构化 `needs_clarification`，不登记任务，交给模型用自然语言向用户确认。

提案工具结果带有 `schedule` 和检查点数量。小程序提案卡、任务详情和 Runtime 登记使用同一排程事实，单次检查会显示“排程 · 指定时刻检查一次”。

## 验证

- Runtime 空调行为测试：6/6；全量测试：357/357。
- Runtime typecheck/build：通过。
- mp Agent 测试：156/156。
- HBuilderX `mp-weixin` 编译：通过；仅有仓库已有 warning。
- 真实 GLM 只读验收：通过。第一轮先询问频率；完成设备范围澄清并确认每 30 分钟后，生成 15:00、15:30 两个检查点的待确认提案。探针使用临时数据库和 GET-only 网关包装器，未确认任务，未执行设备控制。

## 相关实现

- Runtime：`apps/runtime/src/tasks/ac-inspection.ts`、`apps/runtime/src/agent/pi-runner.ts`、`apps/runtime/src/app.ts`。
- Runtime 测试：`apps/runtime/test/company-ac-condition.test.ts`。
- mp 展示：`pages/agent/task-detail-view.mjs`、`pages/agent/components/TaskProposalCard.vue`、`pages/agent/components/TaskDetailContent.vue`。
- mp 测试：`test/agent-timeline.test.mjs`。

07（状态证据）和 08（结果语义）保持独立，未在本票中扩大范围。
