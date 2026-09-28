# 13 — 创建者展示名

**Spec:** `.scratch/region-workbench/spec.md`（“Runtime：代码结构”中的创建者展示名）
**仓库:** iot-agent-runtime（需真实网关实测）

**What to build:** 任务卡与任务抽屉显示创建者的真实姓名，而不是占位的“成员”。Runtime 在任务创建（Agent 确认或即时草案补写）时以请求身份读取客户用户信息并固化进任务，之后不再随客户侧改名变化。

**Blocked by:** 04

**Status:** implemented; pending user miniapp acceptance

- [x] 先在真实网关上实测客户用户信息接口（参考小程序现有获取用户信息的调用），确认姓名字段与鉴权方式，结论记入 Comments；不猜测字段
- [x] 读取经物联适配器或同层客户接口模块完成，Agent 核心不直接拼接客户接口
- [x] 读取失败时仍为“成员”，不阻塞任务创建
- [x] 测试夹具提供该接口的生产协议响应；Runtime 测试覆盖成功与失败回退
- [x] 不使用开发账号重新登录；实测只用 `var/agent-identity.json` 中的既有身份

## Comments

- 2026-09-28 只读实测：客户小程序 `getPrincipalAllInfo()` 指向 `GET https://ncim.577119.com/sso-api/account/me`。现有开发身份返回 HTTP 200、业务码 200；`content.personalName` 为非空字符串，`name` 不存在、`nickname` 为 null。以原 Authorization 和 tenantCode 请求即可；未重新登录。实测记录只保留字段形状和解析结果，不保存姓名或凭据。
- Runtime 适配器已按该字段读取，编译产物在真实网关脱敏验证为非占位姓名；即时/定时任务在创建时固化。接口失败或姓名缺失回退“成员”。
