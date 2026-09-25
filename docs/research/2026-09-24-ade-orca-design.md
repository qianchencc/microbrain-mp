# Orca（ADE）设计调查：富交互面与自动化

日期：2026-09-24
状态：外部产品设计调查，非本项目事实

> 本笔记只使用一手来源：onorca.dev 官方文档、官方 changelog、官方 GitHub 仓库（stablyai/orca）。文档站点可正常访问；早前笔记给出的入口路径（`/docs/cli/automations`、`/docs/cli/orchestration`、`/docs/notifications`、`/docs/mobile`）目前全部有效，为当前规范路径。

## 0. 产品定位（先校准）

- Orca 是 Stably AI 出品的开源桌面"agent IDE / ADE"（Agent Development Environment，Y Combinator 支持），核心形态是：每个任务一个独立 git worktree + 独立 agent 终端 + 独立浏览器标签，并行运行 Claude Code、Codex、Cursor CLI 等用户自带订阅的 CLI agent。来源：https://www.onorca.dev/docs ，https://www.onorca.dev
- 官方自我界定："Not a model"（不带模型）、"Not a git replacement"、"Not a hosted VPS"——默认跑在桌面，远端走用户自己控制的 SSH 目标、自托管 Orca server 或 Cloud VM。来源：https://www.onorca.dev/docs
- GitHub 仓库 stablyai/orca 公开（约 76.7k star），含 `docs/`、`skills/`、`skill-guides/`、`mobile/` 目录。来源：https://github.com/stablyai/orca
- 对我们的相关性：Orca 与我们的小程序 IoT agent 形态不同（它是"人看管一群 coding agent"，我们是"agent 产出动作草稿由人确认后下发物理设备"），但其在**审批/接管表面**与**定时自动化**上的机制设计可直接借鉴。

## 1. 轴一：富交互 / 结构化表面

### 1.1 会话状态模型与总览面

- 一个 **agent session** = 一个 CLI agent × 一个终端 × 一个 worktree；Orca 跟踪其生命周期。来源：https://www.onorca.dev/docs/model/agents-sessions
- 统一状态字形（跨 tab / 侧栏 / dashboard / feed 同一套词汇）：
  - Spinner = 工作中；琥珀色问号 = 等你（权限/需要输入，侧栏 "Needs You" 计数同字形）； emerald 对勾/圆点 = 完成；红点 = 阻塞/中断/失败；灰点 = 空闲；无标识 = 非受识别 agent 的普通 shell。
  - 状态检测基于终端 OSC 标题序列与 agent hooks（Claude Code、Codex 等会发出），不是 UI 轮询猜测。来源：https://www.onorca.dev/docs/model/agents-sessions
- **Agent Dashboard**（实验性）：侧栏入口，跨 worktree 的看板，列 = Needs You / Working / Done / Idle（默认隐藏）；卡片含会话名、最近消息预览、host 徽标、时间；Needs You 卡片染琥珀色并可显示待答问题摘要；点卡片直达该 agent 的活动终端。来源：https://www.onorca.dev/docs/model/agents-sessions
- **启动默认即全自治**：Orca 给每个受支持 agent 预置"全自治"权限旗标启动——Claude `--dangerously-skip-permissions`、Codex `--dangerously-bypass-approvals-and-sandbox`、Gemini `--yolo` 等；官方原话意图是"worktree 本身就是沙箱"，避免逐工具审批打断流。可在 Settings → Agents 改每 agent 启动参数。来源：https://www.onorca.dev/docs/model/agents-sessions

### 1.2 Chat UI：结构化 transcript 上的"块"类型

