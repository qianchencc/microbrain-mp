# ZCode（Z.AI ADE）设计调查：结构化交互面与自动化

- 日期：2026-09-24
- 状态：外部产品设计调查，非本项目事实
- 调查范围：参考产品清单「Orca, Devin, Codex, Zcode」中第四项的消歧，以及其在「结构化交互面」「自动化」两条轴上的设计机制
- 主要来源：ZCode 官方文档站 <https://zcode.z.ai/en/docs/welcome>、官方更新日志 <https://zcode.z.ai/en/changelog>

## 消歧

**结论：「Zcode」指 Z.AI 的 ZCode（<https://zcode.z.ai/>），官方定位为 "Agentic Development Environment (ADE)"，是围绕 GLM-5.3 模型深度调优的桌面 Agent 工作台。**

理由（按证据强度排序）：

1. **名称精确匹配**：产品本名就叫 "ZCode"，官网 zcode.z.ai，是 Z.AI（智谱）官方出品的 "Official Harness for GLM-5.3"（<https://zcode.z.ai/en>）。
2. **文件名佐证**：本笔记文件名约定为 `ade-zcode-design`，而 "ADE" 正是 ZCode 的自我定位用语（"ZCode is an Agentic Development Environment (ADE)"，<https://zcode.z.ai/en/docs/welcome>）。
3. **本仓库直接证据**：`mp/.zcode/plans/plan-sess_a1497d1e-…….md` 是该工具写入本仓库的会话计划产物；`AGENTS.md` 的 Git 规范也明确提到「`.zcode` 临时计划」。即发起方团队日常就在用 ZCode。
4. **列表语境吻合**：Orca / Devin / Codex / Zcode 都是独立 Agentic 编码产品，ZCode 恰为该品类；且它原生提供 **WeChat Bot 通道**（<https://zcode.z.ai/en/docs/bot-channel>），与本项目「微信小程序内的 IoT 控制 Agent」高度同构，作为参照系价值最大。
5. 排除项：Zencoder（zencoder.ai，IDE 插件 + Zenflow 编排平台）名称不符；Zed 的 ACP/Agent Panel 是编辑器内能力而非独立产品；T3 Code（github.com/pingdotgg/t3code）名字差距更大，是「多 Agent 控制面」。

产品概况：ZCode 是闭源 Electron 桌面应用（下载链接为 cdn-zcode.z.ai 的 dmg，<https://zcode.z.ai/en/docs/welcome>），当前版本 3.14.3（2026-09-22 发布，<https://zcode.z.ai/en/changelog>）。核心是自研 ZCode Agent，强调长任务（Long Horizon）执行：目标、文件、终端结果、浏览器上下文、执行模式、Git 状态保持在同一任务内（<https://zcode.z.ai/en/docs/agent-framework>）。其协议层未公开，NDJSON/流式协议细节为 **未核验**。

---

## 轴一：富/结构化交互面

### 1. 权限与确认（Safety Confirmation）

来源：<https://zcode.z.ai/en/docs/safety-confirm>

- **四档执行模式**，在输入框旁切换，`Shift+Tab` 循环：
  - *Ask before changes*（默认）：每次文件编辑或命令前都要求确认——适合关键代码与生产配置；
  - *Edit automatically*：文件编辑自动应用，命令仍需确认；
  - *Plan*：先出计划，确认后才动手——适合重构、迁移等长任务；
  - *Full access*：最少打扰；该模式激活时工具栏保持**橙色风险图标**可见（同页与 <https://zcode.z.ai/en/docs/automations> 中「icon stays orange when Full access is selected」）。
- **确认交互的生命周期**：Agent 发出需授权请求 → 当前任务暂停、**输入框被阻塞**（防止误排队下一动作）→ 展示将要执行的确切命令/文件变更/工具动作 → 用户决策后才继续；拒绝则停止当前操作或把任务退回可调整状态。权限请求**按任务作用域持久化**：切走再回来请求仍在，侧边栏把该任务标记为「等待确认」。
- **决策选项四选一**：Allow（仅此一次）/ Always Allow（同类动作不再问）/ Reject / Always Reject；部分场景有更细粒度选项「Allow for this session」「Always allow for this project」。官方建议不确定时选 Allow，慎用 Always Allow。
- v3.14.0 起审批对话框支持**直接授予 full access**（<https://zcode.z.ai/en/changelog>）。

