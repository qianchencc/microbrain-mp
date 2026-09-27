# 区域工作台实施准备交接

日期：2026-09-27。状态：准备核对完成，生产实现尚未开始。本文件记录开工顺序与现场差异；业务规格仍以原规格和 ADR 为准。

## 工作目录与权威入口

- 客户生产小程序：`/Users/qianchen/works/新发展/mp`，分支 `新世纪办公室`，核对基线 `1c84e08`。
- Runtime：`/Users/qianchen/works/新发展/iot-agent-runtime`，分支 `codex/multi-candidate-lighting-draft`，核对基线 `f1e00a6`。不要切到旧 `main`。
- 规格：[region-workbench/spec.md](../.scratch/region-workbench/spec.md)。14 张票据位于同目录 `issues/`；01–13 为 ready-for-agent，14 为 ready-for-human，是否可开工仍取决于 Blocked by。
- 领域：[CONTEXT.md](../CONTEXT.md)、[ADR 0003](../docs/adr/0003-shared-space-automation-boundary.md)、[ADR 0004](../docs/adr/0004-unified-task-model-and-phase-execution.md)。两份 ADR 已接受。
- 设计：[P2 选择记录](../docs/research/proto-region-panel/c1-workbench-exploration.md)、[B6 几何合同](../docs/research/proto-region-panel/b6-timeline-design.md)。两个 HTML 原型保持冻结。

**跨目录读取注意**：规格、票据、CONTEXT.md 与 ADR 被 mp 的 `.git/info/exclude` 忽略，存在于当前工作目录但不在提交内。Runtime 会话应通过上述 mp 绝对路径读取；新 worktree/另一台机器不会自动获得这些文件。此次没有修改排除规则或把它们强制纳入提交。

## 已核实的现场

- 两仓已跟踪文件均无未提交修改。mp 有 6 个旧图像探索文件未跟踪（prompt/brief/correction 与 gen.py），保持原状；不混入业务提交。
- Runtime 仍由 `src/app.ts` 的即时草案确认路由完成读状态、比较、控制和回读。当前没有区域工作台的 Task 持久化、调度和查询实现。
- 客户小程序是唯一新业务落点。同级 `agent-miniapp` 是回归壳，不属于这批票的同步范围。
- 默认终端 Node 为 26.8.1；Runtime 要求 22.x。本机可用 `/opt/homebrew/opt/node@22/bin/node`（22.23.2），执行 Runtime 命令时在当前命令前设置 `PATH=/opt/homebrew/opt/node@22/bin:$PATH`。
- 本轮不重启服务、不读取凭据、不操作真实设备；运行态健康与真实网关有效性没有重新验证。

## 推进建议：保持原票，围绕业务结果收口

| 顺序 | 票据 | 完成后用户能做什么 |
| --- | --- | --- |
| 第一闭环 | 01 → 02 → 03 → 04 | 在 Agent 确认即时操作后，进入所属区域时间轴看见真实操作记录；跨区域操作出现在相关区域 |
| 第二闭环 | 05 → 06 → 07 → 08 → 09 | 查看任务阶段与日期，用 Agent 安排一次性任务，到时执行并查看结果，能从工作台或 Agent 确认取消未来阶段 |
| 补齐工作台 | 10 → 11 → 12 → 13 | 从设备查任务记录、查看异常提示和创建者 |
| 集成验收 | 14 | 在客户小程序和真实设备上验证完整流程 |

这是建议的串行顺序，不改原票依赖。01/02/03 都可开工，但技术票完成不能单独宣称区域业务闭环完成。02 的渲染结论应尽早在微信环境验证，避免到 04 才发现 B6 无法保真；浏览器截图与独立壳构建不能替代该验证。

06 明确只保存任务，07 才执行；两票之间不能对用户发布“已安排即可自动运行”的完整能力。05 在 07 前完成，可提供 07 验收所需的任务抽屉。

## 下一次实施：先恢复测试基线，再进入票 01

