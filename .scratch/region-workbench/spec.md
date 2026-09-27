# 区域工作台（region-workbench）

- 日期：2026-09-25
- Status: ready-for-agent
- 范围：mp（客户小程序 `pages/agent`，主）+ iot-agent-runtime（任务存储、执行、查询接口）
- 设计来源：原型 `pages/agent/proto-region-workbench.html?variant=P2`（结构选定记录见 `docs/research/proto-region-panel/c1-workbench-exploration.md`）；时间轴几何合同见 `docs/research/proto-region-panel/b6-timeline-design.md`
- 领域与决策：`CONTEXT.md`（区域、范围选择、任务区域归属、设备时间轴、区域异常提示、已查看、执行身份、错过的阶段、任务取消）；ADR 0003、ADR 0004（2026-09-25 修订为已接受）

## Problem Statement

用户今天只能在物联 Agent 里说一句话、确认一张草案、让设备立刻动作。他们无法让设备在“下午两点开会时”或“今晚六点”自动达到目标，也看不到一个区域今天已经发生过什么、接下来会发生什么、谁安排的、结果如何。多人共用的办公区里，某盏灯为什么被关掉、某台空调为什么在 26 度，没有任何地方可以查。

Runtime 侧同样没有任务能力：只有会话和即时草案，没有持久任务、没有到点执行器、没有面向区域或设备的历史查询；即时草案的执行逻辑也全部内嵌在一个超大入口文件里，无法被第二条执行路径复用。

## Solution

在客户小程序中新增“区域工作台”页面，结构采用原型 P2：

- 页面主体是当前区域的 B6 时间轴，展示当天的任务卡：单阶段任务是时间点，两阶段任务是区间缎带；卡片很细，只显示任务名、参与设备头像组和创建者，用样式表达状态。
- 顶部是与物联 Agent 共用的单选区域芯片；区域列表里只有存在未查看的部分完成或失败任务的区域才出现异常提示。
- 设备列表放在一个高底部抽屉里，可按类型、位置、状态筛选并搜索；点设备进入这台设备自己的时间轴，同一套几何，内容换成这台设备在各任务阶段中的目标、结果和来源。
- 每条时间轴自带日历；从区域时间轴进入设备时间轴时沿用当前日期。
- 点任务卡弹出任务抽屉，按阶段展示目标与结果；用户在这里唯一能做的写操作是“删除任务”（语义为任务取消，记录保留）。
- 物联 Agent 顶部新增区域芯片，点它进入区域工作台。Agent 可以在对话中提出创建任务或取消任务，两者都以富面卡片呈现，用户显式确认后才生效；确认后对话中的任务卡持续显示任务的最新状态，并可跳到区域工作台查看。

Runtime 侧新增：区域目录、任务存储、创建者凭据托管、进程内到点执行器、即时草案执行后的任务记录补写，以及区域时间轴、设备时间轴、任务详情、已查看等查询接口。确认路由里的设备执行过程抽成共享模块，即时草案与任务阶段共用。

## User Stories

### 区域与入口

1. As a 物联 Agent 用户, I want to see my current focus region as a chip at the top of the Agent page, so that I know which region an unqualified request like “关灯” defaults to.
2. As a 物联 Agent 用户, I want to switch the focus region from a list of the regions I belong to, so that I can work on another office without leaving the conversation.
3. As a 物联 Agent 用户, I want the conversation to continue after switching region with a visible “关注区域切换为 X” divider, so that earlier context stays available and I can see where the switch happened.
4. As a 物联 Agent 用户, I want the focus region to be remembered when I come back to the mini-program, so that I don't have to pick it every time.
5. As a 物联 Agent 用户, I want to still control devices in another authorized region by naming it explicitly, so that the focus region never becomes a permission wall.
6. As a 物联 Agent 用户, I want to tap the region chip to open that region's workbench, so that I can move from conversation to the region's operational view in one step.
7. As a 区域工作台用户, I want the same region chip at the top of the workbench with the same selection, so that the two pages never disagree about which region I'm looking at.
8. As a 区域工作台用户, I want the region list to mark only regions that have partial or failed tasks I haven't seen yet, so that I'm not distracted by normal activity.
9. As a 区域工作台用户, I want opening a region's workbench to clear that region's attention mark for me only, so that my colleagues still see it until they look.
10. As a 区域工作台用户, I want a partially completed task to remain marked as partially completed after I've seen it, so that “seen” is never mistaken for “handled”.

