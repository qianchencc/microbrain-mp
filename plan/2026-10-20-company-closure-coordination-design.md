# 04 收口协调设计决议：目标接口与引用生命周期（2026-10-20）

日期：2026-10-20。状态：**历史候选设计，已被工具体系探索取代**。离线反例（见[分阶段范围反例](2026-10-20-company-closure-contract-probe.md)）撤回了其中通用形态拒绝规则；原「待用户裁定 Q1」经更正改分类为内部设计问题，由[工具体系设计盘点](../docs/research/2026-10-20-agent-tool-system-design-audit.md)与[设计准备](2026-10-20-agent-tool-system-design-preparation.md)继续探索。下列目标接口仅为初稿提案，不是可实施决议，启用/退役步骤不激活；具体接口/schema/命名未定。[票 04](../.scratch/agent-redesign/issues/04-real-closure-delivery.md) 保持 open，[票 05](../.scratch/agent-redesign/issues/05-complex-energy-investigation.md)/[票 06](../.scratch/agent-redesign/issues/06-safety-collaborative-investigation.md) 阻塞边不变，未通过真实网关只读、微信或现场控制验收。

## 证据基线（2026-10-20 源码检查）

基线版本：MP 分支 `新世纪办公室` 提交 `385f63d`；Runtime 分支 `codex/multi-candidate-lighting-draft` 提交 `4ec44dc`。两仓工作区均含并行未提交改动，下列行号为该修订版本的近似位置。以下事实仅代表源码 HEAD，不代表活动部署版本：

- `apps/runtime/src/agent/pi-runner.ts` companySystemPrompt（约 57–58 行）已要求优先使用具名收口能力。
- 同一文件 Company 工具注册（约 1070–1077 行）同时暴露 find/get/inspect、`propose_action_draft`、`propose_lighting_draft`、`propose_task`、`propose_company_night_closure`、`continue_company_night_closure`；等价入口竞争客观存在。
- `propose_action_draft` 已接受 lighting 参数，纯照明即时请求经专用 `propose_lighting_draft` 属重复入口。
- 通用 `propose_task` 仍要求模型给出候选集合 ID 及逐台检查/控制数组，与业务收口职责重叠。
- `company-night-closure.ts` 的 `prepareCompanyNightClosure` 已实现完整范围解析、排除、成员绑定、控制绑定与预检。
- `app.ts`（约 1304–1370 行）按当前会话与来源加载持久化收口上下文并重新校验，新建与续接共用同一助手。
- `tasks/AGENTS` 要求严格 requiresVerification 与 Task 快照边界。

须区分两类事实：上述及观察读取的 30 分钟有界兜底、401/403 拒绝兜底、Company 空调区域路径均为已提交 HEAD 事实；仍属未提交并行改动的只有 MP 位置优先归组，以及 Runtime 智慧三族/摄像头 locationPaths 与自身楼层优先新增。未提交部分不得当作已集成实现引用。Runtime 当前部署与活动状态未知，本轮未查询远端，不由 HEAD 推断。

## 目标接口决议

下表是初稿目标状态，非实现声明，属历史候选。**注意：启用/退役步骤不激活，任何一行都不视为已完成或可执行；具体接口取舍改按[工具体系设计盘点](../docs/research/2026-10-20-agent-tool-system-design-audit.md)与[设计准备](2026-10-20-agent-tool-system-design-preparation.md)的候选设计推进。**

| 入口/能力 | 目标去向 | 说明 |
| --- | --- | --- |
| `propose_task` | 成为 Company 新建未来任务的唯一入口 | 输入为严格二选一：业务收口分支或现有通用形态，根级 additionalProperties:false，混合字段在任何状态读取前拒绝 |
| `propose_company_night_closure` | 替换落地后从 Company 活动工具注册中移除 | 业务助手 `prepareCompanyNightClosure` 与历史工具结果/回读保留；不保留活动别名、第二路由工具或通用工具注册表 |
| `continue_company_night_closure` | 独立保留 | 现有 `{referenceId,replacements?,lightingAt?,acAt?}` 契约不变，不再与新建合并 |
| `propose_lighting_draft` | 从 Company 活动注册移除 | 纯照明即时请求走 `propose_action_draft.lighting`；实现保留供 Office/共用助手，不删 Office 功能 |
| 发现/状态/检查工具 | 保留 | 用于真实观察、人工精确选择与一般非收口任务，不列为业务收口分支的必经前置 |
| 通用 `propose_task` 分支 | 保留 | 真正的非收口任务（开启、参数调整、周期、区间、只读检查点）继续可用，不做全局删除把目标强改为收口 |