Node 22 下当前全量测试退出码为 1：102 项中 80 通过、22 cancelled（fail 计数为 0 不表示成功）。首个取消出现在 `test/adapter.test.ts:306` 的照明超时用例；`test/conversation.test.ts:1775` 的控制超时用例也发生取消并影响后续用例。错误为 `Promise resolution is still pending but the event loop has already resolved`。原因尚未诊断。

在 Runtime 根目录可独立复现，约 0.2 秒退出：

```sh
PATH=/opt/homebrew/opt/node@22/bin:$PATH node_modules/.bin/tsx --test --test-name-pattern='照明控制窗口内无裁决返回 timeout' test/adapter.test.ts
```

先按这条最窄反馈修复已有基线，并恢复 Node 22 全量通过；该修复是票 01 的验收前提，单独记录，不扩成测试设施重写。本轮只确认复现，没有修改 Runtime。修复基线后再执行以下票 01 范围。

执行 `/implement`，输入票据绝对路径：

`/Users/qianchen/works/新发展/mp/.scratch/region-workbench/issues/01-shared-device-execution.md`

工作目录为 Runtime。先重查 Git 状态并记录基线，再从 `src/app.ts` 的 `/api/agent/action-drafts/:id/confirm` 路由与 `src/iot/readback.ts` 进入。

- 范围：抽出当前执行流程，并由确认路由调用；HTTP、事件、审计、回执与幂等行为保持兼容。
- 规模预期：1 个执行模块、确认路由的局部接线、必要的维护/交接记录；主要是迁移已有代码，净新增目标控制在约 100–200 行。此为开工估算，不为满足行数牺牲既有语义；明显超出时先检查是否提前实现了后续 Task 能力。
- 模块应保存足够的执行事实，让路由继续表达空调逐字段部分受理、控制超时、已满足、回读未确认和中断后的逐设备去向。不能把现有丰富回执压成一个结果枚举而丢失信息。
- 预读失败可恢复待确认；开始下发后的异常保持 INTERRUPTED，不允许重试造成门禁重复开门。控制复用已校验目录，保留现有观测能力。
- 现场差异：`app.ts` 当前在控制循环之后才赋值 `commandAtMs`，而注释及票据描述为指令开始时刻。实施时先明确保行为抽取的边界，若修正时点会改变可观察结果，应登记独立修复，不悄悄混入结构抽取。
- 验收：在 Node 22 下跑既有 `npm test`、`npm run typecheck`，按项目要求完成构建和差异检查；不为内部模块补镜像测试。对真实设备的控制不属于票 01 验收。
- 本票完成后单独提交、回填票据与 plan 记录。共享模块与 Task 存储/调度不在同一轮展开。

## 后续票到达时再处理的边界

- 03：关注区域按当前身份/园区保存和核验，换用户或区域失效时不能沿用旧授权上下文；无可用区域时不得凭空选择。
- 04：重复确认不能产生重复即时 Task 记录；补写失败仍按规格保留草案结果并记审计。
- 06/07：配置凭据加密密钥，终态删除托管凭据，执行时重新核验创建者的授权范围。已接受的凭据托管决策继续有效，不重新退回“先等后台服务身份”。
- 08：阶段认领与取消竞态需由公开行为测试覆盖，避免已取消的 pending 阶段继续被认领。
- 02/14：分别保留微信视觉比对和真实设备人工验收证据。当前尚未执行。

## 本轮验证

- 客户小程序 `npm run test:agent`：16/16 通过。
- Runtime Node 22.23.2：`npm run typecheck` 通过；`npm test` 为 80 通过、22 cancelled，退出码 1；最窄用例复现为 1 cancelled、退出码 1。
- 先前在默认 Node 26 误启动的测试未正常结束，已精确停止本轮启动的测试进程；不作为有效基线证据。
- 未重建微信产物，未验证真机或运行中的 3200。

## Suggested skills

- `implement`：按票执行，并遵循它的测试与收口流程。
- `diagnosing-bugs`：先处理上面的既有超时测试取消问题，以已确认复现命令为入口。
- `handoff`：跨 mp/Runtime 目录交接；按项目约定记录于 `plan/`。
- 02/03 等前端票再按实际需要读取设计技能与页面维护说明；本轮没有重新设计原型。
