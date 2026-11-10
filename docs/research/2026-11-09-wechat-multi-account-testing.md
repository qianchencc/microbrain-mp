# 微信开发者工具多身份测试：本项目的身份边界

日期：2026-11-09。范围：研究与只读源码核对；未切换账号、未读取测试账号名录、未导出真实会话、未改产品代码或后端配置。

## 已核实的项目事实

1. 微信登录主线是 `uni.login` → `thirdLogin(code)` → 客户接口取得 OpenID → 客户 SSO 换取业务 Token。工具微信身份、小程序微信身份、客户业务身份不能混为一层。源码：[wxLogin.js](../../utils/wxLogin.js)、[user.js](../../store/modules/user.js)。
2. `loginByUsername` action 存在，但本次 LSP references 只返回其声明；`pages.json` 未找到 login 页面，`pages/login/index.*` 也未找到。因此不能把“已有可操作的用户名密码登录页”当成现状。源码：[user.js](../../store/modules/user.js)、[pages.json](../../pages.json)。
3. 业务凭据保存在 `authorized-token`，业务园区另保存在 `district`；Pinia 还持有用户/园区状态。只替换一个 Token 字符串或只改头像，不足以证明业务身份切换完整。源码：[auth.js](../../utils/auth.js)、[storage.js](../../utils/storage.js)、[user.js](../../store/modules/user.js)。
4. Agent 请求使用当前业务会话完整 Authorization 与园区 Tenantcode，存储分区摘要包含两者。Company/Office 是业务来源，不自动代表两个不同账号。源码：[agent-session.js](../../utils/agent-session.js)、[本地联调契约](../migration/iot-agent-local-miniapp.md)。

## 本机自动化能力的证据与边界

- 已安装的 miniprogram-automator 0.13.0 的 `launch` 选项叫 `account`，实现转发为 `--auto-account`；不是凭空约定一个 `testAccount` 字段。
- `connect` 只接受 `wsEndpoint`，用于连接现有调试实例；它本身不选择账号。
- 可公开核对的同版本产物：[Launcher.js](https://unpkg.com/miniprogram-automator@0.13.0/out/Launcher.js)、[Launcher.d.ts](https://unpkg.com/miniprogram-automator@0.13.0/out/Launcher.d.ts)。
- 本机 `cli auto --help` 只做帮助查询，没有执行账号切换；SDK 有参数，不等于本机多账号行为和存储隔离已经实测通过。

## 对本项目的安全约束与建议

- 先明确测试目标：业务权限差异测试，还是微信身份与客户账号绑定的完整登录测试。后者不能用修改前端用户字段或 mock 登录成功代替。
- 优先让用户在工具中通过正式入口准备好已授权的测试身份，再由助手连接；不要在聊天中传微信密码、短信验证码、扫码登录凭证、Bearer 或整份 Storage。
- 如使用虚拟微信测试身份，必须核对客户测试环境是否把该身份关联到预期的业务测试账号；不能默认它具有现有员工权限，也不应覆盖真实员工的生产绑定。
- 不把复制项目目录、打开多个普通窗口或更换端口直接当成登录态隔离的证明；需要验证各实例的实际业务主体、园区和可见设备范围。
- 第一轮建议串行 A → B → A：每次核对后端实际主体/园区/授权范围，再检查旧账号对话、任务、视频和前端快照是否仍残留。默认只读，不创建真实任务、不控制设备或发送通知。
- 如后续确需会话快照，它仍是有效凭据：仅本机临时保存、限制权限、Git 忽略、过期后重新登录；不能当成无敏感性的测试夹具，也不能用它声称完整登录链路已验收。

## 用户需要提供的信息

使用别名即可，不需要在研究记录里写真人姓名或手机号：

| 别名 | 客户业务身份/预期权限 | 园区/办公室范围 | 当前准备方式 | 允许操作 |
| --- | --- | --- | --- | --- |
| A | 可查看约定公司设备范围的测试身份 | 用户指定 | 正常登录好的调试实例或待绑定的测试微信身份 | 默认只读 |
| B | 只能查看约定办公室/少量设备的测试身份 | 用户指定 | 同上 | 默认只读 |
| C（可选） | 不应访问目标设备的测试身份 | 用户指定 | 同上 | 默认只读 |

账号标识/自动化连接信息可由助手在工具里读取并现场核对；关键的人为输入是“这些账号分别应当拥有什么权限”，而不是一串 Token。

## 官方已确认的交付操作

1. 打开开发者工具「工具 → 多账号调试」。官方默认提供四个测试号，也支持由不同于主账号的真实微信扫描二维码添加测试账号。用户本人扫码，不向助手提供微信密码或扫码登录凭证。[官方多账号调试](https://developers.weixin.qq.com/miniprogram/dev/devtools/multiaccount.html)。
2. 本项目优先使用已经绑定客户业务账号的真实微信；默认测试号不能被假定为客户现有员工。个人中心账号仅用于核对业务主体，账号编号本身不构成当前微信登录链路的登录凭据。
3. `miniProgram.testAccounts()` 可读取已添加账号的昵称和 OpenID；`automator.launch({account: openid})` 可按该用户打开项目。用户不必手工复制 OpenID 或 Token给助手。[账号枚举及官方多用户示例](https://developers.weixin.qq.com/miniprogram/dev/devtools/auto/miniprogram.html#miniProgram-testAccounts)、[launch账号选项](https://developers.weixin.qq.com/miniprogram/dev/devtools/auto/automator.html)。
4. 助手使用所选身份运行正常微信登录/客户SSO流程，并核对实际业务主体与预期范围；没有切换账号的现场验收前，不承诺本机账号选择、Storage隔离或完整业务登录已通过。
5. 官方提示：主账号换登会同步到所有已打开项目窗口；扫码加入的测试账号若登录其他开发者工具客户端，其登录态会失效。准备测试期间避免在另一台开发者工具重复登录。[官方多账号调试](https://developers.weixin.qq.com/miniprogram/dev/devtools/multiaccount.html)。

本轮直接核实了官方文档及已安装SDK，没有统计社区做法的普及率。所查微信社区讨论页重定向到登录页，未以其内容作为证据；官方示例中的全局登录标记和API Mock仅适合对应的模拟测试，不能替代本项目真实客户鉴权验收。[官方示例](https://developers.weixin.qq.com/miniprogram/dev/devtools/auto/example.html)。
