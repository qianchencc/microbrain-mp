# 工具调用可能跟在文本之后时，主流 Agent 框架如何流式呈现助手文本

- 日期：2026-10-21
- 范围：回答四个问题——(1) 文本增量是否在消息结束前立即发布，即使同一消息稍后出现工具调用；(2) 框架是否区分 interim/preamble 文本与最终文本，如何区分；(3) 文本后跟工具调用时，UI 保留、替换还是隐藏文本；(4) 是否存在“不要展示 pre-tool planning”的文档化模式。并给出对本项目（微信小程序 + NDJSON、已显示文本不可撤回）的适用性判断。
- 方法：只读一手来源——官方文档、官方 SDK 源码/类型、协议规范、本仓库与本地依赖源码。未修改生产代码。
- 证据分级：**【证据】**＝直接读到的原文/类型/夹具；**【推论】**＝由证据推出、来源未明说；**【未验证】**＝无法直接读取或需要实测。
- 引用方式：正文用来源名/文件名指代，完整 URL 与访问日期见第六节来源表；每个【证据】都能回溯到表中对应条目。

> 抓取限制：`platform.claude.com` 在本环境按区域拦截（返回 `claude.com/app-unavailable-in-region`）；`platform.openai.com`/`developers.openai.com` 的 API reference 对自动抓取返回 403。Anthropic 的事件序列用官方文档的检索摘要 + 官方 SDK 仓库内的 SSE 夹具逐事件核对；OpenAI 的字段语义用官方生成的 SDK 类型核对。相关处均已标注。

## 结论（先回答四个问题）

1. **主流框架都立即发布文本增量，不会因为“后面可能有工具调用”而扣留文本。** Anthropic 的官方 SSE 夹具里，文本块先完整流完（`content_block_start` → 多个 `text_delta` → `content_block_stop`），随后才出现 `tool_use` 块；OpenAI Agents SDK 把 `response.output_text.delta` 原样透传；Vercel AI SDK 的 `text-delta` 到达即写入 UI message part；LangGraph 的 `messages` 模式逐 token 产出；ADK 用 `partial=True` 事件逐段产出；ACP 用 `agent_message_chunk` 逐块推送。**没有发现任何框架在协议层默认缓冲到消息结束**【证据】。
2. **“interim/preamble”只在两个层面被区分：推理通道与消息标签。** 推理通道是多数框架都有的：Anthropic `thinking` block、Vercel `reasoning` part、LangGraph reasoning projection、ACP `agent_thought_chunk`、Pi `thinking_delta`；ADK 则用 `partial` 标志区分“增量块”与“合并全文”。消息标签只有 OpenAI Responses 的 `ResponseOutputMessage.phase: "commentary" | "final_answer"`（文档以 `gpt-5.3-codex` 及之后的模型说明该字段）。普通 assistant 文本没有“这是 pre-tool planning”的字段【证据】。
3. **文本后跟工具调用时，框架一律“保留”：文本作为独立 item/block/part 排在工具调用之前，由客户端决定怎么渲染。** 没有框架在协议层替换或隐藏它。唯一接近“隐藏”的是本仓库 `pi-runner` 的应用层选择：同一 assistant message 一旦含 `toolCall`，整段文本被丢弃【证据】。
4. **没有框架文档化“不要展示 pre-tool planning”。** 可用的机制只有三类：(a) 把规划放进独立 reasoning 通道（模型/提示词约束）；(b) 用 `phase=commentary` 之类的标签让客户端过滤（OpenAI 专属）；(c) 事后撤回（AI SDK `reset-step`；ADK `interrupted` 时清空 partial 文本），而 AI SDK 文档自己承认“已经发出的输出无法撤回”。对不可撤回 UI，**唯一无泄漏的方案是先不发布正文，或把正文发布到可折叠、明确标注为草稿的区域**【证据 + 推论】。

---

## 一、逐框架证据

### 1. OpenAI Agents SDK（Python / JS）与 Responses API

**事件分层**【证据】：

