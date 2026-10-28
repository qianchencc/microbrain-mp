# 2026-10-28 消息卡片跳转探索（客户告警卡片 → 公司 Agent）

结论先行。第 1 节是决策所需事实，第 2 节是上游证据，第 3 节是我方缺口，第 4 节建议冻结的契约，第 5 节客户需提供的支持，第 6 节验收与未验证项。本文只做只读探索，未改产品代码。

## 1. 结论

1. 客户小程序里的告警消息卡片走的是**微信「设备订阅消息」**，不是普通一次性/长期订阅消息，也不是公众号模板消息：客户 mp 分支 2026-10-15 的“新增设备订阅”提交引入 `wx.requestSubscribeDeviceMessage`（`pages/user/device.vue`）与 `/api/perception/fire/alarmSubConfig/*`、`/api/perception/alarmUserSub/` 三个接口（`apis/user/device.js`）。这类消息由发送方服务端调用 `POST /cgi-bin/message/device/subscribe/send` 下发。
2. 该接口的 `page` 字段**必填且支持带 query**（“点击模板卡片后的跳转页面，仅限本小程序内的页面。支持带参数”），不填则模板无跳转；路径错误返回 `41030 invalid page`，要求页面存在于**现网版本**小程序；`miniprogram_state` 可选 `developer`/`trial`/`formal`（默认 formal）。来源见第 2.2 节。因此**不需要 URL Link、URL Scheme 或 H5 中转**，卡片可以直接落在 `pages/agent/dashboard` 并携带告警内容。
3. 我方页面与 Runtime 的主要能力已经具备：仪表盘能解析 `source=company`/`alertPrompt` 并自动展开公司 Agent 浮层；`alertPrompt` 作为 `customer_alert` 引用进入输入区，不自动发送；Runtime 对 `customer_alert` 只接受 company 来源并要求内容非空。
4. 我方仍缺四个代码闭环（第 3 节）：`prompt` 参数未实现；未登录冷启动会被 `thirdLogin` 的 `reLaunch('/pages/index/index')` 丢掉原始跳转参数；小程序已在前台/后台时新卡片参数无人接收；参数长度、编码与重复卡片没有契约。
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
| `prompt` 参数 | `pages/agent/context-link.mjs:25` | **未实现**（只有环境/电表窗口会生成 prompt） |
| 浮层接收上下文 | `pages/agent/components/CompanyAgentFloat.vue:56-66` | `open({reference, prompt})`，引用/预填交给会话 |
| 会话暂存与消费 | `pages/agent/components/AgentConversation.vue:291-304, 308+` | hydration 前暂存、hydration 后落地；输入非空时替换需确认 |
| 冷启动登录 | `App.vue:10-21`、`store/modules/user.js:75-100` | 无 token 时 `thirdLogin` 静默登录，成功后 `uni.reLaunch('/pages/index/index')`，**原始跳转页与参数丢失** |
| 已打开时新参数 | `App.vue:10` | `onShow` 不接收 launch options，热启动卡片参数无人处理 |
| 登录态等待 | `utils/agent-session.js:16-27,47-58` | 无 token 立即抛 `AGENT_SESSION_EXPIRED`，不等待 App 登录 |
| 页面注册 | `pages.json:119-146` | `pages/agent` 为分包，`dashboard` 已注册 |
| 线上版本 | `plan/2026-10-28-miniapp-upload-2026.10.28-1.md` | 只有开发版 `2026.10.28-1`（AppID `wxe60e1f697d115f96`），未提审、未发布；`formal` 状态下发 `page` 会 `41030` |

## 3. 我方代码缺口（按最小闭环排序）

1. **支持 `prompt` 参数**：`parseAgentContext` 增加 `options.prompt`（decode 一次、trim、≤200 字、拒绝控制字符），返回 `context.prompt`；`dashboard.onLoad` 已有打开通道，`CompanyAgentFloat`/`AgentConversation` 的暂存队列不需要改。
2. **登录前的跳转参数保留**：`App.onShow` 与 `onLaunch` 用 `wx.getEnterOptionsSync()`/launch options 记录 `{path, query}`；`thirdLogin` 成功后不再无条件 `reLaunch('/pages/index/index')`，而是回到原目标（带 query）；`dashboard.onLoad` 同时消费该暂存，避免两条路径都消费导致重复。
3. **已打开时的新卡片**：`App.onShow(options)` 若当前前台页是 `pages/agent/dashboard`，把新上下文投递给浮层（事件或页面方法）；否则按第 2 条的目标页重开。
4. **去重与提示**：同一 `alertPrompt` 内容不重复插引用；浮层已展开且有草稿时沿用现有“替换输入”确认；无效/超长参数只 toast，不阻断进入仪表盘。所有路径都不自动发送。
5. **回归**：`context-link` 的 `prompt` 解析、长度边界、编码一次；启动参数暂存/消费纯函数；登录后目标恢复在开发者工具用启动参数验证。不把设备控制加入任何自动路径。