### 区域时间轴

11. As a 区域工作台用户, I want today's timeline of the region to open by default at the current time, so that I immediately see what just happened and what is next.
12. As a 区域工作台用户, I want the timeline to look exactly like the approved B6 prototype, so that the product matches the design we agreed.
13. As a 区域工作台用户, I want single-phase tasks drawn as points and two-phase tasks drawn as interval ribbons, so that I can read durations at a glance.
14. As a 区域工作台用户, I want each task card to show only the task name, up to three device avatars plus “+N”, and the creator, so that the timeline stays dense and scannable.
15. As a 区域工作台用户, I want finished tasks to look quieter, executing tasks to carry a jade accent, partial tasks a brass dot, failed tasks a clear failure mark, and cancelled tasks to appear faded as “已取消”, so that status is visible without opening anything.
16. As a 区域工作台用户, I want immediate device operations confirmed in the Agent to appear on the region timeline as point cards, so that the region history includes everything the system did.
17. As a 区域工作台用户, I want a task that spans devices in two regions to appear on both regions' timelines, so that neither region's history is incomplete.
18. As a 区域工作台用户, I want the timeline to refresh while I'm looking at it, so that an executing task turns completed without me reloading.
19. As a 区域工作台用户, I want the region timeline to have its own calendar showing which dates have tasks, so that I can jump to past or upcoming days.
20. As a 区域工作台用户, I want the calendar to go back to any past date and forward up to seven days, so that I can review history and see everything that can be scheduled.

### 任务抽屉

21. As a 区域工作台用户, I want tapping a task card to open a bottom sheet that shows the task by phase, so that I understand what will happen or happened at each moment.
22. As a 区域工作台用户, I want each phase to list its devices with their target state and, after execution, their result, so that I can see exactly which devices were already at target, which were commanded, and which failed.
23. As a 区域工作台用户, I want a missed phase to be shown as “已错过” with its reason, so that I understand why nothing happened at that time.
24. As a 区域工作台用户, I want a phase that failed because the creator's login expired to say so explicitly, so that I know the cause is identity rather than the device.
25. As a 区域工作台用户, I want to see who created the task, when, and from which conversation, so that I can find the person responsible.
26. As a 区域工作台用户, I want to delete a task that hasn't started, so that it never runs.
27. As a 区域工作台用户, I want deleting an executing task to stop only its remaining phases, so that I can stop a meeting task early without undoing what already happened.
28. As a 区域工作台用户, I want deletion to ask for confirmation and to keep the task visible as cancelled afterwards, so that nobody loses history by accident.
29. As a 区域工作台用户, I want no delete action on finished tasks, so that I'm not offered something meaningless.
30. As a 区域工作台用户, I want deletion to be refused if I'm not authorized for every device in the task, so that I cannot stop tasks affecting devices I don't control.
31. As a 区域工作台用户, I want deletion to fail clearly if the task changed since I opened it, so that I never cancel a state I haven't seen.

### 设备抽屉与设备时间轴

32. As a 区域工作台用户, I want to open a tall device drawer listing every authorized device in the region, including non-controllable ones, so that the region's device inventory is in one place.
33. As a 区域工作台用户, I want device cards in the refined product-art style with the last known state, so that the list is recognizable and informative.
34. As a 区域工作台用户, I want the list to render before device states finish loading, so that a slow gateway doesn't block the drawer.
35. As a 区域工作台用户, I want type, location, and status filter chips plus a search that expands in place and highlights matches, like the draft device browser, so that I can find a device quickly with a familiar interaction.
36. As a 区域工作台用户, I want tapping a device to open that device's timeline, so that I can see its history.
37. As a 区域工作台用户, I want the device timeline to open on the date I was viewing in the region timeline, so that context carries over.
38. As a 区域工作台用户, I want the device timeline to share the timeline geometry but show per-device records — source (定时/即时), target, result, initiator — so that it is recognizably the same language yet clearly about one device.
39. As a 区域工作台用户, I want a lighter calendar on the device timeline that marks only dates with records for that device, so that I can jump through its history.
40. As a 区域工作台用户, I want tapping a device record to open the owning task's sheet, so that I can see the full task behind a single device action.

