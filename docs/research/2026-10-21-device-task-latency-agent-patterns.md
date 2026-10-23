# 工具密集 Agent 的端到端延迟：一线框架与产品的一手做法

日期：2026-10-21。状态：只读研究，未修改任何代码或其它文档。

范围：本 Runtime 的“草案 / 能耗”类设备任务——即“发现候选设备 → 读设备状态 / 汇总能耗 → 生成可确认的提案 → 用户确认 → 写入 → 回读”这条多轮工具链。研究对象是主流 Agent 框架与协议（OpenAI Agents SDK、Anthropic 工具调用与工程博客、Vercel AI SDK、LangGraph、Google ADK、ACP、MCP）如何组织工具轮次、如何削减轮次、如何做工具执行延迟工程、如何区分感知延迟与实际延迟、以及“确认后执行”的提案流程如何避免重复读状态与重复生成提案。

非目标：草稿通道 UI（另有并行工作）；prompt caching 基础（[`2026-10-21-agent-latency-patterns.md`](./2026-10-21-agent-latency-patterns.md) 已覆盖）；不写代码。

## 方法

- 只读一手来源：官方文档、官方 SDK 类型定义 / 发布包源码、协议规范、第一方工程博客。不使用二手综述。
- 访问日期均为 2026-10-21。两处访问受限，已在正文标注替代路径：
  - Anthropic 文档站（`docs.claude.com` / `platform.claude.com`）在本机按区域重定向到 “App unavailable in region”，因此 Anthropic 侧证据改用其官方工程博客（`anthropic.com/research/*`，可访问）与官方 Python SDK 1.17.0 的类型源码（PyPI 发布包）。
  - OpenAI 平台文档（`developers.openai.com/api/docs/*`）返回 403，改用 OpenAI Agents SDK 文档与 `openai-agents` 官方发布包源码。
- 基线数字沿用既有实测，不重新测量：普通问答 p50 11.8s、只读 13.7s、能耗 26.3s、草案 35.5s；单轮“请求→响应头”p50 5.7s；旧构建能耗工具 p50 5.7s、草案工具 p50 16.2s，`propose_action_draft` p50 6.7s / p95 42s【基线】。

## 证据分级

- **【证据】**：厂商文档、协议规范或官方 SDK 源码明确写出；或本仓库既有实测。
- **【推论】**：由文档语义推导，文档本身没有直接陈述；或跨来源组合得出的判断。
- **【未验证】**：本次未找到一手来源，或来源访问失败。

---

## 0. 摘要：五个问题的一句话答案

| 问题 | 一手资料给出的答案 | 证据 |
| --- | --- | --- |
| 工具轮次如何组织 | 全部框架都是“模型 → 工具 → 模型”的循环，差别只在**上限默认值**、**并发执行粒度**、**暂停/恢复语义**三处；没有框架允许跳过“工具结果回到模型”这一步（PTC 除外） | [1][2][10][11][12][17][19][22][24] |
| 能否减少轮次 | 有，且是官方推荐的：服务端确定性编排（workflow 代替 agent）、单次复合工具、程序化工具调用（模型写代码在沙箱里连调多个工具）。代价是可观测性下降、错误定位变难、授权边界需要重新划 | [4][7][8][9][21][22][24] |
| 工具执行延迟 | 默认并行只读扇出（OpenAI 启动全部、Vercel 并发、Anthropic 默认允许并行、LangGraph ToolNode 自动并行）；有依赖时必须显式降为串行；连接复用有官方支持但是可选 | [1][10][12][19][26] |
| 感知 vs 实际 | 一线做法是把“工具级状态机”外露（pending/in_progress/completed/failed），而不是只给一个 loading；进度事件可流式、可瞬时（transient），但不可撤回动作不能乐观呈现 | [2][13][14][15][25][26][28] |
| 确认流程防重复 | 用工具调用 ID 绑定提案；用可序列化快照恢复；恢复时**要么不重跑中断节点，要么保证重跑幂等**；提交必须原子消费，防止重放 | [3][16][18][23][24][25] |

---

## 1. 各框架/产品如何组织一次工具调用轮次

### 1.1 OpenAI Agents SDK：显式 agent loop + `max_turns` + 两级并发

**循环语义**【证据】：调用 `Runner.run*` 后，runner 反复执行“调模型 → 若判定为最终输出则结束；若是 handoff 则换 agent 继续；若有 tool calls 则执行工具、把结果追加进输入、再调模型”。“最终输出”的判定规则是**产出期望类型的文本且没有工具调用** [1]。

**轮次上限**【证据】：默认 `DEFAULT_MAX_TURNS = 10`（`agents/run_config.py`），超过则抛 `MaxTurnsExceeded`；传 `max_turns=None` 可关闭上限 [1][5][6]。这意味着框架把“收口”做成异常而不是“降级回答”——调用方必须自己决定超限后的用户可见结果。

**两层并发**【证据】：`ModelSettings.parallel_tool_calls` 控制**模型是否被允许在一次响应里发多个工具调用**；`RunConfig.tool_execution.max_function_tool_concurrency` 控制**SDK 实际同时执行多少个本地函数工具**。默认 `None` 表示“模型发多少就同时起多少” [1]。这个区分对本项目很关键：能不能并行是模型侧问题，串不串行是执行侧问题。

**进度事件**【证据】：流式接口分两层——`raw_response_event`（原始 token 级，含 `response.output_text.delta`）与 `RunItemStreamEvent`（item 完成后才发）。item 事件名是固定语义集合：`tool_called`、`tool_output`、`message_output_created`、`reasoning_item_created`、`mcp_approval_requested` 等 [2]。也就是说，“工具开始 / 工具结束”是可订阅的官方事件，不需要自己推断。

