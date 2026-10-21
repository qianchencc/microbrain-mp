# 工具调用 Agent 的文本流与延迟模式：一手资料综述

日期：2026-10-21。状态：只读研究，未修改生产代码。

范围：单一 OpenAI-compatible GLM 网关、工具调用型 Agent、小程序不可撤回 UI。本文回答两组问题：

1. 上游已流式产出文本时，主流框架是否立即发布文本 delta，即使同一轮随后可能出现工具调用？它们缓冲、标注还是隐藏？文本与工具事件的顺序是什么？不可撤回 UI 有哪些可选策略？
2. 在相同链路上，prompt caching、会话预热、工具路由、减少轮次分别有什么一手证据？哪些能在不换模型、不增加第二次模型调用的前提下落地？

证据分级：

- **[实测]**：厂商公布的生产测量，或本仓库内有请求边界记录的测量。
- **[文档]**：厂商文档 / API reference 明确写出，但未给出可复现测量。
- **[推断]**：由文档语义推导，文档没有直接陈述。

> **状态校正（2026-10-21 实施后）**：本文 §0 的前两项 P0 已在当前 Runtime 分支完成——`runtime_final_reply` / `reply_to_user` 已删除，普通文本直接作为公开答复；Company 目录已按身份共享快照。本文 §7.1 引用的“仍要求 reply_to_user”“每轮重新加载目录 12.33s”是 2026-09-28 的历史事实，不代表当前代码。当前真正的剩余问题是：为了避免工具调用前的规划泄漏，`pi-runner` 仍把整条 assistant 文本缓冲到 `message_end` 才发布，导致“首段可见文本 = 消息完成”。

本文与 [`2026-10-21-agent-response-latency-and-delivery.md`](./2026-10-21-agent-response-latency-and-delivery.md) 分工：该文给出本 Runtime 的请求链、30.35 秒分解和目标交付协议；本文补充厂商 / 网关侧模式、缓存与预热边界，以及流式文本在“工具调用可能跟随”时的可选策略。逐框架的流式协议细节另见并行的 [`2026-10-21-agent-streaming-tool-text-patterns.md`](./2026-10-21-agent-streaming-tool-text-patterns.md)；本文 §1 只保留回答本任务所必需的语义与 UI 选项。

---

## 0. 结论：按“效果 × 可落地性”排序

| 排序 | 模式 | 预期作用 | 证据 | 需要额外模型调用 | 对缓存前缀的影响 | GLM / OpenAI-compatible 可用性 |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | 普通文本即终态，删除 `runtime_final_reply` 二次调用 | 直接去掉一次完整模型往返 | [实测] 本仓库一次 30.35s 请求中补交占 5.26s [24]；[文档] OpenAI Agents SDK 把“无工具调用的文本”定义为最终输出 [14] | 否（是删除调用） | 中性 | 可用 |
| P0 | 稳定前缀：静态指令 / 工具定义在前，动态目录 / 状态在后，且不要每轮改工具表 | 提高 prefix cache 命中，降低 TTFT | [文档] Claude Code 的缓存布局与“会话中不要增删工具 / 换模型” [9][10] | 否 | 显著正向 | 可用（Z.AI 自动缓存 [1]） |
| P1 | 按意图选择可见通道：确定无工具的轮次直接流文本；可能调用工具的轮次用独立“规划 / 工作”通道或缓冲 | 把“首段可见文本”从消息结束提前到首 delta；避免把规划当答案 | [文档] 各 API 均暴露 raw text delta 与 tool-call delta [4][15][21][22]；[推断] 通道划分是应用层策略 | 否 | 中性 | 可用 |
| P1 | 会话粘性 / 缓存 key + 观测 `cached_tokens` | 让重复前缀命中同一后端缓存 | [文档] OpenRouter sticky routing 10 分钟、`session_id` [6]；LiteLLM `prompt_cache_key` / `prompt_cache_retention` [7] | 否 | 正向 | 部分可用：Z.AI 自动缓存，但直连 API 未公开 cache key 参数 [1][6] |
| P2 | 会话打开时预取本机目录快照；模型前缀由首个真实请求自然预热 | 去掉首请求前的本地等待；不伪造额外模型调用 | [文档] Claude Code 会话开始加载项目上下文、首次请求建立缓存；fan-out 最多等 5 秒让后续请求共享前缀 [9] | 否（若用首个真实请求） | 正向，但首请求有 cache write 成本 | 可用 |
| P2 | 并行工具调用 / 服务端批量执行，减少“模型轮次” | 把 N 次工具往返压成 1 次模型轮次 | [文档] OpenAI `parallel_tool_calls` 默认开启 [16]；Anthropic `disable_parallel_tool_use` 默认 false [21]；Vercel AI SDK 默认并发执行同轮多个工具 [20] | 否 | 中性 | 不确定：Z.AI 文档只写 `tool_choice: auto`，未文档化并行开关 [3] |
| P3 | 服务端规则路由 / tools-disabled 请求 | 简单问答不进入工具循环 | [文档] Z.AI 仅支持 `tool_choice: auto`，要禁用只能不传 `tools` [3]；[文档] 会话中增删工具会打断缓存 [10] | 规则路由否；分类器路由是 | 负向（若中途移除工具） | 可用但需权衡 |
| P3 | tool search / defer loading | 缩小工具 schema 体积，避免删除工具 | [文档] OpenAI 仅 Responses API 支持，且命名 `tool_choice` 不能指向 deferred 工具 [18]；[文档] Claude Code 用 `defer_loading` 保持前缀稳定 [10] | 否 | 正向（若实现为稳定 stub） | 不可用：GLM Chat Completions 无此协议 [3] |
| P4 | 模型级联 / 先分类再选模型 | 简单请求走小模型 | [文档] Anthropic routing 工作流 [11]；OpenAI Decisions API 可在 run 前选模型 [17] | 是（分类器或第二次模型） | 负向：换模型即换缓存 [9][10] | 可用但不满足“不加第二次调用” |

