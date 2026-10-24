# 智能体错误恢复：准备完成与执行交接

日期：2026-10-24。状态：规格与票据 ready-for-agent；业务修复、发布、真实验收尚未执行。

## 用户目标与当前结果

用户要求把“错误直接抛给用户”改为系统先恢复：工具可修正错误让模型继续，基础设施瞬时问题由程序恢复，卡片失败承接原委托；最终实施代理自行完成真实业务验收。此次明确要求先准备所有后续方案与票据，因此本轮只改研究/计划文档，没有修改 Runtime 或 MP 业务源码、调用真实控制或部署。

已完成入口：

- [规格](../.scratch/agent-error-recovery/spec.md)：冻结范围、22 条用户故事、错误责任、确认/幂等、状态和预算。
- [执行地图](../.scratch/agent-error-recovery/execution.md)：九票、阻塞、代码量预算、基线与源码导航。
- [验收方案](../.scratch/agent-error-recovery/acceptance.md)：A01–A13（含 A09a）、真实模型/网关、前端、墙钟到期、证据/清理。
- [当前调查](../docs/research/2026-10-24-agent-error-recovery-audit.md)与[社区一手来源](../docs/research/2026-10-24-agent-error-recovery-primary-sources.md)。调查已提交 `167228e`，计划另一个文档提交；最终以 git log 实测为准。

## 下一步

从 [01：任务确认恢复](../.scratch/agent-error-recovery/issues/01-task-confirmation-recovery.md) 开始；独立可开工的 [02：只读恢复](../.scratch/agent-error-recovery/issues/02-read-tool-recovery.md) 也已准备，但默认不并改共享 runner。按执行地图单闭环推进，每票从当前仓库定位实际实现，不能依据旧行号机械补丁。

两仓绝对路径：

- MP：`/Users/qianchen/works/新发展/mp`，准备前 `c79d558`，调查提交 `167228e`。
- Runtime：`/Users/qianchen/works/新发展/iot-agent-runtime`，准备时 `fix/session-writer-lease-recovery` 已到 `3a1a0d8`；另一会话正在完成 AC 提示/窗口排程，不能覆盖或把其未验改动混入错误恢复。

开始每票重读 status/log/diff 和适用 AGENTS。Runtime 未跟踪的 `:memory:.sessions` 等不属于本轮，不删除或提交；MP 本功能 `.scratch` 文档虽然被忽略，属于正式交付，使用精确目录 force-add。

## 已确认的设计陷阱

普通工具异常已由 Pi core 变为模型可见结果；缺口是宿主提前终止及模型循环外的失败承接。修复不能只加提示词。已有 writer lease 恢复和断流轮询应保留。时间/设备/作用域实质变化需新确认，写结果未知先查回执。生产报告必须实际到期，模拟时钟只证明工程路径。

执行代理自行操作现有账号、前端、临时只读任务与报告验证，不能把“用户自行验收”作为关闭方式。新的真实物理控制需已有明确测试对象授权；当前材料没有指定，按验收方案的证据与授权边界处理，不虚报物理效果。

## Suggested skills

- `implement`、`tdd`：逐票完成公开行为闭环；调用前阅读技能，服从本项目的范围、最窄公开接口及必要审查频率。
- `langfuse`：需要真实模型轨迹/评估时使用；先读文档，注意本项目观测读接口的不完整性，原始运行事件交叉核对。
- `ego-browser` / `agent-browser`：根据可用运行环境操作真实前端；不能把普通浏览器当微信真机。
- `better-interface`：当票有 UI 改动时核对恢复进度、错误/结果层次及可操作性。
- `handoff`：每个业务闭环在 plan 留短交接，引用规格/票据/证据，不复制整份方案。

## 完成判据

本次准备完成不代表任何修复已上线。最终只有九票的必要行为与真实证据齐全、报告通知闭环生产实测、临时资源清理并有版本化交接，才算用户目标完成。缺设备、权限或现场证据时记录具体未验项，继续所有不依赖它的工作；不能将测试通过、接口 200、模型承诺或模拟执行写成真实验收通过。