**暂停与恢复**【证据】：`needs_approval=True` 或谓词函数 → 运行暂停，`result.interruptions` 携带 `ToolApprovalItem`（含 agent 名、工具名、参数）；`result.to_state()` 得到 `RunState`，可 `to_json()` 持久化、跨进程 `from_json()` 恢复，再 `state.approve/reject` + `Runner.run(agent, state)` 继续 [3]。`always_approve=True` 的“粘性决定”绑定在 `RunContextWrapper` / `RunState` 上，函数工具的粘性决定按 agent 作用域生效 [3]。

**预检**【证据】：`pre_approval_tool_input_guardrails=True` 让函数工具的输入 guardrail 在**发出审批中断之前**先跑一遍；审批通过后、真正执行前**再跑同一套 guardrail**，文档明确说这是为了“让时效性检查在执行前重新校验” [1]。这是“确认前预检 + 执行前复检”的官方双层模式。

### 1.2 Anthropic：并行是默认，参数可以流式，编排可以下沉到代码

**并行默认**【证据】：`tool_choice` 各变体（`auto` / `any` / `tool`）都带 `disable_parallel_tool_use`，默认 `false`，即**模型默认可以一次输出多个 tool use**；设为 `true` 时最多一个 [10]。

**参数流式**【证据】：工具定义上有 `eager_input_streaming`：为 `true` 时工具入参在生成过程中增量流出，类型边生成边推断，而不是缓冲完整 JSON 后再解析；为 `false` 时即使网关侧开了 fine-grained tool streaming 也对该工具关闭 [10]。对本项目的意义：工具参数（例如目标设备列表）不必等整段 JSON 写完才可用于“进度展示”。

**程序化工具调用（PTC）**【证据】：模型写 Python/JS 代码在沙箱里调用多个已标记 `allowed_callers` 的工具，中间结果**不进入模型上下文**，只有最终结果回模型。官方给出的量化：复杂研究任务平均 token 从 43,588 降到 27,297（-37%）；20+ 次工具调用只需 1 次推理，因为“每次 API 往返都要一次模型推理（数百毫秒到数秒）” [7]。

**工具检索**【证据】：`defer_loading: true` 的工具初始不进上下文，模型先用 Tool Search 工具检索再展开；官方明确说这是权衡——“在工具调用前多一个检索步骤，所以只有在上下文节省与准确率收益超过额外延迟时才划算”，建议工具定义 >10K tokens 或工具数 10+ 时使用 [7]。

**授权边界**【证据】：OpenAI 侧对应能力（PTC）文档明确建议：**审批敏感 / 高影响的工具更适合保持直接调用**，让人在动作被卷进一个大程序之前逐个审阅 [4]。

### 1.3 Vercel AI SDK：`stopWhen` + `prepareStep`，审批会打断循环

**循环终止**【证据】：`ToolLoopAgent` 默认 `isStepCount(20)`，即 20 步；文档说明这是防止失控循环的安全阀，并且如果默认上限截断了本可继续的循环，SDK 会打 warning 建议显式设置 `stopWhen` [11]。终止条件还有：finish reason 不是 tool-calls、工具没有 `execute`、**某个工具调用需要审批**、以及自定义 `stopWhen` [11]。

**逐步改写请求**【证据】：`prepareStep` 在每一步前可改 `model`、`messages`、`activeTools`、`toolChoice`、采样参数。文档给的典型用法是“前 3 步只暴露 search 且 `toolChoice: 'required'`，之后只暴露 analyze” [11]。这就是“用同一套工具表做分阶段收窄”的官方写法，不需要换 agent。

**并发与串行**【证据】：同一步内多个工具调用**默认并发执行**；`toolCallConcurrency` 可限制同时在跑的个数，文档明确建议“当后续调用需要观察到前面调用的副作用时设 `toolCallConcurrency: 1`” [12]。注意它只管 SDK 本地执行的工具，不改变模型能生成几个调用；`parallelToolCalls` 是 provider 侧生成开关 [12]。

**审批的真实代价**【证据】：手动审批**不会让调用原地暂停**，而是让本次生成结束并返回 `tool-approval-request` 部件；应用收集决定后再调一次模型（带 `tool-approval-response`），才执行或告知被拒。文档直接写“手动审批流程需要两次模型调用” [12]。这是本项目最该注意的一条：**确认动作本身可能引入一次完整模型往返**（基线 p50 5.7s 量级）。

### 1.4 LangGraph：super-step、ToolNode 并行、`recursion_limit` 收口

**执行模型**【证据】：图按 Pregel 式 super-step 推进；**同一 super-step 内并行**的节点一起跑，顺序节点分属不同 super-step [17]。

**工具并行**【证据】：`ToolNode` 是预置节点，“自动处理并行工具执行、错误处理与状态注入” [19]。

**收口**【证据】：`recursion_limit` 限制单次执行的 super-step 数，超过抛 `GraphRecursionError`；自 1.0.6 起默认 **1000** 步；可通过 `config={"recursion_limit": N}` 覆盖 [18]。文档还提供 `RemainingSteps` 之类的“主动”写法：在接近上限时优雅收尾，而不是靠捕获异常 [18]。

**并行扇出**【证据】：`Send` API 用于 map-reduce 式扇出：`[Send("node", {...}) for s in subjects]`，每个元素生成一个并行任务 [18]。

**状态快照**【证据】：带 checkpointer 时，LangGraph 在 **super-step 边界**保存检查点，而不是节点函数内部任意位置；中断或重试后，受影响的**节点会从头重跑**，中断点之前的代码与副作用会再执行一次 [17]。

### 1.5 Google ADK：把编排做成“不经过模型”的组件

**模板工作流**【证据】：`SequentialAgent` / `ParallelAgent` / `LoopAgent` 三种模板工作流的执行顺序**不由模型决定**，是确定性的 [20]。`ParallelAgent` 并发跑子 agent，各分支**不自动共享会话历史/状态**，结果顺序不保证 [21]。`LoopAgent` 需要自己给终止条件：`max_iterations` 或子 agent 主动升级退出 [22]。

