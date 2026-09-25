# OpenAI Codex 设计调查：富交互表面与自动化

- 日期：2026-09-24
- 状态：**外部产品设计调查，非本项目事实**。所有结论均来自公开一手资料（OpenAI 官方文档、openai.com 博客/更新日志、github.com/openai/codex 仓库源码），每条论断附内联来源 URL；无法核实的条目标注「未核验」。
- 调查目的：为本项目的 IoT 控制 Agent（微信mini-program，结构化 action draft + 显式确认 + NDJSON 流）提炼成熟 Agent 产品在两个轴上的设计模式：**(1) 富/结构化交互表面**；**(2) 自动化（定时/事件触发的无人值守执行）**。
- 覆盖产品：Codex 云端 Agent（chatgpt.com/codex）、Codex App（ChatGPT 桌面应用内的 Codex 模式）、Codex CLI / IDE 扩展（开源仓库 github.com/openai/codex）。

---

## 0. 产品形态总览

Codex 是一个编码 Agent 家族，跨多个「surface」运行：ChatGPT 桌面 App（Codex 模式）、Codex CLI、IDE 扩展、Codex Cloud（chatgpt.com/codex 网页）、Codex Remote（手机遥控本机任务）。登录体系统一为 ChatGPT 账号。(https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)

Codex 的会话运行位置有三档环境：**Local**（当前项目目录）、**Worktree**（Git worktree 隔离）、**Cloud**（远端配置好的云环境）。(https://learn.chatgpt.com/docs/environments/modes.md)

---

## 1. 轴一：富 / 结构化交互表面

### 1.1 云端任务的呈现结构

- 每个云任务在独立的云沙箱容器中执行，预载仓库；任务期间可实时查看任务日志（terminal commands / 输出），结束后展示**结果摘要 + 文件变更 diff**，并提供三个出口：追问修改（follow-up）、创建 GitHub PR、把 diff 应用到本地。(https://openai.com/index/introducing-codex/ ; https://learn.chatgpt.com/docs/cloud.md ; https://learn.chatgpt.com/docs/environments/cloud-environment.md)
- 任务列表页支持并行多任务，任务完成后 Codex 会在自己的环境中 commit 变更；官方强调「可验证证据」设计——通过引用终端日志与测试输出让用户追溯每一步。(https://openai.com/index/introducing-codex/)
- 2025-06-13 changelog：支持取消任务（cancelling tasks）、Best-of-N（同一任务生成多个并行应答供挑选）、diff 头部可 option-click 全部展开/折叠；2025-06-03：跟进任务可直接更新已有 PR。(https://developers.openai.com/codex/changelog)
- 2025-09-15 changelog：前端任务中 agent 可在 Codex web 输出 UI 截图（image outputs），无需本地 checkout 即可评审视觉结果。(https://developers.openai.com/codex/changelog)

### 1.2 任务对象模型（来自开源仓库源码，最直接证据）

`codex-rs/cloud-tasks-client/src/api.rs` 定义了云任务的客户端模型（kebab-case 序列化）：(https://raw.githubusercontent.com/openai/codex/main/codex-rs/cloud-tasks-client/src/api.rs)

- **`TaskStatus` 枚举：`Pending | Ready | Applied | Error`** —— 即任务级生命周期：排队/执行中（pending）→ 产出可评审结果（ready）→ diff 已被应用（applied）→ 失败（error）。注意：**没有独立的 "review" 状态**，「待评审」就是 `ready`；`is_review` 是一个布尔字段，用来区分该任务是「代码评审任务」还是普通编码任务。
- **`TaskSummary` 字段**：`id, title, status, updated_at, environment_id, environment_label, summary(DiffSummary), is_review, attempt_total`。其中 `DiffSummary = { files_changed, lines_added, lines_removed }`——列表行内嵌 diff 统计。
- **`AttemptStatus`：`Pending | InProgress | Completed | Failed | Cancelled | Unknown`**；`TurnAttempt` 含 `turn_id, attempt_placement, created_at, status, diff, messages`——对应 Best-of-N 的「同一 turn 多个 sibling attempt」模型（`list_sibling_attempts`）。
- **`ApplyOutcome`**：`applied, status(success|partial|error), message, skipped_paths, conflict_paths`；且有 `apply_task_preflight`（dry-run 预检，先验证 patch 能否干净应用、绝不改工作区）与 `apply_task` 分离。**「先预检再落盘」是一个可复用的确认前置机制**。
- `create_task(env_id, prompt, git_ref, qa_mode, best_of_n)`——任务创建参数：环境 + 提示词 + git ref + best-of-N 份数。
- CLI 侧 `codex cloud list --json` 返回 `tasks` 数组 + `cursor`，字段与上述一致。(https://learn.chatgpt.com/docs/developer-commands.md)
- 社区 issue 提到还存在 `codex cloud exec --env ENV_ID`、`status`、`diff`、`apply` 等命令面；环境管理（env list/create）目前无完整脚本化 API，需进 TUI/Web 复制不透明 env ID。(https://github.com/openai/codex/issues/24777)（issue 为用户提交，细节未核验但反映了真实 API 形状）

### 1.3 结构化消息 / 交互组件类型

- **审批提示（approval prompt）**：agent 需要越出沙箱边界（写工作区外文件、需要网络的命令、带副作用的 app/MCP 工具调用）时暂停并弹出审批；带 `destructive` 注解的工具调用永远需要审批（除非工具同时标了 read 注解）。(https://learn.chatgpt.com/docs/agent-approvals-security.md)
- **审批的作用域分级**：提示里可选「仅本次」或「本会话内不再问」等不同作用域；在 TUI 把命令加入 allow list 会写入 `~/.codex/rules/default.rules`，使后续同类命令跳过提示。(https://learn.chatgpt.com/docs/sandboxing.md ; https://learn.chatgpt.com/docs/agent-configuration/rules.md)
- **Smart approvals（默认开启）**：Codex 在越权请求时可主动为用户草拟一条 `prefix_rule`（命令前缀规则），用户审查后可接受——即「审批 → 沉淀为持久规则」的转化路径。(https://learn.chatgpt.com/docs/agent-configuration/rules.md)
- **Auto-review 审批项**：当 `approvals_reviewer = "auto_review"`，审批请求改由一个独立 reviewer agent 裁决；桌面 App 中显示为带状态的审查条目：**Reviewing / Approved / Denied / Aborted / Timed out**，并附风险等级与用户授权评估。(https://learn.chatgpt.com/docs/agent-approvals-security.md ; https://learn.chatgpt.com/docs/sandboxing/auto-review.md)
- **评审面板（review pane）**：桌面 App 内置 Git diff 面板，支持 Unstaged/Staged/Commit/Branch/Last turn 五种视图、逐行内联评论（行级 `+` 按钮写反馈）、按 diff/文件/hunk 三级 stage/unstage/revert、多仓库切换；内联评论作为「review guidance」随下一条消息生效。(https://learn.chatgpt.com/docs/code-review.md)
- **工件预览**：App 侧边栏可预览生成的 PDF/表格/文档/幻灯片（artifact viewer）。(https://openai.com/index/codex-for-almost-everything/ ; https://learn.chatgpt.com/docs/artifacts-viewer.md)
- **状态可见性组件**：桌面 App 有 Activity 视图（铃铛，区分 unread/running/waiting-for-response）和悬浮「pet」状态指示（Running / Needs input / Ready / Blocked）。(https://learn.chatgpt.com/docs/notifications.md)

### 1.4 中途引导（steering）与排队

- CLI 中按 **Tab** 可在 agent 工作期间把追问、斜杠命令或 shell 命令**排队到下一 turn**；排队的斜杠命令在真正执行时才解析。(https://learn.chatgpt.com/docs/developer-commands.md)
- 会话中可 steering 的命令族：`/model`、`/fast`、`/personality`、`/permissions`（中途切换审批档位）、`/approve`（重试一次被 auto-review 拒绝的动作）、`/raw`、`/agent`、`/status`；另有 `/side` 开临时侧聊不打断主聊、`/fork` 复制会话。(https://learn.chatgpt.com/docs/developer-commands.md)
- 云任务的 follow-up 是在已有任务上追加 turn（`TurnAttempt`/`attempt_total` 字段印证多轮尝试），跟进时环境从最近状态续跑（2025-06-03 changelog 修复过「错误地从第一 turn 状态启动」的 bug）。(https://raw.githubusercontent.com/openai/codex/main/codex-rs/cloud-tasks-client/src/api.rs ; https://developers.openai.com/codex/changelog)
- Codex Remote（手机端）将「看进度—批审批—发指令—看 diff」四步做成移动表面，审批请求可远程批准。(https://learn.chatgpt.com/docs/remote.md)

### 1.5 CLI 的权限/审批模型（suggest/auto-edit/full-auto 的后继形态）

早期 TS 版 CLI 的 `--approval-mode suggest|auto-edit|full-auto` 已被当前模型取代；原始命名的官方页面已下线（docs/exec.md、docs/sandbox.md 现均跳转到 developers.openai.com 文档），**旧三档命名的精确措辞未核验**。当前模型的可核实形态为「二维矩阵」：(https://raw.githubusercontent.com/openai/codex/main/docs/exec.md ; https://raw.githubusercontent.com/openai/codex/main/docs/sandbox.md ; https://learn.chatgpt.com/docs/config-file/config-reference.md)

- **sandbox_mode（技术边界）**：`read-only | workspace-write | danger-full-access`。macOS 用 Seatbelt/sandbox-exec，Linux 用 bwrap+seccomp，Windows 有原生沙箱；`.git`、`.agents`、`.codex` 在可写根内仍受保护为只读。(https://learn.chatgpt.com/docs/sandboxing.md ; https://learn.chatgpt.com/docs/agent-approvals-security.md)
- **approval_policy（何时停下来问）**：`on-request | never | { granular = {...} }`；`untrusted` 已退役、`on-failure` 已废弃。granular 粒度按提示类别分闸：`sandbox_approval / rules / mcp_elicitations / request_permissions / skill_approval`，可让某些类别保持交互、其余自动拒绝。(https://learn.chatgpt.com/docs/config-file/config-reference.md ; https://learn.chatgpt.com/docs/agent-approvals-security.md)
- **approvals_reviewer（谁来审）**：`user | auto_review`。(https://learn.chatgpt.com/docs/config-file/config-reference.md)
- 面向用户的档位名（桌面/IDE 权限菜单）：**Ask for approval**（默认推荐）、**Approve for me**（=Auto-review）、**Full access**；CLI 侧对应预设如 `Auto`（workspace-write + on-request）、`Read Only`。(https://learn.chatgpt.com/docs/permission-modes.md ; https://learn.chatgpt.com/docs/sandboxing.md)
- `codex exec`（非交互）默认 read-only 沙箱；`--full-auto` 保留为废弃兼容项并打印警告；`--dangerously-bypass-approvals-and-sandbox`（别名 `--yolo`）= 无沙箱无审批。(https://developers.openai.com/codex/noninteractive.md ; https://learn.chatgpt.com/docs/agent-approvals-security.md)
- **规则层 execpolicy/rules**：`.rules` 文件用 Starlark 写 `prefix_rule(pattern, decision=allow|prompt|forbidden, justification, match/not_match)`；多条命中取最严（forbidden > prompt > allow）；`bash -lc` 复合命令在安全时用 tree-sitter 拆成逐条命令分别判定（防止 `git add . && rm -rf /` 混进 allow）；`codex execpolicy check` 可离线测试规则。(https://learn.chatgpt.com/docs/agent-configuration/rules.md)
- **Auto-review（审批代理化）**：审批请求路由给独立 reviewer agent，输入为「精简 transcript + 具体审批请求」（不含隐藏 CoT）；拒绝时回注理由并指示主 agent 走更安全路径或停下来问人；内置熔断——同一 turn 连续 3 次拒绝或最近 50 次评审中 10 次拒绝即中断 turn；`/approve` 可对最近被拒动作做一次性的精确重试授权（记录最多 10 条拒绝）。评审策略文件开源在 `codex-rs/core/src/guardian/policy.md`，企业可用 `guardian_policy_config` 替换。(https://learn.chatgpt.com/docs/sandboxing/auto-review.md)
- **两阶段网络模型**：默认无网络；`network_proxy` 特性开启后按域名 allowlist（`*.`、`**.`、`deny` 优先）过滤子进程出站流量，含 DNS rebinding 防护；web_search 有 `cached`（默认，走 OpenAI 索引缓存防注入）/`live`/`disabled`/`indexed` 四档。(https://learn.chatgpt.com/docs/agent-approvals-security.md)
- **安全监控可暂停任务**：GPT-6 Astra 起内置异步安全监控，检测到不安全行为可暂停任务；有 findings+resume 流程的客户端可审查后续跑，CLI/移动端/零留存等场景下任务直接结束。(https://learn.chatgpt.com/docs/agent-approvals-security.md)

### 1.6 结构化输出协议（与本项目 NDJSON 直接可比）

`codex exec --json` 把 stdout 变为 JSON Lines 事件流，每行一个事件：`thread.started / turn.started / turn.completed / turn.failed / item.started / item.completed / error`；item 类型含 `agent_message`、`reasoning`、`command_execution`、`file_change`、MCP tool call、web search、plan update；`turn.completed` 附 token usage。另有 `--output-schema` 让最终消息符合指定 JSON Schema，`-o/--output-last-message` 落盘最终消息。进度走 stderr、最终结果走 stdout，便于管道组合。(https://developers.openai.com/codex/noninteractive.md)

---

## 2. 轴二：自动化

### 2.1 Scheduled tasks / Automations 的定义与管理

注意命名沿革：该功能在 Codex App 发布时叫 **Automations**（2026-02-02 博客），当前文档统一为 **Scheduled tasks**；Help Center 明确区分「ChatGPT scheduled tasks」与「Codex automations」。(https://openai.com/index/introducing-the-codex-app/ ; https://learn.chatgpt.com/docs/automations.md ; https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt)

可核实的自动化定义要素：(https://learn.chatgpt.com/docs/automations.md ; https://developers.openai.com/codex/changelog)

- **定义 = 提示词 + 调度 + 执行位置 + 模型/推理档**；可由对话直接让 ChatGPT/Codex 起草并创建/更新（agent 自己也能创建定时任务——「schedule future work for itself」），也可由 skill 创建。(https://learn.chatgpt.com/docs/automations.md ; https://openai.com/index/codex-for-almost-everything/)
- **两种形态**：standalone（每次运行开新 chat，结果进 Scheduled 收件箱）vs **chat/线程内任务**（回到同一 chat、保留上下文，适合「盯着一个长操作直到完成」「固定节奏巡检」的续跑循环；支持分钟级间隔的活跃跟进循环）。(https://learn.chatgpt.com/docs/automations.md)
- **执行位置**：Git 仓库可选本地项目目录或独立后台 worktree（隔离未完成的本地改动）；非版本控制目录直接跑在项目里；同一任务可跨多个项目。桌面 App 场景要求机器开机且 App 运行。(https://learn.chatgpt.com/docs/automations.md ; https://developers.openai.com/codex/changelog)
- **调度**：自定义 cadence 控件 + 高级模式直接编辑 **RFC 5545 RRULE**（如 `RRULE:FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0`）；更早版本的页面曾描述 cron 语法与模板库（2026-03-12 changelog 的「Revamped Automations」提到模板）。**时区编辑的具体 UI 未核验**（RRULE 示例含 BYHOUR 但未说明时区基准）。(https://learn.chatgpt.com/docs/automations.md ; https://developers.openai.com/codex/changelog ; https://developers.openai.com/codex/app/automations)
- **管理面**：Scheduled 视图即收件箱，列出 active/paused/completed 任务与近期 runs，未读指示器标记需要关注；支持 **Run now**（事件型任务可手动触发处理积压事件）；2026-06-18 changelog 加入 run history 批量操作（全部标已读/归档）；worktree 模式下建议归档不需要的 run 以清理 worktree。暂停=paused 状态存在；**「删除自动化」的具体交互未逐字核验**。(https://learn.chatgpt.com/docs/automations.md ; https://developers.openai.com/codex/changelog)
- **输出落点 = 评审队列/收件箱**：自动化跑完，「结果落在 review queue 供回来继续」；旧版页面描述为 Triage 收件箱，且「没有要报告的东西时自动归档该次运行」——**「有发现才打扰」的条件式通知**。(https://openai.com/index/introducing-the-codex-app/ ; https://developers.openai.com/codex/app/automations)
- **无人值守的权限**：scheduled tasks 以默认沙箱设置无人值守运行；组织策略允许时使用 `approval_policy = "never"`，被 admin 禁用时回落到所选权限模式的审批行为；文档建议从最小权限起步、用 rules 精细放行；曾修复「定时任务不遵守所选 approval mode」的 bug（2026-06-11 changelog）。(https://learn.chatgpt.com/docs/automations.md ; https://developers.openai.com/codex/changelog)
- **可组合性**：任务可用 plugins/skills，提示词中可 `$skill-name` 显式指定 skill；官方建议先手动跑通提示词再定时，头几次运行要复查。(https://learn.chatgpt.com/docs/automations.md)

### 2.2 事件触发（event-triggered tasks）

2026-08-25 changelog：定时任务可由 **Gmail / Slack / GitHub** 事件触发（web 与移动端，需相应计划）：(https://developers.openai.com/codex/changelog ; https://learn.chatgpt.com/docs/automations.md)

- Gmail：新邮件，可按发件人/主题过滤；Slack：选定频道新消息（可按作者、是否含线程回复过滤；reaction/编辑/删除/私信不支持；需把 @ChatGPT 加进频道）；GitHub：仓库 PR 活动（可按 PR/作者/标题/label 过滤，可选 review/comment/commit update/仅 merge 触发）。
- 一个任务可用多个事件触发器，但**事件触发与时间调度互斥**；密集到达的事件可能被合并为一次运行；Scheduled 视图可看 pending events。
- 管理员可用 **Allow event-triggered scheduled tasks** 权限管控。

### 2.3 Codex Cloud Environments —— 可重复执行的底座

(https://learn.chatgpt.com/docs/environments/cloud-environment.md ; https://learn.chatgpt.com/docs/agent-approvals-security.md)

- **两阶段运行时**：创建容器→checkout 指定分支/commit→跑 setup script（**setup 阶段有网**，用于装依赖）→应用网络策略→**agent 阶段默认断网**（可按环境开启受限/不受限访问）。维护脚本（maintenance script）在缓存容器被复用时跑，用于刷新旧 commit 上装的依赖。
- **环境变量 vs Secrets**：env var 全程可见；secrets 加密存储、**仅在 setup 阶段解密可用、agent 阶段前被移除**——这是「凭证不进 agent 上下文」的明确设计。
- **容器缓存最长 12 小时**；改 setup/maintenance 脚本、env var、secrets 自动失效缓存；Business/Enterprise 缓存按环境在 workspace 内共享。2025-08-21 changelog：缓存使任务/跟进启动提速 90%（中位 48s→5s）。(https://developers.openai.com/codex/changelog)
- **自动 setup**：无手动脚本时自动识别 npm/yarn/pnpm/pip/pipenv/poetry 等常见包管理器装依赖（changelog 称使新环境测试失败率降 40%）；默认镜像 `universal` 开源在 openai/codex-universal（含参考 Dockerfile），可钉 Python/Node 版本。(https://learn.chatgpt.com/docs/environments/cloud-environment.md ; https://developers.openai.com/codex/changelog)
- **Agent 联网策略**：per-environment 三档——Off（默认）/On（可配域名 allowlist + 限制 HTTP methods 为 GET/HEAD/OPTIONS，阻断 POST 等写方法）；预设域名列表含 None/Common dependencies/All 三档；所有出站流量走 HTTP/HTTPS 代理。文档用真实 prompt-injection 案例（issue 里藏 `git show HEAD | curl POST` 外泄指令）说明风险。(https://learn.chatgpt.com/docs/cloud/internet-access.md)
- **AGENTS.md** 作为仓库内的项目指令层（lint/test 命令、规范），自动被 agent 读取。(https://openai.com/index/introducing-codex/)

### 2.4 代码评审自动化

(https://learn.chatgpt.com/docs/third-party/github.md ; https://learn.chatgpt.com/docs/code-review.md ; https://developers.openai.com/codex/changelog)

- **GitHub 自动评审**：设置里打开 Code review + Automatic reviews 后，每个新 PR 自动收到一条标准 GitHub review；只报 P0/P1 高优先级问题保持信噪比。手动触发：`@codex review`（Codex 先用 👀 reaction 确认受理，再发 review）；`@codex security review` 触发更深的 Security Review（任务内有 Security Report tab）。
- **AGENTS.md 里的 `## Code Review Rules`** 区块定义仓库级/目录级评审规则（root + 嵌套 AGENTS.md 按变更文件就近生效），官方建议规则聚焦「有后果的、仓库特有的行为」并给出 safe path，机械检查留给 CI。
- **评审→修复闭环**：PR 评论 `@codex fix the P1 issue` 会以该 PR 为上下文启动一个云 chat 并可推回分支；`@codex` 任意非 review 评论直接开云任务。本地 `/review`（app/CLI/IDE）支持 base branch / uncommitted / commit / 自定义指令四种 scope，只报告不改工作区；`review_model` 可单独指定评审模型。
- CLI 侧 `codex review` 非交互子命令支持 CI 调用。(https://learn.chatgpt.com/docs/developer-commands.md)

### 2.5 CI / webhook / SDK 触发面

- **Codex GitHub Action**（openai/codex-action）：官方推荐的 CI 集成，内部装 Codex、起 Responses API 代理、按可配置安全策略跑；官方示例模式为「`workflow_run` 监听 CI 失败 → 只读 checkout → 跑 Action → 把 diff 存成 patch artifact → 独立有写权限的 job apply + 开 PR」——**Codex job 只有 contents:read 且不接触 OPENAI_API_KEY，写权限与密钥在分离的 job**。(https://developers.openai.com/codex/noninteractive.md)
- `codex exec` 供脚本/CI 调用，`codex exec resume --last` 支持两段式流水线续跑；`CODEX_API_KEY` 内联注入而非 job 级 env（防被仓库代码读取）。(https://developers.openai.com/codex/noninteractive.md)
- **Codex SDK（TypeScript）**：`new Codex() → startThread() → thread.run(prompt)` 编程式驱动同一 agent；GA（2025-10-06）随 @Codex in Slack、admin 控制一起发布。(https://developers.openai.com/codex/changelog)
- **第三方发起面**：GitHub PR/issue（`@codex`）、GitLab MR/issue（Beta）、Linear issue、Slack 频道/线程均可启动云任务。(https://learn.chatgpt.com/docs/cloud.md)
- **Compliance API**：含 CLI/IDE/web/cloud 各客户端的 Codex 用量审计面。(https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)
- Codex cloud 任务的公开 REST API：文档未提供（`codex cloud` CLI 是唯一脚本化入口，环境管理 API 缺失，见 issue #24777）。**对外 webhook 触发云任务的官方接口未核验**。(https://github.com/openai/codex/issues/24777)

---

## 3. 未能核验事项汇总

- 早期 CLI `--approval-mode suggest/auto-edit/full-auto` 的精确原始措辞（官方文档已迁移，仓库内 docs 页现为跳转 stub）。
- 定时任务的时区编辑 UI、删除自动化的具体交互、事件触发任务的计划资格细节。
- Codex cloud 任务的公开 REST/webhook API（CLI `codex cloud` 之外）。
- 云端任务运行中实时 steering（插入指令立即生效 vs 排队到下轮）在 web UI 的确切行为；文档只确认 CLI 的 Tab 排队与任务级 follow-up。
- 自动化结果的通知渠道细节（push/email/SMS 按类别，具体哪些类别可用因账号而异）。(https://learn.chatgpt.com/docs/notifications.md)

---

## 4. 设计模式提炼（对两个轴可复用的机制）

1. **「沙箱边界 × 审批策略 × 审批人」三维分离，而非单一自治档位**。Codex 把「技术上能做什么」（sandbox_mode）、「何时停下来问」（approval_policy，且可按提示类别 granular 分闸）、「谁来审」（user / auto_review 代理）拆成三个独立旋钮。IoT 场景对应：设备可控范围（设备/房间白名单）× 何时要确认（按动作风险类别：调光不问、开门必问）× 审的人（住户本人/物业代审/策略引擎）。**不要把「自动化程度」做成一维滑块**。

2. **审批 → 规则的沉淀回路**。每次审批不是一次性消耗：TUI 的「加入 allow list」写 `~/.codex/rules`，Smart approvals 主动草拟 `prefix_rule`；规则带 `justification` 与 `match/not_match` 自测样例，且可用 `codex execpolicy check` 离线验证。action draft 确认界面应提供「本次允许 / 本会话允许 / 总是允许此类（生成规则）」三档，并让规则可审计、可离线回放测试。

3. **「先预检再执行」的 dry-run 前置**。`apply_task_preflight` 验证 patch 能否干净应用、返回 conflict_paths/skipped_paths，绝不改工作区。物理执行前应有同等 preflight：读取目标设备当前状态、校验 draft 与实时状态是否仍一致、报告冲突后再让用户确认。

4. **两阶段权限环境：setup 有网/有密钥，agent 阶段断网/无密钥**。secrets 只在 setup 阶段注入、agent loop 前移除。对应到我们：控制通道凭证、设备影子写权限只给「准备阶段」，agent 推理循环只持有最小令牌——凭证不进对话上下文。

5. **任务对象模型：任务级状态机 + attempt 级状态机分离**。`TaskStatus{pending,ready,applied,error}`（ready 即「待评审」）叠加 `AttemptStatus{pending,in_progress,completed,failed,cancelled}` 与 sibling attempts（best-of-N）。我们的 action draft 生命周期可借鉴：`draft → confirming → ready_to_execute(=待用户批) → applied(=已下发设备) → error`，并把「同一意图的多次生成/多次下发尝试」建模为 attempts 而非新任务。`DiffSummary{files_changed,lines_added,lines_removed}` 对应到 IoT 是「设备数/属性变更数」的列表行内嵌摘要。

6. **「有发现才打扰」的自动化收件箱**。Scheduled/Triage 收件箱 + 未读指示 + 无成果自动归档；可 Run now、暂停、批量归档。定时巡检类 agent 任务的默认输出目的地应是「静默的评审队列」，只有命中条件才升级为通知——避免通知疲劳。我们可做「告警条件式上报」：定时任务提示词中显式写明「什么情况算需要报告」。

7. **事件触发器与时间调度互斥、多事件合并为一次运行**。Gmail/Slack/GitHub 触发器可过滤、可与定时互斥、密集事件合并。IoT 侧对应：设备事件触发（门磁/告警）与定时巡检是两类任务模板，事件风暴要 debounce 合并。

8. **结构化事件流协议分层：`thread/turn/item` 三级**。`codex exec --json` 的 JSONL：`thread.started → turn.started → item.started/completed（command_execution/file_change/agent_message/reasoning/plan_update）→ turn.completed(usage)`。我们的 NDJSON 可同样分三级：会话/执行轮/原子动作，item 类型枚举化（action_draft、confirmation_request、device_write、readback、summary），终态事件携带用量与结果统计。

9. **审批请求可委托给「评审代理」但有熔断与人工兜底**。auto_review 用独立 reviewer + 开源策略文件裁决，拒绝回注理由并禁止绕行，连续/窗口拒绝触发熔断中断，用户可 `/approve` 精确重试单次被拒动作。对我们的价值：低风险 action draft（如白天调亮度）可策略引擎自动批，高风险（开门、批量断电）强制人工；自动拒绝要带理由回给 agent 让其换安全路径，而非静默失败。

10. **命令按参数级前缀评估 + 复合命令拆解**。execpolicy 把命令当 argv 前缀匹配，`bash -lc` 能拆则逐条判定、不能拆则整体从严；多规则取最严决策。IoT 等价物：把「动作」当结构化（设备, 属性, 值域）元组做规则匹配，批量/复合 draft 拆成原子动作逐一过策略，任一命中 forbidden 则整批降级为逐项确认。