**一句话结论**：一手资料支持“先删掉额外模型调用、稳定前缀、按意图分流、观测缓存命中”；不支持“把 Z.AI 的自动缓存当成确定命中”，也不支持“在 GLM Chat Completions 上直接套用 OpenAI Responses 的 tool search / programmatic tool calling”。

---

## 1. 流式文本与工具调用：公开语义

### 1.1 OpenAI：raw delta 与 item 事件是两层

OpenAI Agents SDK 的流式接口同时提供两层事件：

- `raw_response_event`：直接透传模型事件，例如 `response.output_text.delta`。文档明确说，这类事件用于“as soon as they are generated”地把回复流给用户 [15]。
- `run_item_stream_event`：更高层事件，只在某个 item 完整生成后发出，例如 `message_output_created`、`tool_called`、`tool_output` [15]。

因此，“是否在工具调用前发布文本”在 OpenAI 侧不是框架强制策略：raw 层允许立即发布；item 层天然等到消息完整。缓冲与否由应用选择。OpenAI 的流事件类型还包含 `ResponseFunctionCallArgumentsDeltaEvent`，说明工具参数也是增量到达的 [22]。

Chat Completions 侧，`tool_choice` 支持 `none | auto | required` 以及指定工具，`parallel_tool_calls` 控制同轮并行 [23]。Responses 侧同样有 `parallel_tool_calls` 与 `tool_choice` [22]。

### 1.2 Anthropic：按 content block 流式，text 与 tool_use 都是 block

Anthropic TypeScript SDK 的类型定义显示：

- 文本增量是 `text_delta`；工具参数增量是 `input_json_delta`，字段为 `partial_json` [21]。
- `tool_choice` 有四种：`auto`（模型自行决定）、`any`（必须用某个工具）、`tool`（指定工具）、`none`（不允许用工具）[21]。
- `disable_parallel_tool_use` 默认 `false`，即默认允许并行工具调用；设为 `true` 时最多一个 tool use [21]。

这组语义说明：文本和工具调用是同一消息中的不同 content block，SDK 逐 block、逐 delta 暴露；框架没有“工具调用前的文本必须隐藏”的规定。[推断] 由于 block 按生成顺序流式到达，文本 block 的 delta 会先于后续 tool_use block 的 `input_json_delta` 到达；但文档没有承诺模型一定先写文本再写工具调用。

### 1.3 Z.AI / GLM：同一 SSE 中同时有 content、reasoning_content、tool_calls

Z.AI 的流式响应格式写明，每个 chunk 的 `choices[0].delta` 可包含：

- `content`：回复文本增量；
- `reasoning_content`：推理过程增量；
- `tool_calls`：工具调用信息（名称与参数）；
- `finish_reason` 只在最后一个 chunk 出现 [5]。

Z.AI 另有 `tool_stream=True`：开启后工具调用参数可以流式输出，“without buffering or JSON validation”，用于降低调用延迟；文档称支持 GLM-4.6 及以上系列 [3][4]。其示例代码在同一个循环里处理 `reasoning_content`、`content` 和 `tool_calls`，说明三类增量可以在同一条流中交错 [4]。

关键限制：Z.AI 的 `tool_choice` 只支持 `auto`；要阻止模型调用工具，只能不传 `tools`，不能依赖 `tool_choice: none` [3]。`tools` 最多 128 个函数 [3]。

### 1.4 Vercel AI SDK：文本 delta 与 tool-call 是不同类型，执行在生成完成之后

Vercel AI SDK 的 `streamText`/`generateText` 文档说明：

- 模型生成 tool call 时，“the model generation finishes first; the step finishes after its local tool execution completes” [20]。
- 默认只跑一步（`isStepCount(1)`）；要让工具结果回到模型并继续生成，需要设置 `stopWhen` 进入多步 [20]。
- 同一轮多个工具调用默认并发执行，可用 `toolCallConcurrency` 限制 [20]。
- `prepareStep` 可以按 step 改模型、改 `activeTools`、裁剪消息 [20]。

这给出了一个清晰的顺序模型：文本 / tool-call 增量先流出 → 工具参数完整后执行 → 工具结果作为下一步输入 → 下一步再生成文本。

### 1.5 四个直接问题的答案