### 2. 超时自动继续的普通提问

来源：<https://zcode.z.ai/en/docs/safety-confirm>

- Agent 的普通提问（「方案 A 还是 B？」）默认**等待 5 分钟**，面板显示倒计时；超时后 Agent 自行判断继续，该步骤在会话历史中标记 **"Unanswered, auto-continued"**。
- 任何活动迹象（指针移入面板、开始选择、点击倒计时、点侧边栏「stop timer」）都会**永久停止倒计时**。
- 可在 Settings → General → Automatically continue questions 关闭；开关不溯及已发出的提问。
- **权限请求与计划确认永远等待**，不受超时机制影响——确认类与询问类交互被刻意区分。

### 3. 工具调用与结构化内容渲染

来源：<https://zcode.z.ai/en/docs/ADE-tools>、<https://zcode.z.ai/en/docs/bot-channel>

- 任务列表每行显示运行/未读/失败状态点，以及该任务的 `+/-` 行数变更统计（ADE Tools）。
- 文件变更以**变更摘要**呈现，附「打开」和「撤销」动作（Safety Confirmation 页「file-change summary with open and undo actions」）。
- 回复内富渲染：Mermaid 代码块渲染为可缩放/拖 pan 的图（流式期间先显示源码）、连续图片聚合为画廊（缩放/下载）、Markdown 表格带工具栏（复制为 Markdown / 导出 CSV / 大预览吸附表头）；PDF 有页码导航与缩放（ADE Tools）。
- 思考轨迹（thinking traces）支持内容搜索、默认展开（v3.10.x changelog）。
- Feishu/Lark 端为**流式卡片**：所有回复在一张卡片内原地更新，工具调用以折叠摘要穿插在正文中、可展开；当 Agent 需要决策时**冻结当前卡片**、问题单独发新卡，回答后另起新卡继续（Bot Channel「Streaming Cards on Feishu」）。
- v3.14.0 新增**动态工作流**：单脚本编排多个子 Agent 协作，`/workflow` 或输入框 `+` 菜单启动；运行中的工作流可**不停机调整并发上限**，工作流卡片有实时状态（changelog 3.14.0/3.14.3）。

### 4. 撤销/重做的结构化语义

来源：<https://zcode.z.ai/en/docs/edit-history>

- 每轮回复下的文件变更摘要带 **Undo**：弹确认框列出本轮哪些文件可安全撤销、哪些不能、哪些被忽略，确认前不落盘；撤销后按钮变为 **Reapply**。
- **全有或全无（all-or-nothing）**：集合中任一文件无法安全恢复则整体不撤销，杜绝半还原状态。
- 不可撤销项：无变更前快照的文件、期间被用户手工改过的文件、**由终端命令产生的变更**（交还给 Git 处理）。

### 5. 运行中用户输入与消息修正

来源：<https://zcode.z.ai/en/docs/edit-history>、<https://zcode.z.ai/en/docs/agents>

- **排队消息**：Agent 回复期间键入的内容进入 queued messages 列表；悬停可 Edit——编辑把整条消息+附件**退回输入框**（非原地改），要求输入框无草稿/无上传中附件；排队中的 `/compact` 只能执行或删除不能改。
- **编辑已发送消息**：仅最新一轮的用户消息可编辑（任务运行中或有排队消息时不可用）；编辑器内提供 **Reset chat + files**——先恢复本轮改动的文件再重发修正指令；若有文件不能安全恢复则提示并降级为「仅重置会话后发送」。
- **Fork**：只能fork**已干净完成**的助手消息；新任务继承截至 fork 点的历史、当时模型与思考等级、Goal 进度；不回滚磁盘文件（两会话共享工作区）、不复制排队消息与后台任务。
- **Side conversation（侧聊）**：右侧面板独立 tab，继承主会话历史作为模型上下文但视觉上是空白；可调工具、可编辑文件、走权限确认，但不继承主任务的 Goal/排队消息；主任务被权限/提问阻塞时仍可从 `+` 菜单开侧聊；每任务每窗口一个、仅桌面端、关闭不可恢复（agents 页「Side Conversation」）。

