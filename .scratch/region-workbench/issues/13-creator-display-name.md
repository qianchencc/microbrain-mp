# 13 — 创建者展示名

**Spec:** `.scratch/region-workbench/spec.md`（“Runtime：代码结构”中的创建者展示名）
**仓库:** iot-agent-runtime（需真实网关实测）

**What to build:** 任务卡与任务抽屉显示创建者的真实姓名，而不是占位的“成员”。Runtime 在任务创建（Agent 确认或即时草案补写）时以请求身份读取客户用户信息并固化进任务，之后不再随客户侧改名变化。

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] 先在真实网关上实测客户用户信息接口（参考小程序现有获取用户信息的调用），确认姓名字段与鉴权方式，结论记入 Comments；不猜测字段
- [ ] 读取经物联适配器或同层客户接口模块完成，Agent 核心不直接拼接客户接口
- [ ] 读取失败时仍为“成员”，不阻塞任务创建
- [ ] 测试夹具提供该接口的生产协议响应；Runtime 测试覆盖成功与失败回退
- [ ] 不使用开发账号重新登录；实测只用 `var/agent-identity.json` 中的既有身份

## Comments