**工具确认**【证据】：`FunctionTool(..., require_confirmation=True)` 让工具在执行前暂停等确认；也可传谓词函数（如“金额 > 1000 才要确认”）按入参动态决定 [23]。确认请求可以带 `hint` 与结构化 `payload`，模型看不到“等待中”的返回，直到本轮恢复 [23]。

**图内人工输入**【证据】：ADK 2.0 的图工作流用 `RequestInput(message, payload, response_schema)` 暂停；**默认 `rerunOnResume: false`——被中断的节点不会重跑**，用户回复直接作为该节点输出传给后继节点；只有调用了 `ctx.runNode()` 的节点才需要 `rerunOnResume: true` [24]。这与 LangGraph 的“节点重跑”语义正好相反，是第 5 节的关键对照。

### 1.6 ACP：把“工具调用状态机”写进协议

**状态**【证据】：agent 通过 `session/update` 通知 client；`tool_call` 首报字段含 `toolCallId`、`title`、`kind`（read/edit/delete/search/execute/think/fetch…）、`status`；后续用 `tool_call_update` 只传变化字段。状态集合固定为 `pending`（入参还在流式生成，或**等待审批**）、`in_progress`、`completed`、`failed` [25]。

**审批**【证据】：`session/request_permission` 携带 `toolCall: {toolCallId}` 与 `options`（`allow_once` / `allow_always` / `reject_once` / `reject_always`），client 回 `selected(optionId)` 或 `cancelled`；client 也可按用户设置自动允许/拒绝 [25]。协议把“被审的那个工具调用”用 ID 绑定，不存在“重新生成一份提案再确认”的歧义。

**计划与取消**【证据】：`session/update` 还有 `plan`（带每条目 `status` 的执行计划）、`agent_thought_chunk`、`notice`（瞬时提示，不进历史）等变体；`session/cancel` 可中断当前轮，agent 返回 `cancelled` [26]。

### 1.7 MCP：结果结构与进度是协议级能力

**调用与结果**【证据】：`tools/call` 返回 `content`（文本/图片/音频/资源链接/内嵌资源）或 `structuredContent`；工具可声明 `outputSchema`，声明后服务端**MUST**返回符合该 schema 的结构化结果，客户端**SHOULD**校验 [27]。

**进度**【证据】：请求在 `_meta.progressToken` 里给令牌，接收方**MAY**发 `notifications/progress`（`progress` 必须单调递增，`total` 可选，`message` 应可读）；双方**SHOULD**做限流避免刷屏；完成后必须停止 [28]。

**安全边界**【证据】：规范要求“**SHOULD** 始终有能拒绝工具调用的人在场”，客户端**SHOULD**对敏感操作弹确认、调用前把工具入参展示给用户、给工具调用设超时；同时明确“**MUST** 把工具注解视为不可信，除非来自可信服务端” [27]。注解能表达“是否需要开放世界访问、是否有破坏性”[8]，但不可作为授权依据【证据】。

### 1.8 轮次上限与收口对照

| 框架 | 默认上限 | 超限行为 | 中止/恢复粒度 | 证据 |
| --- | --- | --- | --- | --- |
| OpenAI Agents SDK | 10 turns | 抛 `MaxTurnsExceeded` | `RunState` 快照，可跨进程 | [1][3][6] |
| Vercel AI SDK | 20 steps | 记 warning，正常返回 | 审批返回 `tool-approval-request`，需再调一次模型 | [11][12] |
| LangGraph | 1000 super-steps（1.0.6+） | 抛 `GraphRecursionError` | checkpoint 在 super-step 边界；节点重跑 | [17][18] |
| Google ADK（模板流） | 无全局默认 | `LoopAgent` 需 `max_iterations` | 图 HITL 默认不重跑中断节点 | [22][24] |
| ACP | 协议不设 | 轮次由 agent 决定，client 可 `cancel` | `toolCallId` + permission 绑定 | [25][26] |

**小结**【推论】：主流框架给的上限（10 / 20 / 1000）都不是“性能预算”，而是防跑飞的安全阀。本项目“草案 35.5s、能耗 26.3s”的问题不在上限，而在**每多一轮就多一次 5.7s 量级的模型往返**。

---

## 2. 减少“候选发现 → 读状态 → 生成提案”轮次的手段

### 2.1 服务端确定性编排：把能确定的步骤从模型循环里拿出来

**workflow vs agent**【证据】：Anthropic 明确区分——workflow 是“用预定义代码路径编排 LLM 与工具”，agent 是“由 LLM 自己决定流程与工具用法”；并建议“先找最简单的方案”，因为 agentic 系统是**用延迟与成本换任务表现** [9]。同一篇里给出的停止条件建议包括“最大迭代次数” [9]。

**框架级实现**【证据】：
- ADK 的 `SequentialAgent` / `ParallelAgent` / `LoopAgent` 执行顺序**不咨询模型** [20][21][22]。
- LangGraph 用普通节点 + 边表达固定流水线，只有需要判断的地方才接模型 [17][19]。
- Vercel 用 `prepareStep` 在第 N 步强制 `toolChoice` 与 `activeTools`，把“先搜后析”写成代码策略而不是提示词约定 [11]。

**对本项目的映射**【推论】：“候选发现 → 读状态”是**只读且目标确定**的两步，完全可以在一次服务端调用里做完（见 2.2），只把“怎么表述 / 是否值得建议”留给模型；而“生成提案”需要模型（文案与取舍），但不该在**确认之前**反复重生成。

### 2.2 单次复合工具：官方明确推荐的合并方式

**官方示例**【证据】：Anthropic 的工效建议直接给了合并范式：
- 不要 `list_users` + `list_events` + `create_event`，而是 `schedule_event`（内部先查可用性再建事件）；
- 不要 `read_logs`，而是 `search_logs`（只回相关行与上下文）；
- 不要 `get_customer_by_id` + `list_transactions` + `list_notes`，而是 `get_customer_context`（一次性汇总该客户近期相关信息）。

