# Office 任务与通知读取耗时交接

2026-10-27。本轮沿 `/ask-matt` 路由进入 Office 任务入口的性能诊断，首片范围为任务列表、周期计划、任务详情和通知中心读取。没有改变控制、确认、撤权核验、已读写入或设备取流语义。

## 已完成

- 前端任务列表 `TaskListSheet` 对相同身份、来源和时间范围的在途 `listAgentTasks` 请求做合并；请求完成或失败立即移除，不保存完成结果。
- 前端通知中心 `TaskInboxContent` 对相同身份、来源和游标的在途 `listNotifications` 请求做合并；请求完成或失败立即移除，不保存完成结果。
- 原有响应提交前 scope、source、视图和代次检查保持不变，身份切换或页面失活时迟到响应仍会被丢弃。
- 变更已单独提交：`ec015a2 perf: coalesce Office task reads in flight`。

## 诊断证据

既有公开 HTTP 回归 `iot-agent-runtime/apps/runtime/test/task-entry-latency.test.ts` 在 Node 22 下通过：Office、Company 任务/计划/通知并发读取均通过，Office 约 395ms、Company 约 249ms（测试上游每次人为延迟 75ms）。

额外只读基线显示，Office 冷目录并发读取在每次上游 75ms 延迟时约 281ms：先是一次 `/sso-api/account/me`，再是办公室成员接口，最后并行读取已声明的 Office 来源。热目录读取仍会为每个 HTTP 请求执行一次账户身份核验，约 77ms；这是当前剩余的固定成本，不能通过任务响应缓存消除。

既有生产交接与边界见：

- `plan/2026-10-09-task-entry-performance-handoff.md`
- `../../iot-agent-runtime/plan/2026-10-26-admin-production-access-and-apply.md`
- Runtime `apps/runtime/src/tasks/AGENTS.md` 中的任务读取、fresh 写入和撤权约束

## 当前判断

本轮适合落地的低风险收益是客户端重复请求合并。Office Runtime 的任务 GET 已有来源＋身份隔离的读缓存和在途目录合并；不能直接延长授权缓存 TTL，也不能让 stale 目录支撑确认、执行、已读或控制。

剩余 Runtime 方向需要单独建立基线后再决定：账户身份核验的固定开销，以及 Office 通用目录读取在非任务入口的请求级合并。任何后续改动都必须保持所有 Office 授权来源完整读取，不能跳过账号级关联目录，也不能用旧授权快照替代 fresh 写入核验。

## 验证边界

- Agent 回归：183 项通过；既有视频服务器测试因 sandbox 禁止监听 `127.0.0.1` 失败，与本轮改动无关。
- `git diff --check` 通过；本轮提交只包含两个前端组件。
- 当前工作区仍有本轮之前的未提交修改和未跟踪文件，后续 Runtime 诊断不能把它们视为可信基线。

## Suggested skills

- `diagnosing-bugs`：为账户核验和 Office Runtime 目录冷读建立可重复的分段耗时回路。
- `tdd`：只有确认存在可安全修复的外部行为后，为该行为补最窄回归。
- `code-review`：Runtime 或前端下一片提交前做 Standards + Spec 双轴审查。
