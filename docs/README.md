# 项目文档入口

更新：2026-10-08

## 当前状态

- 2026-10-08 总览改为环境/计量/台账/任务摘要独立返回，Office区域名不等全设备目录，安全台账详情快照可立即引用、发送时后端核验；已修正消防目录`type=FIRE`参数。唯一真实3200已监听局域网，小程序开发包地址同步并重编译；Runtime94/94与MP27/27通过，手机及实际控制待用户验收。见[本轮交接](../plan/2026-10-08-independent-reads-lan-handoff.md)与[真实业务场景](../plan/2026-10-08-real-business-acceptance.md)。

- 2026-10-08 后端配置控制台已合入 Runtime 主仓库（`746fcde`），本机入口 http://127.0.0.1:3200/admin/，已接原真实模型/Langfuse、客户网关与同一任务库。管理员登录、真实模型纯文本测试、网关只读概览和保存后重启生效通过；能耗缓存现为10分钟。见[真实启用交接](../../iot-agent-runtime/plan/2026-10-08-backend-admin-live-handoff.md)。控制台不属于小程序。

- 2026-10-08 用户最终明确页面分层：员工 Agent 走“我的办公室”，大 Agent 走“智慧xx”，不再追问上游权限配置。Company 空调已按智慧空调区域树/设备页确定成员，保留 hub 身份与原 Task/Plan/报告；真实只读返回 49 台，排除底层目录额外 6 台。Runtime84/84与mp27/27通过，详细结果见[来源对齐交接](../plan/2026-10-08-company-smart-ac-source-handoff.md)；安全台账详情/引用已实施并完成真实只读与微信模拟器验收，真机边界见本轮交接。现有任务、页面/Runtime接口和最小客户材料清单见[对齐记录](../plan/2026-10-08-page-interface-task-alignment.md)，Company 来源修正票 17 已实施；完整Company/旧引用GET升级前后503，实际验收待复核，真实控制/真机仍独立验收。

- 2026-10-08 新增遗漏的 Runtime 配置后台任务：已核对环境配置、模块硬编码、管理员边界和生效机制，建议 Runtime 仓库 monorepo + React/Vite/shadcn；该条为首次调查记录；当前已真实启用，范围与源码证据见[审查与交接](../plan/2026-10-08-runtime-admin-dashboard-audit-handoff.md)。此后台与小程序业务仪表盘区分。

- 2026-10-08 安全台账“单条详情→引用到 Company→围绕同一记录回答”已实施；真实网关只读、微信模拟器点击/返回/草稿/引用/重试及故障恢复通过。Runtime 82/82、最后窄修正后安全2/2与类型/构建通过，mp27/27、微信编译通过。实际证据、快照即时显示与独立核验、真机/窄屏/硬超时未验边界见[闭环交接](../plan/2026-10-08-safety-ledger-detail-reference-handoff.md)；范围见[实施计划](../plan/2026-10-08-safety-ledger-detail-reference-plan.md)。

- 2026-10-08 修复切页时提前挂载关闭抽屉，以及总览串行/重复读取；总览改为summary/energy分段展示，其他概览先返回，慢电表独立等待。测量、回归和实际微信操作见[页面性能交接](../plan/2026-10-08-navigation-performance-handoff.md)。电表上游仍偏慢，页面出现与数据返回分别验收。

- 2026-10-07 本批已实现双端常规任务收件箱、我的安排、Task/Plan身份引用与确认式修改/周期启停/跳过/删除、Company空调定时/周期与只读简报、仪表盘真实自动化摘要。Runtime78/78、合并导航后前端27/27、类型/构建、微信编译通过；真实3200已完成Company只读任务→引用修改→后台报告→结束消息；微信实际验证报告、返回、已读及引用追问，修正列表隐藏和引用名称问题。[页面证据](research/business-completion-acceptance/README.md)与[业务补齐交接](../plan/2026-10-07-business-completion-handoff.md)记录完成项和验收边界。完整电量历史统计等待客户正式接口契约，不能从瞬时功率伪造kWh。整体导航独立推进，下列条目保留当时状态。