- Chat UI 是覆盖在受支持 agent 终端上的实验性视图：**终端仍是事实源**，Chat UI 只是同一 PTY 的结构化 transcript + 输入器；另有一个"updated structured native chat"把会话状态保存在 Orca 内、可跨重启恢复（限本地 Claude/Codex）。来源：https://www.onorca.dev/docs/agents/native-chat
- 已核验的结构化消息/块类型（同页 + changelog）：
  - **工具调用行**：活动工具调用显示实时进度，结束后折叠成可展开的结果行；工具批处理被归组（changelog 1.4.199 "grouped tool batches"）；单个运行中任务可从其行单独停止而不停整轮。来源：https://www.onorca.dev/docs/agents/native-chat
  - **内联 diff 卡**：agent 的文件编辑渲染为 transcript 内的 diff 卡片，可点击文件路径打开。来源：https://www.onorca.dev/docs/agents/native-chat ，changelog 1.4.198 https://www.onorca.dev/changelog
  - **问题/权限卡**：Claude `AskUserQuestion` 等结构化权限/问题被渲染为可回答卡片（非折叠 tool call），在卡片上 Submit 确认；**已回答的审批/问题卡保留为"收据"，展示你选过的答案**。远端/headless host 上的 agent 同样渲染。来源：https://www.onorca.dev/docs/agents/native-chat
  - **计划/清单**：Claude `TodoWrite`、Codex `update_plan` 渲染为内联 checklist，最新计划还出现在输入框上方的可折叠进度面板；OpenCode 有专用 plan 卡片（changelog 1.4.206 "dedicated plan cards … rather than generic approvals"）。来源：https://www.onorca.dev/docs/agents/native-chat ，https://www.onorca.dev/changelog
  - **Codex goal 状态行**：goal 的 set/paused/blocked/completed/stopped/cleared 作为 transcript 行出现。来源：https://www.onorca.dev/docs/agents/native-chat
  - **轮次文件变更汇总头**：一轮结束时 header 汇总改动文件与 +/- 行数，展开露出 diff 卡（changelog 1.4.200）。来源：https://www.onorca.dev/changelog
  - **后台任务条 + 子 agent 行**：运行中显示 agents/shells/monitors 等计数条，子 agent 以缩进子行出现在侧栏与 transcript。来源：https://www.onorca.dev/docs/agents/native-chat ，changelog 1.4.201 https://www.onorca.dev/changelog
  - **message rail**：长会话边缘每 user prompt 一个标记，悬停预览、点击跳转。来源：https://www.onorca.dev/docs/agents/native-chat
- **发送态的诚实状态机**：发送途中 Orca 或 agent 重启时，Orca 核对 provider transcript——能证明送达则 settle，能证明未送达则给 Retry，**无法区分时标记 unconfirmed 而不是冒险重发**。来源：https://www.onorca.dev/docs/agents/native-chat

### 1.3 Diff 审查环（结构化产物审阅）

- 每个 worktree 内置对 start-from ref 的合并 diff：双侧行号、图片 diff（side-by-side/swipe/onion-skin）、HTML 预览、三方冲突解决 UI、按 hunk/行 stage、空白显示开关、折叠未变更区。来源：https://www.onorca.dev/docs/review/diff-viewer
- **Annotate AI Diff**：悬停任意 diff 行出现 + 号留 markdown 评论（支持拖选多行范围，`c` 键）；评论钉在确切行、diff 移动时跟随；审完点 **Send to agent** 把所有评论组成**单条 prompt** 批量发回 agent 修订；评论在修订后保留供核对，可 Resolve；未解决评论并入下一批。官方解释批量原因：逐条发会让 agent 来回摇摆。来源：https://www.onorca.dev/docs/review/annotate-ai-diff

### 1.4 移动端伴随应用（接管面）

- iOS/Android 伴随应用（beta），一次性配对（配对码 / Orca Relay / LAN），**桌面始终是事实源**，定位是"read-mostly remote control"。来源：https://www.onorca.dev/docs/mobile
- 手机上可做：看全部 host 的全部 worktree 及 agent 状态（working/done/waiting on input）；读终端 scrollback；Chat UI 或原始终端视图（设备默认 + 每 tab 覆盖）；**agent 等输入时回复**（`continue`/`yes`/自由文本/照片附件/语音听写）；Live 模式逐字符直送终端；终端辅助键行（Tab/Esc/Ctrl+C 等）；Quick Commands；Source Control 看改动、stage、提交；sleep worktree；建 workspace；切 agent 账号与用量；**agent 完成时收推送通知**。来源：https://www.onorca.dev/docs/mobile
- 官网首页移动端示意里直接出现 `awaiting permission · sudo apt install` 条目，佐证权限等待状态会透到手机。来源：https://www.onorca.dev

