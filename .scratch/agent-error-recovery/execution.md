# 错误恢复执行地图

Status: in-progress
更新：2026-10-24。规格为 [spec.md](spec.md)，验收规则为 [acceptance.md](acceptance.md)。本文件记录推进次序与源码导航，业务规则以规格为准。

## 开工基线

- MP 绝对路径：`/Users/qianchen/works/新发展/mp`；准备前 HEAD `c79d558`，调查提交 `167228e`。
- Runtime 绝对路径：`/Users/qianchen/works/新发展/iot-agent-runtime`；调查基线 `e0c76e3`，准备时已前进到 `3a1a0d8`。其他会话正在改空调提示/排程，不能把调查行号或这个 HEAD 当作未来发布版本。
- MP `.scratch/` 默认忽略，票据属于本轮正式交付，提交时仅对本功能目录显式 force-add；不加入其他临时目录。
- Runtime 既有未跟踪 `.scratch/agent-location-groups/`、`:memory:.sessions`、`apps/runtime/:memory:.sessions` 均不属于本轮。未提交源码/已暂存内容先确认来源，不纳入本票。
- 每票开工重读两仓 status/log/diff、适用 AGENTS 和 docs 入口；若共享 runner/确认路由正在被其他会话修改，等待释放或使用明确来源的独立 worktree，再按单向来源集成。

## 顺序与阻塞

| 票 | 完整业务交付 | Blocked by | 预计新增/修改业务代码行数 |
|---|---|---|---|
| [01](issues/01-task-confirmation-recovery.md) | 确认创建失败后同会话核实、恢复或重建待确认任务 | None | 180–320 |
| [02](issues/02-read-tool-recovery.md) | 只读工具瞬时失败自行恢复并取得结果 | None | 80–160 |
| [03](issues/03-proposal-parameter-repair.md) | 普通任务/即时草案参数多步修正后出卡 | 02 | 60–140 |
| [04](issues/04-compound-proposal-recovery.md) | 夜间收口和分阶段提案失败后继续完成原方案 | 03 | 80–160 |
| [05](issues/05-energy-result-completion.md) | 能耗准备中及解读失败后交付已有/最终成果 | 02 | 100–180 |
| [06](issues/06-task-management-recovery.md) | 修改/取消/周期启停的卡片失败按原意图收口 | 01 | 100–200 |
| [07](issues/07-immediate-execution-reconciliation.md) | 即时控制确认断流或未知结果后核实原操作 | 01, 02 | 120–240 |
| [08](issues/08-conversation-runtime-recovery.md) | 目录/模型故障后继续同一对话且停止/重开一致 | 01, 02 | 100–200 |
| [09](issues/09-scheduled-report-and-production-closure.md) | 已确认只读任务实际到期，恢复读失败并交付报告通知；生产整体闭环 | 01–08 | 80–180 |

这是范围预算，非硬配额；合计约 900–1,800 行业务改动，另估 500–900 行行为测试。允许复用后明显减少。某票预估超过上界约 50% 时，先检查是否引入通用框架或混入其他业务，把超出工作拆为同目标子票并更新依赖；常规选择由执行代理自行决定。

推荐单线程次序：01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09。01/02 无语义依赖，但都会触及共享运行路径，本项目默认不同时修改。每张票包含源码、UI、行为验证、真实轨迹、交接和语义提交，不拆出独立测试/视觉主线。

## 源码导航（开工重新定位）

| 业务 | Runtime | MP |
|---|---|---|
| 工具反馈/守卫/专用提案 | `apps/runtime/src/agent/pi-runner.ts`，Pi core 安装版本源码只用于理解 | 对话事件消费 `pages/agent/conversation.mjs`、`components/ToolActivity.vue` |
| 对话启动、确认、持久化与总结 | `apps/runtime/src/app.ts`、`business-error.ts`、`agent/model-timing.ts` | `components/AgentConversation.vue`、`apis/agent/request.mjs`、`index.js`、`ndjson.mjs` |
| Task/Plan 创建和管理 | `apps/runtime/src/tasks/store.ts`、`plans.ts`、`routes.ts` | `TaskProposalCard.vue`、`TaskDetailContent.vue`、`TaskListSheet.vue` |
| 即时控制/回执 | `apps/runtime/src/iot/execute-devices.ts`、确认路由 | `ActionPanel.vue`、`DraftSheetLayer.vue`、`AgentReplySurface.vue` |
| 能耗结果/定时简报 | `apps/runtime/src/energy/`、`app.ts` 的扫描与检查点执行 | 报告卡、任务详情、`TaskInboxContent.vue` |

