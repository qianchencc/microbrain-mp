# 客户小程序登录态与 Agent 接入调查

日期：2026-09-18  
状态：会话桥接和本地开发验收已完成；真实网关与体验版仍待验收

2026-09-30 修正：本文件保留 09-18 的登录调查基线。用户已纠正“Token 频繁过期”的误记录，账户来源 `account/me.id` 已实测；不再以刷新接口、跨 Token 实验或失效停用规则阻断自动化。见[本轮主体核验](2026-09-30-recurring-principal-readonly-verification.md)。历史 3201 路线已退役，现行单实例 3200 与验收状态以[文档入口](../README.md)为准。

## 结论先行

客户小程序不应为 Agent 增加第二套登录。正确的使用方式应是：

```text
用户打开客户小程序
  -> 客户小程序完成登录并建立客户会话
  -> Agent 页面复用当前客户 Token 和当前园区/租户上下文
  -> Agent API 请求进入客户网关/Runtime
  -> Runtime 按当前用户范围加载设备
```

用户进入 Agent 页面时不需要再次输入账号，也不需要把微信 `openid`、`session_key` 或微信 `code` 交给 Agent。Agent 只消费客户系统已经建立的业务登录态。

会话桥接层已经落地：Agent 页面等待客户 Token 和园区上下文，并通过统一 session provider 组装请求身份。小程序端现存的 OAuth client secret 风险仍未由本轮解决：小程序包可被下载和分析，任何放在其中的值都不能按机密保存。

## 当前登录链路

## Agent 后端地址结论

Agent Runtime 应继续作为独立后端运行，小程序不承载 Runtime。地址不是“永远本地”或“永远公网”的二选一，而是按小程序环境分层：

| 环境 | 地址 | 说明 |
|---|---|---|
| 开发者工具模拟器 | `http://127.0.0.1:3200/api` | 本机 Runtime + Iotfake，适合页面和协议开发 |
| 手机开发预览 | `http://<开发机局域网地址>:3200/3201/api` | Runtime 监听 `0.0.0.0`，手机与开发机同网段；不能使用手机自己的 `127.0.0.1` |
| 体验版 | 客户 HTTPS 验收网关，现有配置目标为 `/micro-api/api/ai` | 必须使用真实客户登录和受控测试设备 |
| 正式版 | 客户正式 HTTPS 网关，现有配置目标为 `/micro-api/api/ai` | 供正式用户使用，不能依赖开发机 |

因此，继续把 Runtime 放在本地是正确的开发策略，但不是客户小程序接入的完整方案。客户配置已经修正为精确判断 `envVersion === 'develop'`；`trial/release` 不再回落到本地地址，后续仍需实际验证 HTTPS 和流式代理。

本地 `3200` 连接 Iotfake；`3201` 是连接真实客户网关的受控开发实例。`3201` 可用于开发机或真机的真实接口联调，但不能作为体验版/正式版的服务地址。

### 首次进入客户小程序

调查时的登录主链路如下；当前实现保留该链路，并补上异步等待与过期检查：

1. 如果本地存在 `authorized-token`，直接调用 `setAuthority()`；
2. 否则调用 `wx.login`/`uni.login` 获取临时 code；
3. `store/modules/user.js::thirdLogin` 将 code 发送到客户接口 `/wx/miniProgram/codeToToken/{code}`，取得 openid；
4. 小程序端再拼接客户 SSO 的 `oauth/token` 请求，换取 `access_token`、`token_type` 和 `expires_in`；
5. `utils/auth.js::setToken` 保存 `token_type + access_token`，当前实现同时记录过期时间；
6. `setAuthority()` 加载菜单、园区列表、用户信息和字典，当前实现等待这些初始化完成；
7. 用户进入首页和 Agent 页面。

### Agent 请求如何使用登录态

调查时客户仓库的 `apis/agent/index.js` 存在开发固定身份和生产客户身份两条路径。现已统一由 `utils/agent-session.js` 读取客户 Token 与当前 `district.id`，开发版只改变 Agent 地址，不再改变客户身份来源。

Runtime 当前要求 `Authorization` 和 `Tenantcode`，并用当前凭据派生短期会话 owner；设备目录仍由当前身份的 Authorized Device Scope 决定。

## 发现的问题

### 1. OAuth 换票逻辑在小程序端

`store/modules/user.js` 中直接构造 SSO `oauth/token` 请求，并将 OAuth client secret 写入前端源码。无论这个值是否被客户当作“公开客户端凭据”，它都能进入小程序包，因此不能承担真正的 confidential secret 职责。

推荐改为：

```text
小程序 wx.login -> 客户后端登录接口
客户后端 -> 微信 code2Session / 客户 SSO 映射
客户后端 -> 返回客户业务 Token 或短时 Agent session
```

小程序只传一次性 code，不接触微信 `session_key` 和服务端机密。客户后端负责把微信用户映射到客户主体，再签发现有客户 Token 或专用 Agent Token。

