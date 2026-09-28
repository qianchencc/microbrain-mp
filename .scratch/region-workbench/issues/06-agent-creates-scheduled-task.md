# 06 — Agent 创建定时任务

**Spec:** `.scratch/region-workbench/spec.md`（“创建者凭据托管”“Agent 工具与任务富面”）
**领域:** ADR 0004 第 5、6、7、8 条；`CONTEXT.md` 执行身份、任务
**仓库:** iot-agent-runtime + mp

**What to build:** 用户在 Agent 中说“下午两点到三点在会议室B 开会，开始时空调 26 度灯全开，结束时全关”，对话中出现一张任务卡：任务名、时间、阶段、每阶段设备与目标。点“创建任务”后任务被保存为已安排，卡片转为持续显示任务最新状态并提供“在区域面板查看”，区域时间轴上出现对应的点或区间缎带。本票不执行任务（见 07）。

**Blocked by:** 04

**Status:** implemented — pending user miniapp acceptance and trace inspection

- [x] Pi 工具 `propose_task`：名称 ≤12 字、1–2 个阶段、`candidateSetIds` 引用候选集，校验与草案一致（能力已检查、名称位置由目录回填）；拒绝 >2 阶段、首阶段晚于 7 天、未来阶段含门禁、首阶段早于“现在 − 10 分钟”，并给模型可读原因
- [x] 流事件 `task.proposed` 与 `task.resolved` 随 events_json 持久化、恢复重放；零滞留：下一条消息退役待确认任务提案；TTL 与草案一致
- [x] `POST /api/agent/tasks/:id/confirm`（带版本）：置 `scheduled`；首阶段已过去超过 10 分钟返回 409“时间已过，请重新创建”（窗口内立即执行的部分见 07）
- [x] 确认时以 AES-256-GCM 加密托管请求的授权信息与租户；密钥为新运行配置项，缺失时 Runtime 拒绝启动；凭据不出现在响应、事件和日志中
- [x] 小程序统一任务卡富面已接线：提案态（创建任务/放弃）、已确认态（按任务 id 轮询详情直到终态，链接到工作台并带日期）
- [x] 对话事件归约支持 `task.*` 事件并可恢复重放，`node --test` 覆盖
- [x] 即时“关灯”仍走原草案链路，既有测试不回归
- [x] Runtime 公开行为测试覆盖零滞留退役、确认、超窗 409、版本冲突、缺密钥拒绝启动与响应不含凭据；其余拒绝条件由服务端校验，未逐分支建测试矩阵
- [ ] 在实际观测轨迹中核对凭据不出现在 span 属性或事件载荷；不得为核对打印凭据
- [ ] 用户在客户微信小程序验收提案卡、确认、实时状态及工作台跳转

## Comments

2026-09-28：实现与证据见 `plan/2026-09-28-scheduled-task-creation-handoff.md`、Runtime `test/scheduled-task.test.ts` 和 `test/runtime-config.test.ts`。真实设备执行属于票 07/14。凭据持久化与终态删除由票 07 的同一公开流程补充验证；Langfuse 轨迹逐字段不作为本票自动化测试。