理由写得很直白：**减少模型上下文里被中间结果占掉的空间**，同时“把 agent 侧的计算卸载回工具调用内部” [8]。文档也提醒：每次工具调用都要一次完整推理，五次工具流程就是五次推理加五次结果解析 [7]。

**程序化编排**【证据】：比“复合工具”更进一步的是 PTC——模型写一段代码，在沙箱里连调多个工具，中间结果不进上下文，只有最终结果回模型；官方称这消除了 19+ 次推理往返 [7]。限制同样明确：生成的程序跑在一次性 V8 环境，无 Node API、无文件系统与网络，只能碰显式允许的工具 [4]。

**代价（官方承认的部分）**【证据】：
- 可观测性：中间结果不进上下文，也意味着模型与日志都看不到中间态；PTC 的 child call 需要靠 `caller` 关系区分（OpenAI 会把 `program` 与其子调用都记为 `ToolCallItem`）[4]。
- 错误恢复：程序化调用下，模型请求的重试边界被收紧（SDK 会关闭 provider 管理的重试与 WebSocket 事件前重试）[4]。
- 授权边界：审批敏感工具应保持直接调用 [4]。
- 工具检索的额外步骤会加延迟，只有上下文收益足够大才划算 [7]。

### 2.3 预取与预检：一手资料里真正被文档化的部分

**预检（授权前）**【证据】：OpenAI 的 `pre_approval_tool_input_guardrails` 在审批中断前跑输入 guardrail，审批后再跑一次 [1]；ADK 的 `require_confirmation` 可传谓词，按入参决定是否需要确认 [23]。

**预取（数据侧）**：本次**没有**在一手文档里找到“框架内置的设备/资源状态预取”机制【未验证】。可用的相邻证据是会话/连接级复用：OpenAI 的 Responses WebSocket transport“推荐用于连接复用”，但**一条连接一次只处理一个响应，且连接上限 60 分钟** [1]。因此“预取”在本项目只能作为应用层设计，而不是框架能力【推论】。

**对本项目的可用形态**【推论】：把“同 hub 的只读状态”在**打开会话/切换 hub 时**读一次并带上 `readAt` 时间戳，后续轮次先判断时间戳是否在可接受窗口内；超出窗口才重读。这不是缓存设备状态（会违背“不能跳过回读”），而是缓存**只读候选与目录**这类变化慢的数据。

### 2.4 结果合并与裁剪：让每次工具返回都值得一次模型往返

**高信号返回**【证据】：Anthropic 建议工具只返回高信号字段，避免 `uuid`、`256px_image_url`、`mime_type` 这类低层标识；必要时用 `response_format: concise | detailed` 让模型自选详细度（官方示例里 concise 版约为 detailed 的 1/3 token）[8]。同时建议对可能吃满上下文的返回实现分页、范围选择、过滤、截断，并给默认值；Claude Code 默认把工具返回限制在 25,000 token [8]。

**结构化返回**【证据】：MCP 的 `outputSchema` + `structuredContent` 让客户端可校验、可类型化使用，并**SHOULD** 同时在 `content` 里放一份序列化 JSON 以兼容旧客户端 [27]。

**对本项目的映射**【推论】：草案工具返回“候选设备 + 当前状态 + 状态版本号 + 不可执行原因”一份结构化对象，比“先返回候选、再被要求读状态”少一整轮；但要把字段裁到决策必需，否则省下的 5.7s 会被更大的输入 token 吃掉一部分。

### 2.5 是否存在 documented pattern：结论表

| 手段 | 是否有一手文档的直接支持 | 关键代价 | 证据 |
| --- | --- | --- | --- |
| 服务端确定性编排（workflow 取代 agent 决策） | 是，Anthropic 明确区分并推荐先简单后复杂；ADK/LangGraph/Vercel 均有确定性编排原语 | 灵活性下降；异常路径需要显式分支 | [9][11][20][21] |
| 单次复合工具（发现+读状态一次返回） | 是，Anthropic 给出多个合并范式与理由 | 返回体变大；错误定位从“哪一步失败”变成“复合体内部哪一段失败” | [7][8] |
| 模型写代码连调工具（PTC） | 是，Anthropic 与 OpenAI 都有文档与量化 | 中间态不进上下文/日志；重试边界收紧；审批敏感工具不建议纳入 | [4][7] |
| 工具检索 / 延迟加载 | 是 | 多一个检索步骤，工具少时反而更慢 | [7] |
| 预取设备状态 | 否（未找到框架级能力） | 可能读到过期状态；与“必须回读”的约束冲突 | 【未验证】 |

---

## 3. 工具执行本身的延迟工程

### 3.1 并行只读扇出

**默认行为**【证据】：OpenAI 默认启动模型一次发出的全部本地函数工具（`max_function_tool_concurrency=None`）[1]；Vercel 默认并发执行同一步的多个工具 [12]；Anthropic 默认允许模型一次输出多个 tool use [10]；LangGraph `ToolNode` 自动并行 [19]；ADK `ParallelAgent` 并发跑子 agent 且**不共享状态** [21]。

**何时必须串行**【证据】：Vercel 文档直接写“当后续调用需要观察到前面调用的副作用时用 `toolCallConcurrency: 1`”，并按模型生成顺序串行启动 [12]。OpenAI 用同一个旋钮的整数形式表达（例如 2）[1]。

**对本项目的映射**【推论】：现约束是“同 hub 串行、不同 hub 最多 3 路并发”。这与框架的并发旋钮天然一致：把 hub 当作并发键，**跨 hub 扇出**用 3，**同 hub 内**保持串行；不要用全局 1，否则不同 hub 的只读也会被串起来。