- `RawResponsesStreamEvent`：包装 LLM 原始事件，“directly passed through from the LLM”。官方文档明确其用途是“stream response messages to the user **as soon as they are generated**”，示例直接在每个 `ResponseTextDeltaEvent` 上 `print(event.data.delta)`。
- `RunItemStreamEvent`：更高层事件，“inform you when an item has been **fully generated**”，名称包括 `message_output_created`、`tool_called`、`tool_output`、`reasoning_item_created` 等。
- `AgentUpdatedStreamEvent`：handoff/agent 切换。

因此存在两级时序：**文本 delta 在生成过程中就发出；`message_output_created` 在该 message item 完成时才发出；`tool_called` 在工具调用 item 生成时发出，通常晚于文本 delta**。【证据 + 推论】

**数据模型（Responses API）**【证据】：

- 文本属于 `message` 输出项：`ResponseOutputMessage.type = "message"`，`status` 为 `in_progress|completed|incomplete`，`content` 是 `output_text|refusal`。
- 工具调用是**另一个输出项**：`response.function_call_arguments.delta` 自带 `item_id` 与 `output_index`，与 `response.output_text.delta` 的 `item_id`/`output_index` 并列。
- 所有流事件都有 `sequence_number`（文本 delta、item added、function-call arguments delta 均如此），排序以它为准。
- `ResponseOutputMessage.phase`（可选）：`"commentary"`（intermediate commentary）或 `"final_answer"`；文档说明“For models like `gpt-5.3-codex` and beyond … preserve and resend phase”。这是目前唯一见到的、由协议直接标注“中间话术 vs 最终答案”的字段。

**Chat Completions 对照**【证据】：`ChatCompletionMessage` 同一对象上同时有 `content: Optional[str]` 与 `tool_calls`，即文本和工具调用共存于一条 assistant message；`finish_reason=tool_calls` 只在末尾给出。【推论】客户端在文本 delta 到达时无法预知后面是否跟工具调用。

**发布行为**：JS SDK 的 `toTextStream()` “only emits assistant text. Tool calls, handoffs, approvals, and other runtime events are available from the full event stream.”【证据】文本流与工具事件流分离；由于工具调用是另一个 output item，文本流没有理由因它暂停或清空——但该结论是【推论】，文档没有逐字承诺“文本流包含工具调用前的文本”。

**对本问题的回答**：立即发布；保留为独立 message item；有 `phase` 这个可选的 interim 标签；未发现“pre-tool 文本延迟发布”的开关。

### 2. Vercel AI SDK（`streamText` + UI message stream）

**协议**【证据】：

- 文本块用 `text-start` / `text-delta` / `text-end`，各自带 `id`；`text-delta` 的定义就是“incremental text content for the text block”。
- 工具调用用 `tool-input-start` / `tool-input-delta` / `tool-input-available`；`tool-input-start` 在参数流式生成前就发出。
- `streamText` 的 `TextStreamPart` 联合类型同时包含 `tool-call`（完整调用）与 `tool-input-start` / `tool-input-delta`（增量），`onChunk` 文档逐项列出这些类型；两者与 `text-delta` 在同一条流里按产生顺序出现。
- `start-step` / `finish-step` 标记一次模型调用；`finish` 标记消息结束。

**UI 侧处理**【证据，`packages/ai/src/ui/process-ui-message-stream.ts`】：

- `text-start`：`state.message.parts.push(textPart)`；
- `text-delta`：`textPart.text += chunk.delta; write();` —— 每个 delta 立即写回状态；
- `tool-input-start`：在 `parts` 中**追加**一个新的 tool part；
- 整个 switch 中没有“收到工具调用就删除前面的文本 part”的分支。

因此文本与工具调用在同一条 assistant message 里表现为**有序的 parts 数组**，先文本后工具；`useChat` 文档也明确“tool calls and tool executions are integrated into the assistant message as typed tool parts”【证据】。

**撤回原语**【证据】：

- `reset-step`：“Removes all message parts received since the most recent `start-step` part … useful when a streamed step is retried and partial output from the failed attempt must be invalidated”。这是唯一显式的“删除已接收 part”机制。
- `streamRetries` 文档：“other output already emitted **cannot be retracted**, but is excluded from the recovered step result…”——官方承认已发出的输出不可撤回。