- 2026-10-07 Office 周期计划首条源码闭环已实施：每天/周一至周五/指定周几，确认后长期计划、未来发生投影、到点独立 Task 执行/报告、下一次与恢复。Runtime 69/69、前端 22/22、类型/构建及微信编译通过；微信模拟器隔离夹具走查，真实模型/设备/真机尚未验。编辑/启停/跳过/删除、Company 自动化与收件箱仍后续。见[本轮交接](../plan/2026-10-07-office-recurring-first-loop-handoff.md)。下列日期条目保留历史状态。

- 2026-10-04 站内收件箱方向已认可：首期统一通知记录＋站内收件箱返回原报告，双端差异与业务协调计划已整理（accepted 与建议分层），功能未实施；外部告警推送/复杂外部集成 deferred 且不阻塞站内。见[核心规格](../plan/2026-10-02-dual-agent-automation-spec.md)与[任务总表](../plan/2026-09-30-agent-task-register.md)。

- 2026-10-04 Office 一次性独立区间 MVP 源码已实施：`interval` 独立起止＋至少一个自由检查点，正常扫描先执行到期检查点再在终点收口报告，最后检查点提前完成不提前终态、不自动生成终点动作。Runtime 初版 66/66、审查修正后窄回归 13/13＋typecheck/build，前端 21/21，HBuilder 微信编译通过；微信模拟器 18 张截图覆盖提案三检查点、区间进行中/设备执行中、详情检查点与执行报告、设备抽屉。创建/放弃点击、sheet 内滚动、设备时间轴深入、320/375 宽度、真机与真实设备均未验，蓝牙权限弹窗遮挡部分截图；联调为临时 `wx.request` mock 夹具（已恢复），本地 3200 未启动。见[任务总表最新回传](../plan/2026-09-30-agent-task-register.md)。

- 2026-10-04 客户告警跳转后的Company引用与对话继续已接通：保留草稿、不自动发送、可移除、原轮恢复/重试引用固定；Runtime62/62、前端19/19、构建及微信夹具交互通过。正式客户回调与真机仍待对接，未开发告警发送/处置平台。见[引用闭环交接](../plan/2026-10-04-customer-alert-reference-handoff.md)。

- 2026-10-04 Company 智慧空调即时操作源码已接通：独立微脑目录/状态、既有草案确认与回读、同源恢复；Runtime61/61、前端18/18、类型/构建及微信编译通过。微信夹具已验证选择、确认和返回恢复，长按参数编辑/真机/真实设备下发待验；共同周期自动化仍未完成。见[Company空调接线](../plan/2026-10-04-company-ac-frontend-handoff.md)。

- 2026-10-04 用户明确当前推进目的为领导展示型项目：A 仪表盘展示质量、Company 已知“智慧”接口与正常自动化业务优先；专门治理、客户办公室入口、正式部署/H5 后置。告警只负责客户跳转后的引用和对话继续。见[当前目的与缺口交接](../plan/2026-10-04-demonstration-delivery-handoff.md)，旧地图中的全局阻塞/治理优先表述不再适用，后置能力没有被记为完成。

- 2026-10-04 A 原生仪表盘首条闭环已实现：物联助手菜单进入公司观察概览，维修演示与真实最新计量读数分开，Company/Office 两入口沿既有会话机制返回。Runtime 60/60、前端 18/18、微信编译通过；一次真实只读接口取得环境 1 / 电表 43 / 安全 3。Runtime `fde5a4c`、mp `0d5c1d9` 已提交，唯一 3200 已按真实网关规范启动；真实数据已在微信模拟器展示、Office 原生菜单返回已补验。操作证据及剩余状态见[首屏交接](../plan/2026-10-04-dashboard-first-loop-handoff.md)。完整统计、任务摘要、Company 控制和周期自动化仍未完成。

- 2026-10-02 客户新增“仪表盘 + 公司大 Agent + 办公室物联 Agent”要求，用户基本认可模块首屏及共用自动化规则方向；两端范围分别由微脑/办公室上游提供。办公室目录合并账号级环境/消防/能耗及告警绕过的错误已完成窄范围源码修复，见[任务总表最新转向](../plan/2026-09-30-agent-task-register.md)和[Runtime 来源纠正](../../iot-agent-runtime/plan/2026-10-02-office-source-boundary-correction.md)。Company 已知只读对话已实施（Runtime `ddb0d5f`），微脑环境/能耗/安全台账与 Office 固定来源分开，见[票 02 交接](../plan/2026-10-03-company-readonly-handoff.md)。仪表盘最新实施状态见上行；周期自动化与未核验公司能力仍未实施；源码回归及协议夹具页面验证不等于客户运行服务或真机验收。

