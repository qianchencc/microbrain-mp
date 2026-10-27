# 小程序启动 content 异常排查

状态：只读诊断及模拟响应验证完成；未修改业务代码，未取得截图用户的真实请求响应，根因尚未定案。

## 用户问题与证据边界

用户提供真机截图：路由为 `pages/index/index`，出现开发模式日志 socket 连接失败提示、`Cannot read properties of undefined (reading 'content')`，全局「加载中...」未消失。询问是否因为账号未认证。

截图没有请求 URL、HTTP 状态或业务响应，无法确认具体账号状态；`app-service.js` 栈也未映射到截图对应版本源码。`pages/agent` 的预加载日志不能证明异常发生在 Agent 页面。

## 已确认的本地代码行为

- `apis/request.js` 与 `apis/codeMap.js`：401/403 分支不返回业务对象，调用方会取得 undefined；500 等分支可返回 null；网络失败也会被转成 null。
- `store/modules/user.js` 的 `setUserInfo` 直接解构 `/account/me` 和 `/api/card/account/:id` 的 `content`；`setGeospatialInfo` 对 `/geospatial/all/list` 同样直接解构。
- `store/modules/permission.js` 的 `setAuthority` 并行等待上述初始化；`App.vue` 的启动恢复/自动登录没有承接初始化异常。
- `thirdLogin` 调用全局 `showLoading`，该方法没有 `hideLoading` 或 finally 清理。后续失败时可留下持续加载提示。
- 首页已有菜单为空时「请前往个人中心确权」的展示，见 `pages/index/coms/index-con.vue`。不能把未确权与程序崩溃视作同一状态。

## 已运行的验证

在仓库根目录用 `node` 标准输入脚本，通过 `node:vm` 加载实际 `apis/codeMap.js`、`apis/request.js`，提取实际 `setUserInfo` 方法；仅模拟 uni 请求响应与存储，不调用真实接口、不使用真实凭据、不控制设备。

| 模拟响应 | 观察结果 |
| --- | --- |
| 用户资料 403 | 解构 undefined 的 content 抛错 |
| 用户资料 401 | 解构 undefined 的 content 抛错 |
| 一卡通资料 403 | 解构 undefined 的 content 抛错 |
| 用户资料 500 | 解构 null 的 content 抛错 |
| 用户资料带未确权标记、两个请求均成功返回业务对象 | 初始化完成 |

这是异常机制验证，Node 的原生解构错误文案与截图微信编译产物的属性读取文案不同，不等同于真机复现，也不证明真实未确权账号的上游一定返回成功。

## 本轮补充定位（2026-10-27）

- 全仓库非构建产物中，只有 `store/modules/user.js` 的 `thirdLogin` 使用 `uni.showLoading({ title: '加载中...' })`。因此截图里的持续「加载中...」把故障点限定在 `showLoading` 之后：`getWxOpenId` 已成功返回，失败发生在换取 token、`setAuthority()` 或 `reLaunch` 之间。
- 该区间内唯一会读取 `.content` 的是 `setAuthority()` 及其 `Promise.all([setGeospatialInfo(), setUserInfo(), setDict()])`。`setDict()` 有空值保护；`setUserInfo()` 与 `setGeospatialInfo()` 直接解构 `content`，是 `reading 'content'` 的直接候选。
- 开发版 `isDev === true`，`setAuthority()` 使用本地 `config/menu.json`，不会请求 `/resource/current/user/resource/v2`。所以真机开发版需重点核查的请求缩小为：
  - `/sso-api/geospatial/all/list`
  - `/sso-api/account/me`
  - `/micro-api/api/card/account/:id`
- `App.onShow` 未捕获 `setAuthority()` / `thirdLogin()` 的异常；`thirdLogin()` 也没有 `try/finally` 关闭 loading。任一候选请求返回 401/403/500/网络失败，都会形成“崩溃 + 一直加载中”。
- 仍不能据此判定账号未确权：模拟“未确权但接口正常返回”时初始化可以通过；401/403/500 三类失败都能复现崩溃。

## 继续入口

先取得故障时上述接口的 HTTP 状态、业务 code/message，以及自动登录 token 申请是否成功。不要采集或保存 Authorization、token、openid、手机号等敏感内容。

候选原因：账号权限/登录拒绝、网络失败、服务端异常。当前只证明这些失败可能被前端放大为空值访问与持续加载；不能宣称已确认账号未确权。

若用户要求修复，范围限定为启动初始化失败的正确承接和加载收尾；按实际响应区分登录失效、确权、无卡资料和网络异常，避免直接用可选链吞掉错误或伪造初始化成功。保留工作区已有其他修改。

## Suggested skills

- `diagnosing-bugs`：依据真实接口响应继续缩小触发条件。
- `handoff`：更新后续进展与真机验证边界。
