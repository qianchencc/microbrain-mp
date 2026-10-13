# 最终答复通道回传

2026-10-13。用户确认全场景不显示思考，保留“处理记录”。Runtime实现 b40da78、部署记录503bdaa，唯一3200已受控更新，GLM-5.3-Flash/真实网关/原数据库与配置v2保持。

模型普通text与thinking不进入公开正文；普通答复、澄清、任务与报告解读、执行总结通过reply_to_user.answer提交，即时草案由服务器按真实卡片回执。真实业务工具开始/进度/完成/失败仍显示，答复工具不成为处理记录。没有有效答复明确失败，不回退到普通模型文本。

旧自由文本公开恢复显示重新提问提示，卡片与处理记录保留，原库证据不改写；旧总结可显式重试。上线后Company/Office current均200，Office仍保留2草案、2任务、26条处理事件。

完整回归148/148，类型/构建与两轴审查通过。真实模型+客户只读目录验证问候、原照明/空调25度混合请求、环境历史、次日19点任务；真实模型另解读既有执行回执。五类均完成，零新物理控制，任务不确认。prompt-only问候失败及兼容网关required对照保留；环境原始SSE89字native reasoning未公开。审查发现的同批“先答复后业务调用”已修为失败，避免无卡片却宣称操作已准备。

结构通道隔离原始规划，不把answer字段的任意语义正确性称为已证明，也不把本次限定闭环称为全Agent可靠性/普遍提速验收。微信真机须由用户重试核对；小程序事件类型保持兼容，本批无需改前端源码。

入口：[规格](../../iot-agent-runtime/plan/2026-10-13-final-answer-channel-spec.md)、[Runtime交接](../../iot-agent-runtime/plan/2026-10-13-final-answer-channel-handoff.md)、[真实验证](../../iot-agent-runtime/docs/research/reply-boundary/final-answer-verification.json)、[部署证据](../../iot-agent-runtime/docs/research/reply-boundary/final-answer-deployment.json)。并行能耗/任务及小程序UI修改未混入本批。
