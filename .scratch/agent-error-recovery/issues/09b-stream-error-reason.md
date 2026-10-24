# 09b: 流式消息保留已返回的失败原因

**What to build:** 同一生产报告闭环中，消息在账户核验阶段两次超时后503，JSON错误通过chunk抵达而success.data为空，微信误显示“服务端未返回具体原因”。保留该结构化原因，有限重试失败后如实说明。

**Blocked by:** 08

**Status:** implemented-and-verified

范围冻结：仅stream错误体保留/展示，约5–12行源代码、一个分块公开行为回归。不增加POST盲重放、不叠加后端已做的两次账户读取预算，不改变身份核验/控制授权。A13生产失败截图和后端超时诊断保留；代理可从现有意图重试继续业务，但不将这次人工代理点击称为系统自动恢复。

验收：中文JSON分块且success.data为空时显示真实原因/错误码；成功NDJSON终态不受影响；裸代理503仍准确说明无具体原因。公开行为测试先红后绿，双轴窄审，微信编译/实际错误恢复正常路径核对。

实现：tracker保留根JSON错误，stream拒绝时取分块错误体，非事件不送presentation。首次辅助测试被双轴审查指出不能证明真实客户端且presentation会TypeError；已改为真实export streamMessage + wx.request分块 + createPresentation，先红复现startsWith，再绿。161/161、两轴复核无阻断。生产后端预算耗尽不是前端任意重发理由；保持只保留原因。微信dev编译正在补最后一行事件过滤。

补充最终字符串响应走同一publish过滤：分块/ArrayBuffer/字符串503均经真实客户端+presentation，保留原因且每种仅一请求。字符串分支先红后绿，161/161与双轴复核通过。此为同票错误契约的收口。

微信开发/production编译均成功。当前实际UI第四项创建/改名已确认（正常消息路径）；09c同一生产第三项completed报告实际重开，期间显示为2024-06-01→07-01，安全截图production-report-completed-shanghai.jpg。工程与真实证据分别见验收状态，不把错误变体测试当真机。

当前证据索引：[验收状态](../../../plan/2026-10-24-agent-error-recovery-acceptance-status.md)。本票工程/隔离场景已核对；整组A13、真机/新物理控制及清理由09统一收口，未验项不随本票状态消失。
