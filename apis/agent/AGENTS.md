# Agent 请求缓存

- `requestJson` 保留原始请求/错误语义。只有 `index.js` 中显式接入 `readSnapshot` 的概览、目录、逐日与期间统计、安全台账列表、两端任务/周期安排/通知列表复用缓存，不能把所有 GET 都缓存。台账查询键按参数排序且保留类型/日期/limit/cursor；正常分页的 `nextCursor`/`coverageComplete:false` 不代表失败或截断。详情、草案与摄像头候选继续实时读取。
- `agent-read-cache.mjs` 的作用域来自不可逆身份键（Token + 园区）；内存60秒、最多40项，过期快照最多5分钟只供UI占位，正常read不能返回过期结果。错误与截断不缓存，401/403清空整组；代际校验阻止清理前的请求重新写回，`drop` 期间的作废同样阻止在途读取写回旧结果。
- 普通读取的消费者活动性、取消与身份变化契约见 [ADR0008](../../docs/adr/0008-agent-page-deep-module-architecture.md#2026-11-07普通读取的视图归属)；对同键在途请求逐消费者交付，不把缓存作废当成身份变化，也不为页面另建缓存。
- 确认/取消设备或任务前后清理整组；周期启停只作废周期安排快照，`markNotificationSeen`/`markAllNotificationsSeen` 只作废通知快照。普通对话、草案勾选不清缓存。强制刷新绕过已完成结果，但可等待同一在途新读取。
- 两端任务列表（`readAgentTasks`）、周期安排（`readAgentPlans`）与通知首屏（`readAgentNotifications`）走同身份快照：`peek*` 先落位再对齐，`force` 只由手动刷新与数据变更后触发。窗口键由 `pages/agent/task-calendar.mjs` 的 `taskListRange` 统一生成（上海自然日），Company「全部任务」首块与首页 62 天议程同键，进入 Agent 的预取因此直接命中；执行结果窗取到今天结束，避免毫秒级 `now` 让每次打开的键都不同。
- 控制、执行状态/回执、任务日历轮询、会话、报告下载、短时效视频地址走实时请求，不复用此缓存：`TaskCalendarView` 按执行中 5 秒/其他 30 秒轮询，快照会掩盖状态推进。服务器执行前权限核验不受前端缓存影响，stale 快照不得支撑确认、执行、已读或控制。
- 微信消息流的非2xx JSON错误可能只在chunk回调中抵达，success.data为空；保留结构化code/message供最终拒绝，不能把无type的HTTP错误送进presentation。不能因未取得终态就盲重发POST。公开客户端分块回归见 `test/agent-stream.test.mjs`。
