# 09b: 流式消息保留已返回的失败原因

**What to build:** 同一生产报告闭环中，消息在账户核验阶段两次超时后503，JSON错误通过chunk抵达而success.data为空，微信误显示“服务端未返回具体原因”。保留该结构化原因，有限重试失败后如实说明。

**Blocked by:** 08

**Status:** in-progress

范围冻结：仅stream错误体保留/展示，约5–12行源代码、一个分块公开行为回归。不增加POST盲重放、不叠加后端已做的两次账户读取预算，不改变身份核验/控制授权。A13生产失败截图和后端超时诊断保留；代理可从现有意图重试继续业务，但不将这次人工代理点击称为系统自动恢复。

验收：中文JSON分块且success.data为空时显示真实原因/错误码；成功NDJSON终态不受影响；裸代理503仍准确说明无具体原因。公开行为测试先红后绿，双轴窄审，微信编译/实际错误恢复正常路径核对。

实现：tracker保留根JSON错误，stream拒绝时取分块错误体，非事件不送presentation。首次辅助测试被双轴审查指出不能证明真实客户端且presentation会TypeError；已改为真实export streamMessage + wx.request分块 + createPresentation，先红复现startsWith，再绿。161/161、两轴复核无阻断。生产后端预算耗尽不是前端任意重发理由；保持只保留原因。微信dev编译正在补最后一行事件过滤。
