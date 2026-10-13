# 本机 Runtime 局域网接线修复

日期：2026-10-13。范围：修复微信开发者工具请求失效的本机地址。

## 根因与修复

Mac 当前 en0 地址为 `192.168.102.19`，但 `config/index.js` 与微信编译包仍使用 `192.168.102.16:3200/api`。旧地址连接失败；新地址 `/healthz` 返回 200。

源码仅替换 Agent 开发地址。通过 HBuilderX CLI 重新编译客户 mp，并在微信开发者工具中加载 `unpackage/dist/dev/mp-weixin`。客户登录、物联接口与视频 HTTPS 地址保持现有配置。

## 验证证据

- HBuilderX 编译成功；既有 uniCloud 未关联提示及客户页面编译警告仍存在。
- 开发者工具运行环境为 `develop`，运行时配置模块返回 `http://192.168.102.19:3200/api`。
- 开发者工具内 `/healthz` 请求返回 200：production、客户网关 `https://ncim.577119.com`、模型 `GLM-5.3-Flash`、数据库 `real-runtime.sqlite`。
- 使用现有客户登录态调用实际编译后的 `getCompanyDashboard('environment')`，约 2463ms 成功，`source=company`，返回一台环境设备、一条读数，`errors=[]`，查询时间 `2026-10-13T01:17:55.038Z`。
- 未注入模拟响应、改写客户登录态、发送 Agent 消息或确认设备控制。未重启 Runtime。
- `git diff --check` 通过。未为单个地址替换新增实现镜像测试。

## 后续与建议技能

DHCP 再次改变 IP 时，核对 `ipconfig getifaddr en0`，更新源码后重新编译，验证开发者工具运行时地址和授权只读请求。此地址修复未覆盖手机真机或物理设备控制验收。

后续排查建议使用 `diagnosing-bugs`；本交接依项目要求保存在 `plan/`。
