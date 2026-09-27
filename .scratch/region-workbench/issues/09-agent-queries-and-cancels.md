# 09 — Agent 查询与取消任务

**Spec:** `.scratch/region-workbench/spec.md`（“Agent 工具与任务富面”）
**领域:** ADR 0003 第 4 条；ADR 0004 第 5 条
**仓库:** iot-agent-runtime + mp

**What to build:** 用户问“今天会议室有什么安排”，Agent 依据真实任务记录回答；用户说“把 18 点那个取消掉”，Agent 找到任务并在对话中给出一张取消卡片（任务名、时间、将被取消的剩余阶段），用户点确认后才取消，结果与在工作台删除完全一致。

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] Pi 工具 `list_tasks`：按区域与日期查询当前用户可见任务摘要，只读
- [ ] Pi 工具 `propose_task_cancellation`：只能引用可见且未结束的任务；生成 `task.cancellation.proposed` 事件，遵循零滞留与 TTL
- [ ] 确认复用 08 的取消接口与全部校验（权限、版本、已结束）
- [ ] 小程序统一任务卡新增取消提案态；确认后显示已取消
- [ ] 模型不能不经确认取消任务；Runtime 测试覆盖查询、提案、确认、零滞留退役、越权引用被拒