### 1.5 通知与收件箱

- **agent-finished ping**：agent 从 working→idle 转换时触发系统通知 + 声音 + worktree 上的 chip；Orca 强调它能区分"真完成"与"只是暂停"。来源：https://www.onorca.dev/docs/notifications
- **header bell**：跨 worktree 未读收件箱；点通知**跳转到对应 worktree 和 pane**；macOS Dock 角标同步未读数；右键可"标记未读"以便稍后回来；按类别（system/sound/chip-only）在 Settings → Notifications 关闭；支持自定义提示音（MP3/WAV/OGG/M4A/AAC/FLAC）。来源：https://www.onorca.dev/docs/notifications
- **Agents feed**：侧栏 "Agents" 入口，跨全部 worktree 的线程化事件流——agent 完成/阻塞提问、等输入够久升级为 blocking、worktree 创建事件、最近回复预览；运行中置顶分组；未读角标；点条目同样跳转 worktree+pane。定位是"离开后的 catch-up 面"，不替代 bell/系统通知。来源：https://www.onorca.dev/docs/activity

### 1.6 人中途接管的方式（汇总）

- 直接在终端打字/ Esc / Ctrl+C（是真 PTY）；Chat UI 输入器可停当前轮；单工具行级停止；移动端 Live 模式逐字符接管、sleep worktree。来源：https://www.onorca.dev/docs/agents/native-chat ，https://www.onorca.dev/docs/mobile
- agent 退出后 tab 出现 **Restart** chip，一键同目录重启；会话可从 Session History 恢复（`claude --resume` 等）；hibernation 自动暂停空闲后台 agent 并在重开 worktree 时用相同 resume 旗标拉起。来源：https://www.onorca.dev/docs/model/agents-sessions ，https://www.onorca.dev/docs/agents/hibernation
- 编排场景：`worker-stop --dispatch` 停受管 worker，`worker-release` 归档输出后关闭协调者拥有的终端，`worker-retain` 保留现场调试。来源：https://www.onorca.dev/docs/cli/orchestration

## 2. 轴二：自动化

### 2.1 自动化如何定义

- 定义方式 = **CLI 命令 + 桌面 UI 表单**，不是 DSL/配置文件。`orca automations create` 参数：`--name`、`--trigger`、`--time`、`--timezone`、`--prompt`、`--provider`、`--repo` | `--workspace` | `--project`/`--host`/`--project-host-setup`、`--precheck`、`--reuse-session`、`--disabled`、`--source-context`、`--json`。来源：https://www.onorca.dev/docs/cli/automations
- **任务本体是 natural-language prompt**（`--prompt "Triage new issues and summarize blockers"`）；触发器是结构化字段：预设 `hourly`/`daily`/`weekdays`/`weekly` + 5 字段 cron + RRULE，`--timezone` 指定 IANA 时区，`--day` 仅配 weekly。来源：https://www.onorca.dev/docs/cli/automations ，https://raw.githubusercontent.com/stablyai/orca/main/skill-guides/orca-cli/references/automations.md
- 运行目标：`--repo` = 每次运行在仓库新建 worktree；`--workspace` = 在既有 Orca worktree 内跑；两者互斥；都不给时从当前 shell 目录推断所属 worktree。来源：https://www.onorca.dev/docs/cli/automations ，https://raw.githubusercontent.com/stablyai/orca/main/skill-guides/orca-cli/references/automations.md
- 桌面 **Automations** 页把本机与已连接 Orca host 的 schedule 合进一张表（Host 列 + Filters→Host）；UI 创建时先选 "Create on" 目标 host 再选项目；版本过旧的 host 显示 "Update server" 而不断言消失。来源：https://www.onorca.dev/docs/cli/automations ；跨 host 管理见 changelog 1.4.192 https://www.onorca.dev/changelog

### 2.2 预检 / 预览 / 试跑

