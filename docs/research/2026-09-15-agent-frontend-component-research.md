# 物联 Agent 前端组件与状态设计调研

日期：2026-09-15

范围：只讨论 Agent 的回答、流式过程、处理记录、错误恢复和输入区；操作草案卡片及其设备编辑器不在本轮重设计范围内。

## 结论先行

本项目不应直接套用一个完整的 AI Chat UI。更合适的方案是保留微信小程序原生页面和现有拟物卡片，建立一个轻量的 `ReplySurface`：一次用户请求对应一个完整的 Agent 回复容器，容器内部按生命周期承载身份、运行状态、处理记录、回答、可选草案、执行结果和恢复操作。

处理记录必须由结构化事件驱动，而不是由工具名称或文本内容推断。检索 0 个候选应先作为临时状态保留在当前检索节点中；只有最终没有后续命中时，才转为失败/未找到。若后续命中，则直接把同一个节点更新为最终摘要，例如“找到 3 个设备候选 · 调整了 2 次检索范围”。

错误恢复应位于上一条用户消息和对应 Agent 回复之间：失败时显示 `编辑` 与 `重试`，编辑会把原文放回输入框，重试复用原文但创建新的 run；不能把“执行结果摘要重试”冒充为“重新回答”。

## 一手组件参考

### Spectrum UI AI blocks

页面：[AI assistants blocks](https://ui.spectrumhq.in/blocks/ai-assistants)

可直接参考的区块：

- [Loading State](https://ui.spectrumhq.in/blocks/ai-assistants#loading-state)：只表达当前正在工作，不预先虚构工具步骤。
- [Reasoning Trace](https://ui.spectrumhq.in/blocks/ai-assistants#reasoning-trace)：将处理记录作为可折叠的辅助层，而不是普通回答正文。
- [Streaming Text](https://ui.spectrumhq.in/blocks/ai-assistants#streaming-text)：流式文本保持在同一个回答表面内，完成后再转为稳定排版。
- [Prompt Composer](https://ui.spectrumhq.in/blocks/ai-assistants#prompt-composer)：输入区同时处理发送、停止、模型/附件等状态，但本项目只保留发送、停止和微信语音切换。
- [Message Actions](https://ui.spectrumhq.in/blocks/ai-assistants#message-actions)：把复制、重新生成、反馈等操作放在消息级别。
- [Error State](https://ui.spectrumhq.in/blocks/ai-assistants#error-state)：失败状态保留原始 prompt，并提供 retry，而不是只显示一行失败文本。
- [Status Tracker](https://ui.spectrumhq.in/blocks/ai-assistants#status-tracker)：长任务使用阶段状态，但阶段必须来自真实事件。

本项目不采用其 reasoning chain-of-thought 表达。只展示已经清洗过的业务处理节点，例如“检索设备候选”“查询设备状态”“生成操作草案”。

### Animate UI

组件页：[Animate UI components](https://animate-ui.com/docs/components)

适合借鉴的基础组件：

- [Sheet](https://animate-ui.com/docs/components/radix/sheet)：仅用于设备复杂配置，不用于 Agent 回复容器。
- [Popover](https://animate-ui.com/docs/components/radix/popover)：可用于消息级重试/编辑菜单，但在微信小程序中应实现为轻量浮层，不引入 Web 专属依赖。
- [Progress](https://animate-ui.com/docs/components/base/progress)：不用于伪造模型进度；最多用于真实的多次门禁尝试或明确的任务次数。

Animate UI 的价值主要是 motion vocabulary：节点进入、状态交叉淡入、sheet 的可中断关闭；不建议把 React/Radix 组件直接移植到 uni-app。

### ReUI / shadcn/ui

- [ReUI components](https://reui.io/components)：参考其控件的密度、focus/pressed/disabled 状态和组件组合方式。
- [shadcn/ui](https://ui.shadcn.com/docs/components)：参考 Button、Textarea、Popover、Sheet、Scroll Area 的状态设计；不直接引入其 React 实现。

## 对当前代码的判断

当前独立小程序已经有 `tool.started`、`tool.completed`、`tool.progress`、`message.delta`、`run.*` 事件，但前端仍把它们直接投影为几个并列区域：

- `presentation.mjs` 只负责简单延迟和取消；
- `conversation.mjs` 以 tool 名称寻找正在运行的节点，没有 invocation id；
- `ToolActivity.vue` 只按数组渲染，无法表达临时检索、更新和最终折叠；
- `index.vue` 只有执行摘要的 retry，没有用户消息 edit/retry；
- `AssistantMarkdown.vue` 是回答正文，但没有和 reply lifecycle 共享容器状态。

因此问题不是再加几个 icon，而是缺少一个稳定的 UI 状态投影层。

## 建议的状态模型

```text
ReplySurface
├── userMessage: { text, editable, retryable }
├── run: idle | starting | streaming | awaiting_confirmation | completed | failed | stopped
├── activities[]
│   └── { invocationId, tool, phase, visibility, summary, details }
├── answer: { streamingText, renderedMarkdown, settled }
├── draft: existing operation-draft state
├── execution: existing receipt state
└── recovery: none | edit | retry | reconnect
```

`find_device_candidates` 特别处理：

```text
started → searching
completed count=0 → searching（只更新辅助文案，不显示 0 候选）
progress → searching（更新“正在调整检索范围…”）
completed count>0 → completed（显示最终候选数和尝试次数）
run.failed 且没有命中 → failed（显示未找到匹配设备）
```

## 重试交互建议

失败的用户消息右下方显示一个轻量消息操作栏：

```text
编辑   重试
```

- 编辑：恢复原文到 composer，原失败轮保留为历史记录；发送后创建新 turn。
- 重试：立即用原文创建新 turn，不修改原 turn，不重发任何已经确认的设备控制。
- 如果失败发生在草案确认之前：可以重新检索和生成草案。
- 如果失败发生在设备执行之后：只允许重新生成自然语言收尾，不能再次控制设备。
- 运行中只显示停止；运行结束后才显示恢复操作。

## 动效建议

- 回复容器一次进入：`opacity 0 → 1`、`translateY(6px) → 0`，180ms，ease-out。
- 处理节点新增：同上，但不为每个 token 触发动画。
- 节点状态切换：固定尺寸 icon 做 120ms cross-fade，避免布局抖动。
- 检索临时态更新只改文案，不移除/重建节点。
- 回答开始出现后自动收起处理记录；失败或用户主动展开时保持可见。
- 低动效设置下移除位移和循环动画，只保留状态颜色和内容变化。

## 分阶段落地

1. **事件投影层**：为工具事件增加稳定 invocationId；前端建立 `ReplySurface` 状态投影，先不改视觉。
2. **检索临时态**：抑制中间 0 候选视觉，补充重放与流式测试。
3. **消息级恢复**：实现用户气泡编辑/重试，区分回答重试和执行摘要重试。
4. **统一回复容器**：重排 Agent 头像、处理记录、回答、草案和执行结果。
5. **图标与动效**：统一 Agent 层图标；操作草案保持现有组件和视觉语言。

## 验收标准

- 正常检索不会出现短暂的“找到 0 个设备候选”后再跳到正确数量。
- 同一工具的重复调用不会覆盖前一个节点，也不会产生无意义的重复视觉节点。
- 流式回答、处理记录和草案属于同一条 Agent 回复。
- 失败后可以编辑或重试上一条用户输入；重试不会重发已确认设备操作。
- 断线恢复后不会重复播放已经完成的工具节点。
- `npm test`、`npm run test:weixin` 和微信开发者工具验收均通过。
