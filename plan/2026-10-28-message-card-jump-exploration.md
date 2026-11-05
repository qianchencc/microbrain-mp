# 2026-10-28 消息卡片跳转探索（客户告警卡片 → 公司 Agent）

> 历史探索记录。2026-10-28 后已实现启动分发、登录恢复与重放保护；2026-11-05 增加按固定设备／类型自动引用最新台账记录的开发实验。当前契约、实际界面证据及明确未验收项见 [规格更新](../.scratch/message-card-jump/spec.md#2026-11-05-固定路径实验当前契约)。下文“尚未实现”仅描述原探索时点。


结论先行。第 1 节是决策所需事实，第 2 节是上游证据，第 3 节是我方缺口，第 4 节建议冻结的契约，第 5 节客户需提供的支持，第 6 节验收与未验证项。上游探索为只读；本轮只补了 `prompt` 参数与解码容错（第 3 节 1），未改登录与热启动生命周期。

## 1. 结论

1. 客户小程序里的告警消息卡片走的是**微信「设备订阅消息」**，不是普通一次性/长期订阅消息，也不是公众号模板消息：客户 mp 分支 2026-10-15 的“新增设备订阅”提交引入 `wx.requestSubscribeDeviceMessage`（`pages/user/device.vue`）与 `/api/perception/fire/alarmSubConfig/*`、`/api/perception/alarmUserSub/` 三个接口（`apis/user/device.js`）。这类消息由发送方服务端调用 `POST /cgi-bin/message/device/subscribe/send` 下发。
2. 该接口的 `page` 字段**必填且支持带 query**（“点击模板卡片后的跳转页面，仅限本小程序内的页面。支持带参数”），不填则模板无跳转；路径错误返回 `41030 invalid page`，要求页面存在于**现网版本**小程序；`miniprogram_state` 可选 `developer`/`trial`/`formal`（默认 formal）。来源见第 2.2 节。因此**不需要 URL Link、URL Scheme 或 H5 中转**，卡片可以直接落在 `pages/agent/dashboard` 并携带告警内容。
3. 我方页面与 Runtime 的主要能力已经具备：仪表盘能解析 `source=company`/`alertPrompt` 并自动展开公司 Agent 浮层；`alertPrompt` 作为 `customer_alert` 引用进入输入区，不自动发送；Runtime 对 `customer_alert` 只接受 company 来源并要求内容非空。
4. `prompt` 参数已补（2026-10-28）。仍缺三个代码闭环：未登录冷启动会被 `thirdLogin` 的 `reLaunch('/pages/index/index')` 丢掉原始跳转参数；小程序已在前台/后台时新卡片参数无人接收；重复卡片没有去重。
5. 客户只给“一个页面路径”也能先跑通：静态路径带固定 `prompt`，Agent 用现有 `query_alerts` 读同一套 perception 告警台账（第 4 节 A）。代价是无法保证就是卡片那一条，也没有 `customer_alert` 原文引用；要保留引用则需客户按条拼 query（第 4 节 B）。
5. 上游**发送端当前 `page` 填了什么无法核实**：发送代码不在可见 GitLab 仓库（只看到 `microbrain/mp`、空的 `microbrain/iot-agent-backend`、`microbrain/front-h5player`），测试服务器只有 gateway/sso/nacos/redis/mysql，数据库里没有 alarm 表，也没有 perception 服务。因此“他们是否已配 page、配成什么”必须由客户提供一次真实调用样例或配合实测（第 5 节）。

## 2. 已核实证据

### 2.1 客户侧（GitLab `192.168.101.194:55080`，分支 `新世纪办公室` @ `4689daf`，2026-10-16）

- 可见仓库：`microbrain/mp`（有分支 `master`/`新世纪办公室`）、`microbrain/iot-agent-backend`（`git ls-remote` 无任何 ref，空仓库）、`microbrain/front-h5player`。
- 告警订阅入口：`pages/user/device.vue` 用 `wx.requestSubscribeDeviceMessage({ sn, snTicket, modelId, tmplIds:[item.templateId] })` 申请**设备订阅**，成功后调用 `POST /api/perception/alarmUserSub/` 记录；`snTicket` 来自 `GET /api/perception/fire/alarmSubConfig/getSnTicket`，设备列表来自 `/api/perception/fire/alarmSubConfig/page`。订阅成功回调不检查用户是否点了“允许”，只记录 ID——测试时用户若拒绝，仍然不会收到消息。
- 普通订阅消息是另一条线：`config/subscriptionsSetting.js` 只登记 `visitors/event/meeting/patrol/card` 模板，`utils/subscribeMessage.js` 只调 `uni.requestSubscribeMessage`，与告警无关。
- 仓库里没有任何邮件/邮箱通道代码，`page` 也没有出现在任何推送调用中（`weixin-mp-push` 云函数只是透传参数给 `uni-subscribemsg.sendSubscribeMessage`，属于订阅消息线）。
- 分支关系：共同祖先 `2f5e8b3`；本地 `HEAD` 比客户 `新世纪办公室` 多 531 个提交、少 25 个提交（09-07 至 10-16，含“新增设备订阅”）。也就是说设备订阅那套 UI 和接口目前只在客户分支，我方主线还没有。

### 2.2 微信官方接口（一手来源）

- 发送设备消息 `POST /cgi-bin/message/device/subscribe/send`：`page` 必填，说明为“点击模板卡片后的跳转页面，仅限本小程序内的页面。支持带参数（示例 `index?foo=bar`）。该字段不填则模板无跳转”；`miniprogram_state` 可选 developer/trial/formal；`41030` = page 路径不正确，需保证在现网版本小程序中存在。
  https://developers.weixin.qq.com/miniprogram/dev/server/API/hardware-device/api_sendhardwaredevicemessage
- 设备订阅消息属于长期订阅消息，须完成“设备接入”；申请端是 `wx.requestSubscribeDeviceMessage`。
  https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message-overview.html
- 一般订阅消息的 `page` 语义相同（“点击模板卡片后的跳转页面，仅限本小程序内的页面”），可作为对照。
  https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage

### 2.3 测试服务器（`192.168.101.182`，只读检查）

- 容器：`gateway`、`nacos`、`redis`、`mysql8`；宿主机只有 gateway 与 nacos 两个 Java 进程，sso 未运行。
- `/opt/service/backend/{gateway,sso}` 只有 jar、日志和 301 字节的 `application-test.yml`；该 yml 只配 Nacos 连接，业务路由与参数在 Nacos 里（本次未取得可用的 Nacos 凭据，登录报“User nacos not found”，未继续绕过）。
- MySQL `sect002` 共 66 张表，没有 `%alarm%`/`%fire%`/`%device%` 相关表；`t_ac_message_template` 无记录；`t_st_message_platform` 只有一条占位记录（`send_url: http://XXXXX.XXXX.XXX`）。即测试库里没有告警订阅配置，也没有可复现的发送端。
- 结论：测试服务器**不能**作为“客户发送端 page 配置”的证据来源；它只证明客户 mp 端订阅接口指向 `/api/perception/*`。

### 2.4 我方现状（本仓库，`af207a8`）

| 能力 | 位置 | 状态 |
| --- | --- | --- |
| 仪表盘深链解析 | `pages/agent/dashboard.vue:504-509` | `source=company`/`alertPrompt`/`taskReference`/`safetyReference`/`environmentWindow`/`energyWindow` 可解析，`onMounted` 打开浮层 |
| 告警内容 → 引用 | `pages/agent/context-link.mjs:51-56` | `decodeURIComponent` 后 trim，≤2000 字，生成 `{ type:'customer_alert', content }`；非法只 toast |
| `prompt` 参数 | `pages/agent/context-link.mjs:61-66` | 已支持（2026-10-28）：decode 一次、trim、≤200 字、拒绝控制字符；参数未编码时按原文保留 |
| 浮层接收上下文 | `pages/agent/components/CompanyAgentFloat.vue:56-79` | `open({reference, prompt})`；子组件未挂载时暂存 payload，`watch(conv)` 出现后再交付（2026-10-28 修复） |
| 会话暂存与消费 | `pages/agent/components/AgentConversation.vue:291-304, 308+` | hydration 前暂存、hydration 后落地；输入非空时替换需确认 |
| 冷启动登录 | `App.vue:10-21`、`store/modules/user.js:75-100` | 无 token 时 `thirdLogin` 静默登录，成功后 `uni.reLaunch('/pages/index/index')`，**原始跳转页与参数丢失** |
| 已打开时新参数 | `App.vue:10` | `onShow` 不接收 launch options，热启动卡片参数无人处理 |
| 登录态等待 | `utils/agent-session.js:16-27,47-58` | 无 token 立即抛 `AGENT_SESSION_EXPIRED`，不等待 App 登录 |
| 页面注册 | `pages.json:119-146` | `pages/agent` 为分包，`dashboard` 已注册 |
| 线上版本 | `plan/2026-10-28-miniapp-upload-2026.10.28-1.md` | 只有开发版 `2026.10.28-1`（AppID `wxe60e1f697d115f96`），未提审、未发布；`formal` 状态下发 `page` 会 `41030` |

## 3. 我方代码缺口与实施状态（按最小闭环排序）

1. **支持 `prompt` 参数**：已完成（2026-10-28，`context-link.mjs`、`dashboard.vue:507`、`index.vue:33`）。`parseAgentContext` 解码一次、trim、≤200 字、拒绝控制字符；参数未被编码时按原文保留；回归见 `test/agent-card-link.test.mjs`。
2. **登录前的跳转参数保留**：`App.onShow` 与 `onLaunch` 用 `wx.getEnterOptionsSync()`/launch options 记录 `{path, query}`；`thirdLogin` 成功后不再无条件 `reLaunch('/pages/index/index')`，而是回到原目标（带 query）；`dashboard.onLoad` 同时消费该暂存，避免两条路径都消费导致重复。
3. **已打开时的新卡片**：`App.onShow(options)` 若当前前台页是 `pages/agent/dashboard`，把新上下文投递给浮层（事件或页面方法）；否则按第 2 条的目标页重开。
4. **去重与提示**：同一 `alertPrompt` 内容不重复插引用；浮层已展开且有草稿时沿用现有“替换输入”确认；无效/超长参数只 toast，不阻断进入仪表盘。所有路径都不自动发送。
5. **回归**：`context-link` 的 `prompt` 解析、长度边界、编码一次；启动参数暂存/消费纯函数；登录后目标恢复在开发者工具用启动参数验证。不把设备控制加入任何自动路径。

风险与取舍：
- `page` 中的中文/长文本长度上限没有官方数值；建议 `alertPrompt` ≤300 字、`prompt` ≤200 字，并压测一次真实卡片（超长时客户应改传更短摘要）。
- onLoad 的 query 官方语义是“路径参数需要 decodeURIComponent”（[页面间关系](https://developers.weixin.qq.com/miniprogram/dev/framework/app-service/page-relation.html)），即框架传原文；因此发送方 encode 一次、客户端 decode 一次。卡片冷启动仍建议用开发者工具“启动参数”复验一次，避免订阅消息链路出现差异。
- `page` 必须存在于线上版本：正式期客户若仍用 `formal`，必须等我方合并并发布包含 `pages/agent/dashboard` 的版本；测试期用 `miniprogram_state=developer` 指向 `2026.10.28-1` 开发版。

## 4. 契约与两种可用配置

微信订阅/设备消息**不会把模板内容传给小程序**：点击后小程序只能拿到 `page` 里的路径与 query（`getEnterOptionsSync` 也只有 path/query/scene/referrerInfo）。所以“引用告警”只有两条路：发送方把内容写进 `page`（动态），或者我方按平台台账自己读（静态）。

### A. 静态路径（客户只配置一次，推荐先上线）

```text
pages/agent/dashboard?source=company&prompt=%E6%88%91%E5%88%9A%E6%94%B6%E5%88%B0%E4%B8%80%E6%9D%A1%E5%91%8A%E8%AD%A6%E6%8E%A8%E9%80%81%E3%80%82%E8%AF%B7%E5%88%97%E5%87%BA%E6%9C%80%E8%BF%91%2024%20%E5%B0%8F%E6%97%B6%E7%9A%84%E7%83%9F%E6%84%9F%E3%80%81%E7%87%83%E6%B0%94%E3%80%81%E6%B0%B4%E6%B5%B8%E5%91%8A%E8%AD%A6%EF%BC%8C%E6%8C%89%E6%97%B6%E9%97%B4%E4%BB%8E%E6%96%B0%E5%88%B0%E6%97%A7%EF%BC%8C%E5%B9%B6%E5%91%8A%E8%AF%89%E6%88%91%E9%9C%80%E8%A6%81%E6%80%8E%E4%B9%88%E5%A4%84%E7%90%86%E3%80%82
```

- 解码后的问题：`我刚收到一条告警推送。请列出最近 24 小时的烟感、燃气、水浸告警，按时间从新到旧，并告诉我需要怎么处理。`
- 不产生 `customer_alert` 引用；用户点发送后，Agent 用现有 `query_alerts` 读同一套 perception 告警台账（Runtime 已接 `/micro-api/api/perception/fire/{ledger}/alarm/page`，Company 目录含 FIRE 设备时可用），回答里的记录可点开成安全事件详情。
- 局限：无法保证就是卡片那一条；近期多条时用户需按卡片上的设备名/时间再说明。台账是历史记录，不是实时推送，也不能据此断言“当前仍在报警/已恢复”。
- 优点：客户零改造、URL 短、无编码风险；只需要我方发布含 `prompt` 支持的版本。

### B. 动态 query（客户发送时按条拼接，可保留告警引用）

```text
pages/agent/dashboard?source=company&alertPrompt=<encodeURIComponent(设备名 · 类型 · 时间)>&prompt=<encodeURIComponent(请帮我核实这条告警并给出处置建议)>
```

示例（`alertPrompt` 解码为 `烟感 · 3 楼东侧机房 · 2026-10-28 09:41`）：

```text
pages/agent/dashboard?source=company&alertPrompt=%E7%83%9F%E6%84%9F%20%C2%B7%203%20%E6%A5%BC%E4%B8%9C%E4%BE%A7%E6%9C%BA%E6%88%BF%20%C2%B7%202026-10-28%2009%3A41&prompt=%E8%AF%B7%E5%B8%AE%E6%88%91%E6%A0%B8%E5%AE%9E%E8%BF%99%E6%9D%A1%E5%91%8A%E8%AD%A6%E5%B9%B6%E7%BB%99%E5%87%BA%E5%A4%84%E7%BD%AE%E5%BB%BA%E8%AE%AE
```

- `alertPrompt` 变成 `customer_alert` 引用随用户消息进入 Runtime；`prompt` 只预填。
- 约束：发送方 encode 一次；建议 `alertPrompt` ≤300 字、`prompt` ≤200 字；超出 2000 字客户端拒收。不要传完整告警文本或 JSON，路径会过长。
- 若客户后台只能存固定字符串但按设备一行配置，可退化为每台设备一个路径，带 `alertPrompt=<设备名>` 或后续新增的 `alertDevice=<sn>`。

### 共同约定

- `source=company` 固定；`alertPrompt`/`prompt` 缺一不影响另一项。
- 客户端只预填，不自动发送；最终下发仍走用户点击发送 + Runtime 权限/确认。
- 不传 `alertId`：本期不建告警详情接口；引用内容即事实边界，Agent 不得声称已核验平台告警记录。
- `page` 必须存在于线上版本；测试期 `miniprogram_state=developer` 指向 `2026.10.28-1`。

## 5. 需要客户提供的支持（按重要性）

1. 确认告警发送端就是 `sendHardwareDeviceMessage`，并给一次**脱敏请求样例**（`template_id`、`sn`、`modelId`、`page`、`miniprogram_state`、`data` 字段名可脱敏），用于确认 `page` 现状。
2. 确认他们的“配置页面路径”是**固定字符串**还是**按条拼 query**：固定就选第 4 节 A（直接抄上面的整条路径），能拼就选 B（动态 `alertPrompt`）。测试期 `miniprogram_state=developer`（或 `trial`），正式期再改 `formal`。
3. 一台已完成设备订阅的测试设备、一个测试微信账号，并触发一次真实告警；说明该账号对我们当前 `2026.10.28-1` 开发版是否有权限。
4. 若第 1 条暂时给不了：提供发送端所在仓库/分支或配置入口（当前 GitLab 账号看不到该仓库），或先手工发一条只带 `page=pages/agent/dashboard` 的测试消息。
5. 正式上线前双方各自发布：我方把 `pages/agent/dashboard` 合入并发布线上版本，客户再把 `miniprogram_state` 恢复 `formal`。

## 6. 验收方式与已做验证

- 已做（2026-10-28 开发者工具自动化，合并后 dev 构建）：`navigateTo /pages/agent/dashboard?source=company&alertPrompt=...&prompt=...` 后浮层展开，引用 chip 显示「烟感 · 3 楼东侧机房 · 2026-10-28…」，输入框预填「请帮我核实这条告警并给出处置建议」，未自动发送；静态路径仅 `prompt` 时无引用 chip、只预填问题。`pageStack.query` 保留未解码原文，与官方“路径参数需要 decodeURIComponent”一致。
- 真机：开发版 + `miniprogram_state=developer` 的卡片，分别验证「已登录冷启动」「已登录热启动（小程序在后台）」「未登录冷启动 → 登录后回落」。静态 A 还要确认：Agent 能列出最近告警、记录可点开；动态 B 要确认引用显示为客户告警原文。
- 发送后检查：Runtime 收到 `customer_alert`（company 来源），引用随本轮落库；设备控制仍需二次确认。

未验证项：`page` 长度上限；卡片冷启动与 `navigateTo` 的解码行为是否完全一致；客户告警模板 `data` 是否已包含设备/时间；客户线上版本是否已有 `pages/agent/dashboard`；客户发送端是否已配置任何 `page`；登录恢复与热启动参数（第 3 节 2、3 条）尚未实现。

## 7. 后端部署后的预期效果（验收口径）

### 7.1 先分清两个“后端”

| 后端 | 归属 | 决定什么 | 部署后能验证到 |
| --- | --- | --- | --- |
| 告警发送端（perception/fire 告警订阅与发送） | 客户 | `page`、`miniprogram_state`、模板 `data` | 点卡片跳到哪、带什么参数、落在哪个版本 |
| 客户网关 `/micro-api/api/ai` → 我方 Runtime | 客户网关 + 我方 Runtime | 会话建立、鉴权/租户、流式回复、任务/通知/告警台账、设备控制草案 | 页面打开后 Agent 是否真的能答、能读、能走确认 |

两个都就绪才形成完整闭环；只完成任一个都只能看到部分效果，不能当成整体验收。

### 7.2 端到端预期（按点击顺序）

1. 发送侧：`/cgi-bin/message/device/subscribe/send` 返回 `errcode=0`；卡片字段正常渲染；`page` 指向 `pages/agent/dashboard`；`miniprogram_state` 按阶段（测试 developer/trial，正式 formal）。
2. 点击侧：直接落在仪表盘，不经过首页、不闪跳；`pageStack.query` 保留未解码原文；公司 Agent 浮层自动展开。
3. 展示侧：B 方案显示「客户告警引用」chip + 预填问题；A 方案只有预填问题、无引用 chip；两种情况都不自动发送、不触发任何设备控制。
4. 对话侧：用户点发送后，Runtime 新增一轮，`reference=customer_alert`（B）随消息落库；模型基于引用回答，不声称已核验平台记录；若调用 `query_alerts`，返回的记录可点开为安全事件；若需要设备动作，先出草案卡，用户确认后才下发。
5. 权限侧：未登录或租户/园区不匹配时明确报身份错误，不建立会话、不落引用；company 来源限制与既有一致。
6. 版本侧：developer/trial/formal 都能跳到 `pages/agent/dashboard`；`formal` 要求该页存在于现网版本，否则发送直接失败。
7. 观测侧：Runtime 有该轮 run 与 `turn_events`；客户网关日志有 `/api/ai` 请求；无自动发送、无越权控制。

### 7.3 部署后应能区分的失败信号

- `41030`：`page` 不在目标版本（最常见：还没发布就切了 formal）。
- `43101`：用户未订阅/已取消该设备模板。
- `47003`：模板 `data` 不合法（与跳转无关，但要和 41030 分开定位）。
- 页面打开但 Agent「连接失败/读取失败」：网关 `/api/ai`、鉴权 header（`Authorization`/`Tenantcode`）或租户映射问题。
- 点击后浮层不展开：query 没到达，或设备打开的是不含 `prompt` 支持的旧包。
- 只有预填、没有引用：客户只配了 `prompt`（A 方案），符合预期，不是故障。
- 点击后回到首页或没有预填：命中我方已知缺口（未登录冷启动丢参、后台热启动未接管）。

### 7.4 部署顺序（避免把告警打断）

1. 在 developer/trial 验证整条链路，正式版 `page` 保持原值不动。
2. 我方发布含 `pages/agent/dashboard` 的线上版本（提审 → 发布，客户管理员操作）。
3. 客户把 `page` 切到契约路径，`miniprogram_state=formal`。
4. 发一条真实测试告警，逐项核对 7.2。
5. 观察一段时间发送成功率与 `errcode` 分布，再扩大范围。

### 7.5 仍需我方先补的三处（否则 7.2 在特定场景不成立）

- 未登录冷启动：`thirdLogin` 成功后会 `reLaunch('/pages/index/index')`，原始路径与参数丢失。
- 小程序在后台时点卡片：`App.onShow` 没有接收/分发新的 launch options。
- 已有未发送草稿时：新卡片的预置问题不会替换（实测保留旧草稿，未出现替换确认）。