**对本问题的回答**：立即发布；保留并与工具 part 并列；没有 preamble 语义（`reasoning` 是单独 part 类型）；没有“pre-tool 隐藏”策略；撤回只服务于重试，不服务于“这段是内部规划”。

### 3. Anthropic Messages API

**官方事件序列**【证据，来自 `platform.claude.com/docs/en/api/messages-streaming` 的检索摘要；该页正文在本环境被区域拦截】：

1. `message_start`：`Message` 对象，`content` 为空；
2. 每个 content block 依次 `content_block_start` → 一个或多个 `content_block_delta` → `content_block_stop`，block 有递增的 `index`；
3. `message_delta`：携带 `stop_reason`、`usage`；
4. `message_stop`。

官方 streaming 指南同时说明：“messages can contain multiple content blocks (`text`, `tool_use`, `thinking`)”。`tool_use` 与 `thinking` 块“cannot be partially recovered”。【证据】

**一个真实的 text→tool_use 夹具**【证据，`anthropic-sdk-python/tests/lib/streaming/fixtures/tool_use_response.txt`】：

```
content_block_start index=0  {"type":"text"}
content_block_delta index=0  "I"
content_block_delta index=0  "'ll check the current weather in Paris for you."
content_block_stop  index=0
content_block_start index=1  {"type":"tool_use","name":"get_weather",...}
content_block_delta index=1  input_json_delta ...
content_block_stop  index=1
message_delta  stop_reason="tool_use"
message_stop
```

这段夹具直接证明：**文本块在工具调用被生成之前就已经完整发送；`stop_reason=tool_use` 直到最后才出现**。客户端在收到 text delta 时不可能知道后面有工具调用。【证据 + 推论】

**SDK 暴露方式**【证据，`anthropic-sdk-typescript/src/lib/MessageStream.ts`】：`content_block_delta` 且 `delta.type === "text_delta"` 时立即 `_emit("text", delta.text, snapshot)`；`content_block_stop` 时才 `_emit("contentBlock", …)`。即文本事件早于 block 完成事件。

**对本问题的回答**：立即发布；保留为文本 block；没有 interim 标签（`thinking` 是另一种 block 类型，不是文本的修饰）；没有 pre-tool 隐藏；协议层没有任何撤回。

### 4. LangGraph / LangChain

**`stream_mode="messages"`**【证据】：产出 `(message_chunk, metadata)`，“stream LLM outputs token by token from any part of your graph”；`AIMessageChunk` 同时可携带 `content` 与 `tool_call_chunks`（后者是 tool call 参数的增量）。

**事件流（v1.2+）**【证据】：

- `messages` channel 以 content block 为中心：`message-start`、`content-block-start`、`content-block-delta`、`content-block-finish`、`message-finish`；
- 文档原话：“Content blocks have explicit boundaries: a block starts, emits zero or more deltas, and finishes before the next block in the same message starts.”；
- `stream.messages` 投影提供 `message.text`、`message.reasoning`、`message.tool_calls`；“If you need text, reasoning, and tool-call chunks in exact arrival order, iterate the message stream's raw events instead of each projection separately.”；
- `tools` channel 单独提供 `tool-started` / `tool-output-delta` / `tool-finished`，按 tool call ID 与消息中的 tool-call block 关联。

**过滤能力**【证据】：只有整个 LLM 调用级别的 `nostream` tag（“Tokens from this model are omitted from `stream_mode="messages"`”）以及按 node/tag 过滤；没有“同一消息内文本是 preamble 则丢弃”的机制。

**对本问题的回答**：立即发布；文本与 tool-call chunks 同属一个 chunk 流，顺序由到达顺序/`seq` 决定；保留；无 preamble 标签；无“pre-tool 隐藏”。

### 5. Google ADK（可选对照）

**事件模型**【证据】：