### 3.2 批量与合并

**有文档的合并**【证据】：复合工具（2.2）与 PTC 是“把 N 次工具往返压成 1 次模型往返”的两种官方形态 [7][8]；OpenAI 的 PTC 描述为“适合有界、且能从循环/分支/并行/中间计算中获益、又不希望每次工具调用后都回模型的工作流” [4]。

**没有找到证据的部分**【未验证】：交互路径上的“批量接口 / 请求合并（request coalescing）”没有一手文档支撑；能找到的只有 SDK 层并发上限与协议层进度限流 [12][28]。把能耗汇总做成一次批量查询属于工程实现，不是框架模式。

### 3.3 连接复用

**证据**：OpenAI Agents SDK 的 Responses WebSocket transport 被文档“推荐用于连接复用”，并给出 `responses_websocket_session()` 跨多次 run 复用的写法；同时列出硬约束——**一条连接一次只处理一个响应、连接最长 60 分钟**，重连后 `store=False`/ZDR 流程无法恢复未缓存的 `previous_response_id`；文档还建议“可靠性优先于 WebSocket 延迟时用 HTTP/SSE” [1]。

**【推论】**：连接复用省的是建连与 TLS，不省模型推理；对 5.7s 的 p50 请求-响应头时间，收益量级有限，且会引入“长连接 + 单飞”的排队风险。对本项目（微信小程序 NDJSON）不建议把长连接复用当成主要优化项。

### 3.4 缓存不可变结果

**证据**：MCP 的工具注解可以表达“是否需要开放世界访问、是否有破坏性”[8]，规范同时要求把注解当作**不可信**输入 [27]。OpenAI 的 `RunState` 序列化包含执行状态与待处理调用，可持久化后恢复 [3]。

**【推论】**：把“设备目录 / 房间-设备映射 / 能力枚举”这类**变化慢且只读**的结果做进程内缓存是安全的；把“设备当前状态 / 能耗读数”做缓存则与“不能靠跳过回读换速度”的约束冲突。缓存键应包含 hub 与快照版本，缓存值必须带 `readAt`。

### 3.5 安全边界（官方原文要点）

- MCP：客户端**SHOULD**对敏感操作弹确认、调用前展示入参、设超时、记审计日志；注解**MUST** 视为不可信 [27]。
- OpenAI：审批敏感工具不要塞进程序化调用；`RunState` 反序列化**不校验**快照归属，必须在服务端保存快照、由服务端鉴权与授权、只把待决项的不透明 ID 发给审核人、并用原子状态迁移防止同一快照被恢复两次 [3]。
- ACP：`name` 只是元数据，“不宣告能力，也不授予授权” [25]。

---

## 4. 感知延迟与实际延迟

### 4.1 官方事件面：把“在做什么”做成可订阅状态，而不是一个转圈

| 框架/协议 | 事件面 | 粒度 | 证据 |
| --- | --- | --- | --- |
| OpenAI Agents | `raw_response_event`（token 级）+ `RunItemStreamEvent`（`tool_called` / `tool_output` / `mcp_approval_requested`…） | 工具开始/结束 | [2] |
| Vercel AI SDK | `useChat().status` = `submitted` / `streaming` / `ready` / `error`；消息 `parts` 里工具部件状态 = `input-streaming` → `input-available` → `approval-requested` → `approval-responded` → `output-available` / `output-error` / `output-denied` | 单工具调用级 | [13][14] |
| Vercel 自定义数据 | `writer.write({type:'data-*', id, data, transient})`，同 id 自动对账；`transient` 只走 `onData`、不进历史 | 任意业务进度 | [15] |
| ACP | `session/update`：`plan`（每步 `status`）、`tool_call` / `tool_call_update`（pending/in_progress/completed/failed）、`notice`（瞬时、不进历史）、`usage_update` | 计划级 + 工具级 | [25][26] |
| MCP | `notifications/progress`（`progress` 单调递增、`total` 可选、`message` 可读） | 长任务级 | [28] |
| ADK | 图 HITL 的 `RequestInput(message, payload, response_schema)`，client 可用 schema 渲染表单 | 中断点级 | [24] |

**共同点**【推论】：一线做法不是“更快的 spinner”，而是**把状态机外露**：用户看到的是“正在读取 3 台设备 / 第 2 台完成 / 需要你确认”，而不是“处理中”。这类事件不缩短真实延迟，但把“无反馈的等待”变成“可解释的进度”。

### 4.2 为什么“先给结论再干活”在不可撤回 UI 上不成立

**证据**：Vercel 的手动审批是**两段式**：第一次生成只产出 `tool-approval-request`，不执行工具；拿到 `tool-approval-response` 后再调一次模型才执行 [12]。ACP 把等待审批的状态明确标成 `pending`，并允许 `cancelled` [25]。

**【推论】**：对“设备写入”这类不可撤回动作，乐观展示（先渲染“已开启空调”再等确认）会造成三类问题：确认被拒后 UI 需要回滚、回读失败时状态与文案不一致、重放/并发提交时同一快照被恢复两次。官方协议给出的解法是**状态先行、结果后置**：`pending → in_progress → completed|failed`，且 `completed` 只在工具真的返回后出现。

### 4.3 适合 / 不适合的模式

| 模式 | 适合 | 不适合 | 证据 |
| --- | --- | --- | --- |
| 工具级状态机（pending/in_progress/completed/failed） | 所有工具调用；尤其读状态、批量汇总 | — | [25] |
| 瞬时进度（transient，不进历史） | “正在读取…”“已排队…”这类一次性提示 | 需要审计留痕的关键节点 | [15][26] |
| 计划外露（plan，带每条 status） | 多步草案流程，让用户知道还差几步 | 步骤本身不确定、频繁变化的探索 | [26] |
| 参数流式（`eager_input_streaming`） | 提前展示“要对哪些设备做什么” | 参数可能被模型后续修正时，提前展示会误导 | [10] |
| 乐观 UI / 预写结果 | 可撤回、幂等的展示性操作 | 设备写入、扣费、通知发送 | [3][12][25] |
| 进度条百分比 | 有 `total` 的批量任务 | 步数未知的探索式调用 | [28] |