### 6. 上下文引用的结构化入口

来源：<https://zcode.z.ai/en/docs/agents>

- 输入框符号系统：`@` 引用文件/文件夹、`#` 链接历史会话、`/` 调用已存命令、`$` 调用技能；`+` 菜单上传附件。
- 超长粘贴自动转附件，不淹没输入框。
- **划词引用**：选中回复正文/推理/代码块/工具结果可「Add to current task」，流式中的回复也可选（按点击瞬间冻结）；超上限会明确报错而非静默截断；目前仅单行。
- **浏览器元素拾取器**：内置浏览器工具栏进入 picker 模式，点击页面元素后抓取「页面标题、URL、元素文本、选择器、位置、安全 HTML 摘要」注入当前会话（ADE Tools）。Agent 也可直接驱动内置浏览器（开 URL、点击、填表、截图）做自验证，默认开启（agents 页「Driving the browser」、<https://zcode.z.ai/en/docs/browser-use>）。

### 7. 可编程拦截点（Hooks）

来源：<https://zcode.z.ai/en/docs/hooks>

- 事件序列：`SessionStart → UserPromptSubmit →（模型）→ PreToolUse → PermissionRequest → 工具执行 → PostToolUse / PostToolUseFailure → Stop`。
- Hook 是**本地子进程协议**：ZCode 向 stdin 写一行 JSON，进程以退出码 + stdout JSON 回复。
- `PreToolUse` 可按工具名匹配并 allow/ask/deny，甚至**整体替换工具入参**（替换后重新按 schema 校验）；`PermissionRequest` 仅在「结果本会弹给用户」时触发，可 allow/deny/改入参/更新权限规则；`Stop` 可注入反馈让主循环继续（连续至多 3 次）。
- 安全取舍：**项目级 hooks 当前版本不执行**（`<workspace>/.zcode/config.json` 中的 hooks 整体忽略并记日志 `config_project_hooks_ignored`），只有用户级 `~/.zcode/cli/config.json`（需 `hooks.enabled: true`）和插件 `hooks/hooks.json` 生效。

### 8. 子 Agent 的前/后台执行

来源：<https://zcode.z.ai/en/docs/subagents>

- 前台子 Agent：并行启动、主任务等全部完成才继续；后台子 Agent：不阻塞，结果自行回到主会话。后台模式由 Agent 自行决定，无单独管理界面。
- 安全约束：**后台 Explore 子 Agent 强制只读**（读文件/按名找文件/内容搜索）。
- 自定义子 Agent（Beta）：`~/.zcode/agents/<name>.md` Markdown+frontmatter，字段含 `model`/`thoughtLevel`/`tools`/`disallowedTools`/`maxTurns`/`injectAgentsMd`/`mcpServers`；`tools` 自定义清单是穷举式（清单外一律不可用，含全部 MCP 工具，除非手写 `mcp__<server>__<tool>` 全名）。子 Agent 不能再派生子 Agent。
- 终端长命令也可转后台执行，当前轮不等结果（ADE Tools「Running Long Commands in the Background」）。

---

## 轴二：自动化

### 1. Automations 总入口

来源：<https://zcode.z.ai/en/docs/automations>

- 左侧栏「Automations」管理页，归属当前项目工作流而非全局设置；分两类：**Scheduled tasks**（定时/周期）与 **Idle-time task**（闲时排队，免费）。
- 页面含「Keep awake」全局开关（与闲时任务共享）：因为任务跑在本机，**电脑睡眠或 App 关闭就不会触发**，错过的一次性运行记为 skipped 而非补跑。

### 2. 定时任务（Scheduled tasks）

