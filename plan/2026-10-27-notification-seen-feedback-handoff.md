# 通知中心「全部已读」提速 + 等待反馈修复交接（2026-10-27）

## 范围与状态

- **仅在本地实现与验证，未部署、未上传微信、未触碰生产。** 小程序侧仅完成开发编译，未做本次修复的发行构建或上传。
- Runtime 改动在隔离 worktree `/private/tmp/runtime-notification-seen-20261027`（分支 `fix/notification-seen-feedback`，以已记录的生产提交 f174632 为基线），已本地提交 `e3ba2b8`。
- MP 改动在主仓库 `pages/agent/components/TaskInboxContent.vue`，与本交接同批本地提交。
- 证据目录 `/private/tmp/notification-seen-evidence/`。

## Runtime 修复（独立 worktree）

- `apps/runtime/src/tasks/routes.ts`：`POST /api/agent/notifications/:id/seen` 与 `POST /api/agent/notifications/seen-all` 改为 `options.loadReadCatalog`（与收件箱/列表共用 catalogTtlMs=60s 的读目录快照及在途合并），原来走 `loadCatalog`（fresh）会在每次已读回执时重拉全量目录。这是用户感知的已读点击高延迟来源（受控夹具探测，非生产计时）。
- 账户身份核验（`readAccountPrincipalId`）仍逐请求执行；冷/过期目录照常 fresh 拉取并如实 503；确认/取消/控制/扫描器仍 fresh，SQL 与可见范围语义未动。
- `apps/runtime/src/app.ts` `loadTaskReadCatalog` 注释与 `apps/runtime/src/tasks/AGENTS.md` 条目同步说明已读回执按读路径处理。
- 回归：`task-entry-latency.test.ts` 新增 office+company 参数化用例——收件箱预热后 seen-all/seen 在目录闸门（hold promise）下不再触发任何非身份上游请求，身份核验仍发生；更新原「已读写入强制 fresh」断言。`task-notifications.test.ts` 新增冷目录失败 503 与身份失效如实失败的用例。
- Lead 性能探测（`/private/tmp/notification-seen-latency-probe.mts`，受控夹具注入延迟，非生产耗时）：修复后 Office elapsedMs=1、Company elapsedMs=1、各仅 1 次身份核验、catalogRequests=[]。证据 `notification-seen-evidence/lead-latency-probe-fixed.log`。

## MP 修复（TaskInboxContent.vue）

- `markAllSeen` 改用独立的 `bulkId` 代次（与列表 `requestId` 分离）。开始时使在途列表读取失效并清空 `loading/loadingMore`；批量进行中 `load()`（含刷新、触底分页）整体阻塞，刷新按钮同样禁用。
- 发送前守卫：无 open/pageVisible 直接返回；先取 `getAgentStorageScope` 与 `loadedScope` 核对，缺失或不一致则 `resetIdentity` 清旧列表/计数并按当前身份 `load(true)`，身份失效显示列表错误——绝不带旧范围 POST 已读。请求途中身份切换时，finally（仅当前 bulkId）检测 scope 失配则清旧状态并重新加载，旧 operation 不会清掉新 operation。
- 按钮 `v-if` 改为 `unreadCount || markingAll`，`:loading="markingAll"`，文案 `正在标记…`；汇总行新增 `正在将通知标为已读…` 状态；不乐观预改列表/计数。
- 新增 `invalidateBulk()`（++bulkId + 清 markingAll），挂在 onHide、关闭、来源/身份重置路径；迟到完成不再留下永久 disabled，也不再可能覆盖新范围状态。旧批量操作在同范围仍展示且无更新批量操作在途时，finally 里触发一次 `load(true)` 对齐服务端已读状态。
- 失败显示行内 `markAllError`（TaskErrorNotice + 查看原因）与专用「重试」按钮（`retryMarkAllSeen` → 重新调 markAllSeen），不再复用列表分页的重试入口；重试先清错。`resetIdentity` 一并清理 markAllError/markingAll/marking/seenFailed。
- 单条已读（打开报告）路径未动。

## 本地验证证据

- Runtime：`tsx --test` 指定两个文件 11/11 通过、typecheck/build/git diff --check 全绿（日志在证据目录）。
- MP：`npm run test:agent` 178/178 通过。
- H5 隔离壳（`/private/tmp/notification-seen-harness`，server http://127.0.0.1:9393）以 `@vue/compiler-sfc` 编译**真实** `TaskInboxContent.vue`（`?v=baseline` 取 HEAD 原版、`?v=fixed` 取当前工作区版），API/会话/生命周期与子组件全部桩化、数据全内存。这是**组件夹具而非小程序验收**——H5 原生 disabled/loading 属性不能证明 uni 原生 spinner；HBuilderX 编译只证明绑定可编译。
- **基线 RED（?v=baseline）**：挂起 mark-all 期间按钮恒显「全部已读」无状态条、刷新仍可用；刷新触发后旧结果到达→按钮**永久 disabled**、未读残留（recipe A，baseline-1/2.png）；关闭重开同样卡死且状态跨重开残留（recipe B，baseline-3.png）；普通延迟成功可正常清未读（baseline-4/5.png）。
- **修复 GREEN（?v=fixed）**：挂起即显「正在标记…」+ 内联状态 + 按钮/刷新禁用（fixed-1.png）；双击仍只发 1 次 POST；成功后未读清零（fixed-2.png）；失败保留计数/行 + 内联错误 + 重试按钮，重试成功（fixed-3/4.png）；关闭重开后旧完成不残留忙碌并以一次新列表对齐（fixed-5/6.png）；迟到列表 GET（请求发起时冻结的快照载荷）不覆盖已读成功（fixed-7.png）；来源切换/点击前 scope 变更不发 POST 并按当前身份重载、途中 scope 变更清除旧行重载（fixed-8/9/10.png）；单条已读流程不变（fixed-11.png）。
- 交互经 agent-browser 真实点击；浏览器评估 JSON 结果记录在执行会话中，截图与构建/测试日志保存在 `/private/tmp/notification-seen-evidence/`。截图文件使用描述性后缀，例如 `baseline-2-stuck.png`、`fixed-1-pending.png`、`fixed-9-scope-before-click.png`。
- HBuilderX `launch mp-weixin --compile true` 编译成功（exit 0，日志 `hbuilderx-compile.log`）。日志还含以下提示/告警，均在本改动范围之外、未经基线对照仅如实记录：uniCloud 本地调试服务未关联服务空间提示、运行模式性能提示、`pages/check/detail/index.vue` sourcemap/default-export 告警、小程序端 img 标签选择器提示、3 条 z-paging/about.vue 鸿蒙 UA 兼容 warning。编译成功不代表已上传微信。
- 未在微信开发者工具/真机验收；H5 壳只是组件夹具，非小程序环境。

## 发布边界

- 本地审查与提交完成；Runtime 与小程序须分别按既有流程发布，生产部署/微信上传另行决定。
- 未包含独立的空调跨检查点修复 `faf1fac`，不改变其待发布状态。