### Agent 创建与取消任务

41. As a 物联 Agent 用户, I want to say “下午两点到三点在会议室B 开会，开始时空调 26 度灯全开，结束时全关” and get a task card, so that I can schedule a meeting setup in one sentence.
42. As a 物联 Agent 用户, I want the task card to show the name, time, phases, and devices with targets before I confirm, so that I know exactly what will happen.
43. As a 物联 Agent 用户, I want nothing to be scheduled until I tap “创建任务”, so that a misunderstanding never causes future side effects.
44. As a 物联 Agent 用户, I want a pending task card to be retired when I send a new message, like device drafts, so that there is only ever one live proposal.
45. As a 物联 Agent 用户, I want confirming a task whose first phase is less than ten minutes in the past to run that phase immediately, and a later one to be refused with “时间已过，请重新创建”, so that late confirmation behaves predictably.
46. As a 物联 Agent 用户, I want the confirmed task card to keep showing the live status and link to the region workbench, so that I can follow the task from the conversation.
47. As a 物联 Agent 用户, I want to ask “今天会议室有什么安排” and get an answer from real task records, so that the Agent never invents schedules.
48. As a 物联 Agent 用户, I want to say “把 18 点那个取消掉” and receive a cancellation card for me to confirm, so that the Agent cannot cancel anything on a misreading.
49. As a 物联 Agent 用户, I want the Agent to refuse tasks more than seven days ahead, tasks with more than two phases, or future access-control actions, and explain why, so that I don't create something the system won't run.
50. As a 物联 Agent 用户, I want “关灯” to keep working as an immediate draft exactly as today, so that the existing flow doesn't regress.

### 执行

51. As a task creator, I want each phase to read all its devices, command only those not at target, and verify, so that devices already at target are counted as success rather than error.
52. As a task creator, I want the phases of my task to run independently, so that a failed start phase doesn't prevent the end phase from switching things off.
53. As a task creator, I want phases to execute with my own permissions, so that tasks never act beyond what I'm authorized for.
54. As a task creator, I want a phase that the system could not run within ten minutes of its time to be recorded as missed rather than executed late, so that a late run doesn't override what people did meanwhile.
55. As a task creator, I want my stored login to be deleted when my task ends, so that the system keeps my credential no longer than necessary.
56. As an operator, I want the runtime to refuse to start without the credential encryption key, so that credentials are never stored in the clear.
57. As an operator, I want a phase interrupted by a runtime crash to be closed as interrupted with what is known, never silently re-run, so that device side effects aren't duplicated.

## Implementation Decisions

### 几条贯穿性的规则

- 时区固定为 Asia/Shanghai；“某一天”的区域时间轴取与该日 00:00–24:00 有交集的任务。
- 阶段数 1 或 2；首阶段不晚于确认时刻后 7 天；未来阶段只允许照明与空调目标；门禁只走即时草案。
- 补执行窗口 10 分钟，同一常量约束到点执行和确认时刻。
- 任务可见性：调用者的授权设备范围包含任务中任一设备即可见；可取消：包含任务全部设备。
- 所有写操作带版本号（乐观并发），与现有草案的 CAS 写法一致。

### Runtime：设备执行模块（从确认路由抽出）

- 把确认路由中“按目标读状态 → 比较 → 只对未达标设备下发 → 回读 → 逐设备回执”的过程抽成一个独立模块，即时草案确认与任务阶段执行共用。
- 接口形状：输入为调用身份、已校验目录快照、设备目标列表（设备、种类、目标命令）和中止信号；输出为逐设备结果：`satisfied`（已达标无操作）、`verified`、`unconfirmed`、`rejected`、`unknown`（已发出结果未知）、`not_dispatched`、`unreadable`、`missing`（目录中已不存在）。
- 现有语义全部保留：控制复用已校验目录不二次加载；回读只认晚于指令开始时刻的上报；门禁非幂等规则；中断时区分已记账、在途未知和未下发。
- 抽出后即时草案的 HTTP 行为不变，由现有会话测试兜底。

