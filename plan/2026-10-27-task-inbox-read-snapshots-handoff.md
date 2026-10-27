# 任务与通知列表读快照交接

2026-10-27。用户要求物联助手与办公室助手的任务列表、通知列表不再每次打开都等 Runtime，并提前完成读取。本轮只改前端读取：没有改 Runtime、没有新增设备控制、没有改变确认/已读/撤权核验语义。

## 已完成

- 缓存模块更名并共用：`apis/agent/company-read-cache.mjs` → `apis/agent/agent-read-cache.mjs`，`createCompanyReadCache` → `createAgentReadCache`，导出实例 `companyOverviewCache` → `agentReadCache`。新增定点作废 `drop(match)`：删除匹配快照，并让作废瞬间仍在途的读取不回写旧结果（按 key 的代次）。`clear()` 仍是整组清理。
- 新增可缓存的列表读取：`readAgentTasks`/`peekAgentTasks`、`readAgentPlans`/`peekAgentPlans`、`readAgentNotifications`/`peekAgentNotifications`，两端 `source` 参数化；通知分页大小由 `AGENT_NOTIFICATION_PAGE` 统一。删除已无调用方的 `listNotifications`/`listTaskPlans`，首页议程旧别名 `readAgentAgenda`/`readAgentUnread`/`peek*` 同步删除，调用方迁移到新名字。
- 失效矩阵：任务/草案确认与取消沿用整组 `clear()`；`POST /task-plans/:id/status` 只作废周期安排快照；`POST /notifications/:id/seen` 与 `/notifications/seen-all` 只作废通知快照。401/403 仍整组清理。
- 窗口统一：`pages/agent/task-calendar.mjs` 新增 `taskListRange(kind, today)` 与 `TASK_ALL_CHUNK_DAYS`/`TASK_ALL_MAX_DAYS`，按上海自然日生成键。Company「全部任务」首块与首页 62 天议程完全同键；「执行结果」结束边界由毫秒级 `now` 改为今天结束（`taskListRange` 注释记录原因），客户端过滤不变，不会多出今天稍后执行的任务。
- `TaskListSheet`：任务/周期安排改走快照，`peek` 先落位再对齐；手动刷新按钮、`refreshKey`（数据变更）与来源切换用 `force`；关闭重开、`onShow`、切 tab 不再强制联网。移除组件内 `taskListInFlight`（快照已合并在途）。
- `TaskInboxContent`：通知首屏与分页改走快照，`peek` 先落位；「刷新」按钮与 `defineExpose().refresh()` 用 `force`；打开/`onShow`/`markAllSeen` 收尾不再强制。移除 `notificationListInFlight`。
- `AgentConversation`：`prewarmLists()` 在会话恢复后按「通知 → 任务首屏 → 周期安排」顺序预取，按身份+来源只跑一次，失败允许下次重试；未读角标改走 `readAgentNotifications(limit:1)`。顺序执行避免并发压 Runtime，同键在途读取由快照合并，用户此时打开 Sheet 不会重复请求。
- `dashboard.vue`、`CompanyTaskOverview.vue`、`MonthlyEnergyComparison.vue` 迁移到新导出名；首页议程与任务列表现在共用同一键。

## 验证

- `npm run test:agent`：188/188 通过。`test/agent-read-cache.test.mjs`（原 `agent-agenda-cache.test.mjs`）9 项覆盖：快照复用与 60 秒到期、`force` 绕过、未读数与列表参数隔离、两端来源/窗口隔离、Company 首块与首页 62 天议程同键、确认任务整组作废、周期启停只作废周期快照、已读写入在途不回写且不动任务快照、换身份不复用。
- 微信开发编译（`cli launch mp-weixin --compile true`）成功；发行构建（HBuilderX 内置 `uniapp-cli-vite` + 显式 `UNI_INPUT_DIR/UNI_OUTPUT_DIR`）`DONE Build complete.` 成功，产物 `apis/agent/agent-read-cache.js` 已带 `drop`。
- 两处既有告警与本轮无关：`pages/check/detail/index.vue` 的 `uni-mp-vue` default 导出提示、鸿蒙 UA 兼容提示。

## 未验证 / 边界

- 未在微信开发者工具里做交互走查：本次只有编译与 Node 回归，真机/模拟器打开任务管理、通知中心的第二次打开速度尚未实测。
- stale 口径是用户本轮明确接受的取舍：列表内容最多落后 60 秒；反馈「刚完成的任务看不到」时先判断是 60 秒窗口还是 Runtime 状态推进，不要直接取消快照。
- `TaskCalendarView`（任务日历）仍按执行中 5 秒/其他 30 秒实时轮询，未进入快照；它会掩盖状态推进，不能同批缓存。
- Runtime 侧未改动。若仍需缩短首次冷读，需要单独立票（账户身份核验固定开销、通用目录请求级合并），且不得用旧授权快照替代 fresh 写入核验。

## 入口

- 决定与取代范围：[ADR 0007](../docs/adr/0007-client-read-snapshots-for-task-and-notification-lists.md)
- 维护约束：`apis/agent/AGENTS.md`、`pages/agent/AGENTS.md`
- 前一轮（只做在途合并、不保存结果）：`plan/2026-10-27-office-task-read-latency-handoff.md`
