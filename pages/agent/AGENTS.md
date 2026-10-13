# Agent Page Notes

- 客户告警跳转的alertPrompt只进入Company；草稿与引用分开保存，编辑/重试用原turn.reference，当前输入的新引用保持不动。run.started携带原引用供恢复；入口与验收边界见 `plan/2026-10-04-customer-alert-reference-handoff.md`，客户正式回调契约仍待对接。
- 安全台账结构化引用与上述自由文本桥分开：事件身份是 ledger＋eventId，并核对 deviceId；共用 SafetyEventDetail 即时展示带读取时间的快照，稳定身份可立即引用，后台更新不阻塞按钮；发送消息时 Runtime 再按当前目录核验记录，引用本身不代表核验成功或控制授权。仪表盘保留列表节点，返回详情用显式 display:none/block；首次挂载必须触发读取。网络错误保留标注过的旧快照，401/404 清理记录并禁用引用，迟到响应核对 requestId/身份/active。现行行为见 `plan/2026-10-08-independent-reads-lan-handoff.md`。

- 微信分块事件的 `data` 是 `ArrayBuffer`，中文 UTF-8 字节可能跨 chunk；所有 NDJSON 解析继续复用 `apis/agent/ndjson.mjs`。
- 正文事件是 `message.delta`（增量，后端已合并）+ `message.completed`（权威终稿）；终稿覆盖累积文本，`tool.started` 会收起工具前的中间评注。
- `tool.progress` 原位更新运行中步骤摘要（0 命中重试聚合为“正在修正检索范围…”）；`run.*` 收尾必须同时清 `running` 与 `streaming`，光标不得滞留。
- 失败轮的恢复入口是最近用户气泡的重试/编辑与错误卡片：重试沿用 `turn.content` 重发，失败轮本就未入服务端会话，无需新接口。
- Android 优先消费 `onChunkReceived`，其他平台保留完整 response 回退，两条路径必须产生相同业务事件。
- 客户身份只通过 `utils/agent-session.js` 提供，`apis/agent/index.js` 只消费统一 header；页面与组件不接触 Token、Authorization 或 tenantCode。
- `ACCEPTED` 表示上游受理，界面保留“暂无物理状态回执”说明；只有待确认卡片可发起真实控制。
- 恢复会话时以服务端 `draft/result` 为准；历史事件只恢复轨迹和正文，不能把已执行草案重放成待确认。
- 选项更新和确认携带最新 revision；执行结果的 summary 由服务端生成，重试回答不得重发设备控制。
- 当前生产范围和验收状态见 `plan/2026-09-18-customer-miniapp-canonical-agent-migration.md`；H5 预览和独立回归壳都不能替代客户小程序验收。
- 视觉为拟物材质体系（呢面/纸材/黄铜/玉漆），只用渐变+阴影实现，不引入 backdrop-filter；`prefers-reduced-motion` 下停用闪烁与脉冲。
- 组件必须对宿主全局样式中立（2026-09-23 根因）：客户 `app.wxss` 继承 uni-app 模板 `view{font-size:28rpx;line-height:1.8}` 与 `input,text{font-size:30rpx}`——元素自身命中的规则优先于继承，会把组件内所有不带字号类的 `text`/`input`（highlightParts 循环子元素、`.from/.to`、裸文本）撑成 15px；每个 Agent 组件 scoped 样式首行固定 `view, text, input { font-size: inherit; line-height: inherit; }`，禁止删除。同理，scroll-view 隐藏滚动条必须用 `enhanced :show-scrollbar="false"`（同 .rail/.conversation 约定），非 enhanced 时该属性不生效——独立壳靠全局 `::-webkit-scrollbar{display:none}` 掩盖，客户壳没有这个全局规则会露滚动条。
- Agent 头像（`AgentAvatar.vue` + `avatar.js`）使用固定预计算 SVG body/eyes 分层，不按会话随机；保留扫视、眨眼、运行呼吸和 reduced-motion 完整行为；不得降级为通用图标方块，也不得重新引入 blobatar 依赖。
- 草案面板沿用 `DraftSheetLayer` + `DeviceSheet` 的本地 Sheet 底座：根节点常驻但关闭态 `pointer-events:none`，面板 `transform` 与遮罩 `opacity` 都由 Vue 的 `open/dragY` 状态驱动；横杆只在触摸期间直接跟手，松手后回弹或退场。不要重新接入 `uni-popup`/`uni-transition` 或 WXS `callMethod` 桥接；此前的异步生命周期和双层位移曾造成孤立遮罩及横杆失效。改动后在客户微信环境核对连续开合、横杆拖拽、遮罩同步与底部安全区；不以源码正则断言替代交互验收。
- 客户小程序是生产 Agent 主线；本目录必须复用客户会话，不得恢复独立 miniapp 的固定 `local-development`/`LOCAL` 身份。
- 开发阶段客户登录、用户、园区和物联网接口继续走客户公网；仅 Agent Runtime 指向 Mac 当前局域网 IP 的3200端口，后端监听0.0.0.0供手机预览。换网后核对IP并重新编译；唯一 Runtime 直连真实客户网关，不存在模拟数据源。`trial/release` 不得依赖本机地址。
- Agent 页面进入前等待 `utils/agent-session.js` 的会话与园区上下文；页面和组件不得自行拼接 Authorization 或 tenantCode。
- 本目录已是生产 Agent 页面；新业务只在客户主线实现。独立 miniapp 已于 2026-09-24 迁出为同级仓库 `agent-miniapp`，仅用于复现问题，回补时只同步能够证明必要的最小修复。
- 修改独立的区域时间轴原型 `proto-region-panel.html` 时，先读 `docs/research/proto-region-panel/b6-timeline-design.md`：它记录唯一设计稿、B4 冻结边界及 B6 的区间、节点、刻痕和时间文字契约。原型不是生产区域面板，多区间重叠仍属探索状态。
- `proto-region-workbench.html`（C1）以 B6 为起点探索入口、区域切换、细任务卡、抽屉、设备列表、设备时间轴、日历归属与区域提示；改动前先读 `docs/research/proto-region-panel/c1-workbench-exploration.md`。其中时间轴组件是 B6 分支的移植，几何参数随 B6 契约冻结，只允许替换卡片内容；`proto-region-panel.html` 保持冻结作对照。
- 区域工作台接线与验收状态见 `plan/2026-09-27-region-workbench-first-loop-handoff.md`。消息发送/重试/编辑应在修改原轮前固定本次关注区域；本地选区按统一 session 的不可逆身份键分区，区域仅是默认上下文。
- B6 生产几何共用 `timeline-geometry.mjs`；时间节点不承载任务完成状态。微信开发者工具已选 SVG 图片承载图形，普通视图承载时间字与卡片；Canvas 原生图层曾越过滚动裁切边界。空区域按 P2 原型显示局部符号。见 `docs/research/proto-region-panel/2026-09-27-native-renderer-status.md`；实际任务回读仍需真实操作验收。
- 区域工作台的 `region-sample-tasks.mjs` 仅供开发版“查看样例”预览：只读授权目录构造 `sample-*` Task，区域与设备时间轴、任务详情共用同一批任务和设备 ID；结果是虚构的，不能写入 Runtime、确认或控制设备，也不能当真实任务验收。从样例返回时必须重新请求真实时间轴。见 `plan/2026-09-28-region-sample-record-consistency.md`。
- 区域时间轴细卡按 P2 原型放任务名、设备头像和创建者标记；部分完成用黄铜点，失败/错过/中断用红色叉号，执行中用卡片强调，取消态例外保留可见的“已取消”，完整状态与创建者姓名在任务详情中。开发样例仅对齐了 14:00–15:30 / 14:52 的主区间，不是票 02 所需的同数据叠图。见 `plan/2026-09-28-region-timeline-card-alignment.md`。
- 工作台底部“＋ 新建任务”回到 Agent 对话：先把当前区域写回关注区域，再经 `agent-compose-prefill:<scope>` 预填含区域名的输入开头；真实创建仍走提案确认流。创建者标记按展示名散列着色，本人显示“我”——判定只用任务 `source.draftId/conversationId`（服务端仅对创建者返回），不得在前端比较身份信息。区域 chip 黄铜点是各区域 `attention` 的聚合，进入真实区域仍由服务端确认后清除。
- 区域设备抽屉见 `plan/2026-09-27-region-device-browser-handoff.md`：每次打开重读授权目录（30 秒内同区域同身份复用），目录先于状态显示；标题栏可手动刷新状态，任务阶段收口后约 1 秒自动刷新一次。刷新期间保留布局，失败时清空旧读数但保留目录。类型/位置/状态是互斥分组，搜索才过滤。
- 设备抽屉是**单层 Sheet 内的三级导航栈**（设备列表→设备时间轴→任务详情）：任务详情共用 `TaskDetailContent`，抽屉内打开任务不再叠加第二个 `DeviceSheet`；pane 用 `translateX` push/pop（260ms 抽屉曲线），退场 pane 靠 `closing` 快照多挂 ~300ms。从区域时间轴直开任务仍用独立 `TaskDetailSheet`（页面上只有一层）。
- 观察设备（video/environment/energy/safety）在抽屉与回复面都是**只读事实呈现**：视频显示「在线/离线/在线状态未知」不套用开-关；状态分组并入「仅观察」；点击进 `DeviceObservationView` 观察 pane（不落空时间轴）。`observation.reported` 事件把本轮只读读数快照挂到 `turn.observations` 由 `ObservationCard` 逐块呈现（视频在线点 +「查看画面」、环境读数带来源标注、能耗最新已知读数带时间、安全仅告警台账、告警记录带平台上报标记）。「查看画面」走 `video-player.js`：先 `getVideoStream` 现取短时效地址再经 `pages/webView` 打开 `config.videoPlayerUrl`（客户域 H5，token/tenantCode 由 webView 注入契约供给）；地址未配置时按钮置灰「播放页接入中」；取流失败 ≠ 播放失败 ≠ 离线，三态分开表达。生产 H5 交付物在 `deploy/h5player/index.html`，客户确认部署路径后填地址并验收真机播放。
- 区域时间轴日历与任务详情见 `plan/2026-09-27-region-task-browse-handoff.md`：空日期仍保留日历，月标记失败单独提示；Task 详情的 `details.receipt/fields/timedOut` 必须参与结果文案，不能仅看总体 outcome。多设备阶段按 P2/D1 显示可展开设备组，单设备结果直接可见；见 `plan/2026-09-28-task-phase-disclosure.md`。开发版双阶段样例不属于真实任务。
- 设备时间轴见 `plan/2026-09-27-device-timeline-handoff.md`：`DeviceTimelineView` 必须包在 `DeviceSheet` 的 flex 子容器中，并保持 `timeline-area` 的 `height:0; flex:1; min-height:0`，否则微信 `scroll-view` 高度会等于全部内容，定位记录失效。设备选择只保存 ID，详情始终从最新读数派生；真实与本地演示记录严格分开。紧凑日历是浮在时间轴左上角的 `datefloat` 日期 chip + `cal-float` 浮层 pill（绝对定位、不占布局、点遮罩或选日收起）；区域常驻日历保持 inline 周条，点头展开月视图（箭头只在展开时出现）。两阶段任务只取消后续阶段时，设备记录须同时保留已发生阶段的结果和后续取消事实，不能统称“已取消”。见 `plan/2026-09-28-device-calendar-disclosure.md` 与 `plan/2026-09-28-device-cancelled-stage-receipt.md`。
- 定时 Task 提案在对话中使用 `TaskProposalCard`：流事件 `task.proposed/task.resolved` 和恢复快照 `turn.task` 共用 taskId；只有点击“创建任务”才调用确认接口。`scheduled/executing` 状态持续按 Task 详情轮询，终态停止；“放弃”只退役提案，不能误显示成已创建任务。工作台深链必须在授权时间轴返回目标 Task 后打开详情，见 `plan/2026-09-28-task-workbench-deeplink.md`。跨日任务仍在每天的区域时间轴显示，绘图只裁切当前日视口，不改变原始阶段时间或同日 B6 几何。微信端验收由用户完成。
- 到点执行后区域时间轴在页面可见时静默刷新，任务抽屉仅对 `scheduled/executing` 轮询详情；刷新不可清空旧卡片造成闪烁。阶段结果显示 `satisfied/verified/partial/failed/unconfirmed/missed/interrupted`，401 失败原因显示“创建者登录已失效”；设备记录以每个阶段实际结果为准，不把平台受理改写成物理完成。
- Office 定时 Task 可选 `interval` 独立起止与 ≥1 自由检查点（无两点业务上限）；确认后由正常扫描完整执行各点、不自主补终点控制。详情与卡片区分 `executing`+`executionActive:false`（区间进行中）与 `executionActive:true`（设备调用中）；`report` 只在终态后由已持久化事实生成，设备按当前授权裁剪、台数按可见唯一设备统计。任务轮询经 `mergeTaskDetail` 合并：提案阶段可能只有 `at`/`actions`，先按 `at` 对齐再写 `id` 与 status，不得用详情的 devices 形状覆盖 actions；取消提案 `phases` 可为空，区域导航锚点取 `interval.startsAt` 或首阶段时间。沿用宿主 flex/`TaskDetailSheet`/B6 几何，报告渲染不调用模型。
- 工作台删除任务使用任务详情 `canCancel` 与 `version`，二次确认后调用取消接口；403/409 保留抽屉并刷新详情。已取消记录继续留在时间轴，淡化并显示“已取消”；未下发设备不得显示为故障。小程序交互验收由用户完成。
- Agent `list_tasks` 只读查询授权区域的某一天；取消必须先列出准确任务，再生成独立 `task.cancellation.proposed` 卡。卡片 `cancellationId` 与目标 `taskId` 不同；会话恢复按前者去重，保留原创建收据。确认调用取消提案接口，放弃/新消息/过期只退役提案；任务状态由真实 Task 详情驱动。
- 区域列表的 `attention` 只表示当前身份尚未查看的部分完成/失败/未核验任务，不能拿运行中状态或装饰圆点充当提示。进入/切换真实区域调用 `acknowledgeRegion`，只有服务端确认后清除本地提示；样例模式不得更新真实水位。工作台可见时常态 30 秒、任务执行中 5 秒刷新，隐藏后停止；小程序交互验收由用户完成。
- Task 详情独立读取当前授权照明现态，显示在执行收据之外；Office `switchStatus` 缺少执行时上报时间，当前显示“开启”不能把历史 `unconfirmed` 改成 `verified/completed`。现态读取失败不应抹掉任务收据。草案卡也只能根据本次回执及执行时回读决定结果标签，不能根据后来刷新到的现态把 `ACCEPTED` 改成“已达到目标”；所有现态查询不得用执行快照覆盖。
- 现态手动与执行后的延迟刷新共用 `state-refresh.mjs`，只读设备状态；常驻界面不展示查询时间或“上报时间未知”。本轮边界与验证见 `plan/2026-09-28-device-state-receipt-separation.md`。
- 工作台只在真实时间轴成功返回且完成视图更新后调用 `acknowledgeRegion`；加载失败、样例模式、隐藏页面或被新请求替代的结果不得清除异常提示。
- `TaskDetailContent` 根节点是 `height:0;flex:1` 的 scroll-view，必须经宿主类（`content-host`/`task-content-host`，`flex:1;min-height:0;display:flex`）挂进 flex 容器；直接放进普通容器会塌成 0 高、详情空白（2026-09-28 抽屉栈重构踩过）。抽屉内 列表→设备→任务 三级导航栈见 `plan/2026-09-28-region-chrome-nav-motion.md`。

