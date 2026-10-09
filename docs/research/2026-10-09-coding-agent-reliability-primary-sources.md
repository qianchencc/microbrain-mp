# 编码智能体可靠性：来自一手源码与官方工程文档的证据

- 日期：2026-10-09
- 范围：回答优秀社区编码智能体的可靠性来自哪些可见系统能力、公开证据能否支持“几乎 100% 可用”，以及哪些经验适用于物联网 Agent。研究只使用项目源码、项目官方文档和 Anthropic 官方工程文档；没有把二手解读当作实现证据。

## 结论

**没有找到能支持“通用业务场景几乎 100% 可用”的公开一手证据。** Anthropic 对 SWE-bench Verified 的说明是模型分数超过 80%，该基准给软件仓库 issue 运行测试，并不测量所有用户请求、部署可用性或物联网副作用是否正确。Anthropic 自己的 Claude Code 质量复盘也记录了上下文处理改动导致遗忘、重复和错误工具选择，且问题逃过了多轮人工与自动审查、单元/端到端测试及内部试用。[Agent evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)；[Claude Code quality postmortem](https://www.anthropic.com/engineering/april-23-postmortem)

源码能证明的是：成熟 harness 把模型放在一个**可观察、有限制、能收到真实工具结果、能在特定错误后恢复或明确停止**的执行回路中。源码本身不能证明这些做法导致了某个高可靠率；本次没有找到对照试验把同一模型、同一任务、同一工具环境分别放在这些 harness 中，量化“harness 本身提升多少”。模型能力、工具和环境质量、任务定义及评测方法仍共同决定结果。

对 IoT 可迁移的是 Agent 自主理解目标、组合工具、依据观察继续或澄清，以及会话记录、错误归因和评测方法。**不能直接迁移的是软件仓库中可重跑测试、文件系统回滚、shell 沙箱所带来的低风险前提。** IoT 每次副作用要由服务端按当前身份、设备范围、设备能力、状态版本、冲突、幂等和批准策略重新裁决，并以设备回读或明确的 `unknown` 收口，不能由 Agent 自报“已成功”。这与本仓库现有系统边界文档相符。[物联 Agent 系统全景地图](2026-09-24-agent-system-map.md)

## 样本与版本

以下源码均以检索时的上游 HEAD 固定。Pi 仓库从 `badlogic/pi-mono` 发展而来，当前规范仓库为 `earendil-works/pi`。

| 项目 | 固定 commit | 实际阅读的源码路径 | 可见的职责 |
| --- | --- | --- | --- |
| Pi agent core / coding agent | `6fb2e7815167e6b19006fc526d1a5d0f5f998787` | [`packages/agent/src/agent-loop.ts`](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/agent/src/agent-loop.ts)、[`packages/coding-agent/src/core/agent-session.ts`](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/coding-agent/src/core/agent-session.ts)、[`packages/coding-agent/src/core/compaction/compaction.ts`](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/coding-agent/src/core/compaction/compaction.ts) | 通用模型/工具循环、分步事件、会话持久化、压缩与恢复 |
| SWE-agent | `3ea751c087f32b16e039a2233dd6eefecef325d5` | [`sweagent/agent/agents.py`](https://github.com/SWE-agent/SWE-agent/blob/3ea751c087f32b16e039a2233dd6eefecef325d5/sweagent/agent/agents.py)、[`sweagent/tools/tools.py`](https://github.com/SWE-agent/SWE-agent/blob/3ea751c087f32b16e039a2233dd6eefecef325d5/sweagent/tools/tools.py)、[`sweagent/agent/history_processors.py`](https://github.com/SWE-agent/SWE-agent/blob/3ea751c087f32b16e039a2233dd6eefecef325d5/sweagent/agent/history_processors.py) | 模型输出解析、环境执行、错误再查询、history 投影、轨迹记录 |
| mini-SWE-agent | `04d809ceab9df28f9adaed044884180159172930` | [`src/minisweagent/agents/default.py`](https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/src/minisweagent/agents/default.py)、[`src/minisweagent/models/utils/actions_toolcall.py`](https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/src/minisweagent/models/utils/actions_toolcall.py)、[`src/minisweagent/models/utils/retry.py`](https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/src/minisweagent/models/utils/retry.py) | 小型模型/环境接口、模型工具调用、单步持久轨迹、停止限额 |
| OpenHands Software Agent SDK | `9c4fd8c6664dfce98524d04d965b4f009f390fbe` | [`openhands-sdk/openhands/sdk/agent/agent.py`](https://github.com/OpenHands/software-agent-sdk/blob/9c4fd8c6664dfce98524d04d965b4f009f390fbe/openhands-sdk/openhands/sdk/agent/agent.py)、[`openhands-sdk/openhands/sdk/agent/base.py`](https://github.com/OpenHands/software-agent-sdk/blob/9c4fd8c6664dfce98524d04d965b4f009f390fbe/openhands-sdk/openhands/sdk/agent/base.py)、[`openhands-sdk/openhands/sdk/agent/parallel_executor.py`](https://github.com/OpenHands/software-agent-sdk/blob/9c4fd8c6664dfce98524d04d965b4f009f390fbe/openhands-sdk/openhands/sdk/agent/parallel_executor.py) | Action/Observation 事件、工具批次、确认策略、上下文压缩与事件恢复 |

官方参考文档：[Anthropic：Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)、[Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)、[Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)、[Claude Code sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing)、[Claude Code permissions](https://code.claude.com/docs/en/permissions)、[Claude Code hooks](https://code.claude.com/docs/en/hooks)。这些文档说明官方产品的行为边界和工程经验，不是 Claude Code 私有实现源码。

## 源码显示的可靠性构件

### 1. Agent 保留选择权，工具面提供强契约

Anthropic 将 Agent 定义为由模型动态决定流程和工具使用；workflow 则由代码预先规定路径。建议从最简单的系统开始，需要时再增加复杂度。[Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)

源码中的自由度不是任意自然语言解析。mini-SWE-agent 把模型输出表示为结构化的 `bash` function call，再解析 JSON 参数；SWE-agent 把模型选出的动作送进工具层，由工具层判定格式、黑名单和执行错误。Pi 的 agent core 则把模型的 tool-call 与已注册工具按名称和参数契约连接，提供 sequential/parallel 执行和统一 `toolResult`。OpenHands 将工具定义和 Pydantic action 类型传给模型，再以 `ActionEvent`、`ObservationEvent` 表示请求和结果。[mini-SWE parser](https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/src/minisweagent/models/utils/actions_toolcall.py)；[SWE tool handler](https://github.com/SWE-agent/SWE-agent/blob/3ea751c087f32b16e039a2233dd6eefecef325d5/sweagent/tools/tools.py)；[Pi loop](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/agent/src/agent-loop.ts)；[OpenHands agent](https://github.com/OpenHands/software-agent-sdk/blob/9c4fd8c6664dfce98524d04d965b4f009f390fbe/openhands-sdk/openhands/sdk/agent/agent.py)

- **证据：** 工具是代码注册、参数有结构、执行权在 runtime，失败结果会回到模型。
- **推论：** 这允许 Agent 根据新目标选路径，又让授权面、输入形状和副作用边界可在模型之外检查。
- **不可推出：** 工具 schema 不能保证模型选择正确工具、业务参数语义正确或权限本身正确。

### 2. 真正执行后的观察成为下一轮上下文

mini-SWE-agent 是一个简洁的 `query → execute_actions → format_observation_messages → next query` 循环，并在每步将消息与环境状态写进轨迹。SWE-agent 记录模型查询、动作、执行时间、环境状态、结果和轨迹；执行超时会中断执行会话并把 timeout 观察交回控制逻辑。Pi 将错误工具调用作为 `isError` 的结果消息写入上下文；如果模型响应因输出长度被截断，即使 JSON 恰好能解析，也会拒绝执行这些可能不完整的 tool-call，要求模型重发。OpenHands 对工具批次按原 action 顺序发出 Action/Observation 事件，并将工具异常作为失败结果记录。[mini loop](https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/src/minisweagent/agents/default.py)；[SWE timeout and forward loop](https://github.com/SWE-agent/SWE-agent/blob/3ea751c087f32b16e039a2233dd6eefecef325d5/sweagent/agent/agents.py)；[Pi truncated-call handling](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/agent/src/agent-loop.ts)；[OpenHands tool batch](https://github.com/OpenHands/software-agent-sdk/blob/9c4fd8c6664dfce98524d04d965b4f009f390fbe/openhands-sdk/openhands/sdk/agent/agent.py)

- **证据：** 模型下一步输入包含工具真实返回、错误和执行观察，而不是只有模型先前声称的结果。
- **推论：** 可见失败和环境反馈给模型留下纠错机会，也给操作员留下可回放的失败轨迹。
- **未知：** 有真实反馈并不保证模型能正确解释、停止或恢复。

### 3. 错误按类别处理，并且恢复有界

mini-SWE-agent 对格式错误提供有限重试，重复格式错误达到配置上限后终止；另有 step、cost 和 wall-time 限额，并在每次循环结束时保存轨迹。它的模型 adapter 另用 retry policy 处理非 abort 类异常，包含尝试次数上限和指数退避。SWE-agent 对格式错误、被拦截动作、shell 语法错误、模型策略拦截和命令超时有不同路径；格式/语法类错误可带着错误信息让模型重试，连续错误/timeout 超限会停止。Pi 将工具执行异常转换为错误结果；对 overload、rate limit、server error 有限重试，context overflow 则走 compaction。OpenHands 将 malformed tool call 作为新的反馈消息；上下文超限或消息历史结构错误可触发 condenser；无 condenser 时则抛出错误。[mini limits](https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/src/minisweagent/agents/default.py)；[mini model retry](https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/src/minisweagent/models/utils/retry.py)；[SWE retry loop](https://github.com/SWE-agent/SWE-agent/blob/3ea751c087f32b16e039a2233dd6eefecef325d5/sweagent/agent/agents.py)；[Pi session retry](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/coding-agent/src/core/agent-session.ts)；[OpenHands context recovery](https://github.com/OpenHands/software-agent-sdk/blob/9c4fd8c6664dfce98524d04d965b4f009f390fbe/openhands-sdk/openhands/sdk/agent/agent.py)

- **证据：** 有限 retry、明确的终态和退出数据是实现的一部分。
- **推论：** 可靠 recovery 是“失败类型被识别后只重试适合重试的动作”，不是无限让模型再试。
- **不可推出：** 特定次数的重试、相同参数计数或 fallback 本身能提升任务准确性；它们只给运行加边界，不能补足错误的事实和意图判断。

### 4. 对话历史与模型上下文是两个不同对象

SWE-agent 将原始 history 与传给模型的 `messages` 分开；processors 可只保留最近若干 observations、摘要旧输出、保留关键 tag 或裁剪重复文件窗口。Pi coding-agent 将会话事件持久化，提供 branch/compaction；请求前可 transform context，压缩生成也走独立模型调用和 retry。OpenHands 保留事件流/会话状态视图，由 condenser 改写发给模型的消息；遇到 context overflow 或 malformed history 会触发压缩恢复。[SWE history processors](https://github.com/SWE-agent/SWE-agent/blob/3ea751c087f32b16e039a2233dd6eefecef325d5/sweagent/agent/history_processors.py)；[Pi session manager](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/coding-agent/src/core/session-manager.ts)；[Pi compaction](https://github.com/earendil-works/pi/blob/6fb2e7815167e6b19006fc526d1a5d0f5f998787/packages/coding-agent/src/core/compaction/compaction.ts)；[OpenHands agent base](https://github.com/OpenHands/software-agent-sdk/blob/9c4fd8c6664dfce98524d04d965b4f009f390fbe/openhands-sdk/openhands/sdk/agent/base.py)

Anthropic 也明确说 context 是有限资源，compaction 会丢弃信息；需要从长轨迹保留关键决策、未解决问题和重要事实，并针对复杂轨迹调校。[Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

**推论：** 应保留能审计/恢复的权威轨迹，再按模型窗口构造有限视图；不能把摘要视作业务记录，也不能让压缩删除授权、待确认草案、工具错误或真实执行证据。

### 5. 副作用边界独立于模型判断

Claude Code 文档将权限规则、hooks、沙箱文件/网络边界作为实际可执行策略。Anthropic 报告沙箱减少其内部 permission prompts 84%，但这是特定内部使用中“提示数量”的变化，不能解释为任务可靠率或 IoT 安全率提升 84%。[Claude Code sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing)；[permissions](https://code.claude.com/docs/en/permissions)；[hooks](https://code.claude.com/docs/en/hooks)

OpenHands 可在运行动作前使用 security analyzer 评估风险，再由 confirmation policy 决定是否进入 `WAITING_FOR_CONFIRMATION`；未配置 analyzer 时风险为 `UNKNOWN`。这是一道风险/审批机制，不等于 analyzer 结果是权威授权。[OpenHands confirmation](https://github.com/OpenHands/software-agent-sdk/blob/9c4fd8c6664dfce98524d04d965b4f009f390fbe/openhands-sdk/openhands/sdk/agent/agent.py)

**IoT 推论：** 服务端权限、授权设备范围和风险策略必须由权威身份与当前能力信息做确定性验证；模型生成的 `security_risk`、用户在对话中的“确认”文本、卡片状态都不能独立授权物理操作。动作应先有可追踪提案，再由服务端验证 proposal/version、用户授权和幂等键，之后执行并回读。实际结果至少区分 rejected、accepted、executed、verified、partial、failed 和 unknown。

### 6. 评测测结果，不把某条工具序列当成唯一正确解

Anthropic 将一轮运行定义为 trial、一个任务可以运行多次，并建议用 code-based、model-based 和 human graders 组合；对代码 agent 运行测试、评估 outcome 和 transcript；维护均衡数据集；同时使用离线 eval、生产监控、A/B、反馈和人工抽查。文章特别指出，严格要求某个工具调用序列容易惩罚有效的替代路径；应优先判断结果，并针对多次模型运行计算稳定性。[Demystifying evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)

**IoT 推论：** 每个真实闭环应把工具参数检查、读数来源/新鲜度、业务对象状态、设备回执、权威回读和用户看到的结果分别评分。模拟夹具/benchmark 只证明它们自己的预设环境，不能代表客户网关、真实授权变动、网络故障和设备异步状态。

## “几乎 100%”的证据门槛

“可用”必须先说明总体：哪些用户目标、设备和版本、模型和工具版本、是否包含超时/澄清/人工确认、何为成功，以及失败如何计数。SWE-bench Verified 的 pass 表示给定仓库 issue 的修复通过该测试环境中的测试；不是所有编码 Agent 请求都成功，更不是 IoT 设备操作成功。[Anthropic evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)

统计推论：如果 300 次**相互独立且来自目标业务真实分布**的试验中 0 次失败，按二项分布单侧 95% 上界，失败率仍约为 1%；也就是说这只刚好给出“至少约 99%”的有限证据，不能证明 100%。若案例重用、同一模型/网关故障造成相关失败、测试只挑选演示路径或漏掉副作用错误，这个上界不成立。公开 demo、一个 happy-path、单次 benchmark 分数、代码测试通过都没有这类生产分母。

目前公开一手材料没有给出跨用户真实 IoT 业务分布下、含真实副作用且定义成功标准的试验分母，因此“几乎 100% 可用”在本次样本中是**未证实**，不应当作为架构前提。这个结论不表示系统一定不可靠；它只说明现有证据不能支持该数值。

## 迁移到本项目的边界

### 可迁移

- 继续让模型对自然语言目标进行意图理解、澄清和工具选择；工具结果返回成下一轮模型能判断的结构化证据。
- 为设备动作提供清晰 schema、窄工具权限和一致返回类型；schema 校验参数，服务端仍检查权限和业务前置条件。
- 把 model request、tool call、真实回执、回读、失败类和耗时放入可关联轨迹；历史压缩只影响模型投影。
- 按模型/提示/工具/客户接口版本运行代表性场景回归，并保留反例和真实用户反馈。
- 对上游 transient failure 使用有界重试；对已发出副作用的 timeout 用状态查询/幂等恢复，不得盲目重复下发。

### 不可直接迁移

- Coding harness 的 `bash`、blocklist、工作树或 Docker 沙箱不能代替 IoT 的身份、设备范围与操作授权。
- “命令返回 0”或文本输出包含 `success` 不等于设备到达目标；设备受理、设备执行和回读是不同事实。
- OpenHands/Pi 的并行工具调用适合互不依赖的查询；对有顺序、冲突或共同影响状态的设备写入，直接照搬并发可能改变物理结果。应由工具契约或服务端按具体设备语义决策并发，不用 Agent prompt 决定。
- Benchmark 成功率、模拟器结果和内部 UX 数据不能替代客户接口和真机上的外部可观察验收。

本仓库既有系统设计已把 Agent 规划/事实检索、业务对象、每次副作用的运行策略、设备层、结果证据分开；任务对象承担持久化、定时执行和审计，不取代 Agent 对开放目标的理解。[系统全景地图：系统分层与生命周期](2026-09-24-agent-system-map.md)

因此，不建议把可靠性目标改写成更多自然语言关键词 `if/else`、更多 prompt 特例或“连续重复次数”计数。用户说的另一件事、别名、范围、设备映射和新模型都会绕开文本补丁；而过度拒绝也会把误报伪装成稳定。更适合的推进单元是一个真实闭环：由 Agent 自主走到结构化事实/操作提案，服务端在副作用边界执行权威校验，真实结果回到 Agent 和 UI，再用该闭环的正例、应澄清反例、范围反例、陈旧/超时/重复确认/已达目标/重启恢复等外部行为做回归。

## 仍然未知

- 在同一组真实 IoT 任务和模型下，Pi、SWE-agent、OpenHands 或 mini-SWE-agent 的 loop/恢复设计分别能带来多少准确率差异；本次没有找到对照结果。
- 本仓库现用模型在 Company、Office、设备范围、模糊指代、确认和接口异常上的真实成功率及置信区间；本次研究没有运行线上模型或真实设备试验。
- 风险分类器或 LLM-as-judge 在本客户语义上的 precision/recall；没有校准样本时不能把其输出当成授权或成功证据。
- Compaction、模型切换、工具清单变化或 provider adapter 更新对本项目任务完成率的影响；需要本项目的版本化回归与真实运行观测。

以上未知项需要在对应真实业务闭环中取得证据；它们不是本次研究范围内实施新控制机制的理由。