- 一切都是 `Event`；`content.parts[]` 可同时承载 `text`、`function_call`、`function_response`、`inline_data`；
- `partial=True` 表示“only the new text since the last event”，`partial=False` 表示该段的合并全文；
- `turn_complete` 表示整轮结束；`interrupted` 表示用户打断；
- `interrupted=True` 时 UI 侧的动作是 `clear_streaming_text()`（官方示例），这是应用层清空，不是协议撤回。

**对本问题的回答**：立即发布（partial 事件）；文本与 function_call 是同一 `Event` 模型里的不同 part 类型；没有 preamble 标签；没有“pre-tool 隐藏”；“清空”只用于用户打断。

### 6. ACP（Agent Client Protocol，协议对照）

**Session update 变体**【证据】：`agent_message_chunk`（助手回复的流式块）、`agent_thought_chunk`（推理的流式块）、`tool_call`（新工具调用）、`tool_call_update`。

**时序**【证据，prompt-turn 规范】：先 `agent_message_chunk`，随后“If the model requested tool calls, these are also reported immediately” `tool_call`；`tool_call` 执行期间状态 `in_progress` → `completed`，然后把工具结果送回模型。

**对本问题的回答**：立即发布；**协议显式把“可见回复”与“思考”分成两种 chunk**（这是最接近“preamble 通道”的协议设计）；文本与工具调用是不同 update，按通知顺序排列；没有撤回语义。

### 7. Pi（本项目依赖）

**事件类型**【证据，`node_modules/@earendil-works/pi-ai/dist/types.d.ts`】：`AssistantMessageEvent` 包含 `start`、`text_start/text_delta/text_end`、`thinking_start/thinking_delta/thinking_end`、`toolcall_start/toolcall_delta/toolcall_end`、`done`、`error`。文本与思考、工具调用是同一事件流里的不同分支。

**转发行为**【证据，`pi-agent-core/dist/agent-loop.js`】：模型事件到达即 `emit({ type: "message_update", assistantMessageEvent: event, ... })`，没有按消息缓冲。

**结论**：底层已经具备“立即、按到达顺序”的语义；本项目 7.7–31s 的“首字延迟”来自 `pi-runner` 的应用层缓冲，而不是 pi 或模型 API。【证据】

---

## 二、对比表

| 框架 / 协议 | 文本增量是否立即发布 | 是否区分 interim/preamble | 文本后跟工具调用时 | 顺序依据 | 撤回 / 重置原语 |
| --- | --- | --- | --- | --- | --- |
| OpenAI Agents SDK + Responses API | 是（`raw_response_event` 透传 `response.output_text.delta`） | 部分：`message.phase = commentary \| final_answer`（特定模型）；reasoning item 单独 | 保留：文本是 `message` item，工具是另一个 item | `sequence_number`、`output_index` | 无协议撤回；客户端可丢弃/折叠 |
| OpenAI Chat Completions | 是（`delta.content`） | 否（`reasoning` 另见 provider 扩展） | 保留：同一 message 的 `content` + `tool_calls` | chunk 到达顺序；`finish_reason` 在末尾 | 无 |
| Vercel AI SDK | 是（`text-delta` 即写 UI state） | 否（`reasoning` 是独立 part 类型） | 保留：parts 数组先 text 后 tool | `start`/`delta`/`end` + `id`；`start-step`/`finish-step` | `reset-step`（删除当前 step 的 parts，仅用于重试） |
| Anthropic Messages | 是（`text_delta` 即发；SDK `text` 事件） | 否（`thinking` 是另一种 content block） | 保留：text block 在 tool_use block 之前 | block `index` + `content_block_start/stop`；`stop_reason` 末尾 | 无；thinking/tool_use 不可部分恢复 |
| LangGraph / LangChain | 是（`messages` 模式逐 token） | 否（reasoning 独立投影） | 保留：`content` + `tool_call_chunks` 同流 | content-block 边界 + `seq`；`interleave` 保序 | 无（`nostream` 只在调用前生效） |
| Google ADK | 是（`partial=True`） | 部分：`partial` 标志（增量 vs 合并全文） | 保留：text part 与 function_call part 并列 | 事件到达顺序；`partial`/`turn_complete` | `interrupted` 时客户端 `clear_streaming_text()` |
| ACP | 是（`agent_message_chunk`） | 是（`agent_message_chunk` vs `agent_thought_chunk`） | 保留：先 message chunk，后 `tool_call` | JSON-RPC 通知顺序；`messageId` 分组 | 无 |
| Pi（pi-ai / pi-agent-core） | 是（`message_update` 原样转发） | 是（`text_delta` vs `thinking_delta`） | 底层保留；应用层可丢 | `AssistantMessageEvent` 到达顺序 | 无 |
| **本仓库现状（pi-runner）** | **否**：`text_delta` 只进 `heldAssistantText`，`message_end` 且无 `toolCall` 才发 | 否 | **隐藏**：整段丢弃 | 自定义 `sequence` + NDJSON 行序 | `message.completed` 可整段覆盖（但小程序是追加渲染） |

