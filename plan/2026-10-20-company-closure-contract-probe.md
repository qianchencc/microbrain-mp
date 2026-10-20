# Company 收口协调：分阶段范围反例与待决问题（2026-10-20）

日期：2026-10-20。基线：MP 提交 `385f63d`（分支 `新世纪办公室`），Runtime 提交 `4ec44dc`（分支 `codex/multi-candidate-lighting-draft`）。本记录针对[收口协调设计](2026-10-20-company-closure-coordination-design.md)中的通用形态拒绝规则，是离线构造反例证据，不是生产事故，也不代表任何实现已落地。隔离 worktree `/Users/qianchen/works/新发展/iot-agent-runtime-company-proposal-convergence`（分支 `codex/company-proposal-convergence-20261020`）保持在 `4ec44dc` 干净待用。无任何生产改动、确认、扫描或网络调用。

## 离线反例（固定证据，勿重跑）

注入协议夹具 + 真实 Pi/faux provider，经公开 HTTP 流执行：

| 路径 | 阶段一（18:30 照明关） | 阶段二（20:00 空调关闭） | requiresVerification | 终态 |
| --- | --- | --- | --- | --- |
| 通用 `propose_task` 分阶段范围 | 88 台（window-filler-0..79、north-grid、north-strip、south-grid、south-strip、meeting-0..3；不含 other-floor） | 30 台（batch-ac-30..59） | 未设置 | run.awaiting_confirmation |
| 共享范围 `propose_company_night_closure`（scopeTexts 26楼、27楼） | 89 台（同上 + other-floor） | 60 台（batch-ac-0..59） | true | run.awaiting_confirmation |

输入 A 语义为「18:30 只关 26楼照明、20:00 只关 27楼空调，不动 27楼照明与 26楼空调」。通用路径按 A 构造；共享路径另行显式提交 `scopeTexts=[26楼,27楼]`，用来检查拟议重定向的后果，不是让模型对同一原话自行选路。两条路径设备写零。若把 A 改写为这份共享范围请求，将额外纳入照明 `other-floor` 与空调 `batch-ac-0..29`。现行两路径互不自动转换；本反例否定的是先前拟议规则，不是报告已发生的自动扩范围或真实误控。

结论：动作形态相同（照明关 + 空调关闭两阶段）不证明业务范围等价；原设计中「等价通用收口形态一律在预检前拒绝」会拒绝合法的分阶段范围请求，或诱导模型扩大/歪曲用户范围。该规则据此撤回（WITHDRAWN），不得实施，也不提交给用户批准。

## SDK 线编码证据（仅本地）

已安装 Pi 0.84.4 TypeBox：合法收口分支通过本地校验，混合字段被拒；OpenAI-completions 注入 fetch 抓包显示工具参数根保留 anyOf（根 type 为空），流式正常结束。这只证明本地 SDK 校验与序列化可行；真实 GLM 端点是否接受该 schema、模型是否自然选择正确分支均未测试（无网络），兼容性闸口仍未通过。

## 待决问题 Q1（历史问题，已改分类）

**2026-10-20 更正：本问题原先按产品批准口径挂起属过度框定。用户原目标本就要求灵活的分阶段/精确目标与轻 Pi，并明确要求探索整个工具体系设计；故 Q1 改分类为内部设计问题，纳入[工具体系设计准备](2026-10-20-agent-tool-system-design-preparation.md)继续探索。这不构成用户已批准某个具体 schema 或工具名。以下原记录保留。**

原问题：是否将本轮的服务端准备提升为现有 Task/Phase 的阶段目标接口：每阶段独立声明范围/排除与受支持动作模板，或引用用户已经选定的设备集合；服务器统一展开、能力校验、预检和固定快照，夜间收口只是便捷输入展开，而非根据动作形态强制套用的例外？

建议选「是」（原待用户确认，现按内部设计评审推进）：保留全部受支持的灵活目标，移除等价活动工具名，但绝不凭照明关/空调关的顺序推断范围等价。保持 Task/Phase/确认/执行器/回读/持久化，不引入 OperationPlan、工作流或 Investigation 平台。用户明确选定的设备集合必须保持精确，不同的阶段范围/排除不得并入共享范围。requiresVerification/预检事实与成功 HTTP/受理命令必须分开，不把通用证据静默升级。原提案曾将该选择表述为把 04 从工具名/schema 合并扩大为阶段目标准备、并须等用户确认后才实施；现按上方更正与[工具体系设计准备](2026-10-20-agent-tool-system-design-preparation.md)推进，未批准具体 schema。备选是保留窄共享范围收口并让合法的通用非等价请求继续存在，但那样不能宣称范围/结果准备已完全收敛；不得把受限模板强加给用户。

## 证据索引

- 本轮探针配方：`/tmp/runtime-worktree-audit-20261020/contract-probe-recipe.mjs`
- stdout/stderr：`/tmp/runtime-worktree-audit-20261020/contract-probe.log`
- HTTP 流与抓取 schema：`/var/folders/cf/h00nh8m17jbg28fbq3y9r08m0000gn/T/closure-contract-probe-FSnVA1/{generic.ndjson,shared-scope.ndjson,wire-schema.json}`
- 上表已含关键计数值，干净检出不必重跑临时产物。