---

## 5. “用户确认后执行”的提案流程：如何不重复读、不重复生成

这一节是本次研究里一手资料最扎实的部分，因为四个框架各自踩过坑并写进了文档。

### 5.1 用调用 ID 绑定提案，而不是“再生成一次”

- ACP：`session/request_permission` 的参数就是 `toolCall: {toolCallId}`，选项是 `allow_once` / `allow_always` / `reject_once` / `reject_always`；用户选完回 `optionId`，agent 不需要重新生成提案 [25]。
- OpenAI：`ToolApprovalItem` 带 `call_id`；粘性决定按“工具身份 + 调用 ID”作用域生效，函数工具的粘性决定不跨 agent 继承 [3]。
- Vercel：`tool-approval-request` 部件带 `approvalId` 与完整 `toolCall`，回填时用该 ID 关联 [12]。

**【推论】**：本项目应把“草案”当成**一个带 ID 的持久对象**（`proposal_id` + `snapshot_id` + 目标设备 + 参数 + 生成时间 + 状态），确认接口只接受 `proposal_id + decision`，**不接受客户端回传的参数**。OpenAI 文档对审核接口的要求同理：只接受服务端存储的待决项 ID 与布尔决定，拒绝客户端替换工具调用或序列化状态 [3]。

### 5.2 快照与恢复：两种语义，别混用

| 语义 | 代表 | 恢复时发生什么 | 要求 | 证据 |
| --- | --- | --- | --- | --- |
| **不重跑中断节点** | ADK 图 HITL（默认 `rerunOnResume: false`） | 用户回复直接作为该节点输出传给后继 | 无（但节点内已算好的东西必须随快照保存） | [24] |
| **重跑中断节点** | LangGraph `interrupt()` | 节点从头重跑，`interrupt()` 之前的代码与副作用会再执行 | 中断前的副作用**必须幂等**（upsert、read-before-write、幂等键） | [16][17] |

LangGraph 原文的措辞值得照抄进设计评审：“因为 interrupt 通过重跑所在节点实现，interrupt 之前调用的副作用**应当**幂等”；建议是“幂等操作放在 interrupt 前、副作用放在 interrupt 后、把副作用拆到独立节点” [16]。同一页给出反例：节点里先更新记录再 interrupt，恢复时会重复更新或产生重复记录 [16]。

**对本项目的建议**【推论】：选择 ADK 式语义——确认前生成草案时把“读到的状态快照 + 计算出的目标参数”一起写进 `RunState` 等价物；确认后**只执行写入**，不重跑“发现候选 / 读状态 / 生成提案”。这样确认动作的额外成本只剩一次写入 + 一次回读，而不是又一轮 5.7s × N。

### 5.3 幂等与并发：三个官方约束

1. **重放防护**【证据】：OpenAI 要求“与存储协调每个待决请求的消费，使并发或重放的提交不能把同一快照恢复两次；共享存储里要用原子的、带 owner 校验的状态迁移” [3]。
2. **粘性决定的作用域**【证据】：`always_approve` 对 shell / apply_patch 是**按工具类型与名称**匹配，不按 agent；文档专门警告“不同权限的 executor 共享审批状态时，一个 always_approve 可能作用到另一个 agent 的同名工具” [3]。本项目若做“本会话内始终允许调温”，必须绑定到具体设备 + 动作 + 会话，而不是工具名。
3. **版本标记**【证据】：OpenAI 建议“如果审批可能搁置较久，把 agent 定义或 SDK 的版本标记与序列化状态一起存”，以便反序列化时路由到匹配的代码路径 [3]。

### 5.4 预检缓存与版本号：可以省什么、不能省什么

**可以省**（确认前，只读、可重复）：候选发现、设备目录、能力枚举、房间映射、上一次已知状态（带 `readAt`）【推论，依据 3.4】。

**不能省**（确认后，必须新鲜）：写入前的目标设备在线性/可执行性校验、写入后的回读【推论，依据项目约束与 1.1 的“执行前复检”模式】。

**官方支持的复检模式**【证据】：OpenAI 的 pre-approval guardrail 在审批后、执行前**再跑一次**，理由正是“时效性检查要在执行前重新校验” [1]。把它映射到本项目：确认前用快照做一次“可执行性预检”（设备在线、模式合法、权限允许），确认后执行前**再校验一次**（此时可以只查差异，不必重读全量状态）。

**提案版本号**：ACP 用 `toolCallId` 区分同一会话内不同调用 [25]；ADK 的 interrupt ID 建议“稳定前缀 + UUID”以避免跨 workflow 运行碰撞 [24]。**【推论】** 本项目的 `proposal_id` 应同时带 `snapshot_version`（设备状态版本或 `readAt`），确认时若版本已过期，只做“差异重读 + 局部重算”，而不是整条链路重跑。

### 5.5 剩余风险（未被任何框架解决的部分）

- **跨进程恢复**：`RunState` 反序列化不做身份校验，必须靠应用层鉴权 [3]。小程序场景下，恢复请求来自客户端，服务端必须自己绑定 `openid + proposal_id`。
- **审批搁置过久**：设备状态、电价、时段都会变；框架只给“版本标记”建议，不给 TTL 策略 [3]。
- **重复提交**：ACP 的 `cancelled` 与 `selected` 是两种不同结果 [25]，客户端重试时必须区分，否则会把“取消”当成“拒绝”再弹一次。

---

## 6. 与当前基线的对照