---

## 三、“不要展示 pre-tool planning”到底有哪些模式

**框架层面没有现成答案。** 上述所有一手来源中，没有任何一个提供“文本可能后跟工具调用时延迟发布”的开关或默认行为；相反，Anthropic 的夹具、OpenAI 的 raw event、AI SDK 的 `text-delta`、LangGraph 的 `messages`、ADK 的 `partial`、ACP 的 `agent_message_chunk` 都证明文本先发。【证据】

真正被文档化的是三类替代机制：

1. **把规划放进独立推理通道（最可移植）**
   - Anthropic：`thinking` block 与 `text` block 是不同类型，SDK 分别发 `thinking` 与 `text` 事件；
   - AI SDK：`reasoning-*` 与 `text-*` 是不同 part；
   - ACP：`agent_thought_chunk` 与 `agent_message_chunk` 是两个变体；
   - Pi：`thinking_delta` 与 `text_delta` 是两个事件。
   → 客户端可以只渲染 `text`，而把 planning 留给 `thinking`。**但这要求模型真的把规划写进 thinking，属于提示词/模型行为约束，不是框架保证。**【证据 + 推论】

2. **用消息级标签过滤（OpenAI 专属）**
   - `ResponseOutputMessage.phase` 明确把消息标为 `commentary` 或 `final_answer`；客户端可只显示 `final_answer`。
   - 限制：字段可选，文档以 `gpt-5.3-codex` 及之后的模型说明其用途；且 `phase` 在消息创建时是否已可用，未在类型/文档中说明（`output_item.added` 携带的是 item 快照）。【证据 + 未验证】

3. **事后撤回（不可靠）**
   - AI SDK `reset-step` 可删除当前 step 已接收的 parts，但这是为“重试失败 step”设计的；`streamRetries` 文档同时说明“other output already emitted cannot be retracted”。
   - ADK 在 `interrupted` 时清空 partial 文本，但那是用户打断，不是“发现后面有工具调用”。
   - Anthropic/OpenAI/LangGraph/ACP/Pi 均无协议级撤回。
   → 对“已经显示就不能收回”的 UI，事后撤回不成立。【证据 + 推论】

**因此，对不可撤回 UI，只有三种自洽策略**【推论】：

- **A. 发布前门控**：在确认“这条消息没有工具调用”之前不发正文（现状；首字延迟 = 消息完成）。
- **B. 发送到“草稿/可折叠”区域**：正文立即发，但 UI 把它放进明确标注为“思考中/草稿”的容器；工具调用到来时只做“折叠/改标题”，不删除文本。文本从未冒充最终答复，因而不需要撤回。
- **C. 通道分离**：要求模型把 planning 放进 thinking/`commentary`，只把面向用户的句子放进 `text`；客户端只渲染 `text`。这需要模型支持 + 提示词 + 评测。

---

## 四、对本项目（微信小程序 NDJSON、不可撤回）的适用性

### 4.1 现状链路（证据）