- 客户小程序根目录是 Agent 唯一生产开发主线；独立回归壳已于 2026-09-24 经 `git subtree split` 迁出为同级独立仓库 `agent-miniapp`（保留完整提交历史），仅用于回归、演示和故障复现。
- 本地 Runtime 运行规范为唯一 `3200` 直连真实客户网关；2026-10-02 本轮检查该端口未监听，没有新启动真实扫描。Iotfake 与 `3201`/`3100` 已于 2026-09-23 退役，不应再有进程监听这些端口。
- 2026-09-23 已完成 `.scratch/customer-agent-migration/issues/03-local-real-gateway-acceptance.md`：唯一 `3200` 真实网关上的只读查询完整收尾，低风险照明操作完成草案→确认→受理→回读闭环，重复 confirm 只回放结果不重复执行（审计仅一次 `ACTION_DRAFT_ACCEPTED`）；票 04 随之关闭，独立 miniapp 正式定位为回归壳。
- 一次性 Task 已具备本地代码闭环；体验版/正式版 HTTPS 网关、更多设备、记忆、重复计划和告警仍未进入完成状态。账户来源 `account/me.id` 已核验；“Token 频繁过期”是用户纠正的误记录，不再列作自动化前置阻塞。

- 2026-10-02 用户基本认可仪表盘 A，并指定 `pages/agent/proto-observation-surface.html` 为前端重要参考。业务范围、验收与长期推进纪律见[完整业务交付交接](../plan/2026-10-02-full-business-completion-handoff.md)；Office 历史恢复与 Company 只读对话已完成源码实施；按票长期推进中；10-04 本地真实网关服务已启动，正式部署仍后置。

## 按任务进入