| 问题 | 答案 | 证据 |
| --- | --- | --- |
| 主流框架会在工具调用可能跟随时立即发布文本 delta 吗？ | API / SDK 的 raw 层会：OpenAI 有 `output_text.delta`，Z.AI 有 `delta.content`，Anthropic 有 `text_delta`，Vercel 有 text delta。高层 item 事件则等到完整生成。 | [15][4][21][20] |
| 它们会缓冲、标注还是隐藏工具调用前的文本？ | 三者都不是框架默认：raw 事件可直接转发；`reasoning_content` / thinking block 是被单独标注的推理通道；普通 `content` 没有“preamble”标记；隐藏是应用层行为。 | [5][21][15] |
| 文本与工具事件的顺序？ | 文本 delta 和 tool-call 参数 delta 按生成顺序到达；工具执行要等参数 JSON 完整；工具结果回填后进入下一轮模型生成。 | [20][4]；[推断] 具体先后取决于模型输出顺序 |
| 不可撤回 UI 能做什么？ | 立即展示（接受规划泄漏）、整条消息结束后展示（当前行为）、见到首个 tool-call 后丢弃、双通道标注、按意图预路由。没有“先展示再撤回”的官方机制。 | [推断] 基于各 API 的 delta 语义 |

关键点：这些 API 都没有“先探测本轮是否会出现 tool call，再决定是否发布文本”的机制。文本 delta 与 tool-call delta 都是生成即到达；框架把“是否缓冲 / 是否隐藏”留给应用。因此“工具调用前文本是否可见”是产品与协议决策，不是模型能力限制。[推断，基于 15/4/21/20 的 delta 语义]

### 1.6 不可撤回 UI 的选项与代价

设“工具前文本”= 模型在发出 tool call 之前写出的普通 `content`。它可能是规划，也可能是用户真正想看的答案。

| 方案 | 首段可见时间 | 规划泄漏 | 额外模型调用 | 代价 / 风险 |
| --- | --- | --- | --- | --- |
| A. 立即展示所有 `content` delta | 首 delta | 会泄漏 | 否 | 用户可能看到“我先查一下……”这类内部规划；Anthropic 反而建议显式展示规划步骤 [11] |
| B. 整条消息结束再展示（当前） | 消息结束 | 不泄漏 | 否 | 首段可见时间 = 完成时间；这正是 7.7–31s 的体感来源 |
| C. 收到首个 `tool_calls` delta 时丢弃已缓冲文本；若 `finish_reason=stop` 则整段放出 | 无工具轮次仍在结束时 | 工具轮次不泄漏 | 否 | 无工具轮次没有变快；只解决“别把规划发出去” |
| D. 双通道：`reasoning_content` / “规划中” 与最终 `content` 分开渲染 | 首 delta | 不冒充答案 | 否 | 需要模型把规划放进 reasoning 通道；不能保证服从；UI 要能承载“工作日志”而非答案 |
| E. 意图预路由：确定无工具的请求不传 `tools`，直接流 `content`；可能用工具的请求缓冲或走 D | 首 delta | 可控 | 规则路由否；分类器是 | 中途移除工具会打断缓存 [10]；分类器增加一次调用与误判风险 |
| F. 提示模型“先给用户可见答复，再调用工具” | 首 delta | 仍可能泄漏 | 否 | 无厂商保证；工具调用前文本仍可能是规划 |

**建议**：不要把“立即展示”当成唯一解。对确定无工具的轮次用 E（不传 `tools`，直接流）；对可能用工具的轮次用 D（独立工作通道）或 C（丢弃工具前文本）。B 只应作为无法判断意图时的兜底，而不是默认路径。

---

## 2. Prompt caching：能假设什么，不能假设什么

### 2.1 Z.AI / GLM

Z.AI 的 Context Caching 文档明确：

- 自动、隐式识别重复上下文，无需手工配置；支持 GLM-5、GLM-4.7、GLM-4.6 系列 [1]。
- 命中量在 `usage.prompt_tokens_details.cached_tokens` 返回 [1]。
- 命中 token 按折扣价计费（文档示例为标准的 50%）[1]。
- “首次请求建立缓存可能稍慢”；缓存有“reasonable time limits”，过期后重新计算 [1]。

**不能假设**：该页没有给出最小可缓存 token 数、TTL 具体值、命中率保证、跨网关 / 跨账号共享规则，也没有公开的“创建缓存”或“预热”接口 [1]。因此只能把 Z.AI 缓存当作“可能命中”的优化，不能当作容量或延迟承诺；必须读 `cached_tokens` 验证。

OpenRouter 的网关文档补充了它转发给 Z.AI 的行为：自动缓存、读价约 0.2x，并且为了命中率会给 Z.AI 发送基于账号与 `session_id` 的 session affinity key [6]。这是“网关侧粘性路由”的一手证据，但也说明命中依赖网关是否真的转发 / 保持该 key。

### 2.2 OpenAI-compatible 网关

- OpenAI 自动缓存：prompt ≥ 1024 tokens 才可能命中；`prompt_cache_key` 是路由提示，`prompt_cache_retention` 可取 `in_memory`（约 5–10 分钟）或 `24h` [7]。
- OpenRouter 的 sticky routing：缓存请求后，后续同模型请求会被粘到同一 provider endpoint；闲置 10 分钟后失效；可用 `session_id` 或 `prompt_cache_key` 作为粘性 key；手动 `provider.order` 会关闭 sticky [6]。
- LiteLLM：低于 provider 最小长度时“silently skipped, no error”，必须检查 `cache_creation_input_tokens`；精确匹配缓存按整个请求 hash，多轮每轮都是新 key；semantic cache 不适合 agentic traffic [7][8]。

这意味着“OpenAI-compatible”只保证 HTTP 形状，不保证缓存语义。网关可能转发、忽略或剥离缓存标记。

