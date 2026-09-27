# 01 — Runtime：抽出共享的设备执行模块

**Spec:** `.scratch/region-workbench/spec.md`（“Runtime：设备执行模块”）
**仓库:** iot-agent-runtime

**What to build:** 预重构，用户可见行为不变。把即时草案确认路由中“按目标读状态 → 比较 → 只对未达标设备下发 → 回读 → 逐设备回执”的过程抽成一个独立模块，让后续的任务阶段执行可以复用同一条执行路径。模块接收调用身份、已校验目录快照、设备目标列表和中止信号，返回逐设备结果：`satisfied`、`verified`、`unconfirmed`、`rejected`、`unknown`、`not_dispatched`、`unreadable`、`missing`。确认路由改为调用该模块，并把结果映射回现有草案回执。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 确认路由通过新模块完成执行，HTTP 响应、流事件、审计与回执形状不变
- [ ] 保留全部既有语义：控制复用已校验目录不二次加载；回读只认晚于指令开始时刻的上报；门禁非幂等；抛出时区分已记账、在途未知与未下发（INTERRUPTED 语义不变）
- [ ] 模块不依赖 Fastify、数据库或会话状态，只依赖物联适配器
- [ ] 现有全量测试（`npm test`）与 `npm run typecheck` 通过，不为模块新增内部测试
- [ ] 提交前 `git branch -v` 确认落在 codex 主线

## Comments

- 2026-09-27：已按用户要求精简测试，Runtime 基线 `e002202`（Node 22，27/27、typecheck/build 通过）。以现有控制用例保护抽取，不恢复已删除的内部/重复测试。取舍与夹具说明见 Runtime `plan/2026-09-27-test-pruning.md`；开工范围见 mp `plan/2026-09-27-region-workbench-readiness-handoff.md`。本票尚未实施。
