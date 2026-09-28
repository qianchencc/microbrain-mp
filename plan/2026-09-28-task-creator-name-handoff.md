# 任务创建者展示名交接

日期：2026-09-28。范围：区域工作台票 13；依据 `.scratch/region-workbench/issues/13-creator-display-name.md`。

## 已接通

- 用既有开发身份只读核实客户小程序使用的 SSO `GET /sso-api/account/me`：HTTP/业务码均为 200，真实姓名字段是非空 `content.personalName`；`name` 不存在，`nickname` 为 null。没有重新登录，也没有保存或输出姓名和 Token。
- Runtime 适配器使用请求身份读取该字段，确认定时任务和即时草案补写时固化 `creator_name`；资料接口失败或字段为空回退“成员”，不影响设备操作与任务建立。任务时间轴和抽屉直接投影已保存姓名，后续客户侧改名不重写历史。

## 验证与边界

- Runtime 39/39、typecheck、build 通过；编译后的适配器在真实网关脱敏只读验证解析出非占位姓名。现有 HTTP 场景分别覆盖即时、定时创建的姓名固化，以及 SSO 失败时的回退。
- 本轮没有在真实网关创建任务或执行设备控制。小程序显示效果由用户验收；票 14 的真实设备场景仍需用户指定并操作。

建议技能：`$ask-matt`、`$implement`、`$handoff`。