### 2.3 Anthropic（作为对照）

Anthropic 的缓存以显式 `cache_control` 断点为主（网关文档也记录了请求级 automatic caching 的用法），按模型有不同最小长度（512 / 1024 / 2048 / 4096 tokens），默认 5 分钟 TTL，可设 1 小时；写缓存 1.25x（5 分钟）或 2x（1 小时），读缓存 0.1x [6]。缓存是精确前缀匹配，换模型即换缓存；缓存按组织隔离，某些 provider 还按 workspace 隔离 [9]。

Claude Code 文档还给出网关行为的关键事实：

- 网关原样转发 `cache_control`：缓存与直连 provider 相同。
- 网关以 400 拒绝带标记的请求：Claude Code 会退回到“把标记移到最后一个会话消息”，系统块按未缓存计费。
- 网关静默移除标记：整个会话历史每一轮都按未缓存计费 [9]。

这是“不能假设缓存命中”的最强一手证据：同一个请求经过不同网关，缓存结果可以从“正常命中”变成“每轮全价”。

### 2.4 对本 Runtime 的直接含义

1. **不要把动态 Company 目录放进 system prompt 或工具定义。** Claude Code 的布局原则是“静态内容在前，动态内容在后”，并把会话级更新放进消息或 tool result，避免改动缓存前缀 [10]。目录每轮变化会直接打断前缀。
2. **不要每轮重排工具或改工具描述。** 工具定义属于缓存前缀；Claude Code 团队明确说“Never add or remove tools mid-session”，并给出用 `defer_loading` 而不是删除工具的做法 [10]。
3. **不要中途换模型。** 每个模型有独立缓存；Claude Code 文档与博客都说明换模型会重算整个请求 [9][10]。
4. **必须观测 `cached_tokens` / `cache_creation_input_tokens`。** Z.AI 与 LiteLLM 都把它作为唯一可靠信号 [1][7]；LiteLLM 还警告低于最小值时不会报错 [7]。

---

## 3. 会话预热（prewarming）模式

### 3.1 Claude Code：会话开始加载，首个请求建缓存

Claude Code 的缓存文档描述了完整的预热生命周期：

- 会话开始时加载 system prompt、项目上下文（CLAUDE.md、memory、rules）；每个请求重发完整上下文，新增内容追加在末尾 [9]。
- 第一次请求建立缓存；之后每轮读取不变前缀，只处理新增 exchange [9]。
- 缓存按“机器 + 目录”有效；并行会话在同一目录可共享前缀；不同目录前缀不同 [9]。
- 子 agent 有自己的 system prompt 与工具集，首次请求不读父缓存，而是自建缓存 [9]。
- workflow fan-out 中，Claude Code 默认把除第一个外的同前缀 agent 最多 hold 5 秒，让它们的首请求能读到第一个 agent 写下的前缀 [9]。
- 编辑 CLAUDE.md 不会中途生效，也不会打断缓存；新内容在 `/clear`、`/compact` 或重启后加载 [9]。

这是“预热 = 用真实首请求建立前缀，并让后续请求复用”的典型实现：没有额外的合成模型调用，代价是首请求更慢、且必须保持前缀稳定。

### 3.2 OpenAI：连接预热与工具目录延迟加载

- Responses over WebSocket：SDK 支持复用同一 WebSocket 连接，官方建议多轮使用 `responses_websocket_session()`；服务端每条连接一次处理一个 response，连接上限 60 分钟；官方同时提醒“reliability 比 latency 更重要时用 HTTP/SSE” [14]。
- `previous_response_id` / Conversations 可让服务端保留上下文，减少重复传输；但 `store=False` + 重连后无法恢复未缓存的 `previous_response_id` [14][19]。
- Tool search：把大工具面延迟到运行时，模型只加载当前需要的子集；仅 Responses API 支持，且命名 `tool_choice` 不能指向 deferred-only 工具 [18]。
- Sessions 文档还给出一个反例：自动 compaction 可能让 `stream_events()` 在最后一个输出 token 之后继续打开“几秒”，官方建议低延迟场景关闭自动 compaction、改在轮次之间手动压缩 [19]。

### 3.3 Z.AI / 网关：没有公开的“创建缓存”接口

Z.AI 文档只描述自动缓存，没有 cache create / warm 接口 [1]。因此“预热”只能是：

- 在会话打开时先发一个使用相同 system prompt 与工具定义的真实请求（如果业务允许），或
- 直接让用户的第一个真实请求承担建缓存成本，并保证后续请求前缀不变。

OpenRouter 对 Z.AI 的 session affinity 说明，网关层可以用 `session_id` 把同会话请求粘到同一缓存 [6]；但直连 Z.AI 是否暴露等价参数，文档没有写 [1][3]。

### 3.4 预热模式的权衡

| 模式 | 收益 | 成本 / 风险 | 证据 |
| --- | --- | --- | --- |
| 首请求自然建缓存（Claude Code 式） | 无额外调用；真实请求即预热 | 首请求更慢；TTL 过期后重算 | [9] |
| 会话打开时合成一次 warm 请求 | 用户首问前缓存已热 | 多一次模型调用与 token；会话可能根本不用；cache write 计费 | [推断] 基于 [7][9] |
| 连接复用（WebSocket） | 省 TLS / 连接建立 | 60 分钟上限、一次一个 response、重连恢复限制 | [14] |
| 网关 sticky / session affinity | 提高同前缀命中 | 10 分钟闲置失效；手动 provider 顺序会关闭；网关可能不转发 | [6] |
| 工具目录 defer loading | 减少 schema token，保持前缀稳定 | 需要协议支持；GLM 不可用 | [10][18] |
| fan-out 等待首请求 | 后续同前缀请求命中 | 最多 5 秒人为等待；降低并发 | [9] |