- `--precheck "<shell 命令>"`：运行前的廉价探针，**非零退出记为一次 skipped run**（不是失败）。例：无 PR 时跳过评审。来源：https://www.onorca.dev/docs/cli/automations
- 官方推荐流程即"安全首跑"模式：**先 `--disabled` 创建**，调好 prompt 和 target 后用 `orca automations run <id>` 手动触发验证，再 `edit --enabled` 启用。文档没有独立的 dry-run/preview 概念——"手动跑一遍 + 默认禁用"就是预览路径。来源：https://www.onorca.dev/docs/cli/automations
- UI 侧可全文查看 prompt（changelog 1.4.192 "full prompt inspection"）。来源：https://www.onorca.dev/changelog

### 2.3 副作用授权模型

- 文档**没有**描述自动化运行时逐步弹权限审批的机制；结合 1.1 节"全自治旗标 + worktree 即沙箱"的默认启动模型，Orca 的授权语义是：**创建/配置时选定目标与 prompt + worktree 隔离即边界，运行中默认不再问**。注意：automation 启动的 agent 是否沿用同一套全自治旗标，文档未逐字说明——**此点为推断，标记未核验**。来源：https://www.onorca.dev/docs/cli/automations ，https://www.onorca.dev/docs/model/agents-sessions
- 对照证据：对外副作用（artifact 公开链接）采用**人类独占闸门**——必须在设备上由人打开 Settings → Artifacts → Allow publishing，**没有任何 CLI 旗标可授予该权限**，agent/脚本无法自行开启。来源：https://www.onorca.dev/docs/cli/reference （Artifacts 节）
- 对我们的映射价值：Orca 的边界是"worktree 内随便动、出边界要人开门"；对应到我们就是"agent 只产出动作草稿、物理执行永远过人确认"。

### 2.4 运行历史 / 幂等 / 错过运行

- `orca automations runs --id <automationId>` 查运行历史；`automations show`/`list` 查定义。UI 侧有集中 **Runs 仪表盘**（工具栏按钮）：cursor 分页、24h/7d 汇总指标、按状态与 host 过滤（changelog 1.4.197）。来源：https://www.onorca.dev/docs/cli/automations ，https://www.onorca.dev/changelog
- 列表可按 Host、Enabled/Paused、上次运行结果（Failed/Succeeded/Never ran）、Agent 过滤；行内键盘导航（Enter 打开、方向键翻运行历史、左右切 Overview/Runs、Esc 返回）。来源：https://www.onorca.dev/docs/cli/automations
- **错过运行宽限**：`edit --missed-run-grace-minutes 30`。来源：https://www.onorca.dev/docs/cli/automations
- **失败重跑**：若 run 在打开 workspace/重连目标前失败，可在 Orca 内打开该 run 点 **Rerun** 排一个同自动化的手动 run。来源：https://www.onorca.dev/docs/cli/automations
- **会话复用**：`--reuse-session` 让后续 run 沿用上一个 live automation 终端（仅限 existing-workspace 目标；上一个终端没了则回退新会话）；`--fresh-session` 切回每次新终端。来源：https://www.onorca.dev/docs/cli/automations ，https://raw.githubusercontent.com/stablyai/orca/main/skill-guides/orca-cli/references/automations.md
- 并发重叠/去重等幂等策略：文档未描述，**未核验**（precheck 是唯一显式的"跳过"机制）。
- `remove` 删除自动化**及其运行历史**。来源：https://www.onorca.dev/docs/cli/automations
- SSH host 断连时其上的"外部自动化"仍可管理（含删除）——管理面不依赖活连接。来源：https://www.onorca.dev/docs/cli/automations

### 2.5 编排层（Orchestration）：更重的自动化形态

