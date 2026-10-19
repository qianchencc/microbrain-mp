# 安全台账详情文案调整

仪表盘燃气、水浸、烟感共用 `pages/agent/components/SafetyEventDetail.vue`：删除“记录名称”字段行，将“记录时间”改为“告警时间”，仍展示 `occurredAt`。

验证：Agent 测试通过；HBuilderX 微信编译成功，产物已核对字段文字。手机页面尚未复验。

未纳入工作区其他并行修改。验证日志：`/tmp/safety-detail-copy-tests-20261019.log`、`/tmp/safety-detail-copy-build-20261019.log`。

## 后续技能

若继续调整文案可使用 better-writing；需复核手机显示时按实际页面验收。
