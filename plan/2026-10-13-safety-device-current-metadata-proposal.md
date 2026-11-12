# 消防设备当前资料与历史记录：旧方案已替代

2026-11-12：本方案由[告警统一智慧消防资料约定](../../iot-agent-backend/docs/adr/0010-safety-event-current-name-historical-playback.md)替代，旧实施指令已移除。

- 告警名称采用智慧消防事件接口同步值；当前名称和安装地址也采用智慧消防目录，不混用物联网引擎。
- 上游历史事件名称会随更名变化，不能把名称或当前安装地址当作事发位置快照。监控仍按事件接口名称查候选，回放取事件时间；不承诺还原历史地点。
- 页面读取与核验仅访问后端本地数据；不新增位置推断或补造快照。客户反馈见[响应说明](../docs/research/2026-11-12-fire-alarm-response-feedback.md)。

原来源调查与当时实施事实保留于[来源诊断](2026-10-13-gas-relocation-source-diagnosis.md)、[历史回传](2026-10-13-safety-device-current-metadata-handoff.md)，仅供追溯，不作为现行实现或验收依据。