- Company 正式入口位于 A 仪表盘底部；从仪表盘进入两端对话后返回总览，两端同级入口统一位于总览，会话菜单只负责会话操作。路由 source 仅在页面创建时固定，API 显式传递，本端恢复拒绝错来源。Company 不消费 Office 区域/任务/播放入口。见 `plan/2026-10-03-company-readonly-handoff.md`（仓库根）。
- 微信页面卸载会销毁页面包的模块级内存；跨来源导航草稿须放 app globalData，并按 getAgentStorageScope() + source 分区，身份变化清空，不保存长期凭据。Company 返回后重进必须做真实输入/点击验收，纯 helper 断言不能证明此行为。

- 物联助手菜单入口为 `dashboard.vue`。A 首屏的数量只表示 Company 当前接入观察目录；告警是本次读取的历史台账，不代表实时报警。`totalActivePower` 展示 kW 最新功率，不能累加成日用电 kWh；2026-10-13 已移除本地电量演示曲线；电表只读上游接口，目前客户采用临时模拟补数，页面需说明来源，保留实际 readTime 和陈旧标注，不在本地补造缺失记录。核验与上游缺口见 `plan/2026-10-13-upstream-meter-simulation-handoff.md`。详情复用 ObservationCard/DeviceSheet，切换身份或读取失败清理旧概览；正常刷新保留布局。对话 `from=dashboard` 是入口标记；返回以真实页面栈为准，不授予来源或设备权限。