| 任务 | 权威入口 |
|---|---|
| 从接口区分员工 Agent、公司 Agent 与仪表盘：范围、控制引用、空间和统计口径 | [10-08 真实接口盘点](./research/2026-10-08-interface-source-boundary-audit.md)与[当前任务/页面对齐](../plan/2026-10-08-page-interface-task-alignment.md)（按用户确定的“我的办公室/智慧xx”页面分层；Company 来源偏差属我方接线，权限机制不再列为客户疑问） |
| 物联助手全部页面、抽屉、浮层与前进/返回/关闭/手势的检查 | [10-07 导航检查](../plan/2026-10-07-page-navigation-audit.md)、[设计对照图](./research/assistant-navigation-review/index.html)与[导航改进交接](../plan/2026-10-07-assistant-navigation-improvement-handoff.md)、[改进后画面](./research/assistant-navigation-review/after/index.html)（29 类入口、25 项检查；导航改进已实施，模拟器夹具走查；真机手势/H5/生产延迟仍待验） |
| 客户四项历史接口、智慧监控区域定位、人员回放分析及告警/任务收件箱边界 | [10-07 复核与交接](../plan/2026-10-07-history-interfaces-alert-inbox-handoff.md)（真实只读定位验证；人员统计由我方后端分析回放；收件箱仅任务结束消息） |
| 模型缓存的应用恢复、压缩与真实用量 | [10-03 恢复/压缩核验](./research/2026-10-03-model-cache-recovery-compaction-verification.md)（局部诊断通过，跨进程/生产/Langfuse 落库仍未验；无生产代码改动） |
| 双 Agent 新规格与实施切片审阅 | [核心规格](../plan/2026-10-02-dual-agent-automation-spec.md)、[16 切片图](../plan/2026-10-02-dual-agent-automation-ticket-review.md)（核心与拆分已认可，tracker 已发布；票 01 已提交 `cb2a18c`，真实升级待验收；票 02 Runtime `ddb0d5f`、59/59，前端与联调见票 02 交接；局部决定/外部依赖保留） |
| 长期推进的理想成品、设计依据、全部待办关闭标准与外部阻塞 | [完整业务交付交接](../plan/2026-10-02-full-business-completion-handoff.md)（A 方向与核心 spec/切片已认可；局部决定及外部依赖保留） |
| 仪表盘、双 Agent、自动化、通知、能耗与告警、模型缓存：全部已知待办、依赖缺口与 UI 定稿状态 | [任务总表](../plan/2026-09-30-agent-task-register.md)（含最新完整度核对、批准规格和逐票实施状态） |
| 任务前台简化、交给 Agent 与引用到输入框：最终体验及剩余依赖 | [10-02 接手复核与体验基准](../plan/2026-10-02-agent-task-management-handoff.md)（方向已认可，最新场景原型见下行，非生产实现） |
| 双 Agent 真实业务情境：仪表盘、任务引用、来源拒绝、告警、报告与通知返回 | [11 场景原型交接/回传](../plan/2026-10-02-dual-agent-scenario-prototype-handoff.md)（独立 HTML 内存演练，A 方向已认可，非生产实现） |
| 已认可的周期计划/独立区间方向与原型验证 | [ADR 0005](./adr/0005-recurring-plans-and-independent-task-intervals.md)、[原型交接](../plan/2026-09-30-recurring-prototype-handoff.md)与[原型回传](../plan/2026-09-30-recurring-prototype-return.md)（旧前台编辑原型为历史证据，现行交互以 10-02 简化方向为准） |
| 客户小程序 Agent 接入、环境路由、当前验收边界 | [客户小程序生产主线](../plan/2026-09-18-customer-miniapp-canonical-agent-migration.md) |
| 登录态、Token、园区和 Agent session | [登录与接入调查](./research/2026-09-18-customer-miniapp-login-and-agent-integration.md) |
| 长期用户隔离、记忆/规则 owner | [真实 MP 身份边界](./research/2026-09-18-real-mp-identity-boundary.md)与[09-30 主体只读核验](./research/2026-09-30-recurring-principal-readonly-verification.md)（账户来源已核验，归属键接入未实施；不再以 Token 生命周期阻断） |
| 自动化结束通知：订阅规则、可信接收人、发送链路与客户缺项 | [09-30 通知接线核对](./research/2026-09-30-task-completion-notification-integration.md)（事实调查已完成，功能未实施） |
| 设备扩展、自动化、日程/会议、告警和富操作面 | [业务探索地图](./research/2026-09-18-agent-business-opportunity-map.md) |
| 系统对象、会话、持久化、配置、记忆和路线总览 | [Agent 系统全景地图](./research/2026-09-24-agent-system-map.md) |
| 区域工作台实施顺序、精简测试基线与下一张票 | [首条闭环交接](../plan/2026-09-27-region-workbench-first-loop-handoff.md)与[冻结规格](../.scratch/region-workbench/spec.md) |
| 统一任务模型、任务阶段与富面边界 | [统一任务模型 ADR](./adr/0004-unified-task-model-and-phase-execution.md) |
| 照明任务已受理但未核验的状态与现态展示 | [照明任务未核验交接](../plan/2026-09-28-lighting-task-unconfirmed-handoff.md) |
| 设备现态刷新与草案/任务执行结果分离 | [现态与结果交接](../plan/2026-09-28-device-state-receipt-separation.md) |
| 区域时间轴原型、区间与时刻的组件设计语言 | [B6 时间轴设计](./research/proto-region-panel/b6-timeline-design.md)（非生产实现） |
| 自动化设计盘点、区域工作台入口/区域切换/任务卡/设备时间轴/日历/通知探索 | [C1 区域工作台探索](./research/proto-region-panel/c1-workbench-exploration.md)（含待拍板决策，非生产实现） |
| 摄像头与环境/消防/能耗传感器接入设计、业务场景 | [摄像头与传感器接入方案](./research/2026-09-28-camera-and-sensor-integration.md)（2026-09-28 P1 只读能力+取流端点已实施；自建 H5 播放页已端到端实测可播，生产页面与响应卡片待建） |
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
- 我方服务端接入现有账户 ID 与旧 owner 兼容；通知的可信账户→openid 映射仍待接线，Token 刷新不再作为本轮客户前置要求；
- 客户 AppID 的 `WechatSI` 插件授权；
- 区域工作台票 01–13 的代码闭环已推进，票 02 的 P2/B6 视觉保真和票 04 的真实设备记录仍待用户在小程序验收；开发版本地演示记录不算真实任务证据。票 14 的真实网关最终验收仍待推进。各闭环记录见 `plan/2026-09-27-*` 与 `plan/2026-09-28-*`。