### 2. `trial` 被误判为开发环境（已修复）

调查时 `config/settings.js` 使用 `envVersion !== 'release'` 作为 `isDev`，所以 `trial` 也会进入开发分支。结果是：

- `config/index.js` 可能把 Agent URL 指向 `127.0.0.1:3200`；
- `apis/agent/index.js` 可能发送 `local-development`/`LOCAL`；
- 体验版无法证明真实用户登录、真实租户和真实设备范围。

现已改为精确区分 `develop/trial/release`：只有 `develop` 可使用本地 Agent 地址，`trial/release` 使用客户网关和客户登录态。

正式环境必须按精确环境区分：

| 环境 | Agent 地址 | 身份 | 设备范围 |
|---|---|---|---|
| `develop` | 本地 Runtime/Iotfake | 客户小程序使用客户登录态；独立壳才可使用固定身份 | 模拟或受控开发设备 |
| `trial` | HTTPS 验收网关/Runtime | 必须客户真实登录 | 客户批准的测试设备 |
| `release` | HTTPS 生产网关/Runtime | 必须客户真实登录 | 正式授权范围 |

### 3. Token 过期与刷新（部分解决）

调查时登录响应包含 `expires_in`，但客户端没有保存或检查过期时间。现已保存 `authorized-token-expires-at`，Agent session 会拒绝缺失或过期 Token；客户刷新接口和完整的 401 恢复政策仍未提供。

这会导致：

- 小程序重新打开时携带过期 Token；
- Agent 页面首次请求才暴露 401；
- 401 触发登出和重新登录，用户体验不稳定；
- 流式请求或确认请求在过期时无法区分“尚未发送”和“结果未知”。

### 4. 首次登录可能早于园区上下文准备完成（已修复）

调查时 `thirdLogin`、`setAuthority` 和 `App.onShow` 没有形成统一的 session-ready barrier。

现已等待登录和权限初始化完成，Agent 页面还会通过 `waitForAgentSession()` 等待 Token 与园区准备就绪；基础请求读取园区也改为空值安全。

### 5. 退出逻辑存在重新登录竞态（已修复）

调查时 `logOut()` 会先调用 `wxLogin()`，再删除 Token 和清空本地存储，存在异步写回新 Token 的竞态。现已移除登出过程中的隐式重新登录，退出只负责清理当前会话。

退出应先阻止新请求、取消或标记登录 generation、清除客户端会话，再由明确的登录入口启动下一次登录；不能把登出实现成立即隐式登录。

### 6. Token 刷新与 Agent 请求重试不能一概而论

普通读取请求可以在确认身份有效后重试一次，但确认设备动作不能在“请求是否已到达 Runtime”不明确时盲目重试。尤其门禁等非幂等动作，必须先恢复/核查服务端状态，再决定是否重新起草。

因此 Agent API 需要区分：

- 会话读取、目录查询：可等待会话恢复后重试一次；
- 流式消息：发送前先确保会话有效，401 时重新建立流，不重复提交已经被服务端接受的消息；
- 草案确认：不自动重复下发，结果未知时进入恢复和人工核验；
- 取消、清除和登出：遵循 Runtime 当前状态机，不因客户端离开就假报动作已取消。

## 推荐的正式登录模型

### 方案 A：复用客户现有登录态，优先采用

```text
微信小程序 wx.login
  -> 客户后端完成 code2Session 和客户主体映射
  -> 客户后端签发/刷新客户业务 Token
  -> 客户小程序保存客户会话
  -> Agent API 读取同一客户会话
  -> Authorization + 当前 tenantCode 发送到 Agent 网关
```

优点：不增加第二次登录、不复制客户用户体系、设备范围继续由客户上游按真实用户过滤。

前提：客户 Agent 网关能够接受当前客户 Token，或客户提供一个等价的短时 Agent Token 交换接口。

### 方案 B：客户后端签发短时 Agent session

如果客户不允许 Agent Runtime 直接接触客户长期 Token，则增加客户后端会话交换：

```text
客户小程序客户会话
  -> 客户后端 /agent/session
  -> 短时 Agent session + 稳定 principal/workspace
  -> Agent Runtime
```

该 session 必须明确过期、撤销、园区切换、权限变化和审计 actor。Runtime 仍需使用客户授权范围读取设备，不能因为 Agent session 存在就扩大设备范围。

### 不采用的方案

- Agent 页面自行调用 `wx.login` 并另建一套用户表；
- 前端把 `openid` 当作客户业务主体直接传给 Runtime；
- 前端把微信 `session_key` 或 OAuth client secret 传给 Agent；
- 用 `tenantCode` 单独代表用户；
- 用 Token 哈希作为长期记忆、日程、规则和告警的稳定 owner；
- 将客户体验版也当成开发环境使用固定身份。

## 用户实际如何使用

正式用户的体验应是：