1. `pi-agent-core` 在模型事件到达时立即 `emit("message_update", assistantMessageEvent)`（`agent-loop.js`）。
2. `apps/runtime/src/agent/pi-runner.ts` 的订阅者只处理 `text_delta`：`heldAssistantText += replyText.push(delta)`，**不发送**；`message_end` 时若 `message.content` 含 `toolCall`，整段清空且不发送；否则一次性 `emit({ type: "message.delta", content: heldAssistantText })`。
3. `apps/runtime/src/app.ts` 对 `message.delta` 做 120ms 合并后写 NDJSON；`message.completed` 携带最终全文；心跳 15s。
4. `web/src/agent-turn.js` 对 `message.delta` 执行 `turn.assistantText += event.content`（追加），`message.completed` 时整段赋值。

**结论**：当前“首字可见时间”严格等于“assistant message 结束时间”，与模型请求耗时（<5s）无关；用户感知的 7.7–31s 主要来自这里，而不是上游 token 生成。【证据 + 推论】

### 4.2 约束

- 小程序渲染是**追加式**的：已追加的文本不能“删除”，只能在 `message.completed` 时整段替换——整段替换会造成明显闪烁，且与“不可撤回”的产品直觉冲突。【证据（代码）+ 推论（体验）】
- NDJSON 是单向下行，没有客户端 ack/重放；`sequence` 只保证行序，不提供“撤回上一行”的语义。【证据】
- 运行时已有 `tool.started` / `tool.progress` / `tool.completed` 等事件，可以在不暴露正文的情况下提供即时反馈。【证据】

### 4.3 可选方案（按泄漏风险 / 改动量排序）

| 方案 | 首字延迟 | 泄漏 pre-tool planning | 改动面 | 说明 |
| --- | --- | --- | --- | --- |
| A. 维持门控，但首个 `text_delta` 立即发“状态”事件 | 立即（非正文） | 无 | 小：pi-runner + 小程序渲染状态行 | 例如 `assistant.composing` / `message.status`，让用户看到“正在组织答复”，正文仍在 `message_end` 发。**不解决“看到内容”的延迟，但解决“界面无反应”** |
| B. 只对“本轮第一条 assistant message”门控，后续消息直接流 | 第一条仍慢；工具调用后的最终答复立即显示 | 低（规划通常发生在第一条） | 小：pi-runner 记录 `turnCount`/首条标志 | 大多数工具循环里，带 planning 的是第一条消息；工具执行后的收尾消息通常就是最终答复。属于启发式，需用真实轨迹验证【推论】 |
| C. 全文立即流，接受泄漏 | 最低 | 高 | 最小：删除 `heldAssistantText` 门控 | 与所有主流框架一致；但需要提示词保证“text 只写用户可见内容”，并把规划迁到 thinking。需要评测集验证泄漏率 |
| D. 草稿通道 + 折叠 | 最低 | 中（文本短暂可见，但被标注为草稿） | 中：新增 `message.delta` 的 `provisional`/`phase` 字段 + 小程序草稿容器；工具调用到来时发 `message.reclassified`，UI 折叠而非删除 | 与 ACP/OpenAI `phase` 的设计同构；追加式 UI 友好（只改样式/标题，不删文本） |
| E. 推理通道分离 | 低（正文仍可立即流） | 低 | 大：模型/提示词/评测 + 客户端只渲染 text | Pi 已把 `thinking_delta` 与 `text_delta` 分开；若模型支持 thinking，且提示词要求“规划只写 thinking”，则 `text_delta` 可安全直发。需要确认当前 provider 是否稳定产出 thinking【未验证】 |

**建议（推论）**：

- 短期先做 **A + B**：不改协议语义，先把“无反应窗口”消掉，并把门控范围缩到首条消息；风险最低，可用现有 `tool.*` 事件与心跳配合。
- 中期做 **D**：给 `message.delta` 增加 `provisional`（或 `phase: "draft" | "final"`）字段；小程序把 provisional 文本渲染进可折叠的“思考中”区，工具调用到来时只折叠、不删除。这样既降低首字延迟，又不让草稿冒充最终答复。
- **C 不应在未做提示词改造与泄漏评测前直接上线**：本仓库的 `replyText` 过滤与“收尾回合”提示词已经承担了“最终答复”的语义，直接放开会让内部规划进入用户可见区域。
- **不要**寄希望于“发现 toolCall 后撤回”：小程序是追加渲染，运行时的 `message.completed` 整段替换只适合收尾，不适合逐段纠正。