### Runtime：区域目录

- 适配器在装配授权设备范围时保留每台设备所属办公室的 `elementId` 与名称（当前仅把名称兜底进位置文本，id 被丢弃），作为设备的区域归属；同一设备出现在多个办公室时区域归属为集合。
- 新接口 `GET /api/agent/regions`：返回当前用户所属区域 `{ id, name, attention }`，`attention` 为该用户在该区域存在未查看的部分完成或失败任务。
- 新接口 `POST /api/agent/regions/:regionId/seen`：记录该用户在该区域的最后查看时间（水位）。

### Runtime：任务存储

- 新表（SQLite，同一运行库）：
  - 任务：id、租户、名称、状态、版本、区域集合、创建者（不可逆身份键 + 展示名）、来源（`agent` 会话与轮次 / `immediate_draft` 草案）、创建与更新时间、取消者与取消时间。
  - 任务阶段：任务、序号、计划时刻、状态、开始与结束时刻、失败原因。
  - 阶段设备：阶段、设备 id、种类、名称与位置（来自目录事实）、目标命令、执行结果、结果细节。
  - 任务凭据：任务、加密后的授权信息与租户、创建时间；任务进入终态即删除。
  - 区域查看水位：身份键、区域、最后查看时间。
- 任务状态沿用 ADR 0004：`proposed → scheduled → executing → completed | partial | failed | cancelled | expired`；`expired` 用于未确认即过期或被新消息退役的提案。
- 阶段状态：`pending → executing → verified | satisfied | partial | failed | missed | cancelled | interrupted`。任务终态由阶段结果汇总：全部 verified/satisfied → completed；存在失败但也存在成功 → partial；全部失败/错过 → failed；被取消且之前无失败 → cancelled。
- 区域时间轴与设备时间轴只从这些表投影，不另建记录来源。

### Runtime：创建者凭据托管

- 确认任务时，把当前请求的授权信息与租户用 AES-256-GCM 加密后写入任务凭据表；密钥来自新的运行配置项（环境变量），缺失时 Runtime 拒绝启动，与其他关键配置一样 fail closed。
- 凭据只在执行器内部解密使用，不出现在任何响应、事件、日志或观测轨迹中；本地开发时请求身份已被开发身份覆盖，托管的就是开发身份。
- 执行时上游返回 401/授权不可用：该阶段 `failed`，原因“创建者登录已失效”；后续阶段到期时同样处理。

### Runtime：执行器

- 进程内周期扫描（默认 15 秒），按计划时刻认领 `pending` 且已到期的阶段：CAS 置 `executing` 后执行；到期超过 10 分钟的直接置 `missed`。
- 执行：解密凭据 → 以创建者身份加载授权设备范围 → 不在范围内或已消失的设备记 `missing` → 其余交给设备执行模块 → 写逐设备结果 → 汇总阶段状态与任务状态 → 任务终态时删除凭据。
- 启动自愈：残留 `executing` 阶段一律置 `interrupted`（沿用即时草案 INTERRUPTED 的理由：不重复下发），不补跑。
- 构建出的 Runtime 对外暴露一个“执行一次到期扫描”的方法，生产定时器调用它，测试直接调用它并配合注入的 `now`。

### Runtime：Agent 工具与任务富面

- 新 Pi 工具：
  - `propose_task`：名称（≤12 字）、1–2 个阶段（时刻 + 设备目标），通过 `candidateSetIds` 引用候选集，校验规则与草案一致（设备来自候选集、能力已检查、名称位置由目录回填）；额外校验阶段数、7 天上限、未来阶段禁止门禁、首阶段不早于“现在 − 10 分钟”。
  - `list_tasks`：按区域与日期查询当前用户可见的任务摘要，只读。
  - `propose_task_cancellation`：引用一个可见且未结束的任务，生成取消提案。
