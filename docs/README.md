# 项目文档入口

更新：2026-09-23

## 当前状态

- 客户小程序根目录是 Agent 唯一生产开发主线；独立回归壳已于 2026-09-24 经 `git subtree split` 迁出为同级独立仓库 `agent-miniapp`（保留完整提交历史），仅用于回归、演示和故障复现。
- 本机只有单一 Runtime 实例：`127.0.0.1:3200` 直连真实客户网关；Iotfake 与 `3201`/`3100` 已于 2026-09-23 退役，不应再有进程监听这些端口。
- 2026-09-23 已完成 `.scratch/customer-agent-migration/issues/03-local-real-gateway-acceptance.md`：唯一 `3200` 真实网关上的只读查询完整收尾，低风险照明操作完成草案→确认→受理→回读闭环，重复 confirm 只回放结果不重复执行（审计仅一次 `ACTION_DRAFT_ACCEPTED`）；票 04 随之关闭，独立 miniapp 正式定位为回归壳。
- 体验版/正式版 HTTPS 网关、稳定用户主体契约、更多设备、记忆、日程、自动化和告警仍未进入完成状态。

## 按任务进入

| 任务 | 权威入口 |
|---|---|
| 客户小程序 Agent 接入、环境路由、当前验收边界 | [客户小程序生产主线](../plan/2026-09-18-customer-miniapp-canonical-agent-migration.md) |
| 登录态、Token、园区和 Agent session | [登录与接入调查](./research/2026-09-18-customer-miniapp-login-and-agent-integration.md) |
| 长期用户隔离、记忆/规则 owner | [真实 MP 身份边界](./research/2026-09-18-real-mp-identity-boundary.md) |
| 设备扩展、自动化、日程/会议、告警和富操作面 | [业务探索地图](./research/2026-09-18-agent-business-opportunity-map.md) |
| 系统对象、会话、持久化、配置、记忆和路线总览 | [Agent 系统全景地图](./research/2026-09-24-agent-system-map.md) |
| 统一任务模型、任务阶段与富面边界 | [统一任务模型 ADR](./adr/0004-unified-task-model-and-phase-execution.md) |
| 区域时间轴原型、区间与时刻的组件设计语言 | [B6 时间轴设计](./research/proto-region-panel/b6-timeline-design.md)（非生产实现） |
| 向客户索取新增设备接口与验收材料 | [设备接入支持包](./research/2026-09-18-customer-device-expansion-support-package.md) 与 [客户请求清单](../plan/2026-09-18-customer-device-support-request.md) |
| 合同范围和业务能力缺口 | [合同能力审查](./research/2026-09-11-contract-device-capability-audit.md) |
| 当前客户 Agent 页面实现约束 | [页面维护说明](../pages/agent/AGENTS.md) |
| 独立回归壳的构建和用途 | 同级仓库 `agent-miniapp`（原 `apps/agent-miniapp`，2026-09-24 迁出）的 README |

## 阅读优先级

1. 代码、配置和可重复测试是当前实现事实。
2. 本入口、当前生产主线计划和目录内 `AGENTS.md` 记录现行决策与维护约束。
3. `docs/research/` 是带日期的调查证据；其中的“当前”只代表成文日期，若与现行入口冲突，以现行入口为准。
4. `plan/002-*` 至 `plan/028-*` 等编号文档是已完成切片、事故或验收的历史记录，不作为当前路线图。已被客户小程序生产主线完整替代的 `plan/001-native-agent-migration.md` 已删除。

## 尚未关闭

- `trial/release` HTTPS、合法域名和 NDJSON 代理验收；
- 客户稳定 `principalId/workspaceId`、Token 刷新/撤销和后台运行契约；
- 客户 AppID 的 `WechatSI` 插件授权；
- 从业务探索地图中选择下一条单业务闭环，再进入规格与实现。