- Company 智慧空调复用现有草案/参数抽屉；页面 source 必须传到 AgentReplySurface → ActionPanel → ActionDraftCard 及 DraftSheetLayer，选择/确认/还原/取消/状态/参数/重核/收尾请求都显式带 Company。不能仅取消 readOnly 遮罩而让 API 缺省落到 Office；来源校验仍由服务端持久化会话决定。Company 观察视频仍未接入；定时/周期空调和只读简报已接入，报告、安排列表与收件箱保持本端来源。

- 周期卡与虚拟发生（2026-10-07）：`repeat` 提案确认仍走原任务接口，之后按 planId 读取 `getTaskPlan`；`mergeTaskPlan` 不改原提案 actions。未来发生 ID 含冒号，深链参数必须 encode/decode；实际 Task 的 occurrence 元数据用于替换旧虚拟链接。现有 Sheet/B6 共用，报告导航使用实际 latestTask.id。验收边界见 `plan/2026-10-07-office-recurring-first-loop-handoff.md`。

- 2026-10-07 业务补齐：收件箱为常规个人结束消息列表，打开同源原报告成功后标记已读；“我的安排”列表复用同一详情宿主，Company 不跳 Office 区域。Task/Plan 引用只固定身份、保留原输入且不自动发送，发送时 Runtime 读取真实最新事实；恢复/重试保持原轮引用。修改卡承载明确作用域与差异，确认/放弃经 task-changes 同源接口。

