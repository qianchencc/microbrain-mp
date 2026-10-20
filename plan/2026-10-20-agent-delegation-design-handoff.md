# 完整业务委托设计接续（2026-10-20）

本轮只核对本地证据、收口设计并更新原地图。按用户授权连续处理常规设计；在真正影响未来控制授权的选择处停止。生产代码、候选分支、服务、真实设备均未改动，没有联网试跑或重跑测试。

## 接续入口

以[原 Wayfinder 地图](../.scratch/agent-redesign-wayfinder/map.md)为索引；[版本证据](../docs/research/2026-10-20-agent-delegation-current-state.md)已更新报告 S2 提交与历史验证状态。决议只保存在各票，本文件不复制详情。

- 已决定：[现状证据基线](../.scratch/agent-redesign-wayfinder/issues/04-current-state-evidence-baseline.md)、[交付与自主推进界限](../.scratch/agent-redesign-wayfinder/issues/05-complete-delegation-outcomes.md)、[Pi 与业务模块职责](../.scratch/agent-redesign-wayfinder/issues/06-business-modules-and-pi-contract.md)。普通选择由用户最新指令授权，不是逐项另获确认。
- 迁移/首条验证已整理在[既有能力保留、候选合流与首条验证选择](../.scratch/agent-redesign-wayfinder/issues/07-migration-and-first-validation.md)；仍开放，只等待关联的重要风险决议，不直接驱动实施。
- 当前用户问题：[控制计划失效后的未来执行与恢复](../.scratch/agent-redesign-wayfinder/issues/08-control-plan-invalidation-and-resumption.md)。推荐明确拒绝/撤权/绑定变化时暂停该控制计划，重新确认后恢复；普通超时不自动等同撤权。尚未收到选择。

## 下一步

1. 收到用户选择后只补风险票 Resolution 与迁移票对应部分，检查地图是否清晰；不重新问已定本次停止、范围来源或技术字段。
2. 地图清晰后沿 `/to-spec` 汇总为一份可构建规格，再按授权范围 `/to-tickets` 拆完整业务切片；不从设计票直接 `/implement`。
3. 首条建议是既有 Company 能耗调查→即时附件→依据/导出/追问；报告候选已经有 S1/S2，仍需自然语言承接与当前主线整合证据。定时日报、周/月、控制管理、告警、有限空调巡检的顺序与边界见迁移票。
4. 控制候选仍有改时重绑、规模限制、兼容/新路径核验标准、旧入口竞争与本次失效偏离；原暂停草案仅作证据，不变成独立总路线。

## 工作区保护

MP 本轮起点 `70386f8`，Runtime 主线 `4ec44dc`；阶段候选 `af06d94`、报告 Runtime `c04ab5d` / MP `8de0a72`。主仓两侧能耗、首页、设备位置等并行 WIP 原样保留，疑似 SQLite 文件未清理。不将这些内容混入本轮文档提交。

真实模型、网关只读、微信/Excel原生打开、活动服务构建、发布和物理控制分别取证。本轮历史日志核查不代表新验收；没有取得候选合并、部署或真实控制的具体授权。

## Suggested skills

- `ask-matt` / `wayfinder`：接收当前风险选择，完成原地图。
- `to-spec`、`to-tickets`：地图清晰后进入构建规格和完整业务票。
- `prototype`：仅当现有附件/详情不能承载具体交互时先验证；不重做外围 UI。
- `implement`：明确业务票进入实施后使用；遵守用户减少频繁双审/测试的要求，在稳定切片验证。
