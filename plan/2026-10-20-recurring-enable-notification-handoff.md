# 周期计划启停与失效通知交接

日期：2026-10-20。状态：已实现，等待真实任务/微信验收。

本轮在 ticket05 两个专用 worktree 完成周期计划启停、恢复核验、自动失效停用和原任务收件箱通知闭环。主线月度规则、其他 worktree 和真实服务均未修改。

## 业务行为

- 计划列表和详情复用现有 `TaskListSheet`、`TaskDetailContent`，直接增加启停开关。
- 手动停用只改变未来发生；已经落账、执行中或已经下发的当前 Task 不回滚。
- 重新启用必须由用户确认，并用 fresh 完整目录重核原目标、设备能力、控制绑定和版本；不补旧发生。
- `GatewayAuthorizationError`、完整授权目录中的固定成员缺失、以及核验控制绑定变化会自动停用周期计划。
- 自动停用会取消同一当前发生中尚未派发的后续 phase；已派发结果保留。
- 原任务通知仍使用 `task_notifications`，通过唯一 `(task_id, recipient_key)` 保证重扫/重启只写一次。
- 自动停用原因写入现有通知的 `reason` 字段并在收件箱显示。全部设备撤权时，创建者仍可读取最小通知和阶段原因，设备明细与报告事实继续受当前授权裁剪。

## 代码边界

Runtime：

- `apps/runtime/src/tasks/plans.ts`
  - `pause_reason` 持久化；
  - `validateResume()`；
  - `enabled/paused` 状态与版本更新。
- `apps/runtime/src/tasks/routes.ts`
  - `POST /api/agent/task-plans/:id/status`，支持 `pause` / `resume`；
  - resume 要求 `confirmed: true`。
- `apps/runtime/src/tasks/store.ts`
  - `disablePlanForPhase(phaseId, { kind, reason }, at)`；
  - 先由现有 phase 方法收口，再由 hook 停用计划、取消未派发 phase、补写通知原因。
- `apps/runtime/src/tasks/scanner.ts`
  - 仅在既有 scanner 分支中调用 hook，不重排主循环；
  - 普通超时、局部失败、回读失败不自动停用。
- `apps/runtime/src/tasks/notifications.ts`
  - 复用原通知表，新增可选原因字段和创建者最小可见规则。
- `apps/runtime/src/tasks/management.ts`
  - Agent 确认式 resume 路径调用 `validateResume()`。

MP：

- `apis/agent/index.js` 增加计划状态请求。
- `TaskListSheet` 计划行和计划详情增加开关。
- `TaskDetailContent`、`TaskDetailSheet`、`TaskResultContent`、`AgentConversation` 传递状态变更刷新。
- `TaskInboxContent` 展示自动停用原因。

## 协作接口

票04/07/08 不复制停用和通知逻辑，只在当前 phase 已收口后调用：

```ts
store.disablePlanForPhase(
  phaseId,
  { kind: "authorization_revoked" | "identity_rejected" | "binding_changed", reason },
  at,
)
```

`read.ac.mode`、`read_json`、`finishRead`、`finishPhase` 和 interval advance 继续由对应票据负责。

## 验证边界

按用户要求未运行测试、模型探针或 code review。已执行 `git diff --check` 和 MP API JavaScript 语法检查；Runtime typecheck 因该 worktree 缺少 Node 类型定义（`TS2688: Cannot find type definition file for 'node'`）未能运行。未部署、未重启服务、未控制真实设备。真实周期计划、撤权后最小通知和微信原生开关仍待验收。