MP 组件路径相对 `pages/agent/components/`。测试入口从两仓 package scripts 与 `test/` 中相应行为文件定位，不依赖本文缓存的测试总数。

## 每票执行

1. 读本票、规格与所需验收场景；重新取基线、冻结单条业务和改动预算。
2. 以现有公开接口复现失败；工程行为可用窄夹具，推理行为必须另用真实模型轨迹证明。
3. 最小实现后跑针对性行为检查、类型/构建；发布前跑相关全量与 MP 微信编译。已有稳定小片只做必要审查，不每次触发大范围双审。
4. 在隔离 staging 自行跑该票真实模型/网关及可操作的 UI 验收；证据按 acceptance.md 分类保存。卡片入口从可见 UI 点击，不用直接调方法代替。
5. 改动进入可发布版本后按云端规范发布；多个关联票可同批发布，但每票保留语义 commit 与证据。正式上线前记录未在生产验证的状态，不写为全部完成。
6. 把实际结果、版本、残余缺口及清理记录写入 `plan/`，维护改动模块的轻量 AGENTS；仅提交本票代码/测试/文档。

## 接入与工具

- Node 22；Runtime 基于现有测试、typecheck/build 脚本；MP 使用 `npm run test:agent`，没有 `npm test`。微信通过 HBuilderX 现有 CLI 编译，命令见项目 AGENTS。
- 真实身份仅从既有私密存放点读取；按 Runtime AGENTS 复用既有身份，不重新登录专属账号、不把密钥复制到票据或日志。
- 云端规范与备份/回滚入口：`plan/2026-10-23-runtime-cloud-release-spec.md`。生产 release 以现场 current 实测为准；历史 3211 staging 已清理，使用前检查端口占用，不依赖旧进程或临时包存在。
- 前端真实操作按可用环境选择 `ego-browser` / `agent-browser` 对应技能及已安装能力；微信开发者工具用实际可用自动化接口。单纯 H5 浏览器测试不能冒充微信验收。
- UI 改动先按项目优先级核对 animate-ui、ReUI、shadcn 文档，优先复用现有微信可用组件，不把 Web 组件依赖硬装进 uni-app；视觉验收可用 `better-interface`，实施时再读技能。

## 票据状态

`ready-for-agent` 表示规格可执行；开始时记录正在处理的代理/基线。只有本票必需的真实证据齐全才记完成，不能转 ready-for-human 把验收交给用户。外部阻碍保留具体未验项、尝试和可继续工作；依赖该证据的票不能假定通过。最终完成以 09 的业务交付及 acceptance.md 全部必需项为准。


## 流程状态（2026-10-24 最新授权）

- 用户已确认按后端恢复为主推进，并明确要求“自行完成全部推进，直至完成验收并取得理想效果”。既有 seam、粒度、阻塞边沿用，不再等待重复批准。
- 01 后端 `97f90f1`、`96e79b7` 与 MP `cca7ec1` 已完成工程/真实模型 staging 验证；前端真实点击、生产证据由 09 集中补齐，不阻塞 06/07/08 的后端实现。已过时时刻请求必要的新决定属于合法收口。
- 02 后端 `dce88cb`：复用已有适配器瞬时重读，允许只读同参刷新，连续同参同错误才止损，退避可取消；环境历史公开行为 5/5、类型检查通过。真实集成轨迹并入候选 staging 逐项核验，未标整体完成。
- 前端不是每票实现入口；仅后端返回语义现有客户端无法正确消费时补状态/文案。微信真实点击与真机证据集中在 09，不能用该证据待补阻断独立后端修复。
- 保留历史流程偏差：01 初实现并非严格先红后绿，review 已修复实际问题。后续沿现有 HTTP/NDJSON seam 做窄行为回归；最终做必要的两轴集成审查，不重复每票大范围审查。

## 当前业务闭环（生产验收推进中）

- 生产已由 `3a1a0d8` → `fc95eed` → `2051f1e`，实际备份和版本见 `plan/2026-10-24-agent-error-recovery-implementation-handoff.md`。后者修复生产引用后改名的后置校验错误：HTTP回归先红，399/399、双轴窄审与真实模型修正/确认/重放通过；生产微信真实修改也已确认。
- 原报告完整性未核验的原因是模型把统计要求错放 `agent.period/comparisons` 而被忽略。新增阻断子片 [09a](issues/09a-report-contract-repair.md)，仅收紧新提案对象字段、不迁移历史。`c0b07b9` 工程400/400、类型/构建、两轴窄审通过，真实模型和生产验收待闭环。
- 流程使用已认可 seam 和阻塞图。没有重新采访用户或重复要求授权；未通过的真实证据仍保留未勾选，不把工程通过写成整体验收通过。
