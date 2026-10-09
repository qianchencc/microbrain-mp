# 03 — 双 Agent 共用实时观看链路

Date: 2026-10-09
Status: ready-for-agent
Blocked by: None (can start immediately)
External/decision gates: E02 只阻塞客户域/真机最终关闭；源码和开发环境首帧验证可先做。

规格：[历史观察与双 Agent 视频](../2026-10-09-history-observation-spec.md)。状态是发布时快照，实施进展在本地 tracker 同编号票维护。

## What to build

用户从任一 Agent 找到本端可见摄像头，点击即进入同一观看页，在页内取流、播放、重试，返回原对话或列表。

## Frozen scope

复用现有实时取流与自建 H5 方向；开放 Company 观看动作而不扩大控制权限。保留 source/身份/设备，收口 tenantCode 与重连参数，按视频范围去掉敏感日志，不扩写其他 WebView 业务。

## Expected code size

Runtime 160–280，mp/H5 340–600 行。 估算只含新增/主要修改的生产逻辑，不含固定倍数的测试或文档，也不是报价。开工先核对现有实现；明显超出应说明原因并缩小本票，禁止顺手扩大为平台。

## Acceptance criteria

- [ ] Company 与 Office 各用本端目录，范围外摄像头不能取流；共享播放器不共享目录。
- [ ] 先导航再取流；加载中标题/返回可用，Company 观察卡提供观看入口。
- [ ] 重试保留本端 source/摄像头/租户，换身份清除旧画面；接口失败不改写在线态。
- [ ] 首次/换流/退出可靠释放 SDK 会话，流地址不进持久化卡片或敏感调试日志。
- [ ] 两端开发环境真实首帧、失败返回、再打开留证；E02 满足后补客户微信真机与 HTTPS 验证，缺项时票保持待验。
- [ ] 必要测试/类型/构建、微信编译和本票实际操作证据通过；真实接口、模拟器、真机边界分别记录。
- [ ] 必要稳定切片审查、语义提交、plan 交接完成；外部验收未通过不得标整票完成。

## Testing decisions

既有 video-stream 公开 HTTP 扩展两端范围/认证场景；微信验证首次导航和重连路径，真实播放器验证首帧/JS_Stop，不以 HTTP 200 替代画面。

## Out of scope

不新增本票之外的控制、通知、权限或通用平台。未决项只阻塞这里列出的业务行为，不反向阻塞已可开始的历史查询。