### 3.5 预热的安全 / 授权边界

- **缓存 key 必须包含授权指纹。** 预热目录是“某个身份可看到的设备集合”，不能跨用户、跨租户复用；否则预热会变成越权数据缓存。Claude Code 的缓存按机器 / 目录隔离、子 agent 独立缓存，说明缓存不是天然按用户授权隔离的 [9]；本 Runtime 必须自己把 principal / 授权范围纳入快照 key。
- **缓存不是授权。** 预热只减少读取，不改变“控制前重新核验授权、动态状态另行读取”的边界；旧快照只能服务低风险只读查询，并携带观察时间 [24]。
- **不要把密钥或用户隐私放进可缓存前缀。** Anthropic 的缓存按组织 / workspace 隔离，不等于按终端用户隔离 [9]；共享前缀应只含公共指令与工具定义。
- **预热失败必须 fail-open 到正常读取，不能 fail-open 到旧授权。** 这是设计约束，不是厂商文档结论。

---

## 4. 工具路由：tool_choice、tools-disabled、服务端决策

### 4.1 三家 API 的能力矩阵

| 能力 | OpenAI Chat Completions | OpenAI Responses | Anthropic | Z.AI / GLM |
| --- | --- | --- | --- | --- |
| 不调用工具 | `tool_choice: none` [23] | `tool_choice` 支持 none / auto / required / 指定 [22] | `tool_choice: none` [21] | 只能不传 `tools`；`tool_choice` 仅 `auto` [3] |
| 强制调用 | `required` / 指定工具 [23] | required / 指定 [22] | `any` / `tool` [21] | 不支持 [3] |
| 并行工具 | `parallel_tool_calls` [23] | `parallel_tool_calls` [22] | 默认允许，`disable_parallel_tool_use` 关闭 [21] | 未文档化 [3] |
| 延迟加载工具 | 无（Chat） | tool search / deferred tools [18] | `defer_loading`（Claude Code 文档）[10] | 无 [3] |
| 单次模型轮次内编排多工具 | 无 | programmatic tool calling [18] | 无对应文档 | 无 [3] |
| 服务端分类 / 选模型 | 无 | Decisions API（独立 classifier）[17] | routing 工作流（应用层）[11] | 应用层 |

### 4.2 服务端路由的三种实现

1. **确定性规则（无模型调用）**：按意图、入口、是否有设备实体等规则决定“本轮不传 tools”。这是唯一不增加模型调用、也不引入分类误差的做法；代价是规则覆盖有限。
2. **分类器（额外模型调用）**：OpenAI Decisions API 可在 run 前回答 predicate / choice，并据此选模型或走 guardrail [17]；Anthropic 的 routing 工作流也是“先分类再路由” [11]。代价是额外往返、误判，以及换模型导致的缓存失效 [9][10]。
3. **延迟加载而不是移除**：OpenAI tool search 用 deferred tools 让模型按需加载 [18]；Claude Code 用 `defer_loading` 保持工具 stub 稳定 [10]。这能缩小 schema，又不破坏前缀；但 GLM Chat Completions 没有该协议 [3]。

### 4.3 tools-disabled 的授权与安全权衡

- **收益**：不传 `tools` 直接消除模型调用工具的能力，降低 prompt injection 触发副作用的面积；对纯问答轮次也减少 schema token。
- **成本**：工具定义是缓存前缀的一部分，会话中移除工具会让后续请求前缀不匹配 [10]；如果每轮按意图切换 tools，缓存命中率会显著下降。
- **授权仍必须在服务器**：工具是否存在不等于是否有权限；OpenAI 文档也把 approval-sensitive / high-impact 工具建议为 direct call，而不是交给 programmatic 编排 [18]。路由只能决定“模型能看到什么”，不能替代 allowlist、确认、回读。
- **Z.AI 的特殊约束**：因为只支持 `tool_choice: auto`，不能要求模型“这轮别用工具”；唯一可靠方式是构造不含 `tools` 的请求 [3]。这意味着路由决策必须在请求构造前完成，不能靠提示词保证。
- **失败方向**：分类器失败或超时应默认“带工具但要求确认”，而不是默认“无工具”导致能力缺失，或默认“全工具”扩大攻击面。这是 [推断]，不是厂商文档。

---

## 5. 减少 Agent 轮次

### 5.1 并行工具调用

- OpenAI：`parallel_tool_calls` 控制同轮多个工具；Agents SDK 的 `ModelSettings` 文档说多数 provider（如 OpenAI）默认开启，设为 false 可限制为最多一个 [16]。
- Anthropic：默认允许并行，`disable_parallel_tool_use: true` 才限制为一个 [21]。
- Vercel AI SDK：同轮多个工具默认并发执行，`toolCallConcurrency: 1` 可强制顺序 [20]。
- Z.AI：文档没有并行开关；`tool_choice` 仅 `auto`，`tools` 最多 128 个 [3]。不能假设 GLM 会在一轮里发多个 tool call；需要实测。