- 任务入口性能（2026-10-09）：工作台在区域/日期确定后同时读取日历与时间轴，不等时间轴返回才发起日历请求；两路仍独立校验身份、区域、可见性与请求代次。安排/周期/收件箱的等待主要来自Runtime fresh目录的串行读取，已并行并只合并同身份同来源在途GET，不以旧权限缓存替代。实测与真机边界见 `plan/2026-10-09-task-entry-performance-handoff.md`。

## 导航与状态恢复（2026-10-07）

- 安全历史列表与详情共用单层 Sheet，历史组件宿主也须 `flex:1;min-height:0;display:flex`，否则筛选可见而 scroll-view 高度为零。三类独立台账及旧 flooding 引用规则见 `plan/2026-10-09-safety-history-handoff.md`；目录/摘要失败不应禁用独立历史入口。

- 修改页面返回、Sheet、搜索、参数或日历时先读 `plan/2026-10-07-assistant-navigation-improvement-spec.md` 与对应 handoff。三个路由共用 `AssistantNav`；实际历史决定上一页，无历史由 `navigation.mjs` redirect 到默认父页。工作台新建任务定位 Office，source 在页面创建时固定。
- `NativeBackBoundary` 只承接微信返回，视觉仍由 DeviceSheet 的 transform/opacity 绘制。设备抽屉统一消费 日历→设备/任务 pane→搜索→关闭；日历通过暴露的 dismiss 方法交给所属抽屉，避免再独立挂返回容器。左侧返回退局部一层，右侧 X 关闭整层。
- onHide 暂停请求/刷新并保留浏览位置；onUnload 释放。恢复前与异步响应写入前都复核身份 scope；换身份立即清除旧会话、任务、目录和编辑状态。同身份的旧内容只用于退出动画/暂存，授权拒绝应清除，网络失败须显示重试。
- 对话阅读位置、原新消息草稿和正在编辑的旧消息分开，按 scope+source 存 app globalData，并以 conversationId/turnId 校验恢复。参数脏值离开需明确放弃；保存返回原搜索/列表，失败留在原处。确认失败保留面板并读取权威回执。
- 跨页入口有防连点与立即反馈；草案编辑抽屉首次使用才挂载。微信自动化要等待真实页面栈变化并核对画面；组件选择器成功不等于点击成功，夹具不能作为真实设备/真机证据。

- 常规安排/报告单层切换保留列表节点时，用显式 inline display:none/flex；微信把 v-show 编译为 hidden，带 display:flex 的 view 会继续显示，导致列表与报告同时占高度（2026-10-07 实际走查）。复验必须确认运行 WXML 已更新，不能只看磁盘 dist 时间。

- 页面切换性能（2026-10-08）：安排、收件箱、详情和设备抽屉首次打开才挂载；初始open=true的监听需immediate触发读取，不能依赖此前已发生的页面onShow。打开后保留实例，维持退出动画和返回位置。总览并行读取 summary/energy 分区，慢电表不阻塞其余概览；两路响应都核对身份、可见性和 requestId，任一路失败后作废另一旧响应。测量需区分页面出现、对话可用、读数返回，见 `plan/2026-10-08-navigation-performance-handoff.md`。