| 环节 | 现状（基线） | 一手资料支持的可动部分 | 预期作用（推断） | 依据 |
| --- | --- | --- | --- | --- |
| 普通问答 | p50 11.8s | 与本主题无关（不涉及工具轮次） | — | 【基线】 |
| 只读 | p50 13.7s | 单轮工具 + 一次模型收尾，已接近下限 | 小 | 【基线】 |
| 能耗 26.3s | 比普通问答多 14.5s | 若“发现候选 + 读状态 + 汇总”压成一次复合只读调用，可去掉 1–2 次模型往返（每次 p50 5.7s） | −5.7s ~ −11.4s | [7][8] |
| 草案 35.5s | 比普通问答多 23.7s；旧构建草案工具 p50 16.2s、p95 42s | 复合只读工具 + 确认后不再重生成；p95 主要被工具尾部拖长 | 中位数与尾部都要分别看 | [7][8][12] |
| 确认动作 | 未测量 | Vercel 明确“手动审批需要两次模型调用”；ADK 式语义可把第二次调用降为“仅执行” | 取决于是否重生成 | [12][24] |

**重要限制**【推论】：上表的 −5.7s/−11.4s 是“每去掉一次模型往返”的算术上限，未计入输入 token 变大带来的 TTFT 上升、复合工具内部串行 IO、以及网关抖动。必须实测，不能按算术值承诺。

---

## 7. 对本项目可执行结论（≤6 条）

| # | 优先级 | 结论 | 预期 | 风险 | 需实测 |
| --- | --- | --- | --- | --- | --- |
| 1 | **P0** | 把“候选发现 + 读状态”合并为一个服务端复合只读工具，返回“候选 + 当前状态 + 状态版本 + 不可执行原因”一份结构化结果 | 能耗/草案各去掉 1–2 次模型往返（p50 5.7s/次） | 返回体膨胀抬高 TTFT；错误定位从“哪一步”变成“复合体哪一段”；需保留分阶段 `status` 事件补偿可观测性 | 复合工具返回体 token 数、p50/p95、失败时的可诊断性 |
| 2 | **P0** | 提案改为“服务端组装参数 + 单次模型只产出文案/取舍”，并把草案生成移出“确认前必须完成”的路径（可先给结构化摘要，文案随后补齐） | 草案 p95（旧构建 42s 的尾部）主要来自重复生成 | 文案自然度下降；若用户先看到摘要再看到文案，需要明确“未完成”状态 | 草案 p50/p95、用户是否在两次渲染间误操作 |
| 3 | **P1** | 确认流程改为 `proposal_id + snapshot_version` 绑定，确认后**不重跑**发现/读状态/生成，只做“执行前差异复检 + 写入 + 回读” | 确认动作不再引入新的模型往返（对照 Vercel 的“两次调用”代价） | 快照过期导致执行失败；需 TTL 与版本冲突时的“只重读差异”路径 | 确认→执行的端到端耗时、快照过期率 |
| 4 | **P1** | 进度事件先行：按 ACP 的工具状态机（`pending/in_progress/completed/failed`）在小程序 NDJSON 里先发“正在读取 N 台设备 / 第 k 台完成”，不可撤回动作不发 `completed` 直到回读成功 | 不减少真实延迟，但把无反馈等待变成可解释进度 | 事件过多会拖慢 NDJSON 通道；瞬时提示不得进历史 | 首事件到达时间、事件数与总时长的关系 |
| 5 | **P2** | 并行只读扇出按 hub 分键：跨 hub 3 路、同 hub 串行；不要全局串行 | 多 hub 场景的只读/汇总阶段近似线性下降 | 网关侧限流与设备网关承载未知；并行会放大尾部失败率 | 不同并发度下的 p50/p95 与失败率 |
| 6 | **P2** | 补齐观测：每轮模型调用计数、工具阶段耗时、轮次分布、复合工具内部子步骤耗时 | 没有这些无法验证 1–3 是否真的减少了轮次 | 观测本身增加开销 | 采样开销、与真实请求延迟的偏差 |

**明确不做**【推论】：

- 不引入 PTC / tool search：两者都是 OpenAI Responses 与 Anthropic 的模型侧能力，当前 GLM / OpenAI-compatible Chat Completions 路径没有对应协议（参见 [`2026-10-21-agent-latency-patterns.md`](./2026-10-21-agent-latency-patterns.md) 对 Z.AI `tool_choice` 仅 `auto`、无 tool search 的记录）。
- 不把“预取设备状态”当成提速手段：一手资料里没有框架级预取；且与“不能跳过回读”的约束冲突。
- 不为了并行而并行：同 hub 的读写串行是正确性约束，不是性能缺陷。

---

## 8. 未验证 / 待实测

1. **Anthropic 官方文档正文未能访问**：`docs.claude.com` / `platform.claude.com` 在本机按区域重定向；本节 Anthropic 结论来自其工程博客（`anthropic.com/research/*`）与 Python SDK 1.17.0 类型源码。并行工具调用的**行为细节**（例如模型是否保证把多个 tool_use 放在同一条消息里）未在文档正文核实。
2. **OpenAI 平台文档 403**：`developers.openai.com/api/docs/guides/function-calling`、`.../tools-programmatic-tool-calling` 未取到；PTC 的语义来自 Agents SDK 文档与其引用的平台指南链接。
3. **`max_turns=10` 的出处**：数值取自 `openai-agents` 官方发布包 `agents/run_config.py`（`DEFAULT_MAX_TURNS = 10`），Ref 页面只列出常量名未直接展示数值。
4. **MCP 工具注解的具体字段名**（是否只读 / 破坏性 / 开放世界）未在本次访问的 2025-06-18 Tools 页面正文列出字段清单；结论依赖 Anthropic 博客对注解用途的描述与规范“注解不可信”的约束。
5. **“请求合并 / 批量接口”在交互路径上的官方模式**：未找到；只有 SDK 并发上限与进度限流。
6. **Z.AI / GLM 是否支持单轮多 tool calls**：沿用既有研究的未验证项，需真实请求验证。
7. **小程序 NDJSON 的事件密度上限**：无一手资料，需本机实测。