并行化的收益是减少“模型 → 工具 → 模型”的往返次数；风险是同轮工具互相依赖时顺序错误、部分失败、token 增加。Vercel 文档明确建议有副作用依赖时用 `toolCallConcurrency: 1` [20]。

### 5.2 单轮内编排（single-pass tool calling）

OpenAI 的 Programmatic Tool Calling 让模型生成一段 JavaScript，在托管 V8 中调用多个允许的工具、合并结果，只把最终结果返回模型，文档明确说“without a model round trip after every tool call” [18]。限制也很明确：

- 仅支持特定 Responses 模型；Chat Completions 与非 Responses 后端会拒绝 [18]。
- 程序只能调用显式允许的工具；无文件系统 / 网络 / 持久进程 [18]。
- 需要审批的高影响工具更适合保持 direct call [18]。

这在 GLM 的 OpenAI-compatible Chat Completions 上不可用；本 Runtime 不能把它当作近期方案。

### 5.3 工具结果流式（tool result streaming）

一手文档没有“把部分工具结果流回模型”的协议。Vercel AI SDK 的 step 定义是：模型生成完成 → 执行工具 → 把完整工具结果作为下一步输入 [20]；OpenAI Agents SDK 也是工具调用完成后产生 `tool_output` item，再进入下一轮 [15][14]。

因此“工具结果流式”目前只能指：

- 把工具执行进度流给 **UI**（不进入模型）；
- 工具完成后立即发布结构化事实 / 卡片，不等待最终文字（本仓库既有协议）[24]。

它不能减少模型轮次，也不能让模型基于半截结果继续推理。

### 5.4 模型级联（model cascade）

- Anthropic 的 routing 工作流：先用分类把请求分到不同下游，包括“简单问题走 Haiku、难题走 Sonnet” [11]。
- OpenAI Decisions API：在 agent run 前做 predicate / choice 分类，可映射到允许的模型 [17]。
- 代价：多一次分类请求；换模型会重建缓存 [9][10]；分类错误会同时影响质量与延迟。
- 若必须做，放在会话边界或子 agent，而不是同一会话中途换模型；Claude Code 博客明确建议用 subagent 做模型切换，避免打断主会话缓存 [10]。

---

## 6. 实测证据 vs 厂商声明

| 结论 | 类型 | 来源 |
| --- | --- | --- |
| 容器预置等“模型外”工作会主导 TTFT；解耦后 p50 TTFT 约降 60%，p95 降 90% 以上 | **[实测]**（Anthropic 生产架构变更） | [12] |
| 一次 30.35s 的简单请求：首模型请求前 12.33s，首次模型调用 12.71s，`runtime_final_reply` 补交 5.26s | **[实测]**（本仓库单请求，尚未与“上游 4s”对齐） | [24] |
| 流式 run 在最后一个可见 token 之后仍可能等待 compaction 等后处理“几秒” | **[文档]**（OpenAI Agents SDK） | [19] |
| Z.AI 缓存“显著降低 token 消耗与响应延迟” | **[文档]**（无具体数字） | [1] |
| Claude Code 缓存 miss “几个百分点就能显著影响成本与延迟” | **[文档]**（无具体数字） | [10] |
| Prompt caching 可把 TTFT 降低最多 80% | **[文档/未核实]**：OpenAI Cookbook 页面在访问时返回 403，仅索引摘要可见 | [25] |
| API 延迟随时段 / 流量波动 | **[文档，明确未量化]**：Anthropic 称“anecdotally”，未正式测量 | [13] |
| 公开的 GLM 网关端到端 TTFT / 工具轮次分解 | **未找到** | — |

**解读**：现有最强的一手实测不是“模型变快”，而是“去掉模型外的串行阶段”和“减少一次模型往返”。Anthropic 的 TTFT 数据支持这一点：推理本身没变，变的是推理开始前的准备时间 [12]。本仓库的 30.35s 分解同样显示，用户等待的大部分不在单次上游生成 [24]。优化顺序应先处理“额外模型调用 / 前置串行阶段”，再谈缓存与并行。

**证据缺口**：没有找到同时公布“上游模型请求 < 5s”与“端到端 Agent 延迟分解”的一手案例。Anthropic 的 TTFT 数据证明模型外阶段可以主导首 token 等待，但没有公布对应的模型推理耗时 [12]；本仓库的 4s 说法目前也无法与 12.71s 的本地模型调用边界对齐 [24]。因此“上游 4s、用户 7.7–31s”只能作为本仓库待验证的观测，不能引用为行业已测结论。

---

## 7. 对本 Runtime 的适用性

### 7.1 当前事实（来自既有研究）

- `pi-runner` 把普通模型文本视为内部规划，要求最终答复调用 `reply_to_user`；未调用时再发一次 `<runtime_final_reply>` 请求 [24]。
- 订阅逻辑丢弃普通 `text_delta`，只在最后提交可见答复；工具事件仍会先到 [24]。
- 每轮重新加载 Company 目录，首模型请求前可占 12.33s [24]。
- 模型经 OpenAI-compatible GLM 网关；Z.AI 缓存自动但无公开 TTL / 最小长度 / 预热接口 [1][3]。

### 7.2 推荐实施顺序（不换模型、不增加第二次模型调用）

