# Devin（Cognition）产品设计调查：富交互界面与自动化

- **日期**：2026-09-24
- **状态**：外部产品设计调查，非本项目事实
- **来源范围**：仅一手来源 —— 官方文档 docs.devin.ai、官方博客 devin.ai/blog 与 cognition.com/blog、公开 Devin API 参考（v3）。未使用第三方评测。
- **调查动机**：本项目在微信小程序内做 IoT 楼控 agent（灯光/空调/门禁），输出需用户显式确认的"动作草稿"，会话经 NDJSON 流式下发。本笔记研究成熟 agentic 产品 Devin 在"富/结构化交互界面"与"无人值守自动化"两个轴上的设计。

---

## 0. 产品形态速览

- Devin 定位为"AI 软件工程师"，核心交互是**会话（Session）**：每个会话跑在一台独立云端 VM 上，带完整开发环境（Shell / IDE / 浏览器 / 桌面）。(https://docs.devin.ai/get-started/devin-intro)
- 会话入口多样：Web 应用 app.devin.ai、Slack、Microsoft Teams、Linear/Jira、API、CLI/Desktop（`origin` 枚举：webapp/slack/teams/api/linear/jira/automation/cli/desktop/code_scan）。(https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session)
- 官方自称"conversational user interface"，但对话只是表层——可观察、可接管的工作过程才是主体。(https://docs.devin.ai/get-started/devin-intro)

---

## 轴 1 —— 富 / 结构化交互界面

### 1.1 会话视图结构（超出聊天文本的部分）

**双模式入口：Ask / Agent。** 新会话有两种模式：Ask（只读问答与计划，不改代码）与 Agent（完整自主执行）。官方建议先用 Ask 与 Devin 共同制定计划，再"Send to Devin"切到 Agent 执行；从 Ask 启动的会话其状态直接显示在 Ask 对话里。(https://docs.devin.ai/get-started/first-run)

**会话内嵌开发者工具三件套**（侧边栏可开，点进度步骤也可跳入）：
- **Shell**：只读观察 Devin 执行命令与输出日志；有完整命令历史、输出预览、复制按钮、点击命令可跳到会话的时间点。
- **IDE**：内嵌 VSCode，实时看 Devin 编辑、可直接接管编辑/跑命令（终端可在只读/可写间切换）。
- **Browser / Computer**：Interactive Browser 可观看并接管 Devin 的浏览器（帮忙过验证码、MFA、复杂导航）；组织开启 Computer Use 后该 Tab 变为 Computer（完整桌面）。(https://docs.devin.ai/work-with-devin/devin-session-tools, https://docs.devin.ai/get-started/devin-intro)

**Progress Tab / Worklog**：点击会话中任意步骤或 Progress Tab，可看到该步所有 shell 命令、代码编辑、浏览器活动的统一日志视图。(https://docs.devin.ai/work-with-devin/devin-session-tools)

**PR Tab（结构化 diff 视图）**：会话内的 PR Tab 有文件树 + diff（滚动时高亮当前文件）、"Smart diffs"平铺视图、"Open in editor"、Checks Tab 显示 CI 状态；Tab 顺序为 Changes / Description / Discussion / Commits / Checks / Bugs。(https://docs.devin.ai/release-notes/overview)

**Side Chats（侧聊）**：对任意消息 hover 菜单、加 Tab、或输入 `/btw 问题`，可在不打断主会话的情况下开只读旁聊——Devin 可检索代码回答但不能改文件/跑命令；主会话持续运行。(https://docs.devin.ai/work-with-devin/devin-session-tools)

**会话树与多 PR**：父子会话在侧边栏以嵌套树展示；父会话标题旁有 session-tree 图标可看子会话；同状态多 PR 在侧边栏显示为下拉列表。(https://docs.devin.ai/release-notes/overview)

**引用与链接卡片**：消息中可选中 worklog/文件/消息文本"引用"进下一条输入；链接渲染为富预览卡（Figma 链接可实时内嵌）；Devin 提到的 PR/issue/commit 渲染为完整链接与 GitHub 徽章。(https://docs.devin.ai/release-notes/overview)

### 1.2 面向用户的交互式提示（agent 主动发起的结构化请求）

**Secrets 请求**：Devin 工作中可在会话内发起凭据请求（API key/登录），界面为结构化输入卡片；此类 secret 仅限当前会话，不持久化。也可由用户主动添加 session secrets。(https://docs.devin.ai/product-guides/secrets)

**权限/审批请求（permission requests）**：
- 会话存在 `waiting_for_approval` 状态——"awaiting action approval in safe mode"（等待用户在安全模式下批准动作）；API 创建会话有 `bypass_approval` 参数。(https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session, https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions)
- 用户 approve/deny 权限请求后 Devin 立即恢复执行（2026-09-23 release note：不再等 wait timer 到期）。(https://docs.devin.ai/release-notes/overview)
- **部署审批**：因为部署会把内容暴露到公网，每次 deploy 都需显式 approve/deny 提示；企业组织与受安全 profile/网络策略约束的会话直接禁用部署工具（"secure mode"）。(https://docs.devin.ai/product-guides/deployment-capabilities)
- **插件/配置变更审批**：插件安装、插件变更、MCP 安装的审批卡片显示来源、内容摘要、以及"建议变更的 diff"——批准后能看到实际写入内容。(https://docs.devin.ai/release-notes/overview)
- **环境蓝图建议卡**：让 Devin 配置环境时，它以"suggestion cards"形式在 timeline 提议 blueprint，用户逐卡批准后构建 snapshot。(https://docs.devin.ai/onboard-devin/environment)

**计划确认与置信度**：Devin 2.0 引入 Interactive Planning——会话开始数秒内返回相关文件、发现和初步计划，用户可修改后再放行。Devin 2.1 引入置信度 🟢🟡🔴：会话开始、计划完成后、答问时均报告置信度；不 🟢 时会主动追问澄清；置信度不足时**等待用户批准计划**，否则自动继续并接受异步反馈。(https://cognition.com/blog/devin-2, https://cognition.com/blog/devin-2-1)

**"Devin 受阻"状态**：
- 状态机层面：`waiting_for_user`（需要用户输入）、`waiting_for_approval`（等待动作批准）是 running 下的 status_detail；挂起原因枚举含 inactivity/user_request/usage_limit_exceeded/out_of_credits 等 12 种。(https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session)
- UI 层面：丢失 VM 的会话在侧边栏显示 "Reboot VM" 动作而非笼统的 blocked/finished；"hard-blocked"机器故障卡提供 "Continue in a new session" 与 "Try restart"，并注明机器本地文件不迁移；另有专门的 "Waiting" 活动状态表示 Devin 有意在等待。(https://docs.devin.ai/release-notes/overview)
- 网络受限时 Devin "知道自己在受限策略下运行"：被拦时会**请求放行某域名**，用户批准后仅对该会话生效（受强制 profile 上限钳制）。(https://docs.devin.ai/product-guides/security-profiles)

**测试提议卡**：创建 PR 后 Devin 提供 "Test the app" 按钮，进入三段式测试流程（准备→计划→录屏执行），先发测试计划短消息再执行，最终回传带标注、自动缩放的视频作为证据；可设 "Pre-approve testing" 免确认。(https://docs.devin.ai/work-with-devin/testing-and-recordings)

### 1.3 知识 / Playbook / Skill 表面

- **Playbook**：可复用的结构化提示词库，建议章节含 Procedure（每步一行祈使句、MECE）、Specifications（后置条件）、Advice、Forbidden Actions、Required from User。会话输入框输入宏（如 `!db-migration`）附加 playbook，出现蓝色 pill + 内联编辑组件；会话中以灰底卡片显示已挂载 playbook；可在运行中迭代修订。Playbook 分 Organization / Enterprise / System 三个作用域，支持 structured output schema。(https://docs.devin.ai/product-guides/creating-playbooks, https://docs.devin.ai/product-guides/using-playbooks, https://docs.devin.ai/release-notes/overview)
- **Knowledge（正在迁移为 Skills）**：带 Trigger Description（决定何时被召回）+ Content 的笔记，Devin 按相关性自动召回；支持文件夹嵌套、批量启停、按 repo 钉住、组织/企业两级作用域；**Knowledge Suggestions**——Devin 根据会话反馈主动建议要记住的知识，用户可编辑/驳回后再保存。(https://docs.devin.ai/product-guides/knowledge)
- **Skills**：仓库内 `SKILL.md` / `.agents/skills/` 的可复用流程文件；测试后 Devin 会把"怎么跑这个 app"总结成 skill 并以 PR 形式提议合入。(https://docs.devin.ai/product-guides/skills, https://docs.devin.ai/work-with-devin/testing-and-recordings)
- **Session Insights**：会话结束自动生成轻量分类（category/语言/工具）+ 大会话自动深度分析。洞察弹窗含：ACU 用量、用户消息数、会话尺寸分级（XS–XL，L/XL 标记为"不健康"）、任务分类；三个 Tab：Issue Timeline（红/黄/绿时间线）、Actionable Feedback（改写后的 improved prompt + 可一键起新会话 + 环境修复 action items）、Knowledge Usage（哪些知识有用/误导）。(https://docs.devin.ai/product-guides/session-insights)

### 1.4 会话对象的结构化字段（Sessions API v3）

`GET /v3/organizations/{org_id}/sessions/{devin_id}` 返回 `SessionResponse`，关键字段（均来自 OpenAPI schema）：

| 字段 | 形状 | 说明 |
|---|---|---|
| `status` | enum | `new`/`claimed`/`running`/`exit`/`error`/`suspended`/`resuming` |
| `status_detail` | enum | running 下：`working`/`waiting_for_user`/`waiting_for_approval`/`finished`；suspended 下：inactivity、user_request、usage_limit_exceeded、out_of_credits、out_of_quota、no_quota_allocation、payment_declined、org/user_usage_limit_exceeded、total_session_limit_exceeded、contract_expired、error |
| `structured_output` | object | 经 `structured_output_schema`（JSON Schema Draft 7，≤64KB）校验的结构化输出；`structured_output_required` 为 true 时 agent **必须**调用 `provide_structured_output(is_final=true)` 才能结束回合 |
| `pull_requests` | array | 会话产出的 PR 列表（SessionPullRequest） |
| `tags`/`title`/`url`/`category`/`subcategory` | — | 标签、标题、webapp 链接、自动分类 |
| `origin` | enum | 会话来源（webapp/slack/teams/api/automation/cli…） |
| `automation_id`/`playbook_id`/`parent_session_id`/`child_session_ids` | — | 溯源：哪个 automation/playbook/父会话产生 |
| `acus_consumed` | number | 算力消耗 |
| `security_profile`/`devin_mode`/`is_archived`/`service_user_id` | — | 治理与模式 |

(https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session, https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions)

**消息流**：`GET .../sessions/{id}/messages` 游标分页、按时间序；`SessionMessage` = `{event_id, source: devin|user, message, origin, user_id, username, created_at}`——注意 **API 层消息是文本流，富交互卡片的结构化载荷不直接暴露**；发送消息 `POST .../messages` 会自动唤醒 suspended 会话。(https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session-messages, https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions-messages)

**幂等**：v1 Sessions API 支持 `idempotency_key`——重复 key 返回原会话，创建进行中返回 409 供稍后重试。(https://docs.devin.ai/release-notes/overview)

### 1.5 Slack / Teams 上的代理表面

- **表情反应即"肢体语言"**：Devin 在 Slack 不用文字刷屏，而用 emoji 标记状态——👀 在处理（结果出来时清除）、👍 已知悉、✅ PR 落地、💤 机器休眠；词汇可自定义（如 🎫 表示已开工单）。人对 Devin 消息的 emoji 反应也会回传会话作为反馈信号。(https://devin.ai/blog/devins-slack-etiquette)
- **Code Channel**：任务变大时 Devin 可把会话迁到专属 Slack 频道——频道名跟随会话标题、状态 chip 显示 working/blocked/done、PR chips/tabs、live worklog、回 webapp 的链接；频道内消息无需 @ 即送达会话。(https://docs.devin.ai/integrations/slack)
- **关键词协议**：`!ask`/`!deep`（不起会话的轻量问答）、`mute`/`unmute`/`(aside)`、`sleep`/`archive`/`EXIT`、`!fast`/`!ultra`/`!lite`/`!fusion`/`!swe2`、`!new`、`!channel`、`!windows`/`!mac`/`!outpost`、`![macro]` 挂 playbook。bang 命令可在消息任意位置、可叠加、会被从 prompt 剥离。(https://docs.devin.ai/integrations/slack)
- **审批在聊天内完成**：Teams 中 Devin 请求部署时显示 "Approve deployment" 按钮；Devin 休眠时出现 "Detach session" 卡。(https://docs.devin.ai/release-notes/overview)
- **沉默即默认**：Slack 场景给模型的常驻指令是"Silence is your default…没有把握就不回复"；"be quiet"/"stop" 被 harness 解析为状态命令而非对话。(https://devin.ai/blog/devins-slack-etiquette)

### 1.6 移动端 / 桌面端伴随形态

- **Devin Desktop**（原 Windsurf）：Agent Command Center 为默认界面——Kanban 视图统一管理本地+云端 agent、PR；Spaces 聚合会话/PR/文件/上下文；支持 ACP 协议的第三方 agent 获得同一界面。(https://devin.ai/blog/windsurf-is-now-devin-desktop, https://devin.ai/download)
- **移动端**：无独立原生 App 文档页面；官方 release notes 表明存在移动 Web 体验并持续优化（2024 年"Devin mobile improvements"、2026-09-23"手机/平板上未查看的会话 Tab 会卸载以省内存"、Desktop Tab 在 iPad 触屏手势支持）。(https://docs.devin.ai/release-notes/2024, https://docs.devin.ai/release-notes/overview) —— **是否有独立 iOS/Android App：未核验**（docs 索引无对应页面）。
- **CLI**：Devin CLI 本地 agent，`/handoff` 把长任务移交云端会话，`devin --cloud` 在终端创建/引导/恢复/观看云会话。(https://docs.devin.ai/cli, https://devin.ai/blog/devin-cloud-in-your-terminal)

---

## 轴 2 —— 自动化（无 live 人值守运行）

### 2.1 Automations 模型：Trigger → Conditions → Action

- 三元结构：**Trigger**（事件）+ **Conditions**（可选过滤，两层 `{"any":[{"all":[...]}]}` 包络的 `{field, operator, value}`）+ **Action**。一个 automation 可有多个 trigger（OR 关系）。(https://docs.devin.ai/product-guides/automations, https://docs.devin.ai/api-reference/v3/automations/post-organizations-automations)
- **触发源枚举**（v3 API event_type）：Slack（message/reaction_added/usergroup_mentioned）、GitHub（issues/issue_comment/pull_request/review/review_comment/check_run/push）、GitLab（MR/note/issue/pipeline/push）、Linear（create/label/assign/status/priority/moved）、Jira、Pylon、incident.io、PagerDuty、`schedule:recurring`、`webhook:incoming`、`snapshot_build:completed`。(https://docs.devin.ai/api-reference/v3/automations/post-organizations-automations)
- **四类 Action**：`start_session`（新会话，事件 payload 自动附加进 prompt）、`message_session`（喂给长驻会话；`auto_create=true` 时首个触发自动建长驻会话）、`monitor_session`（Triage Devin 持久监频）、email notification（always/on failure/on success）。(https://docs.devin.ai/product-guides/automations, https://docs.devin.ai/api-reference/v3/automations/post-organizations-automations)
- **prompt 引用令牌语法**：`@{owner}/{repo}`、`@{path}`、`@playbook:{id}`、`@skills:{name}`、`!{macro}`、`${SECRET_NAME}`；kind 前缀在保存时校验，未知 id 返回 400。(https://docs.devin.ai/api-reference/v3/automations/post-organizations-automations)
- **创建路径三条**：手工编辑器、模板库（20+ 内置模板如 "Fix CI Failures"、"Fix Sentry Errors Daily"）、"Generate with Devin"（让 Devin 开会话帮你配置好再确认创建）。(https://docs.devin.ai/product-guides/automations)

### 2.2 调度（定时/周期）

- Schedule trigger：Every hour/day/week、Run once、Custom（iCalendar RRULE，可直接写 `FREQ=WEEKLY;BYDAY=MO;BYHOUR=9`）；时区本地显示、UTC 存储；run-once 执行后自动禁用。(https://docs.devin.ai/product-guides/automations)
- 旧版 Scheduled Sessions 已是 legacy：新建定时任务一律走 automation + Schedule trigger；旧 schedule 保留 name/agent/playbook/repos/frequency/email+Slack 通知/run-as/prompt 等配置，状态三态 Active/Paused/Error（连续失败进入 Error），详情页有 **Past Sessions** Tab 列出该 schedule 产出的所有会话。(https://docs.devin.ai/product-guides/scheduled-sessions)
- API 层 `/v3/.../schedules` 端点已废弃：2026-09-24 起已迁移组织 POST schedules 返回 403，改用 automations 的 `schedule:recurring` trigger。(https://docs.devin.ai/api-reference/common-flows)

### 2.3 无人值守时的授权边界

**run_as 身份**：创建 automation 必须显式选 `organization`（System User 身份，系统权限——个人连接的 MCP 不可用）或 `creator`（个人 automation，以创建者权限运行，仅创建者与 org admin 可见；需 `UsePersonalAutomations` 权限）。(https://docs.devin.ai/api-reference/v3/automations/post-organizations-automations)

**资源/速率上限（防爆机制）**：
- `max_acu_limit`：每次会话 ACU 预算上限（1–1000），触顶即停。
- Invocation limit：时间窗内最大触发次数；新建默认 **50 次/小时**（频道监听 triage 类 150/小时）。
- `concurrency`：`max_concurrent_runs`（在途上限，超出排队；会话"完成且等待进一步指令"即释放额度）+ `max_queue_depth`（队列上限，溢出丢弃）。
(https://docs.devin.ai/product-guides/automations, https://docs.devin.ai/api-reference/v3/automations/post-organizations-automations)

**安全 Profile 层级绑定**：可复用限制包（网络 allowlist、MCP allowlist、Devin MCP 只读、git 只读/全量、移除 gh token）绑定到 enterprise 默认 → org 默认 → automations 默认 → 单个 automation → 单个会话 五级；每级可选 Inherit/Pin/No profile。**Mandatory 级是硬地板**：下层只能收紧不能放宽（网络取交集、git 取最小权限）；会话在 boot/resume 时解析生效 profile；子会话继承父级链，无法通过派生逃逸。(https://docs.devin.ai/product-guides/security-profiles)

**自动化专属网络策略**：automation 可再叠一层网络 allowlist（只窄不宽，与 governing profile 取交集）——官方明确建议对处理不可信输入（Slack 消息、webhook payload）的 automation 启用。(https://docs.devin.ai/product-guides/automations)

**公网仓库触发的提示注入防线**：GitHub automation 默认只对私有仓库触发；管理员须显式把 connection 的 Automation scope 改为 "All installed repos" 才覆盖公开仓库，且官方警告公开仓库 trigger 有更高 prompt-injection 风险、应保持条件狭窄。Slack message trigger 强制要求至少一个实质过滤条件（仅 is_thread_reply 不算）。(https://docs.devin.ai/product-guides/automations, https://docs.devin.ai/release-notes/overview)

**Webhook 触发器**：每个 webhook trigger 分配独立 URL + secret（`X-Webhook-Secret` 头 / Bearer / query 参数；secret 只在创建时显示一次，可重新生成且旧值立即失效）；支持 payload 正则过滤；>200KB payload 截断进 prompt。(https://docs.devin.ai/product-guides/automations)

**会话内动作授权**：`bypass_approval` 参数与 `waiting_for_approval` 状态表明存在"安全模式"下逐动作批准的机制；自动化/定时会话的超限、欠费、配额问题以 status_detail 细分原因暴露。部署到公网永远需要人工批准。(https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions, https://docs.devin.ai/product-guides/deployment-capabilities)

### 2.4 长驻监频：Auto-triage

- 持久父 Devin 监听 Slack 频道每条消息，过滤噪音、去重，对可处理项派生**子 sub-devin** 会话定位根因、在 thread 回诊断、@ 对应 code owner。
- **Scratchpad 长期记忆**：父子共享持久 scratchpad——记录已 triage 项、code area→owner 路由表、重复项链接；跨会话重启保留。人被 tag 错时在 thread 纠正，父级更新路由表。
- `monitor_session` action 需 `setup_prompt`（注入系统提示）+ `slack_monitor_config`；每个子会话计 ACU。(https://docs.devin.ai/product-guides/auto-triage, https://docs.devin.ai/api-reference/v3/automations/post-organizations-automations)

### 2.5 可复现环境：Blueprint → Snapshot

- 环境配置产出 **snapshot**（冻结可启动镜像）：每组织一个活跃 snapshot，每个会话 boot 一份干净副本，会话改动不回写 snapshot；配置变更自动触发新构建。(https://docs.devin.ai/onboard-devin/environment)
- Blueprint 是声明式 YAML（版本化、可组合、可复现），含 steps/env vars/secrets/文件附件；secrets 加密存储、以环境变量注入、永不写入 snapshot。(https://docs.devin.ai/onboard-devin/environment/blueprints, https://docs.devin.ai/onboard-devin/environment/blueprint-reference)
- `snapshot_build:completed` 本身可作为 automation 触发源（环境重建后自动起会话）。(https://docs.devin.ai/api-reference/v3/automations/post-organizations-automations)
- 会话 `resumable` 参数：默认保留 VM 状态可恢复；false 为一次性会话。(https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions)

### 2.6 完成通知与运行历史

- **通知渠道**：automation action 级 email 通知（always/on failure/on success）；Slack 通知——automation 运行结果可发到指定频道；旧 schedules 支持 Slack 频道通知 + email（默认 on failure）；2026 年新增企业/安全 profile 组织的邮件通知能力；计划会话失败邮件有速率限制防轰炸。(https://docs.devin.ai/product-guides/automations, https://docs.devin.ai/product-guides/scheduled-sessions, https://docs.devin.ai/release-notes/overview)
- **运行历史**：automation 详情页 **Activity Tab** 列出近期 invocation（时间戳、成功/跳过、链接到产生的会话、失败错误信息）；列表页每条 automation 有 30 天 sparkline；API `AutomationResponse.last_invocation = {fired_at, status: succeeded|failed|skipped}`（open enum，客户端须容忍新值）。(https://docs.devin.ai/product-guides/automations, https://docs.devin.ai/api-reference/v3/automations/post-organizations-automations)
- **审计**：Enterprise 有 Audit Logs API（enterprise/org 两级）；`created_by`/`last_edited_by` ActorResponse 区分 user/service_user。(https://docs.devin.ai/api-reference/v3/audit-logs/enterprise-audit-logs, https://docs.devin.ai/api-reference/v3/automations/post-organizations-automations)

### 2.7 编排型自动化（多会话）

- **Managed Devins**：会话内 Devin 可充当 coordinator——派生子会话（带 prompt/playbook/tag/ACU 上限）、发消息、监控 ACU、休眠/终止子会话、**给自己定时发消息**（提醒回来检查长任务）；默认不逐批询问，可在 Preferences 关闭 "Auto-approve child sessions" 改为逐批批准。(https://docs.devin.ai/work-with-devin/advanced-capabilities)
- **Dynamic Workflows**：确定性 Python 脚本编排 agent 群——`register_workflow`/`agent(prompt, schema=...)`/`pipeline`/`parallel`/`log` 原语；每个 agent 调用按 (prompt, schema, …) 哈希记录结果，**中断后从断点续跑**（已完成 agent 重放记录结果）；workflow 面板显示各 phase 各 agent 实时状态；默认自动批准运行，可关 "Auto-approve workflows" 改为逐次批准。(https://docs.devin.ai/work-with-devin/dynamic-workflows)
- **Devin MCP**：把会话管理（建/查/发消息/终止）、playbook、knowledge、schedule 管理能力暴露为 MCP 工具，使任意 agent/会话可编排 Devin；安全 profile 可将其降为只读。(https://docs.devin.ai/work-with-devin/advanced-capabilities, https://docs.devin.ai/product-guides/security-profiles)

### 2.8 自动化产出物的闭环

- 自动化会话产出 PR 走正常评审流；Devin 会自动修自己 PR 的 merge conflict（会话活跃 12h 内，PR 已批准则 36h）并在有冲突时通知用户。(https://docs.devin.ai/release-notes/overview)
- 自动化会话出现在侧边栏专属 "Automations involving you" 文件夹；会话可用 `origin` 过滤来源；`automation_id` 字段可溯源。(https://docs.devin.ai/release-notes/overview, https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session)

---

## 未核验项

- **独立移动 App**：docs 无专门页面；release notes 仅证明移动 Web 体验存在。App Store 原生 App 存在与否未核验。
- **"safe mode" 的完整语义**：仅见于 API `status_detail`/`bypass_approval` 字段描述与部署文档的 "secure mode" 表述；未见独立功能文档页。两者是否同一机制未核验。
- **webhook 失败重投/退避策略**：docs 未描述 webhook 接收失败或 action 执行失败的自动重试语义；仅有 concurrency queue 与 invocation 记录。
- **NDJSON/流式 API**：公开 v3 API 为轮询式（游标分页 messages + status 轮询），未见 SSE/WebSocket 流式端点文档。

---

## 设计模式提炼（对本项目的可迁移机制）

1. **双层状态机**：粗粒度 `status`（new/running/suspended/exit/error）+ 细粒度 `status_detail`（working / waiting_for_user / waiting_for_approval / finished / 各种挂起原因）。前端据此渲染"正在工作 / 等你输入 / 等你批准 / 已完成"等语义化徽章，而非只有"运行中"。→ 我们的"动作草稿待确认"可直接映射为 `waiting_for_approval` 式状态。
2. **审批卡 = 结构化消息类型**：部署批准、权限请求、secrets 请求、插件变更（带 diff）、蓝图建议卡——都是嵌在 timeline 里、带 approve/deny 动作的结构化卡片；批准后 agent 立即续跑（不等超时）。→ 对应我们的动作草稿：卡片化 + 显式确认 + 批准后即时执行。
3. **JSON Schema 结构化产出**：会话创建时传 `structured_output_schema`（Draft 7，可强制 required），agent 必须调用 `provide_structured_output` 收尾；schema 也可挂在 playbook 上。→ 我们可用同样手法约束 agent 输出动作草稿的字段结构。
4. **"肢体语言"式轻量状态**：Slack 用 👀/👍/✅/💤 emoji 表达受理/知悉/完成/休眠，替代刷文字；表情可自定义且双向（人的 emoji 回传为反馈）。→ 小程序里可用消息旁的轻量状态图标/回执代替冗余文本进度。
5. **Trigger–Condition–Action 三段式自动化**：事件源枚举 + `any/all` 条件包络 + 四类动作（起新会话 / 喂长驻会话 / 监频 / 通知）；事件 payload 自动进 prompt；prompt 内 `@playbook:`/`${SECRET}` 引用令牌保存时校验。→ 我们的定时巡检/告警触发可复用此模型。
6. **身份与预算显式化**：自动化必须选 run_as（组织身份 vs 创建者权限）；每次运行 ACU 上限 + 触发速率上限 + 并发/队列上限，超限排队或丢弃并留痕。→ IoT 场景对应：自动化动作以"谁的身份"执行 + 每周期最大动作数/并发数。
7. **受限运行 + 运行时申请放行**：网络 allowlist 可预先收窄；agent 知道自己受限，被拦时发起"放行此域名"请求，用户批准仅当次会话生效；mandatory profile 是不可突破的地板。→ 对应：自动化 agent 默认只能读设备状态，越权动作（如开门禁）触发显式升级请求。
8. **长驻监频 + Scratchpad 记忆**：持久 monitor 消化高频事件流，scratchpad 存路由表/已处理项/去重记录，跨重启保留；派生子会话做实际调查。→ 对应楼控告警流：一个常驻 agent 过滤噪音，只对真告警派生处理流程。
9. **断点可续的编排脚本**：workflow 把编排写成确定性脚本，每次 agent 调用按内容哈希记录，中断后已完成步骤重放结果、只重跑未完成部分。→ 我们的多设备批量操作可用"录制可重放"模型保证幂等续跑。
10. **证据回传代替文字汇报**：PR 后主动提议 "Test the app"，产出带标注的操作视频/截图作为"它真的work了"的交付物。→ IoT 动作执行后可回传设备状态读数/截图式回执卡作为执行证据。