风险与取舍：
- `page` 中的中文/长文本长度上限没有官方数值；建议 `alertPrompt` ≤300 字、`prompt` ≤200 字，并压测一次真实卡片（超长时客户应改传更短摘要）。
- onLoad 的 query 是否已被框架解码一次，必须以开发者工具“启动参数”实测确认；现有 `alertPrompt`/`safetyReference` 的“一次 decode”约定来自已实测的 `navigateTo` 路径，卡片冷启动尚需复核，避免双重解码。
- `page` 必须存在于线上版本：正式期客户若仍用 `formal`，必须等我方合并并发布包含 `pages/agent/dashboard` 的版本；测试期用 `miniprogram_state=developer` 指向 `2026.10.28-1` 开发版。

## 4. 建议冻结的契约

```text
page: pages/agent/dashboard?source=company&alertPrompt=<encodeURIComponent(简短告警)>[&prompt=<encodeURIComponent(预置问题)>]
```

- `source=company`：固定，标识进公司 Agent（缺省时 `alertPrompt` 也会打开，但保留以便兼容现有重定向）。
- `alertPrompt`：客户告警卡片必填；建议内容为「设备名 · 告警类型 · 时间」这类可自解释摘要，≤300 字；发送方 encode 一次，客户端 decode 一次；超出 2000 字被客户端拒收。
- `prompt`：可选，≤200 字；缺省时客户端不预填，用户直接看到引用。若希望“点卡片即得到处置建议”，客户传固定问句即可，例如“请帮我核实这条告警并给出处置建议”。
- 不传 `alertId`：本期不建立告警详情查询接口；引用内容即事实边界，Agent 不得声称已核验平台告警记录。
- 客户端始终只填输入框，不自动发送；真正下发仍走用户点击发送 + Runtime 权限/确认。

## 5. 需要客户提供的支持（按重要性）

1. 确认告警发送端就是 `sendHardwareDeviceMessage`，并给一次**脱敏请求样例**（`template_id`、`sn`、`modelId`、`page`、`miniprogram_state`、`data` 字段名可脱敏），用于确认 `page` 现状。
2. 把 `page` 按第 4 节契约配置（改代码或后台配置均可）；测试期 `miniprogram_state=developer`（或 `trial`），正式期再改 `formal`。
3. 一台已完成设备订阅的测试设备、一个测试微信账号，并触发一次真实告警；说明该账号对我们当前 `2026.10.28-1` 开发版是否有权限。
4. 若第 1 条暂时给不了：提供发送端所在仓库/分支或配置入口（当前 GitLab 账号看不到该仓库），或先手工发一条只带 `page=pages/agent/dashboard` 的测试消息。
5. 正式上线前双方各自发布：我方把 `pages/agent/dashboard` 合入并发布线上版本，客户再把 `miniprogram_state` 恢复 `formal`。

## 6. 验收方式（本轮未执行）

- 开发者工具“编译模式 → 启动参数”填 `pages/agent/dashboard?source=company&alertPrompt=...&prompt=...` 冷启动：浮层展开、引用与预填正确、不自动发送。
- 真机：开发版 + `miniprogram_state=developer` 的卡片，分别验证「已登录冷启动」「已登录热启动（小程序在后台）」「未登录冷启动 → 登录后回落」。
- 发送后检查：Runtime 收到 `customer_alert`（company 来源），引用随本轮落库；设备控制仍需二次确认。

未验证项：`page` 长度上限；卡片冷启动 query 的解码次数；客户告警模板 `data` 是否已包含设备/时间；客户线上版本是否已有 `pages/agent/dashboard`；客户发送端是否已配置任何 `page`。