1. **删除 `runtime_final_reply` 默认路径。** 普通文本即终态；只有业务事实不足时才由服务器生成确定性收据，不再调用模型补交。依据：OpenAI Agents SDK 的 final output 定义 [14]；本仓库实测补交占 5.26s [24]。
2. **冻结每个会话的 system prompt 与工具表。** 工具顺序、描述、schema 序列化必须稳定；不要在会话中增删工具或改模型 [10]。动态目录、时间、设备状态放进消息或 tool result，放在前缀末尾 [10]。
3. **按轮次选择可见通道。** 确定无工具的请求：不传 `tools`，直接流 `content`；可能用工具的请求：工具前文本进独立“规划 / 工作”通道，或按 C 方案在首个 tool-call 时丢弃。不要把“立即展示规划”与“展示最终答案”混在同一气泡。
4. **用 Z.AI `tool_stream` 提前拿工具参数。** 这不改变模型轮次，但能让 UI 更早显示“正在调用哪个工具”；注意参数 JSON 完整前不能执行 [4][20]。
5. **网关侧确认缓存行为。** 读 `usage.prompt_tokens_details.cached_tokens`；如果网关支持 `session_id` / `prompt_cache_key`，同会话固定使用；如果网关会剥离缓存标记，按 Claude Code 文档的三种情况判断实际计费 [9]。直连 Z.AI 没有公开 cache key 参数，不要假设粘性 [1]。
6. **会话打开时预取目录快照（本地 / 业务上游），不要合成模型 warm 请求。** 目录快照不消耗模型 token；模型前缀由首个真实用户请求建立。若首请求前仍有 >1s 的本地串行工作，再考虑显式 warm，但必须先测量其收益 [推断]。
7. **并行工具只在模型真的支持时启用。** 先实测 GLM 是否在一轮返回多个 `tool_calls`；若不支持，用服务端批量工具或合并工具减少轮次，而不是加一轮模型调用 [3]。
8. **不要现在做模型级联、tool search、programmatic tool calling。** 前者增加调用并打断缓存 [9][10]；后两者在 GLM Chat Completions 上没有协议支持 [3][18]。

### 7.3 明确不做

- 不把 prompt cache 当成本地目录缓存或授权缓存 [1][9]。
- 不用 semantic cache 处理 agentic 请求：LiteLLM 明确说它在 agentic traffic 上“goes badly wrong” [8]。
- 不在会话中移除工具来实现“简单问答不调工具”；改为请求构造前路由，或接受缓存损失 [10]。
- 不把 `reasoning_content` 当最终答案展示；它是独立通道 [5]。
- 不用“先展示再撤回”作为方案；流式 UI 没有官方撤回语义。

### 7.4 需要补的观测

- 每个请求：发送时间、响应头、首个文本 delta、首个 tool-call delta、最后 delta、stream close。
- 缓存：`cached_tokens`、`cache_creation_input_tokens`（若 provider 返回）。
- 工具：开始 / 结束 / 结果大小。
- 可见性：首段公开文本、首张卡片、`message.completed`、`run.completed`。
- 目标：把用户所说的“上游 4s”映射到同一次请求的具体阶段，而不是与本地 12.71s 直接相减 [24]。

---

## 8. 模式对比总表

| 模式 | 一手证据 | 证据级别 | 额外模型调用 | 缓存影响 | GLM 可用 | 主要风险 |
| --- | --- | --- | --- | --- | --- | --- |
| 普通文本即终态 | OpenAI Agents SDK final output 定义 [14]；本仓库分解 [24] | 文档 + 实测 | 否（删除调用） | 中性 | 是 | 业务完成性需服务器判定 |
| 稳定前缀 / 冻结工具表 | Claude Code 缓存布局与“不要中途增删工具” [9][10] | 文档 | 否 | 强正向 | 是 | 动态内容必须改放消息 |
| 立即发布文本 delta | OpenAI raw event [15]；Z.AI delta [5]；Anthropic text_delta [21] | 文档 | 否 | 中性 | 是 | 工具前规划泄漏 |
| 双通道 / 规划标注 | Z.AI `reasoning_content` [5]；Anthropic 透明原则 [11] | 文档 + 推断 | 否 | 中性 | 部分（取决于模型是否分离） | 模型不保证把规划放进 reasoning |
| 工具前缓冲、见 tool-call 丢弃 | Vercel step 语义 [20]；各 API delta [4][15] | 推断 | 否 | 中性 | 是 | 无工具轮次仍慢 |
| 意图预路由（不传 tools） | Z.AI 仅 auto [3]；Claude Code 工具变更打断缓存 [10] | 文档 | 规则否 / 分类器是 | 负向（中途移除） | 是 | 误判、缓存损失 |
| 会话粘性 / cache key | OpenRouter sticky [6]；LiteLLM key [7] | 文档 | 否 | 正向 | 部分 | 网关不保证转发 |
| 会话打开预取目录 | Claude Code 会话加载 [9] | 文档 | 否 | 首请求写缓存 | 是 | 快照过期 / 授权 |
| 合成 warm 请求 | 无厂商推荐；由缓存 TTL / 写价推导 [7][9] | 推断 | 是 | 正向 | 是 | 成本、浪费、可能违反速率限制 |
| 并行工具调用 | OpenAI 默认 [16]；Anthropic 默认 [21]；Vercel 并发 [20] | 文档 | 否 | 中性 | 未文档化 | 依赖关系、部分失败 |
| 单轮内工具编排 | OpenAI Programmatic Tool Calling [18] | 文档 | 否 | 中性 | 否 | Responses-only |
| 工具结果流式 | Vercel step 语义 [20]；OpenAI item 事件 [15] | 文档 | 否 | 中性 | UI 可用，模型不可用 | 不能减少轮次 |
| 模型级联 | Anthropic routing [11]；OpenAI Decisions [17] | 文档 | 是 | 负向（换模型） | 是 | 额外延迟、误判、缓存重建 |

