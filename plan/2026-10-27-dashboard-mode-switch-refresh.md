# 物联助手模式切换与议程快照收口

日期：2026-10-27。用户反馈每次进入物联助手、以及精简/详细互相切换都会重新读取一批数据；授权直接改进。

## 根因

- `dashboard.vue` 用 `v-if="mode === 'simple'"` / `<template v-else>` 切换两种模式：模式一换，整棵子树销毁重建，`v-else` 里的 `CompanyTaskOverview`、`MonthlyEnergyComparison`、`CompanyEnergyStrip` 全部重新挂载。
- `CompanyTaskOverview` 的 `watch(..., { immediate: true })` 挂载即 `listAgentTasks` + `listNotifications`，不走 `company-read-cache.mjs`；`loaded` 是实例内状态，重挂载必闪「加载中…」。
- `MonthlyEnergyComparison` 同样 `immediate`，切到详细最多发 5 个 `company-meter-report`（本月、环比两期、同比两期去重）；60 秒内的 `monthly-snapshot` 快照能省掉，超期则全部重读，冷读遇 `preparing` 还会每 2 秒重试。
- 精简模式的议程在 `loadSimpleAgenda()` 里另读一份同样的 62 天任务窗；两套读者互不知道对方的快照。

## 改动

- 新增 `readAgentAgenda`/`peekAgentAgenda`/`readAgentUnread`/`peekAgentUnread`（`apis/agent/index.js`）：只服务首页议程（`source=company` 的 62 天任务窗、`limit=1` 未读数），走同一 `companyOverviewCache`（同身份、60 秒、在途合并、401/403 清空）；`peek` 与 `read` 使用带 `agentUrl` 前缀的同一键。任务明细列表（`TaskListSheet`/`TaskCalendarView`）仍用实时 `listAgentTasks`。
- `dashboard.vue`：两个分支常驻，只切 inline `display`；详细子树按 `detailMounted` 首次展示才挂载，之后切模式不再重建。`CompanyTaskOverview` 与 `MonthlyEnergyComparison` 的 `active` 追加 `mode === 'detailed'`，隐藏时停读。`loadSimpleAgenda(force)` 先用快照落位再对齐，强制刷新仍绕过缓存。
- `CompanyTaskOverview.vue`：改用上述快照接口；`load(force)` 先 `peek` 落位再读，重挂载/切模式不闪「加载中…」；30 秒/5 秒定时刷新走 `force`，任务确认后由 `tasksChanged()` → `invalidateCompanyDashboard()` 立即失效。

## 验证

- `node --test test/agent-agenda-cache.test.mjs`：5/5。覆盖精简/详细共用同一快照（切换 0 新增请求）、60 秒到期重读、强制刷新绕过、未读数 `limit=1` 与明细参数隔离、确认任务后快照失效、换身份不复用。
- `npm run test:agent`：184/184 通过。
- HBuilderX 微信编译成功；`unpackage/dist/dev/mp-weixin/pages/agent/dashboard.wxml` 中 `.simple` 无 `wx:if` 且带 `style="{{'display:' + B}}"`，`.detail` 为 `wx:if="{{C}}"` + `style="{{'display:' + ah}}"`，即「常驻 + 只切可见性」按预期生成。

## 未验边界

- 未在微信开发者工具/真机做交互验收：切模式后 GET 数归零、第二次进入不闪「读取中」、日柱不重置、月度对比不重排，需按既有做法由用户侧确认（`pages/agent/AGENTS.md` 的微信端验收约定）。
- 月度对比在缓存超期时仍会重读 5 个期间统计（这是它自身的月度口径，不是模式切换引入的）；本次只消除「切模式即重读」。
