# 双 Agent 接口区分交接

2026-10-08。完成：真实只读接口数据、设备/控制/provider 引用、两端最终目录与仪表盘口径已核对；没有生产代码变更。

权威证据与理想接线表见 [接口层复核](../docs/research/2026-10-08-interface-source-boundary-audit.md)。其中区分当前事实与接线建议，具体请求、数量、映射示例及限制只在该文维护。

延续 [09-17 范围裁定](027-office-association-scope-ruling.md) 与 [双 Agent 来源 ADR](../docs/adr/0006-dual-agent-sources-and-history-boundary.md)：原始三类关联分页只作为 Office 控制引用对照；它们不能定义员工目录。上一轮把这三类接口描述成员工范围来源的措辞已纠正，实际代码过滤没有被回退。

下一步使用本报告核对接口接线与展示口径，优先考虑已有 Company 监控材料和感知位置字段兼容；业务改动在对应切片冻结后实施。客户四项历史接口仍待正式文档，人员统计由我方分析回放；告警与任务收件箱边界沿 [10-07 交接](2026-10-07-history-interfaces-alert-inbox-handoff.md)。本报告没有把未实现的监控、统计或人员分析记为完成。

建议 skills：继续梳理使用 `ask-matt`；记录新术语/不可逆决定使用 `domain-modeling`（本仓库领域入口为 `CONTEXT.md`）；明确业务切片后使用 `implement`。交接阶段用 `handoff`，按本项目要求将交接保存在 `plan/`。