### 4.4 协议层建议（推论）

- `message.delta` 增加 `phase`（`draft`/`final`）或 `provisional: true`；`message.completed` 保持权威全文。
- 新增 `message.reclassified`（`from: "draft"`, `to: "final"` 或 `to: "internal"`），语义是“改变呈现分类”，不是“删除已发送内容”；追加式 UI 可据此折叠/改标题。
- 保留 `sequence` 与心跳；不要把“是否展示”编码进事件顺序（例如“延迟发送”），否则一旦发送就无法表达“这段其实是内部的”。

---

## 五、未验证 / 待确认

- **【未验证】** OpenAI `phase` 在 `response.output_item.added` 时是否已填充；若只在完成时可用，则无法用于流式门控。
- **【未验证】** Anthropic 官方 streaming 文档正文未能直接抓取（区域拦截）；本文的序列描述来自该页检索摘要，并用官方 SSE 夹具核对。若需要逐字引用，应在可访问环境重新抓取。
- **【未验证】** ADK 的 thought part 标志（`part.thought`）在 `adk.dev` 的 Events 页面未逐字确认；本文只使用了已读到的 `partial`/`turn_complete`/`interrupted` 与 `content.parts[]` 类型。
- **【未验证】** 当前生产 provider 对 Pi 的 `thinking_delta` 覆盖率和稳定性；这决定方案 E 是否可行。
- **【未验证】** “首条 assistant message 才含 planning”这一启发式的真实占比；需要用本仓库轨迹统计（带 `toolCall` 的首条消息 vs 后续消息的文本长度）。

## 六、来源