### `propose_task` 业务收口分支

- Company 专属输入为不交的并集：`{ companyNightClosure: { scopeTexts: string[], excludeTexts?: string[], lightingAt: string, acAt: string } }` 或现有通用 `{label,candidateSetIds,interval?,repeat?,phases}`。两个分支根级均 additionalProperties:false，出现交叉字段在读取任何状态之前拒绝。
- 沿用现有字段边界与时间校验；收口标签由服务器固定，输出仍为现有 TaskProposal。
- 收口分支委托现有 `prepareCompanyNightClosure`，不由模型枚举成员，不新建规划器。Office 的 schema 与行为不变。

### 候选兼容性风险闸口

逻辑上的二选一输入契约已确定，但其 schema 线上编码必须先对照当前 Pi/模型供应商（现行 GLM 配置）核实；不预设顶层 anyOf/oneOf/union 已被支持。无论供应商能否表达该形态，混合字段拒绝始终由服务端在任何状态读取前以 fail-closed 方式执行。若供应商无法表达所选 schema，停止并带证据报告，重新评审 schema 表达；不得静默调整接口、重新引入活动别名或放宽接受范围，也不得把本设计标记为已验证。本闸口是目标验证要求，本轮不实际调用模型或网络验证。

已记录的 SDK 侧证据（仅本地，见[反例记录](2026-10-20-company-closure-contract-probe.md)）：Pi 0.84.4 TypeBox 本地接受合法二选一分支、拒绝混合字段；注入 fetch 抓包显示 OpenAI-completions 线上编码保留 anyOf 根。真实 GLM 端点接受度与模型自然分支选择仍未验证，闸口不视为通过；且接口形态本身正待 Q1 裁定，闸口对象可能随之改变。

### 续接语义

- 新建目标走新请求；已登记任务走 `get_task`/`propose_task_change`；不得借续接入口重建任务。
- 服务端持久化生命周期保持权威；不得因措辞或关键词分类静默改变有效引用的可用性。
- 旧保存卡片/引用正常恢复，旧工具结果保留为历史证据；无活动别名的旧调用不再具备执行路径。

### 通用路径收口形态拒绝（WITHDRAWN，已撤回，不得实施）

**2026-10-20 离线反例（见[分阶段范围反例与待决问题](2026-10-20-company-closure-contract-probe.md)）证明动作形态等价不证明业务范围等价：合法的分阶段独立范围通用提案会被本规则误拒或诱导扩大范围。本节仅作历史记录保留，不是现行规范指令，不得实现。**

原拟规则（撤回）：对等价的通用收口形态在能力/状态预检之前拒绝：归一化后无 repeat/interval/只读、恰好两个非空控制阶段、第一阶段仅含照明关闭（closeOrOpen=0）、第二阶段仅含空调关闭且无温度/模式/风速等附加字段的通用提案，返回结构化 BusinessError，说明必须改用 `companyNightClosure` 分支并给出完整范围/排除表达。

- 形态比较基于类型化控制意图的确定性判断，不是用户文本或关键词；不自动推断/省略用户排除，也不从枚举设备 ID 编造完整范围。
- 该规则不声称识别全部语言意图，模型与真实路径仍须验收；不把较弱的通用预检证据静默升级为 requiresVerification。
- 其它形态继续走通用路径。本规则是重复接口替换的一部分，不是独立的守卫或平台项目。

## 不变职责

Pi 与服务端职责不变：TaskProposal/Task/Phase 结构、确认流程、固定设备成员与控制绑定、最多三路控制并发、未知不重试、空调权威回读与照明未核验口径全部保持首条规格。本决议不引入 OperationPlan、Investigation 类型、工具加载/路由平台、框架替换、UI 重设计、跨族位置实体抽取或依赖升级。

## 引用与事实生命周期