---

## 9. 未验证 / 待实测

1. Z.AI 缓存的最小 token 数、TTL、命中率、跨网关 / 跨账号共享规则：文档只写“automatic”“reasonable time limits”，没有数值 [1]。
2. Z.AI 是否支持一轮多个 tool calls、是否支持 `parallel_tool_calls`：文档只列 `tool_choice: auto` 与 `tools` 上限 [3]；需用真实请求验证。
3. Z.AI 直连 API 是否有 session affinity / cache key 参数：文档没有；OpenRouter 的 affinity 是网关侧行为 [1][6]。
4. GLM 是否稳定把“规划”放进 `reasoning_content` 而非 `content`：无文档保证；需 prompt + 采样验证。
5. OpenAI Cookbook 的“TTFT 降低最多 80%”原始页面在访问时 403，只有索引摘要；未作为可靠依据 [25]。
6. Anthropic API 文档在访问时按区域重定向，Anthropic 的最小缓存长度 / TTL 数值取自 OpenRouter 网关文档与 Claude Code 文档的交叉引用 [6][9]。
7. 没有找到公开的 GLM 网关端到端延迟分解；本仓库的 30.35s 是单请求内部记录，不能外推 [24]。

---

## 10. 参考来源（访问日期均为 2026-10-21）

1. Z.AI, *Context Caching*. https://docs.z.ai/guides/capabilities/cache
2. Z.AI, *Function Calling*. https://docs.z.ai/guides/capabilities/function-calling
3. Z.AI, *Chat Completion API Reference*. https://docs.z.ai/api-reference/llm/chat-completion
4. Z.AI, *Tool Streaming Output*. https://docs.z.ai/guides/capabilities/stream-tool
5. Z.AI, *Streaming Messages*. https://docs.z.ai/guides/capabilities/streaming
6. OpenRouter, *Prompt Caching*. https://openrouter.ai/docs/guides/best-practices/prompt-caching
7. LiteLLM, *Prompt Caching*. https://docs.litellm.ai/docs/completion/prompt_caching
8. LiteLLM, *Caching (proxy)*. https://docs.litellm.ai/docs/proxy/caching
9. Claude Code Docs, *How Claude Code uses prompt caching*. https://code.claude.com/docs/en/prompt-caching
10. Anthropic / Claude Code Blog, *Lessons from building Claude Code: Prompt caching is everything* (2026-04-30). https://claude.com/blog/lessons-from-building-claude-code-prompt-caching-is-everything ；镜像：https://claude.dev/blog/lessons-from-building-claude-code-prompt-caching-is-everything/
11. Anthropic, *Building effective agents*. https://www.anthropic.com/engineering/building-effective-agents
12. Anthropic, *Scaling Managed Agents with stable interfaces*. https://www.anthropic.com/engineering/managed-agents
13. Anthropic, *Quantifying infrastructure noise in agentic coding evals*. https://www.anthropic.com/engineering/infrastructure-noise
14. OpenAI Agents SDK, *Running agents*. https://openai.github.io/openai-agents-python/running_agents/
15. OpenAI Agents SDK, *Streaming*. https://openai.github.io/openai-agents-python/streaming/
16. OpenAI Agents SDK, *Model settings*. https://openai.github.io/openai-agents-python/ref/model_settings/
17. OpenAI Agents SDK, *Models*（含 Decisions API、WebSocket transport）. https://openai.github.io/openai-agents-python/models/
18. OpenAI Agents SDK, *Tools*（含 tool search、programmatic tool calling）. https://openai.github.io/openai-agents-python/tools/
19. OpenAI Agents SDK, *Sessions*. https://openai.github.io/openai-agents-python/sessions/
20. Vercel AI SDK, *Tool Calling*（multi-step、concurrency、prepareStep）. https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
21. Anthropic TypeScript SDK, *messages.ts*（ToolChoice、text_delta、input_json_delta）. https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/main/src/resources/messages/messages.ts
22. OpenAI Python SDK, *response_stream_event.py* / *response_create_params.py*（output_text.delta、function_call_arguments.delta、parallel_tool_calls）. https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/responses/response_stream_event.py ；https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/responses/response_create_params.py
23. OpenAI Python SDK, *chat_completion_tool_choice_option_param.py* / *completion_create_params.py*（none/auto/required、parallel_tool_calls）. https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/chat/chat_completion_tool_choice_option_param.py ；https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/chat/completion_create_params.py
24. 本仓库研究：*Agent 请求延迟与答复交付协议研究*，2026-10-21. `docs/research/2026-10-21-agent-response-latency-and-delivery.md`
25. OpenAI Cookbook, *Prompt Caching 201*. https://developers.openai.com/cookbook/examples/prompt_caching_201 （访问时 403，仅索引摘要；未核实其“最多 80% TTFT”数字）