---

## 9. 参考来源（访问日期均为 2026-10-21）

1. OpenAI Agents SDK, *Running agents*（agent loop、`max_turns`、`tool_execution.max_function_tool_concurrency`、`pre_approval_tool_input_guardrails`、WebSocket transport）. https://openai.github.io/openai-agents-python/running_agents/
2. OpenAI Agents SDK, *Streaming*（`raw_response_event`、`RunItemStreamEvent` 事件名、审批暂停与恢复）. https://openai.github.io/openai-agents-python/streaming/
3. OpenAI Agents SDK, *Human-in-the-loop*（`needs_approval`、`RunState` 序列化、审核服务端要求、原子消费、版本标记）. https://openai.github.io/openai-agents-python/human_in_the_loop/
4. OpenAI Agents SDK, *Tools*（Hosted tool search、Programmatic Tool Calling、`allowed_callers`、审批敏感工具建议）. https://openai.github.io/openai-agents-python/tools/
5. OpenAI Agents SDK, *API reference: run_config*（`DEFAULT_MAX_TURNS`）. https://openai.github.io/openai-agents-python/ref/run_config/
6. `openai-agents` 官方发布包（`agents/run_config.py`：`DEFAULT_MAX_TURNS = 10`）. https://pypi.org/project/openai-agents/
7. Anthropic, *Introducing advanced tool use for Claude*（Tool Search、Programmatic Tool Calling、延迟与 token 量化）. https://www.anthropic.com/research/advanced-tool-use
8. Anthropic, *Writing effective tools for agents*（工具合并范式、`response_format`、截断与 token 效率、注解用途）. https://www.anthropic.com/research/writing-tools-for-agents
9. Anthropic, *Building effective AI agents*（workflow vs agent、parallelization、检查点人工反馈、最大迭代次数）. https://www.anthropic.com/research/building-effective-agents
10. `anthropic` Python SDK 1.17.0 类型源码（`types/tool_choice_auto_param.py` 的 `disable_parallel_tool_use` 默认 false；`types/tool_param.py` 的 `eager_input_streaming` 语义）. https://pypi.org/project/anthropic/
11. Vercel AI SDK, *Loop Control*（`stopWhen`、默认 20 步、`prepareStep` 改 `activeTools`/`toolChoice`/model、审批中断循环）. https://ai-sdk.dev/docs/agents/loop-control
12. Vercel AI SDK, *Tool Calling*（`toolCallConcurrency`、`parallelToolCalls` 的区别、`toolApproval` 与“两次模型调用”）. https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
13. Vercel AI SDK, *Chatbot*（`useChat` 的 `status` 四态）. https://ai-sdk.dev/docs/ai-sdk-ui/chatbot
14. Vercel AI SDK, *Chatbot Tool Usage*（工具部件状态机、`sendAutomaticallyWhen`）. https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage
15. Vercel AI SDK, *Streaming Custom Data*（data part、同 id 对账、`transient`）. https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data
16. LangGraph, *Interrupts*（`interrupt()`、`Command(resume=...)`、中断前副作用必须幂等、多中断按 ID 映射）. https://docs.langchain.com/oss/python/langgraph/interrupts
17. LangGraph, *Graph API overview*（super-step、检查点在 super-step 边界、恢复时节点重跑、幂等要求）. https://docs.langchain.com/oss/python/langgraph/graph-api
18. LangGraph, *Use the graph API*（`Send` map-reduce、`recursion_limit` 默认 1000、`RemainingSteps` 主动收尾）. https://docs.langchain.com/oss/python/langgraph/use-graph-api
19. LangGraph, *Workflows and agents*（`ToolNode` 自动并行工具执行、parallelization 模式）. https://docs.langchain.com/oss/python/langgraph/workflows-agents
20. Google ADK, *Template agent workflows*（Sequential / Parallel / Loop 均为非模型决定的确定性编排）. https://adk.dev/agents/workflow-agents/
21. Google ADK, *Parallel template workflow agent*（并发、分支不共享状态、结果顺序不确定）. https://adk.dev/agents/workflow-agents/parallel-agents/
22. Google ADK, *Loop template workflow agent*（`max_iterations`、需显式终止条件）. https://adk.dev/agents/workflow-agents/loop-agents/
23. Google ADK, *Get action confirmation for ADK Tools*（`require_confirmation`、谓词函数、`hint`/`payload`、等待期模型不可见）. https://adk.dev/tools-custom/confirmation/
24. Google ADK, *Human input for agent workflows*（`RequestInput`、`rerunOnResume` 默认 false、interrupt ID 建议）. https://adk.dev/graphs/human-input/
25. ACP, *Tool Calls*（`toolCallId`、`kind`、状态集合、`session/request_permission` 与权限选项、name 不授予授权）. https://agentclientprotocol.com/protocol/v1/tool-calls
26. ACP, *Prompt Turn*（`session/update` 变体、`plan`、`notice`、`session/cancel`）. https://agentclientprotocol.com/protocol/v1/prompt-turn
27. MCP, *Tools*（`tools/call`、`structuredContent` / `outputSchema`、人工在场 SHOULD、敏感操作确认、注解 MUST 视为不可信）. https://modelcontextprotocol.io/specification/2025-06-18/server/tools
28. MCP, *Progress*（`progressToken`、`notifications/progress`、单调递增、限流 SHOULD）. https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/progress
29. 本仓库：*Agent 请求延迟与答复交付协议研究*，2026-10-21. `docs/research/2026-10-21-agent-response-latency-and-delivery.md`
30. 本仓库：*工具调用 Agent 的文本流与延迟模式*，2026-10-21（GLM / Z.AI 能力边界与缓存约束）. `docs/research/2026-10-21-agent-latency-patterns.md`
