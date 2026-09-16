# 026 · 模型侧短句柄：去长 ID 寻址

日期：2026-09-16 ｜ 仓库：iot-agent-runtime（e206461 + 62bc83c）

## 本轮闭环

模型不再手抄 32 位设备 id / 36 位候选集 id：检索结果只暴露句柄（候选集 `sN`，设备 `d{N}_{k}`），四个工具（find/inspect/read_states/propose）入参句柄归一为真实 id 后走既有成员校验，出参投影回句柄。句柄随候选集 payload 持久化（`deviceHandles` 数组与 devices 索引对齐，域层 DiscoveredDevice 不动），恢复/重启后保持；旧会话的真实 id 引用继续可用（双轨）。

## 实测（真实网关 superadmin，3201）

- propose 提交 814 → **227 字节（-72%）**，模型正确引用 `s1`/`d1_1~d1_3`；
- 提示词「不得捏造 ID」换为句柄语义表述；find 结果不再含 candidateSetId/snapshotId/真实 id。

## 设计要点（防再踩）

- 句柄存集合级 `deviceHandles[]` 而非设备字段——曾试过设备级 `handle` 字段，8 个内部 deepEqual 测试全破；域对象不动是硬约束。
- `resolveDeviceCandidateSet` 接受句柄或 id（内存匹配 + `json_extract(payload_json,'$.handle')`）；未命中句柄原样返回，交给成员校验按既有语义拒绝。
- 并行会话 9dbc072（断开解耦/超期兜底）自带 6 个测试失败，基线 worktree 验证非句柄引入；其 pi-runner 混参容错 3 行随 62bc83c 一并入库（提交信息已注明）。

## 遗留观察

- 本轮 smoke 无混参（旧基线那次有 closeOrOpen+controlType 混入）；混参容错与句柄正交。
- token 级前后对照（tokenizer 实测）未做——字节级 -72% 已达验收；需要更细数据时按 plan/023 的测量法补。