- 实验性（Settings → Experimental），核心模型：**Run**（命名空间 + 协调者收件箱）/ **Task**（spec + 依赖 + 状态：`pending`/`ready`/`dispatched`/`completed`/`failed`/`blocked`）/ **Dispatch**（一次任务尝试，是 `worker_done`/心跳的生命周期权威）/ **Message**（`status`/`dispatch`/`worker_done`/`escalation`/`question`/`heartbeat`）/ **Decision gate**。来源：https://www.onorca.dev/docs/cli/orchestration
- **完成权威与防陈旧**：worker 完成/心跳必须带 `taskId` + `dispatchId`，"stale retries cannot complete the wrong dispatch"；`worker_done` 必须带 `--outcome succeeded|failed` 且只发一次。来源：https://www.onorca.dev/docs/cli/orchestration
- **收件箱确认语义**：`check` 默认取最老未 ack Delivery（FIFO），可 replay 直到 `--ack`；`--peek`/`--all` 不消费；`check --wait` 阻塞等指定类型并每 15s 向 stderr 打 JSON 心跳。来源：https://www.onorca.dev/docs/cli/orchestration
- **人/机提问通道**：worker 用 `orchestration ask --question --options --timeout-ms` 问协调者（阻塞、返回可 `jq` 的 JSON）；协调者用 `gate-create`/`gate-resolve` 在 DAG 上挂决策门。来源：https://www.onorca.dev/docs/cli/orchestration
- 组播地址 `@all`/`@idle`/`@<agent>`/`@worktree:<id>`；终端里打印的 `task_...` ID 是可点链接，点击聚焦其当前 dispatch 的终端（含远端）。来源：https://www.onorca.dev/docs/cli/orchestration
- 联邦 worker：`worker-start --on <host>` 派到别的机器，之后按 dispatchId 路由。`reset --tasks|--messages|--all` 是显式放弃全局编排状态。来源：https://www.onorca.dev/docs/cli/orchestration

### 2.6 通知通道与回链

- 通道：桌面系统通知 + 声音 + worktree chip + header bell 未读收件箱 + Dock 角标 + 移动端推送（镜像桌面通知）。来源：https://www.onorca.dev/docs/notifications ，https://www.onorca.dev/docs/mobile
- **回链语义统一**：任何通知/feed 条目点开都落到"对应 worktree + 对应 pane"——通知不是消息存档，而是进入现场的深链。来源：https://www.onorca.dev/docs/notifications ，https://www.onorca.dev/docs/activity
- 自动化运行是否有专属通知类别（区别于 agent-finished）：文档未明示，**未核验**；但 run 本身是 agent 会话，finish/ping 链路应适用（推断）。

### 2.7 暂停 / 停止 / 杀死语义

- 自动化级：`edit --enabled`/`--disabled` 启停；列表过滤器中存在 **Paused** 状态（具体置位入口文档未单列，**未核验**，推断为 edit/UI）；`remove` 连历史一起删。来源：https://www.onorca.dev/docs/cli/automations
- 运行级：失败 run 可 Rerun；没有文档化的"杀掉进行中的 automation run"命令——但 run 落在终端上，`terminal close`/`worker-stop` 是通用手段（自动化专用 kill 未核验）。来源：https://www.onorca.dev/docs/cli/reference ，https://www.onorca.dev/docs/cli/orchestration
- agent 级：composer 停轮、单工具停止、`worker-stop --dispatch`、手动 sleep worktree（含 Sleep with Descendants）、hibernation 自动休眠空闲 done 态 agent（有未 settle dispatch 时不休眠）。来源：https://www.onorca.dev/docs/agents/native-chat ，https://www.onorca.dev/docs/cli/orchestration ，https://www.onorca.dev/docs/agents/hibernation

### 2.8 相邻能力：computer use 与 worktree checkpoint

- `orca computer`：通过 accessibility tree 驱动本地 GUI 应用（click/set-value/type/drag/截图），需系统级 Accessibility/屏幕录制权限，**权限缺失时 `permissions --json` 显式报告**；敏感输入走 stdin 不进 shell history——"物理动作前显式权限面"的又一例。来源：https://www.onorca.dev/docs/cli/computer-use
- worktree comment/card status（`todo`/`in-progress`/`in-review`/`completed`）是官方推荐的"agent 向人类协作者报进度"轻量通道。来源：https://www.onorca.dev/docs/cli/worktree-checkpoints

## 3. 设计模式提炼（对我们两轴的可复用点）