1. 用户打开客户小程序；
2. 客户小程序自动恢复有效登录态，过期则由客户会话层刷新或重新登录；
3. 用户选择当前园区/工作空间；
4. 用户点击首页“物联助手”；
5. Agent 页面等待 `sessionReady`，确认用户主体和园区上下文后再恢复/创建会话；
6. 用户直接对话、查询设备或生成操作草案，不再二次登录；
7. 用户切换园区后，Agent 丢弃旧上下文并重新加载设备范围；
8. 用户退出客户小程序后，Agent 不再接受旧凭据；重新登录后恢复新的用户上下文。

## 最小接入边界

本轮只落地“会话桥接 + 现有三类设备闭环”，没有扩展新设备或长期业务：

### 客户小程序（已落地）

- 精确区分 `develop/trial/release`；
- 建立 `ensureCustomerSession()` 或等价的统一会话入口；
- 保存 Token、过期时间和当前用户/园区上下文；
- Agent API 只从 session provider 读取 header，页面不直接拼身份；
- Agent 页面进入前等待 `sessionReady`；
- 过期 Token 在 Agent 请求前被拒绝；确认请求禁止盲重试；
- 修复首次登录等待和退出重登录竞态；
- 已迁移独立项目验证过的对话、草案和设备交互，不同时扩展新设备。

### Runtime/网关（部分落地）

- 本地 `3200` 已接受客户 Token/tenantCode 并完成流式只读查询；
- 客户网关 `/api/ai` 与 Runtime API 的映射仍需在体验版验证；
- HTTPS、流式 NDJSON、超时和代理缓冲仍待验收；
- 保留当前用户设备范围和每次确认前重核验；
- 记录稳定主体（若客户提供），同时暂不把 Token 哈希升级为长期业务主体；
- 不记录明文 Token、微信 code、session_key 或 OAuth secret。

## 登录态验收矩阵

必须在客户 AppID 下由真实测试用户完成：

| 场景 | 预期 |
|---|---|
| 干净安装首次进入 | 完成客户登录后才能进入 Agent；不要求二次登录 |
| 有效 Token 重启小程序 | 直接恢复，不重复登录，不丢园区 |
| Token 临近过期 | 由会话层刷新或重新建立，不把请求直接打到 Agent 才失败 |
| Token 已过期 | 用户得到明确登录恢复，不自动重复确认动作 |
| 首次登录无园区缓存 | 等待园区初始化完成后才允许 Agent 请求 |
| 切换园区 | 新请求使用新园区；旧会话/草案不可跨园区恢复 |
| 切换用户 | B 看不到 A 的会话、草案和设备范围 |
| 退出 | 旧凭据立即失效，不能被异步回调写回 |
| Agent 普通查询 | 使用当前用户 Token 和 tenantCode，设备范围正确 |
| Agent 流式消息 | HTTPS 不被缓冲，断线能恢复，不重复提交 |
| 草案确认 | 仅显式确认执行；401、超时、未知结果不自动重下发 |
| 设备权限撤销 | 确认前重新核验并拒绝或缩减草案 |
| trial 构建 | 不出现 `127.0.0.1`、`local-development` 或 `LOCAL` |
| release 构建 | 未配置正式身份/地址时 fail closed |

## 当前决策

- **客户小程序会话桥接和页面迁移已经完成本地开发验收。** 当前下一步是 `3201` 真实网关和低风险设备动作验收。
- **优先复用客户登录态，不在 Agent 内重新登录。**
- **客户后端必须承担 code2Session、主体映射和 confidential credential 处理。**
- **客户 Token 可以作为现有设备闭环的短期接入凭据，但不能作为长期个人业务 owner。**
- **09-30 已撤回“长期业务必须等待刷新契约”的结论。** 账户 ID 来源已核验，服务端归属键接入作为我方实现事项；当前凭据复用，不新增刷新前置条件。
- **OAuth 前端换票属于原调查的独立工程问题。** 不把它扩成本轮周期任务阻塞，也不把 `openid` 或 Token 哈希升级为长期用户主体。

## 实施后的开发版验证补记

本调查形成的会话边界已经在客户小程序中落地：客户登录、用户、园区和物联基础接口继续走 `https://ncim.577119.com`；开发环境仅把 Agent API 指向本机 `http://127.0.0.1:3200/api`。Agent 页面不自行建立第二套微信登录，而是等待客户 Token 和当前园区上下文就绪后再恢复或创建会话。

2026 年 9 月 18 日在客户 AppID 的微信开发者工具中完成了开发版只读验收：从客户首页进入 Agent，发起“我有哪些设备？”后收到完整流式回答并正常收尾；本地 3200 Runtime 的同一查询也返回完整 NDJSON 终止事件。由此可确认登录态桥接和本地 Agent 请求链路已打通。

尚未完成的事项保持不变：3201 真实客户网关、真实设备动作、体验版 HTTPS/流式代理、客户正式 `WechatSI` 插件授权。这些必须作为独立的受控验收，不应由本地开发版查询结果替代。
