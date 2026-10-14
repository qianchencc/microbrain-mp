# 物联 Agent 设备上下文与工具设计：问题清单与社区方案

日期：2026-10-09。状态：设计调查，未实施。证据来自 `iot-agent-runtime`（分支 `codex/multi-candidate-lighting-draft`）源码与本地 `var/real-runtime.sqlite`，外部方案只引用一手来源。

## 一、遇到的设计决策问题与真实场景

### D1 模型对设备目录"有多少底"

- 现状：ADR 0004 删除了常驻地点/设备名词表，`device_context` 只给类型、数量和少量提示；完整目录只能经 `find_device_candidates` 获得。
- 真实场景：用户说"26楼办公区楼道的灯"。目录里没有"楼道"，只有设备名里的"过道"（如 `照明开关-26楼运营部公共办公区过道-2回路过道格栅灯`）。模型不知道目录用词，只能猜。
- 约束（用户裁定）：全量设备清单常驻上下文（Office ≥123 台约 4.6k 字符，Company 约 335 台估计接近 1 万 token）不可接受。

### D2 检索语义：软提示与硬过滤两档

- 现状：`deviceText`/`nameHints` 永不过滤，只在前 50 台上注释；位置词字面硬匹配。
- 真实场景：最近 40 次照明检索中，`26楼` + 描述（过道、楼道、过道格栅灯、前台01 过道、灯…）11 次全部返回整层 81 台；把"楼道"当位置硬条件则返回 0 台。模型在 81 与 0 之间来回，形成 81→7→3→16→4 的打转轨迹。

### D3 展示上限被当成操作上限

- 现状：匹配 >50 台时候选集 `complete=false`，不能出草案或任务；候选集只保存前 50 台明细，完整匹配被丢弃。
- 真实场景：生产库照明候选集 92 个，其中 26 个（28%）超限，最大 156；其他类型 58 个候选集无一超限。超限后工具只会说"请缩小范围"，但模型缺少可用于缩小的词（见 D2）。

### D4 跨轮指代没有可引用对象

- 现状：每次检索生成会话内句柄 `sN`/`dN_k`；模型在正文里给用户列的选项（按设备基础名划的子集）不对应任何句柄。
- 真实场景：第 1 轮回复"26楼前台01过道灯带和过道射灯 / 2回路过道格栅灯"，第 2 轮用户说"后者"。这两项都出自同一个 83 台的不完整候选集，"后者"无法直接成为草案目标，模型只能重新检索（证据：proof worktree `2026-10-09-trials.json` 第 1 条）。

### D5 守卫与 prompt 规则替代工具设计

- 现状：结果重复守卫、同类型 5 次守卫、提案连续失败守卫、相同调用拦截、总预算，触发后撤掉工具并输出固定文案；prompt 中大量"不要重复检索/不要先核验/不要拆分草案/后者不是新检索"。
- 真实场景：守卫触发后回复"本次检索没有继续产生新结果，请补充更具体的位置"，丢失已有候选。

### D6 prompt 职责混杂、常驻成本高

- 现状：Office 系统 prompt 约 5.7k 中文字符，混合设备协议参数、工具使用规则、草案/任务生命周期、UI 排版规则和真实性边界；另有 12 个工具 schema；每轮 `runtime_context`（含 `device_context`、`task_regions`、`action_draft_context`）作为一条 user 消息追加并随新消息持久化进历史。
- 含义：现在常驻上下文的主要成本是"规则"而不是"事实"。拒绝 1 万 token 目录的同时，已经为规则支付了同量级成本（待用 Langfuse 实测确认）。
- 产品要求：用户可见的基础事实（地点、设备、简单描述）应让模型有底，而不是依赖语义检索。

## 二、社区一手方案

1. **最小 prompt、最小工具集**：pi coding agent 的系统 prompt 只有十几行，默认只给 read/write/edit/bash 四个工具；作者认为前沿模型已被充分训练，不需要上万 token 的系统 prompt。[Mario Zechner, What I learned building an opinionated and minimal coding agent](https://www.mariozechner.at/posts/2025-11-30-pi-coding-agent/)（Minimal system prompt / Minimal toolset 节）
2. **渐进披露替代常驻全量**：pi 不支持 MCP，理由是 MCP 一次性把工具描述（如 13.7k、18k token）全部塞进上下文；替代做法是 CLI + README，代理需要时才读，"pays the token cost only when necessary"。（同上，No MCP support 节）
3. **just-in-time 上下文：轻量标识 + 按需加载**：代理保存文件路径等轻量标识，运行时用工具加载；层级、命名本身就是信号，代理可以逐层探索（progressive disclosure）。Claude Code 是混合策略：CLAUDE.md 常驻，glob/grep 按需检索，从而绕开过期索引和复杂语法树问题。[Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)（Context retrieval and agentic search 节）
4. **反对把边界情况清单堆进 prompt**：推荐少量规范示例，而不是"laundry list of edge cases"；工具集臃肿、选择点模糊是最常见失败模式之一。（同上，The anatomy of effective context 节）
5. **工具按任务的自然切分设计，返回高信号信息**：把计算从代理上下文移回工具内部；返回名称等可读字段而非低信号技术标识；用过滤、分页、截断和合理默认限制控制 token。[Anthropic, Writing effective tools for AI agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
6. **工具结果分离给模型与给 UI 的部分**：pi-ai 的工具可同时返回给 LLM 的内容和给 UI 渲染的内容。（Zechner 文章，Structured split tool results 节）本项目的 `details` 已经在用这个机制。

## 三、映射到本项目（待讨论的方案方向）

把设备目录当作代码仓库来对待：

- **常驻的是"地图"不是"文件"**：只放极小的层级入口（如楼层与该层顶级地点及设备数），对应 CLAUDE.md/`ls` 根目录，体积为几百 token 级，具体数字待实测。
- **按需检索用字面、可预测的语义**：相当于 grep——在设备名和位置原文上做子串匹配，返回匹配行（稳定 ID、名称、位置），附总数和截断提示。没有软提示和 resolution 模式。"楼道→过道"这类语义映射留给模型，失败重试一次很便宜，结果也可预测。这样不需要先把脏数据解析成结构化词表（见 D1 的解析难题）。
- **稳定目录 ID 代替每次检索的句柄**：类似文件路径。历史里的检索结果自带 ID，"后者"可以对照上一轮输出解析；草案和任务直接引用 ID，Runtime 按当前授权目录校验。
- **删除建立在旧前提上的补丁**：候选集、`complete`、50 台上限、守卫、对应 prompt 规则；prompt 回到角色、真实性和授权边界、回复风格。

## 四、尚未解决的问题

- 常驻地图的粒度：楼层 + 顶级地点能否从现有字段可靠得出（位置字段常与设备名相同，楼层写法不统一）。
- grep 式检索在 Company 335 台、命中很宽的词（如"灯"）时的返回形态：截断 + 总数 + 按位置计数，还是要求模型加词。
- 现有常驻规则与 `runtime_context` 每轮重复的实测 token 成本（Langfuse 输入 token 与 cacheRead）。
- 是否仍需要"待选项"机制：目录 ID 稳定后，先用真实对话判断"后者"是否仍会出问题。