来源：<https://zcode.z.ai/en/docs/automations>

- **三种创建方式**：表单（标题/周期/指令/工具栏四要素）；会话内「Create in chat」——此时任务**绑定当前会话**，每次触发的产出回投同一会话并在会话内出现任务卡；四个内置模板（工作日站会摘要/每日风险扫描/周五发版简报/周三文档同步检查），模板统一约束「只读分析、只写可核验事实、证据不足须明说、不改代码」。
- **周期规则**：Hourly / Daily / Every weekday / Weekly / Monthly / Custom；自定义支持间隔 N 单位、指定星期/日期/月/时分、月度可选「15 号」或「第三个周一」、Ends 结束日期（过期转 Completed）。无「最多 N 次」字段，但可在会话里让 Agent 创建带次数上限的任务。时区一律本机时区。
- **每任务配置**（创建后不可改项目）：项目（仅当前窗口已打开的本地项目）、权限（与会话相同的四档执行模式）、模型、思考等级。官方提示：无人值守场景慎选执行模式——要报告就保持只读。
- **运行管理**：Run now 立即跑且不影响排程；上一次未跑完则拒绝再次触发（"previous run still in progress"）。任务四态：active / paused / completed / failed。
- **运行历史**：详情页 Settings/History 切换，记录每次触发的进行中/成功/失败/**因睡眠跳过**，有会话的记录可直跳现场。
- **限额与边界**：全部项目合计 20 个任务（含暂停/完成/失败，只有删除定义才释放名额）；Agent 在会话里建任务撞限额时会说明并停止，不擅自删除；仅本地项目，不进移动端 Remote 界面。

### 3. 闲时任务（Idle-time task）

来源：<https://zcode.z.ai/en/docs/idle-time-tasks>

- 无排程、单次执行、**全局队列按创建时间先进先出**，卡片显示排队位次；走专用闲时通道，**自动运行全程免费、不占套餐额度**（含工具循环、自动压缩、前台子 Agent）。需 Coding Plan 订阅，分批放量中。
- **分段续跑**：长任务到达时间上限后**重回队列并在同一会话续跑**而非重来；重启 App 不丢。
- **计费/接管语义清晰分层**：
  - 会话永不锁定，运行中可键入：不中断的消息进会话队列、当前自动轮结束后才发出——该消息及其驱动的轮次按你的模型**计费**，但任务后续自动分段仍免费；
  - `Esc` 中断=接管：当前自动轮结束、任务进入终态**不再回队**，此后为普通付费会话；
  - **批准权限≠接管**：无人值守运行停在确认点，人点批准/拒绝仍在同一自动轮内、继续走免费通道。
- 六态：queued / paused / running / completed / failed / cancelled；暂停过久会**重新排到队尾**；失败不自动重试、已改文件不自动回滚。侧栏「Idle-time tasks」组以月亮图标标记运行中的任务。每日创建有上限。
- 限制：后台子 Agent 在闲时任务内不可用（显式报错）；仅桌面+本地项目。

### 4. Goal Mode：目标驱动的自续跑

来源：<https://zcode.z.ai/en/docs/goal>

- `/goal` 给当前会话设一个**可核验目标**；每轮结束跑独立校验，未达标则产出下一步并自动开下一轮，达标才收尾写总结。会话内插入「Iteration N · Goal not met, task continues」分隔条。
- **验证看证据不看姿态**：计划、清单、耗时、听起来像结论的回复都不算数；文件变更、命令输出、测试结果才算。有待办未完就不判完成。
- 摘要面板显示目标+耗时，已完成检查项**按首次出现的迭代分组**（防止把后面轮次补完的事项记错轮次）。
- `/goal pause|resume|clear|replace`；暂停不丢任何轮次/工具调用/产物，**停止运行任务会自动暂停 Goal**（防偷跑额度）；关闭会话重开状态仍在。Goal 在三种情况停止自推进：验证通过、被暂停/清除、达到为该 Goal 配置的用量预算。
- 与执行模式正交组合：Goal 管「何时算完」，执行模式管「多少动作要你确认」；Plan 模式下不可设 Goal（冲突）、任务运行中不可设。

### 5. 远程/移动伴随面

来源：<https://zcode.z.ai/en/docs/remote-control>、<https://zcode.z.ai/en/docs/bot-channel>

- **Remote Control（扫码遥控）**：左下角手机图标出二维码+链接；手机连上的是**整个桌面窗口**而非单个工作区，可浏览/切换工作区与任务、看会话、发指令、复制/点赞/ Fork。关键架构约束：**手机只是控制面，不同步代码、不建运行时**——指令交给桌面已建立的连接执行（本地/SSH/WSL/Docker 各归其位）。同一时刻只允许一个手机页面；关闭对话框≠停止遥控，须点 Stop；链接泄露可刷新二维码立刻失效；桌面须保持在线。
- **Bot Channel（聊天工具机器人）**：**WeChat 扫码即绑**（凭证自动保存），Feishu 两步（扫码创建应用 → 发送限时 `/bind XXXX` 指令绑定）；规划中 DingTalk/Discord/WeCom。机器人管理项：启用/停用、连接状态、回复粒度（Standard/Full/Summary，Feishu 固定流式卡不适用）、**工作区访问范围白名单**。绑定后 Feishu 机器人返回可用命令：查状态、建任务、切项目、切模型、改运行模式、调回复详略。
- 两条远程路径都驱动**桌面上已存在的会话**；Automations 不出现在移动遥控界面（automations 页限制节）。

### 6. 会话/任务的状态持久化与组织

来源：<https://zcode.z.ai/en/docs/task-management>、<https://zcode.z.ai/en/docs/ADE-tools>

- 任务视图三模式：分组（7 色自定义组）/ 按工作区 / 时间线；排序按创建或更新时间；搜索覆盖命令、会话、文件。
- 归档：完成且无未读、无置顶、超过保留窗口（3/7/14/30 天可配）的任务进入自动归档候选；归档列表有 Restore/Delete；v3.14.0 起支持批量删除。
- 任务行状态点：running / unread / failed；`+/-` 变更行数。
- 工作区文件树带 Git 状态标记（新增/修改/删除/重命名，目录聚合），「只看变更」过滤用于评审；Git Graph 只读视图；切分支有未提交变更时提示并可一步提交再切。
- 「Work outside a project」会话：无项目任务，产物文件不被清理；发过第一条消息后模式固定。
- Memory（设置里默认关闭）：每轮成功后在后台提炼可复用事实，新项目会话自动带上；不可浏览/清除（未提供 UI）；子 Agent 不读写（<https://zcode.z.ai/en/docs/agents>）。

### 7. 其他自动化相关机制

- **Hooks**：见轴一第 7 节，是事件驱动的自动化扩展点（<https://zcode.z.ai/en/docs/hooks>）。
- **动态工作流**（v3.14.0）：单脚本编排多子 Agent，`/workflow` 启动，运行中可调并发（<https://zcode.z.ai/en/changelog>）。细节未展开核验：**未核验**。
- **Computer Control / CUA**：changelog 提及 Computer Use 能力（v3.14.x 修复项），官方文档未见独立章节：**未核验**。
- **桌面系统级通知**（任务完成推送）：官方英文文档未见专门章节；第三方教程提到可开关「目标完成/检查点审批/错误」通知（<https://www.aimadetools.com/blog/zcode-setup-guide/>，非一手来源）：**未核验**。已核验的「完成感知」机制是：任务行 unread 状态点、Bot/Remote 推送进度、运行历史记录。
- **插件系统**打包 skills/commands/subagents/MCP（<https://zcode.z.ai/en/docs/plugin>）；**Skill** 以 `$` 调用（<https://zcode.z.ai/en/docs/skill>）；MCP 服务器接入（<https://zcode.z.ai/en/docs/mcp-services>）。

---

## 设计模式提炼

以下模式对「微信小程序内、动作草案需显式确认、NDJSON 流式」的 IoT 控制 Agent 有直接可移植性：

1. **四档自治度旋钮，默认最保守**：Ask/EditAuto/Plan/FullAccess 把「每次确认」到「最少打扰」做成显式模式，且每档的默认确认边界按动作类型切分（文件 vs 命令）。移植：我们的执行模式可沿「读设备状态 / 出草案 / 物理执行」三类动作分别设默认确认级。高风险模式用**常驻色彩风险标识**（ZCode 的橙色图标）提醒当前自治度。
2. **确认交互 = 一等结构化状态，作用域为任务**：权限请求挂起任务、阻塞输入、跨页面切换持久化、侧边栏标「待确认」。移植：动作草案应是可持久化的状态机实体（pending→approved/rejected/executed），而非一条消息；断线重连后待确认草案必须恢复呈现。
3. **确认与询问分离，超时只放给低风险询问**：普通提问 5 分钟倒计时后自动继续并留痕「Unanswered, auto-continued」；权限/计划确认永远等。移植：澄清类问题可带超时与默认值并明确标注「超时按 X 处理」；物理执行确认绝不超时放行。
4. **粒度化授权决策集**：Allow / Always Allow / Reject / Always Reject，外加「本次会话」「本项目」作用域。移植：小程序确认卡可提供「仅本次」「同设备同动作本会话不再问」「永久允许该房间照明」等分级授权，并配套查看/收回已授权范围的入口。
5. **全有或全无的回合级撤销 + 显式不可撤销边界**：Undo 以「本轮文件集合」为单位原子生效，终端命令改动明确排除并指回 Git。移植：一组动作草案的执行应具备「整组回滚或整组不回滚」语义，并在草案上标注哪些动作物理上不可逆（如门禁开门），不可逆项绝不承诺回滚。
6. **会话内排队与修订三条路**：运行中输入进队列（可撤回重编）、最新一条已发消息可编辑（可连带重置本轮改动）、Fork 从干净节点开分支但不回滚副作用。移植：草案待确认期间允许用户追加约束进入队列；「修正指令并重出草案」应支持连带作废旧草案；Fork 语义提醒我们：分支对话不等于撤销已执行物理动作。
7. **计划-确认-执行三段式（Plan Mode）+ 证据型完成验证（Goal Mode）**：先给计划等批准再动手；目标驱动时每轮独立校验且只认可核验证据（文件变更/命令输出/测试结果）。移植：IoT 场景的「目标」可以是「26 楼照明全部关闭」，验证器应回读设备真实状态而非相信 Agent 自述——与本项目「动作草案+回读」机制天然契合。
8. **无人值守运行的授权模型 = 预圈定权限包**：定时/闲时任务在创建时固定项目+执行模式+模型+思考等级，运行中遇确认点仍等人批准（批准不算接管）；闲时任务把「看」「插话」「Esc 接管」三种介入的计费与语义严格分层。移植：定时巡检/自动化任务应在创建时绑定「授权范围包」（可操作设备集、动作白名单、时段），运行中超出范围的动作仍落到人工确认队列。
9. **移动伴随面 = 纯控制面，不复制运行时**：手机扫码接管的是桌面窗口的会话，命令仍在原执行侧跑；机器人通道提供「回复粒度调节+工作区白名单」；流式卡片在 IM 内原地更新、工具调用折叠、决策点冻卡另发。移植：小程序天然是控制面——确认卡、进度卡应在 NDJSON 流中作为原地更新的结构化块渲染；审批类卡片与过程类卡片分离（决策点独占一条消息，不被后续流覆盖）。
10. **可编程拦截点前置到权限层**：Hooks 的 `PreToolUse`（可改写工具入参并重校验）与 `PermissionRequest`（仅在将弹给用户时触发，可改权限规则）提供了策略即代码的管道。移植：草案执行前挂策略钩子（如「22 点后禁止开整层照明」），钩子可放行/改写参数/升级人工确认；同时注意 ZCode 的安全取舍——项目级 hooks 因安全默认不执行，第三方下发的执行策略需独立信任域。