| # | 来源 | URL | 访问日期 | 读取/核对内容 |
| --- | --- | --- | --- | --- |
| 1 | OpenAI Agents SDK — Streaming | https://openai.github.io/openai-agents-python/streaming/ | 2026-10-21 | raw event 透传、`ResponseTextDeltaEvent` 示例、run item 事件在 item 完成后发出 |
| 2 | `openai-agents-python` v0.22.3 `stream_events.py` | https://github.com/openai/openai-agents-python/blob/v0.22.3/src/agents/stream_events.py | 2026-10-21 | “directly passed through from the LLM”；事件名称集合 |
| 3 | OpenAI Agents SDK (JS) — Streaming | https://openai.github.io/openai-agents-js/guides/streaming/ | 2026-10-21 | `toTextStream()` 只发 assistant text；`response.output_text.delta`；run item 表 |
| 4 | `openai-python` `ResponseTextDeltaEvent` | https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/responses/response_text_delta_event.py | 2026-10-21 | `item_id`/`output_index`/`sequence_number` |
| 5 | `openai-python` `ResponseOutputItemAddedEvent` | https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/responses/response_output_item_added_event.py | 2026-10-21 | item + `output_index` + `sequence_number` |
| 6 | `openai-python` `ResponseOutputMessage` | https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/responses/response_output_message.py | 2026-10-21 | `type=message`、`status`、`phase=commentary\|final_answer` |
| 7 | `openai-python` `ResponseFunctionCallArgumentsDeltaEvent` | https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/responses/response_function_call_arguments_delta_event.py | 2026-10-21 | 工具参数 delta 是独立 `item_id`/`output_index` |
| 8 | `openai-python` `ChatCompletionMessage` | https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/chat/chat_completion_message.py | 2026-10-21 | 同一 message 上 `content` + `tool_calls` |
| 9 | OpenAI Responses streaming reference（自动抓取 403） | https://platform.openai.com/docs/api-reference/responses-streaming | 2026-10-21 | 仅作为官方参考链接；字段语义以上述生成类型为准 |
| 10 | Vercel AI SDK — Stream Protocols | https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol | 2026-10-21 | `text-start/delta/end`、`tool-input-start/delta/available`、`reset-step` |
| 11 | Vercel AI SDK — `streamText` reference | https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text | 2026-10-21 | `TextStreamPart` 联合类型；`streamRetries` “cannot be retracted” |
| 12 | `vercel/ai` `process-ui-message-stream.ts` | https://raw.githubusercontent.com/vercel/ai/main/packages/ai/src/ui/process-ui-message-stream.ts | 2026-10-21 | `text-start` push、`text-delta` 追加并 `write()`、`tool-input-start` 追加 tool part |
| 13 | Vercel AI SDK — Chatbot Tool Usage | https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage | 2026-10-21 | tool calls 作为 assistant message 的 typed parts |
| 14 | Anthropic — Streaming Messages（区域拦截） | https://platform.claude.com/docs/en/api/messages-streaming | 2026-10-21 | 事件序列（检索摘要）；正文抓取被重定向到区域提示页 |
| 15 | Anthropic — Streaming（区域拦截） | https://platform.claude.com/docs/en/build-with-claude/streaming | 2026-10-21 | “messages can contain multiple content blocks”；正文抓取被重定向 |
| 16 | `anthropic-sdk-python` SSE 夹具 `tool_use_response.txt` | https://raw.githubusercontent.com/anthropics/anthropic-sdk-python/main/tests/lib/streaming/fixtures/tool_use_response.txt | 2026-10-21 | text block 完整流完后才出现 tool_use block |
| 17 | `anthropic-sdk-typescript` `MessageStream.ts` | https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/main/src/lib/MessageStream.ts | 2026-10-21 | `content_block_delta`→`text` 事件；`content_block_stop`→`contentBlock` |
| 18 | LangGraph — Streaming | https://docs.langchain.com/oss/python/langgraph/streaming | 2026-10-21 | `messages` 模式逐 token；`nostream` tag |
| 19 | LangGraph — Event streaming | https://docs.langchain.com/oss/python/langgraph/event-streaming | 2026-10-21 | content block 边界；`message.tool_calls` 参数块；按到达顺序读 raw events |
| 20 | LangChain — Streaming | https://docs.langchain.com/oss/python/langchain/streaming | 2026-10-21 | `stream.interleave("messages","tool_calls")`；message/tool 分开投影 |
| 21 | `langchain` `AIMessageChunk` | https://raw.githubusercontent.com/langchain-ai/langchain/master/libs/core/langchain_core/messages/ai.py | 2026-10-21 | `content` + `tool_call_chunks` 同属一个 chunk |
| 22 | Google ADK — Events for live agents | https://adk.dev/live/events/ | 2026-10-21 | `partial`、`turn_complete`、`interrupted`、`clear_streaming_text()` |
| 23 | Google ADK — Configuration | https://adk.dev/live/configuration/ | 2026-10-21 | `StreamingMode.SSE`（`run_async` 路径） |
| 24 | ACP — Prompt Turn | https://agentclientprotocol.com/protocol/v1/prompt-turn | 2026-10-21 | `agent_message_chunk` → `tool_call`；`sessionUpdate` 变体表 |
| 25 | ACP — Content | https://agentclientprotocol.com/protocol/v1/content | 2026-10-21 | content block 结构 |
| 26 | `pi-ai` 类型（本地依赖） | `node_modules/@earendil-works/pi-ai/dist/types.d.ts:389-463` | 2026-10-21 | `text_delta`/`thinking_delta`/`toolcall_*`/`done` |
| 27 | `pi-agent-core` `agent-loop.js`（本地依赖） | `node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js:219-223` | 2026-10-21 | `message_update` 立即 emit |
| 28 | 本仓库 `apps/runtime/src/agent/pi-runner.ts` | 工作区 | 2026-10-21 | `heldAssistantText` 缓冲与 `hasToolCall` 丢弃 |
| 29 | 本仓库 `apps/runtime/src/app.ts` | 工作区 | 2026-10-21 | NDJSON 输出、120ms 合并、心跳、`message.completed` |
| 30 | 本仓库 `web/src/agent-turn.js` | 工作区 | 2026-10-21 | `message.delta` 追加、`message.completed` 整段替换 |