1. **沙箱边界替代逐动作审批**：默认给 agent 全自治旗标、用 worktree 隔离做权限边界，把"审批"从每步一次挪到"环境准入"一次。对我们的启示相反但同构——我们的边界是"动作草稿不过人确认不出系统"，应把确认闸做成边界而非装饰。来源：https://www.onorca.dev/docs/model/agents-sessions
2. **卡片即状态机，回答即收据**：AskUserQuestion/权限卡 pending→Submit→answered 后**留作展示所选答案的收据卡**，不消失。动作草稿也应 pending→confirmed/rejected/expired 后留存可追溯收据。来源：https://www.onorca.dev/docs/agents/native-chat
3. **批量锚点反馈（Annotate）**：行级锚定评论 → 合成单条 prompt 发回 → 评论跨修订保留用于核对。对应我们：对草稿的逐条修改意见可聚合为一轮反馈而不是逐条往返。来源：https://www.onorca.dev/docs/review/annotate-ai-diff
4. **一套状态字形贯穿所有表面**：6 个状态符贯穿 tab/侧栏/dashboard/feed/mobile，检测靠 OSC+hooks 语义信号而非启发式。我们 NDJSON 流也应定义显式状态词表（working/needs-you/done/blocked/idle）并让每类表面复用。来源：https://www.onorca.dev/docs/model/agents-sessions ，https://www.onorca.dev/docs/activity
5. **三层通知分层**：瞬时 ping（系统通知/推送）→ 持久收件箱（bell + 未读 + 标记未读）→ 追赶面（Agents feed 线程化 + 回复预览 + running 置顶）；且**每条通知都是跳回现场的深链**。来源：https://www.onorca.dev/docs/notifications ，https://www.onorca.dev/docs/activity
6. **自动化 = NL prompt + 结构化触发器 + 目标三元组**：任务体是自然语言，触发是预设/cron/RRULE + IANA 时区；`--disabled` 优先 + 手动 `run` 即验证循环；`--precheck` 廉价探针把"无事可做"记为 skipped 而非 failed。来源：https://www.onorca.dev/docs/cli/automations
7. **Run/Dispatch 分离 + 双 ID 完成权威**：任务与"一次尝试"分表，完成消息必须同时带 taskId+dispatchId，陈旧重试无法错误收口——幂等靠身份而非时序。来源：https://www.onorca.dev/docs/cli/orchestration
8. **Delivery ack/replay 收件箱语义**：消息 FIFO 投递、可重放到 ack 为止；schedule 侧配 missed-run-grace-minutes 处理错过窗口。来源：https://www.onorca.dev/docs/cli/orchestration ，https://www.onorca.dev/docs/cli/automations
9. **接管 = 同一事实源的另一视图**：mobile Chat UI/终端都是同一 PTY/会话的视图，接管就是直接输入；sleep/hibernate/resume 保会话供稍后接管。我们小程序端同理：草稿确认界面应是同一会话流的视图，不是独立系统。来源：https://www.onorca.dev/docs/mobile ，https://www.onorca.dev/docs/agents/hibernation
10. **人类独占闸门**：越边界副作用（公开链接发布）只能由人在 Settings 打开、无 CLI/agent 路径；`computer use` 权限缺失显式可查。物理设备执行权限也应只存在人类通道可授予的档位。来源：https://www.onorca.dev/docs/cli/reference ，https://www.onorca.dev/docs/cli/computer-use

## 4. 未核验清单（明确留白）

- 自动化 run 内的 agent 是否沿用全自治旗标（推断沿用，文档未逐字写明）。
- 自动化是否有专属通知类型/渠道（推断复用 agent-finished 链路）。
- 自动化重叠触发（上一次未完又来一次）的去重/排队策略。
- "Paused" 自动化状态的具体置位入口（edit 旗标还是 UI 独占）。
- 杀掉进行中 automation run 的专用命令（通用 terminal close/worker-stop 可覆盖，但是否有语义级 kill 未写明）。
- 文档站点声明 Chat UI、Orchestration、hibernation、mobile、computer use 均为 Experimental/Beta，机制可能随版本漂移；本笔记以 2026-09-24 抓取页面为准。
