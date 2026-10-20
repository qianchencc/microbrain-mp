# 完整业务委托设计接续（2026-10-20）

本轮按用户授权收口常规设计；用户现已选择 A，并新增周期计划启用开关及自动停用通知。地图已闭合并转正式规格/切片；独立分支已有内存交互原型。生产代码、候选分支、服务和真实设备均未改动，没有联网试跑或重跑业务测试。

## 接续入口

以[原 Wayfinder 地图](../.scratch/agent-redesign-wayfinder/map.md)为索引；[版本证据](../docs/research/2026-10-20-agent-delegation-current-state.md)已更新报告 S2 提交与历史验证状态。决议只保存在各票，本文件不复制详情。

- 已决定：[现状证据基线](../.scratch/agent-redesign-wayfinder/issues/04-current-state-evidence-baseline.md)、[交付与自主推进界限](../.scratch/agent-redesign-wayfinder/issues/05-complete-delegation-outcomes.md)、[Pi 与业务模块职责](../.scratch/agent-redesign-wayfinder/issues/06-business-modules-and-pi-contract.md)。普通选择由用户最新指令授权，不是逐项另获确认。
- 迁移/首条验证已在[既有能力保留、候选合流与首条验证选择](../.scratch/agent-redesign-wayfinder/issues/07-migration-and-first-validation.md)收口，进入[正式实施规格](../.scratch/agent-delegation/spec.md)和其 issues/ 下完整业务切片；不是放行现有候选。
- 用户已决定：[控制计划失效后的未来执行与恢复](../.scratch/agent-redesign-wayfinder/issues/08-control-plan-invalidation-and-resumption.md)选 A；周期计划开关采用已启用/未启用，系统失效停用通过现有站内任务通知说明。全部撤权仍须允许已认证创建者读取最小停用通知，设备明细不越权。

## 下一步

1. 从[能耗调查到即时报告切片](../.scratch/agent-delegation/issues/01-energy-investigation-report.md)进入独立实施会话；复用报告 S1/S2 候选，完整结果/缺数与源语义分别验证，不等待控制候选上线。
2. 周期开关和自动停用必须按[同一完整业务切片](../.scratch/agent-delegation/issues/05-recurring-enable-notification.md)接通，不能只画开关。复杂控制的保快照改时与本次失效规则是真实前置；日报/月报/告警/有限空调检查各自按依赖推进。
3. 原控制暂停草案仍仅作局部证据；生产/真机/实际控制另行具体授权和验收。常规设计、模块字段及切片粒度已由用户授权自行处理，不重新索取逐项流程确认。

## 周期开关原型回传

- 分支 `prototype/recurring-enable-state`，提交 `c4e0e91`，独立 worktree `/Users/qianchen/works/新发展/mp-recurring-enable-prototype`。
- 可直接打开 [状态原型](../../mp-recurring-enable-prototype/pages/agent/proto-recurring-enable.html)，不需服务。只使用内存样例，没有真实控制或通知。
- 引导场景：手动关闭而本次继续；明确撤权后本次后续停止、在途收口生成一条通知、重扫不重复；权限恢复后确认启用且不补旧点；取消/启用请求失败保持关闭。
- Node 22 内联脚本语法通过。浏览器实际指针走查通过前两类；恢复/失败通过页面按钮事件完成，显示预期状态。移动视口截图超时、后续指针定位也失败，已恢复普通视口；不声称视觉保真、原生/真机或完整移动点击验收。
- 原型页已交给用户在浏览器查看，自动检查不等于用户体验确认。原型留独立分支，未合入生产路由。没有启用或清理其它服务。

## 工作区保护

MP 本轮起点 `70386f8`，Runtime 主线 `4ec44dc`；阶段候选 `af06d94`、报告 Runtime `c04ab5d` / MP `8de0a72`。主仓两侧能耗、首页、设备位置等并行 WIP 原样保留，疑似 SQLite 文件未清理。不将这些内容混入本轮文档提交。

真实模型、网关只读、微信/Excel原生打开、活动服务构建、发布和物理控制分别取证。本轮历史日志核查不代表新验收；没有取得候选合并、部署或真实控制的具体授权。

## Suggested skills

- `ask-matt`：地图已清晰，沿正式规格进入下一条完整业务切片。
- `to-spec`、`to-tickets`：本轮已完成合成，只有范围变化才修订，不重写同一组文档。
- `prototype`：仅当现有附件/详情不能承载具体交互时先验证；不重做外围 UI。
- `implement`：明确业务票进入实施后使用；遵守用户减少频繁双审/测试的要求，在稳定切片验证。
