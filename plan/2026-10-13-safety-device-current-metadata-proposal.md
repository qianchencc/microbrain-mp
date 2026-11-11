# 消防设备当前资料与历史记录：旧方案已替代

2026-11-11：本方案已由[告警事件与当前设备资料约定](../../iot-agent-backend/docs/adr/0010-safety-event-current-name-historical-playback.md)替代，旧实施指令已移除。

- 告警标题和监控地点检索使用上游原事件记录；回放使用原告警时间。
- 当前设备名称、位置通过设备身份关联后端本地目录，独立展示；不覆盖事件，不参与历史事件监控定位。
- 页面读取与核验不访问上游，不要求逐事件保存摄像头快照才能查找监控。

原来源调查与当时实施事实保留于[来源诊断](2026-10-13-gas-relocation-source-diagnosis.md)、[历史回传](2026-10-13-safety-device-current-metadata-handoff.md)，仅供追溯，不作为现行实现或验收依据。