| 对象 | 规则 |
| --- | --- |
| 历史报告/卡片/任务执行事实 | 不可变快照；解释原结果只读已保存快照（重新核验当前访问权限），不重新统计 |
| 范围/时间/来源数据改变或新查询 | 产生新结果，不改写旧对象 |
| 仅显示名变化、成员与控制绑定不变 | 不构成普遍失效：收口续接按原范围词重新解析，改名导致成员/解析变化才失效；全局目录指纹单独变化不证明成员变化 |
| 待确认收口引用 | 成员/绑定/有效期/会话/来源变化整体拒绝；只允许修补已声明的缺口与时间 |
| 已登记任务 | 稳定 taskId，走既有带版本的查询/修改；任务不随临时收口引用到期失效 |
| 确认与执行 | 必须重新做当前授权与控制检查，历史数据不扩大新权限 |

## 来源与位置口径的影响

共用口径的权威段落见[后续规格](../.scratch/agent-redesign/followup-spec.md)「来源与位置口径（共用）」，本文件只记其对收口协调的结论：

- 电表与智能设备/摄像头分属不同上游主数据，名称相似只是线索，不构成跨模块稳定 ID 或规范地址；禁止自动同步或模糊 join。
- 收口范围由服务器依来源特定的名称/安装地址/树路径证据解析；Pi 不自行重写地点或枚举成员。自身楼层冲突或无法解析时保留出处并澄清，不用粗树节点或模型猜测覆盖冲突。
- 目标输出必须明示来源、版本与读取时刻；目录/元数据走当前授权实时读取，兜底窗口不得用于确立新控制或安全匹配所需的当前位置与授权。

## 下一步切片（窄，先决条件已插入）

0. 原列「先由用户裁定 Q1（阶段目标接口扩大范围 vs 窄共享范围切片）」为历史步骤：该问题已改分类为内部设计问题，确切 schema/接口按[工具体系设计准备](2026-10-20-agent-tool-system-design-preparation.md)的候选设计确定后再进入 TDD；不得把已撤回的形态拒绝规则或相应测试当作当前方向继续推进。
1. 在隔离 worktree 从已记录的 Runtime 提交 HEAD 实施接口替换，保留并行位置改动，不盲目拷贝未提交工作。
2. 只新增最小 HTTP 公共回归，覆盖：分支混合字段无预检/无提案/无控制；合法收口单计划含完整夹具成员与排除；**各阶段范围/排除不同或用户明确选定设备集合的通用提案保持精确成员，不被合并入共享范围，也不被形态规则误拒**（替代原先「同形态通用收口无法落成弱任务」用例，该用例随撤回规则失效）；空调温度/开启/区间/周期/只读与 Office 正常；重启后续接/改时与已确认任务不重建；旧历史正常恢复。现有相关套件：company-batch-plan、company-closure-clarification、company-night-closure-execution、mixed-scope-draft、scheduled-lighting-scope、task-plan-management。断言业务结果与零外部写入，不断言工具清单、提示词字符串或内部调用顺序。
3. 继承六类复杂输入各不少于 2 次只读样本：跨楼层/排除、口语同义、真实歧义、待确认改时、已登记任务查询/修改、无效范围/新目标。保留全部尝试、确切候选 SHA、目录证据/成员 ID/读取时刻、所选路由、提案或澄清/失败及时间/token/请求证据，输入冻结可比。无同范围配对基线不宣称提速；共享提案预检计时按一批计，不重复求和。HTTP/流式事实为主，Langfuse 仅作既有锁定插桩的可选辅助，不升级不建数据集。

## 验收闸口

设计记录（本轮）→ 离线候选代码回归 → 单独授权的真实网关只读（进程内临时库、不确认、无扫描副作用、不另起持久 Runtime）→ 微信原卡片/返回/引用 → 服务变更仅在明确授权并做版本/数据库/密钥备份回退后进行 → 真实控制仅在明确范围/时间/版本/用户授权后进行。照明按已受理未核验报告，现场人工证据不自动升级为权威；最终 Task 报告在所有阶段终态后唯一通知。票 04 保持 open；不凭本轮文档释放 05/06。

## 边界

本轮仅文档记录，无生产/测试代码改动，未启动/停止/重启任何服务、模型任务、隧道、数据库或依赖，未做任何网络调用。两仓未提交并行改动全部保留；`2026-10-19-device-location-authority-handoff.md` 为用户并行未提交证据，本文件已收录其必要结论，干净检出本记录不依赖该未跟踪文件。