- 新流事件（与现有 `action.proposed` 并列，保持前端依赖面最小）：`task.proposed`（提案）、`task.cancellation.proposed`（取消提案）、`task.resolved`（提案被确认、退役或过期）。事件随 events_json 持久化，恢复即重放。
- 提案遵循现有零滞留相位规则：下一条消息退役待确认的任务提案和取消提案；TTL 与草案相同。
- 新接口：
  - `POST /api/agent/tasks/:id/confirm`（带版本）：写凭据、置 `scheduled`；首阶段已到期且在窗口内则立即交给执行器；超出窗口返回 409“时间已过，请重新创建”。
  - `POST /api/agent/tasks/:id/cancel`（带版本）：Agent 取消提案确认与区域工作台“删除任务”共用；未开始整体取消，执行中取消剩余 `pending` 阶段，已结束返回 409；权限不足返回 403。
- 模型输入新增当前关注区域（名称与 id）作为未指明地点时的默认值，由消息体中的 `focusRegionId` 传入并校验属于当前用户区域；提示词只声明其“默认值而非权限”语义。

### Runtime：即时草案补写任务记录

- 即时草案执行进入终态后，同一事务外补写一条任务：来源 `immediate_draft`、单阶段、计划时刻为确认时刻、阶段设备结果由执行回执映射；不托管凭据。补写失败只记审计，不影响草案结果。

### Runtime：查询接口

- `GET /api/agent/regions/:regionId/timeline?date=` → 该日任务列表：id、名称、状态、版本、阶段（时刻、状态）、设备摘要（id、种类、名称，按阶段去重）、创建者展示名、来源类型、是否可取消。
- `GET /api/agent/regions/:regionId/calendar?from=&to=` → 有任务的日期、有异常的日期。
- `GET /api/agent/tasks/:id` → 任务详情，含逐阶段逐设备目标与结果、来源会话。
- `GET /api/agent/regions/:regionId/devices` → 区域内全部授权设备（id、种类、名称、位置），不含状态；`GET /api/agent/regions/:regionId/device-states` → 最后已知状态（平台影子，带年龄标注），供抽屉后台加载。
- `GET /api/agent/devices/:deviceId/timeline?date=` 与 `.../calendar?from=&to=` → 该设备的阶段记录（来源类型、计划时刻、目标、结果、发起人、所属任务 id）。
- 所有接口按请求身份过滤可见性；区域不属于当前用户时返回 404。

### Runtime：代码结构

- 任务能力以独立模块组织（存储、执行器、路由、工具），以 Fastify 插件形式挂到应用上，不再向现有入口文件追加路由；设备执行模块同样独立。不做入口文件的一次性重写，只在抽取执行模块时移动确认路由的相应部分。
- 创建者展示名：确认任务时由 Runtime 以请求身份向客户用户信息接口读取并固化进任务；读取失败时使用“成员”。具体接口在对应票中实测后确定，不猜测字段。

### 小程序：时间轴几何模块

- 把 B6 的几何从原型中抽成纯函数模块：`railX(y)`、34px/小时时间映射与跨日紧凑映射、单侧缎带路径（左边为曲线本身、右边沿右法线）、刻度与刻度文字的统一显隐判定、午夜只出现一次 `00:00`、当前时刻标签整组隐藏判定、端点与当前时刻节点坐标（不避让）。
- 数值不变；模块输出路径命令与标记坐标，不依赖任何渲染方式。原型保持冻结，不从原型反向改动。

### 小程序：时间轴渲染

- 首张票同时实现两种渲染：canvas 2d 与“生成 SVG 字符串后以图片显示”；在同一时刻、同一屏宽下与原型截图叠加对比，保真度更高者胜出，另一种删除。
- 必须满足：进度两层使用同一条路径且深色层裁剪到当前时刻；无独立多边形、无额外前沿线；节点与刻度样式与 B6 一致。
- 任务卡、时间文字等可交互元素以普通视图绝对定位叠在图形之上，坐标来自几何模块。

### 小程序：区域工作台视图模型

