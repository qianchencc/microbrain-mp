# 05 — 计量点原始历史与 Company 查询

Date: 2026-10-09
Status: ready-for-agent
Blocked by: None (can start immediately)
External/decision gates: None；不依赖 E01 即可忠实展示原始历史，单位未知不输出派生耗电。

规格：[历史观察与双 Agent 视频](../2026-10-09-history-observation-spec.md)。状态是发布时快照，实施进展在本地 tracker 同编号票维护。

## What to build

用户在仪表盘选计量点和日期查看真实历史累计示数，Company 能查询同一窗口并解释采样情况；今日无数据时可主动选择有数据日期。

## Frozen scope

绑定能源 equipmentId、复用本端目录与观察卡，按窗口分页。展示 epf/epz/totalElectric 的原始定义和采样时间，不预建统计仓库，不将旧样本或维修演示替代用户请求。

## Expected code size

Runtime 200–320，mp 200–320 行。 估算只含新增/主要修改的生产逻辑，不含固定倍数的测试或文档，也不是报价。开工先核对现有实现；明显超出应说明原因并缩小本票，禁止顺手扩大为平台。

## Acceptance criteria

- [ ] 指定计量点只返回其范围内采样，记录 ID 与计量点 ID 区分，Office 不开放公司能源查询。
- [ ] 分页/排序/窗口/空数据真实可用，不将 176,179 条全拉到首屏；预算不足说明覆盖。
- [ ] epf/epz/totalElectric 标签不伪称日用电；未知单位/倍率显式保留。
- [ ] 今日无数据显示最近采样时间，只有用户明确切换才显示历史日期，演示不进入 Agent 事实。
- [ ] 真实 2025 年窗口和当前空窗口均留接口、Company 问答、微信选择/返回证据。
- [ ] 必要测试/类型/构建、微信编译和本票实际操作证据通过；真实接口、模拟器、真机边界分别记录。
- [ ] 必要稳定切片审查、语义提交、plan 交接完成；外部验收未通过不得标整票完成。

## Testing decisions

电量历史公开 GET + Company 观察事件/恢复；夹具覆盖不存在/范围外计量点、分页重复、空日期、旧样本和网络失败。

## Out of scope

不新增本票之外的控制、通知、权限或通用平台。未决项只阻塞这里列出的业务行为，不反向阻塞已可开始的历史查询。