- 纯函数模块（与现有 `conversation.mjs` 同一风格）：接口响应 → 时间轴卡片（点/区间、状态样式、头像组最多 3 个加 “+N”）、任务抽屉阶段视图与可用操作、设备列表筛选与搜索高亮、设备时间轴记录、区域异常提示、日期沿用规则。
- 页面与组件只消费视图模型，不自行推导状态。

### 小程序：页面与组件

- 新页面 `pages/agent/region`（注册到客户小程序），由 Agent 页区域芯片 `navigateTo` 进入；页面参数携带区域 id 与日期。
- 区域芯片与区域选择浮层为共享组件，Agent 页与工作台共用；当前关注区域保存在本地存储，两页读写同一份。
- 设备抽屉、任务抽屉复用 `DeviceSheet` 底座（保持根节点常驻、关闭时禁用指针、拖拽跟手与回弹）；设备筛选与搜索沿用 `DraftSheetLayer` 的交互。
- Agent 对话新增一种统一任务卡富面，按提案、取消提案、已确认（实时状态）三种状态渲染；已确认卡按任务 id 轮询任务详情，直到任务终态。
- 所有请求经 `utils/agent-session.js`，页面与组件不接触 Token、Authorization 或租户。
- 刷新：工作台在 onShow 与可见期间每 30 秒刷新当前时间轴；存在执行中任务时缩短为 5 秒。

## Testing Decisions

2026-09-27 按用户要求精简：验收项不等于逐项新增自动化测试。每个业务切片只保留少量能保护独立风险的公开行为用例，优先复用现有场景；详细保留范围见 `test/AGENTS.md` 及 Runtime 同目录说明。

- **Runtime**：`buildApp` + `inject`，注入生产协议网关夹具、faux runner 与可推进的 `now`；到期扫描通过构建结果上的公开方法驱动。测试不调用真实设备。
- **票 01**：既有精简控制套件和类型检查保护抽取，不为新执行模块新增内部测试。
- **Task 最小保护**：随业务切片逐步覆盖“确认 → 扫描 → 结果”、执行时权限隔离、重复扫描不重复下发、取消后不执行、窗口外错过，以及凭据不泄露/终态清除。失败、部分成功和中断以影响真实执行的风险选代表场景，不建立全状态组合矩阵。凭据清除须通过适当的存储接口验证，不能仅以再次扫描未执行代替。
- **小程序**：继续保留分块解码、权威恢复与流式终态测试；新增任务事件确有恢复风险时扩展原场景。几何仅测试公开时刻映射和跨日边界等必要数值行为，不锁定 SVG 路径字符串、采样点快照、CSS 或源码写法。
- **视觉与操作**：B6 保真度、Canvas/SVG 选型、卡片样式、抽屉、筛选和日历跳转通过客户微信环境中的真实操作验收。截图与结论写入对应票，不以纯函数或源码检查替代。
- **最终真实网关**：票 14 人工执行一次两阶段照明任务、取消流程及异常提示，保留设备结果证据。

## Out of Scope

- 任务编辑、用户手动创建任务（另一业务范围）。
- 三个及以上阶段、重复计划、超过 7 天的排期。
- 共享资源冲突检测、人工接管、区域角色或审批。
- 微信订阅消息、短信等外部推送；只做应用内区域异常提示。
- 设备时间轴中的“人工”来源（未找到客户侧人工操作记录接口）。
- 未来阶段中的门禁操作。
- 客户提供的稳定后台服务身份（本方案以创建者凭据托管替代）。
- 历史清理与归档。
- 独立小程序回归壳（agent-miniapp）的同步。

## Further Notes

- Runtime 提交前先 `git branch -v` 确认落在当前 codex 主线；mp 提交遵循仓库 Git 规范，原型相关未跟踪文件不入库。
- 原型 `proto-region-workbench.html` 与 `proto-region-panel.html` 保持冻结，仅作设计来源；生产实现不得直接复制原型代码结构。
- 控制到权威读反映延迟波动大（实测 2.4s–30s），任务阶段回读沿用现有窗口与 `unconfirmed` 语义，不因任务场景另调。
