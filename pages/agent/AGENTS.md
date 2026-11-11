# Agent Page Notes

- 空调巡检行事实拆分（2026-10-27）：`acInspectionMeta`（observation-view.mjs）统一生成行文案——`adjusted` 只写「已下发调到X℃」（指令事实，X 取该检查点 criteria 的目标温度），调后温度只写 `afterSetpoint` 平台回读值并标注「平台回读」，缺回读不补温度；聚合行 `acReportDeviceRows` 的 after 同样写「平台回读 X℃」或「目标 X℃」。平台影子可能是指令回声或与现场面板不一致（半度设定、事后改回），禁止把指令目标写成设备实际结果。回归见 `test/agent-observation.test.mjs`。

- 任务展示（2026-11-09）：统一经`task-presentation.mjs`生成状态，摘要`completed`只写“已结束”；详情从设备事实投影：有回传才写“已完成/已检查”，无回传（`dispatched`/`unconfirmed`/`unknown`/`unavailable`）一律写“已下发”；`satisfied`与`verified`/`observed`只表达内部完成状态，不再向用户输出“无需调整”或结果说明行，历史任务中已落盘的重复说明也由`deviceResultReason`过滤；只有`failed/partial/missed/interrupted`标异常并展示原因；全有确认依据才写“已完成”，不改原状态；完成/颜色不能比较中文字符串；没有证据不能写完成。设备原因只在真实失败时展示，不追加“以现场为准/无法确认”一类兜底句，不贴原始 JSON；服务端返回的文字原因仍保留。错误默认简短中性，`TaskIssueDetails`在同一Sheet内显示可滚动/复制的原始原因；原因页组件宿主须显式`height:0;min-height:0;flex:1;display:flex;flex-direction:column`，否则微信虽有文本节点但视口为0；已有顶部返回时用`back-in-header`。宿主`back()`优先退原因页，保留任务节点与位置。长任务先显示最近3次，全部记录可展开；规则只显示一次，创建资料进更多信息。汇总分类可能重叠，不相加做进度。详见`plan/2026-10-26-task-presentation-audit.md`。

- 修改同轮系统续接或恢复正文时，终稿写入所属条目，后续run保留旧正文；创建POST在途允许原卡恢复轮询，完成后的迟到快照按epoch丢弃。公共回归与已验边界见 `plan/2026-10-26-agent-continuation-01-handoff.md`。

- 能耗接口的 `comparison.currentDay` 指最新采样日；只有其 `date` 等于上海当日时才能展示“今日至今”或今日对比。旧采样保持原日期，不用旧日数值冒充今天。诊断与未验边界见 `plan/2026-10-26-energy-stale-sample-handoff.md`。

- 检查点产物仅在所属阶段增加 `phase.report` 行，现有任务收件箱仍先打开任务。任务详情宿主统一用 `TaskResultContent`，在同一 Sheet 内按依据→报告→原任务返回；任务节点保持挂载并暂停轮询。预览、引用、PDF 只读保存事实，引用保留草稿且不自动发送；Office 设备时间轴保持原来源，不因共用宿主新增 Company 导航。维护与验收见 `plan/2026-10-15-company-checkpoint-production-handoff.md`。

- 告警监控候选提供直播/回放；回放展开后清空`scroll-into-view`、await nextTick再定位表单，保证同一目标重复点击仍滚动。安全录像卡保留用户两种选择，`safetyContext.occurredAt`经WebView传`eventTime`供标记，直播仍保留原录像窗口；见`plan/2026-10-14-safety-video-controls-handoff.md`。

- 公司 Agent 由仪表盘右下角浮层承载：`CompanyAgentFloat.vue`（常驻 orb + 全宽底片面板，展开约至导航栏下沿，orb 停靠面板右上角沿兼任收起把手，点遮罩同样收起）。会话主体是 `AgentConversation.vue`——office 页面（index.vue）与公司浮层共用；`source` 与引用/预填上下文经 props + `setReference`/`prefill` 注入，页面生命周期由宿主 `active` prop 驱动（false=收起/隐藏：保草稿、停轮询、不中止在途流，浮标上亮运行环与未读角标）。`index.vue` 只保留 office 宿主；`source=company`/告警/引用/窗口参数重定向到仪表盘解析（`context-link.mjs`）。浮层首次挂载与页面 `onMounted` 同拍时，子组件实例要等 setData 往返才出现：深链 payload 必须先暂存，`watch(conv)` 出现后再交付；只 `await nextTick()` 会静默丢掉引用/预填（2026-10-28 开发者工具实测）。面板内打开的台账/任务 Sheet 以视口 fixed（z99）盖在浮层（z40-46）之上。会话菜单统一走 `agent-menu.mjs`。公司 Agent 空会话在欢迎副标题下渲染推荐问法 chips（`companySuggestions`，4 条固定文案，原型 `prototypes/proto-composer-suggestions.html` 的 C 变体），点击经 `prefill` 进输入框不直接发送；首个 turn 落位后随 welcome 分支消失，office 侧无此入口。原型资料均位于 `prototypes/`，不注册路由、不参与生产运行。
- 环境历史「向公司 Agent 询问此期间」附结构化`environment_window`引用（`from`/`to`取服务端报告窗口，客户端只带展示`label`），输入区显示引用条；发送时Runtime按当前Company授权重读同一窗口，不信任客户端样本，也不把引用当操作授权。空草稿仍预填问题，已有草稿只询问是否替换、不清掉引用；Office、无时区或反向窗口分别400。电表历史仍是提示词，不在同一改动内。见`plan/2026-10-27-environment-history-quote-reference.md`。
- 客户告警跳转的alertPrompt只进入Company；草稿与引用分开保存，编辑/重试用原turn.reference，当前输入的新引用保持不动。run.started携带原引用供恢复；入口与验收边界见 `plan/2026-10-04-customer-alert-reference-handoff.md`，客户正式回调契约仍待对接。
- 安全台账结构化引用与上述自由文本桥分开：事件身份是 ledger＋eventId，并核对 deviceId；共用 SafetyEventDetail 即时展示带读取时间的快照，稳定身份可立即引用，后台更新不阻塞按钮；发送消息时 Runtime 再按当前目录核验记录，引用本身不代表核验成功或控制授权。仪表盘保留列表节点，返回详情用显式 display:none/block；首次挂载必须触发读取。网络错误保留标注过的旧快照，401/404 清理记录并禁用引用，迟到响应核对 requestId/身份/active。现行行为见 `plan/2026-10-08-independent-reads-lan-handoff.md`。
- 消防搬迁资料：`currentDevice`表示本次核验的当前名称/安装位置，空字段显示未核验；`recordedDeviceName`保留告警原名称。列表重新打开静默更新，摄像头查询返回的同事件资料同步详情，入口明确“按当前位置查找监控”，不把当前位置解释为记录时位置。安全详情/列表/告警行不再展示“当前位置未核验”“显示记录名称”“当前名称未核验”及候选依据/默认回放窗口说明等次级注记；位置仅在已核验时显示，未核验不补占位文案。`cameraNote` 仅保留「未找到候选」类提示与错误，`cameraError`/`cameraNote` 状态与重置需成对维护。

- 微信分块事件的 `data` 是 `ArrayBuffer`，中文 UTF-8 字节可能跨 chunk；所有 NDJSON 解析继续复用 `apis/agent/ndjson.mjs`。
- 正文事件是 `message.delta`（增量，后端已合并，带 `phase`）+ `message.completed`（权威终稿）+ `message.reclassified`；终稿覆盖累积文本。`phase:'draft'` 的增量以过程权重实时落在答复位（`draftText` 条目），无工具调用时由 completed 原地沉淀为终稿色，带工具调用时由 reclassified 折叠为处理记录里的「检索思路」行——已渲染内容不删除、不移位、不重打。一轮答复按事件序渲染为有序条目流（`turn.items`：正文/草稿/观察卡/操作卡/任务卡），卡片可先落位、终稿随后；`tool.started` 对旧协议无 phase 的未收正文同样折叠为思路行而非丢弃。
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
- 开发版 Agent 使用云端 `https://mp-agent.qianc.ltd/api`，客户登录、用户、园区和物联网接口继续走客户公网；`trial/release` 沿现有客户网关。部署与回滚先读根目录 `plan/2026-10-23-runtime-cloud-release-spec.md`。
- 微信编译：HBuilderX `cli launch mp-weixin --compile true` 产出开发版；发行构建使用 HBuilderX 自带 Node，且以其 `uniapp-cli-vite` 目录为工作目录，避免系统 Node 的 V8 缓存不兼容。命令与两套产物路径见根目录 `plan/2026-10-23-all-changes-release-handoff.md`；编译成功不代表已上传微信。
- Agent 页面进入前等待 `utils/agent-session.js` 的会话与园区上下文；页面和组件不得自行拼接 Authorization 或 tenantCode。
- 本目录已是生产 Agent 页面；新业务只在客户主线实现。独立 miniapp 已于 2026-09-24 迁出为同级仓库 `agent-miniapp`，仅用于复现问题，回补时只同步能够证明必要的最小修复。
- 修改区域时间轴原型 `prototypes/proto-region-panel.html` 时，先读 `docs/research/proto-region-panel/b6-timeline-design.md`：它记录唯一设计稿、B4 冻结边界及 B6 的区间、节点、刻痕和时间文字契约。原型不是生产区域面板，多区间重叠仍属探索状态。
- `prototypes/proto-region-workbench.html`（C1）以 B6 为起点探索入口、区域切换、细任务卡、抽屉、设备列表、设备时间轴、日历归属与区域提示；改动前先读 `docs/research/proto-region-panel/c1-workbench-exploration.md`。其中时间轴组件是 B6 分支的移植，几何参数随 B6 契约冻结，只允许替换卡片内容；`prototypes/proto-region-panel.html` 保持冻结作对照。
- 区域工作台接线与验收状态见 `plan/2026-09-27-region-workbench-first-loop-handoff.md`。消息发送/重试/编辑应在修改原轮前固定本次关注区域；本地选区按统一 session 的不可逆身份键分区，区域仅是默认上下文。
- B6 生产几何共用 `timeline-geometry.mjs`；时间节点不承载任务完成状态。微信开发者工具已选 SVG 图片承载图形，普通视图承载时间字与卡片；Canvas 原生图层曾越过滚动裁切边界。空区域按 P2 原型显示局部符号。见 `docs/research/proto-region-panel/2026-09-27-native-renderer-status.md`；实际任务回读仍需真实操作验收。
- 区域工作台的 `region-sample-tasks.mjs` 仅供开发版“查看样例”预览：只读授权目录构造 `sample-*` Task，区域与设备时间轴、任务详情共用同一批任务和设备 ID；结果是虚构的，不能写入 Runtime、确认或控制设备，也不能当真实任务验收。从样例返回时必须重新请求真实时间轴。见 `plan/2026-09-28-region-sample-record-consistency.md`。
- 区域时间轴细卡按 P2 原型放任务名、设备头像和创建者标记；部分完成用黄铜点，失败/错过/中断用红色叉号，执行中用卡片强调，取消态例外保留可见的“已取消”，完整状态与创建者姓名在任务详情中。开发样例仅对齐了 14:00–15:30 / 14:52 的主区间，不是票 02 所需的同数据叠图。见 `plan/2026-09-28-region-timeline-card-alignment.md`。
- 工作台底部“＋ 新建任务”先保留当前关注区域，再回到办公室 Agent 对话，不自动预填文字或提示替换草稿；已有输入按原草稿恢复逻辑保留，真实创建仍走提案确认流。创建者标记按展示名散列着色，本人显示“我”——判定只用任务 `source.draftId/conversationId`（服务端仅对创建者返回），不得在前端比较身份信息。区域 chip 黄铜点是各区域 `attention` 的聚合，进入真实区域仍由服务端确认后清除。
- 区域设备抽屉见 `plan/2026-09-27-region-device-browser-handoff.md`：每次打开重读授权目录（30 秒内同区域同身份复用），目录先于状态显示；标题栏可手动刷新状态，任务阶段收口后约 1 秒自动刷新一次。刷新期间保留布局，失败时清空旧读数但保留目录。类型/位置/状态是互斥分组，搜索才过滤。
- 设备抽屉是**单层 Sheet 内的三级导航栈**（设备列表→设备时间轴→任务详情）：任务详情共用 `TaskDetailContent`，抽屉内打开任务不再叠加第二个 `DeviceSheet`；pane 用 `translateX` push/pop（260ms 抽屉曲线），退场 pane 靠 `closing` 快照多挂 ~300ms。从区域时间轴直开任务仍用独立 `TaskDetailSheet`（页面上只有一层）。
- 观察设备（video/environment/energy/safety）在抽屉与回复面都是**只读事实呈现**：视频显示「在线/离线/在线状态未知」不套用开-关；状态分组并入「仅观察」；点击进 `DeviceObservationView` 观察 pane（不落空时间轴）。`observation.reported` 事件把本轮只读读数快照挂到 `turn.observations` 由 `ObservationCard` 逐块呈现（视频在线点 +「查看画面」、环境读数带来源标注、能耗最新已知读数带时间、安全仅告警台账、告警记录不展示 `report` 上报属性或相关标记/说明）。「查看画面」走 `video-player.js`：先 `getVideoStream` 现取短时效地址再经 `pages/webView` 打开 `config.videoPlayerUrl`（客户域 H5，token/tenantCode 由 webView 注入契约供给）；地址未配置时按钮置灰「播放页接入中」；取流失败 ≠ 播放失败 ≠ 离线，三态分开表达。生产 H5 交付物在 `deploy/h5player/index.html`，客户确认部署路径后填地址并验收真机播放。环境历史趋势用 `energy-chart.mjs` 的 `trendLineChart` 折线（玉绿线+淡面积；相邻间隔超中位 2.5 倍断段，缺测不连；稀疏留顶点小点、密集只留线；孤立单点段恒画点；选中黄铜点），不再画散点。
- 无状态设备呈现（2026-11-11）：`hasDeviceState`集中区分本项目支持状态读数的设备类型。门禁、仅台账安全设备不显示状态/采样占位或状态色点；门禁不归入“状态未知”组。观察详情缺读数只在正文提示，顶部仅显示有效事实；草案按支持状态的设备过滤缺测名单，真实失败、离线、采样时间及执行回执保留，不改后端事实或控制规则。
- 电表业务只有统计与对比，改动先读 `.scratch/meter-scope-time/spec.md` 与对应票据；旧 `plan/2026-10-13-meter-business-redesign.md` 已被取代。`MeterReportCard` 渲染 `meter_report`：时间跨度、计量范围独立显示，数值用度，金额按目录电价估算。缺测、回退、停报与读取不全是覆盖问题；无有效数据显示不可计算，不补零。时间对比固定范围，区域对比固定跨度，跨层级或台数不同的曲线用单台平均，小时数据不足自动退回分段双柱。
- 同环比为两张独立对比卡，不合并为“报告产物”；不涉及另一线程的产物、保存分发与通知。`params.relation` 区分用电同比/环比/时间对比，同比图例与表头为去年同期，跨年份的两期参数必须显示年份。单侧有效主数字明确标为本期/基期用电，不冒充变化量；参数行允许换行，时间与范围不能被省略号遮掉。
- Agent电表卡片数值至多两位小数，差额/比例/颜色按可见舍入结果判断，禁止带符号零；共用贡献SVG的精度回调仅由Agent报告传入，不改变仪表盘图表默认值。两期均无有效小时曲线时只展示分段，隐藏无效切换；两类图都无数据时隐藏图槽。同实例换报告须纠正选中视图。日均贡献只按 `contribution.unit:'度/日'` 标记解释，历史无标记贡献保留累计口径。
- 新电表报告卡 `MeterReportCard` 只在 Agent 会话中使用，视图模型为 `meter-report-view.mjs`，图表复用 `energy-chart.mjs`；组件内不另写 SVG 几何。指标定义说明采用绝对定位局部浮层（不占文档流、不推挤图表与指标行）；带 `nightWindow:'20:00-08:00'` 的新报告显示“夜间负荷”及双段夜间底带，旧报告保持原“夜间基荷”与 00–06 底带。两期有效时长不等时对比主数字按日均（`度/日`）显示，副行带各自总量与有效天数；单侧有效时隐藏空贡献图；完全无有效数据的 `meter_report` 块由 `ObservationCard` 过滤，不渲染空卡片。参数行可看逐表依据与固定期间的电表统计，单层导航保持真实起止时刻，统计窗口包含明确基期。`energy_comparison`、`company_energy`、`energy_report` 的旧卡仅供历史恢复与引用，保留原口径；追问用保存事实并由 Runtime 复核所有参与对照的表的当前授权。所有经 `image` 承载的 SVG（`energy-chart.mjs`、`timeline-svg.mjs`）根节点必须 `preserveAspectRatio="none"`：超宽图在原生栅格化按默认 meet 居中，整图右移左侧留白（2026-10-20 模拟器实测复现，291 列同比图即中招）。微信真机交互另行验收，源码与编译不代替验收。
- 电表统计浏览复用 `CompanyEnergySheet` 内容页；`MeterHistoryView` 只承接固定单表与 `[from,to)`。日期、月份、现在按钮和日柱请求均在既定范围内，迟到上下文重新初始化；有界单表投影服务端日分段并明示口径，首页08:00采样日保持原样。首开等统一会话就绪；关闭、隐藏、换身份使旧响应失效，缺数与读取失败分开。界面回归沿真实组件夹具，微信编译不等于原生交互验收。
- 环境历史趋势最多180个上海自然日（含首尾），日期起点不得早于后端`availableWindow.from`的上海日期；边界未就绪或无历史时禁用日期控件，不从选中窗口的coverage猜全局起点。旧区间越界后纠正并重读，身份变化清边界。`resolution=auto`按1–2天原始、3–14天3小时均值、15–180天日均；主读数与图中所选点同口径，最新原始采样与原始峰值独立保留。空桶断线且可选，不跳到其他有效时段；均值、最低/最高和有效条数在图上方展示。询问动作跟随内容滚动，不在裁切边缘隐藏明细；独立历史卡保留日期上下文。横轴按实际宽度避让并保留首尾日期，不拉伸填补缺测。
- 安全台账日期下限只取后端当前授权／类别的`availableWindow.from`（上海日期），默认及重置为该日起至上海今天；换类别或身份清旧边界，缺边界禁用日期选择。首页台账失败不能显示为0条，完整数量取后端汇总而非预览条数。
- 尚未开始的环境聚合时段不计为缺测；选中它显示“该时段尚未开始”，不能因没有值跳到已发生的时段。缺测、未来时段与合法零值必须分开。
- 区域时间轴日历与任务详情见 `plan/2026-09-27-region-task-browse-handoff.md`：空日期仍保留日历，月标记失败单独提示；Task 详情的 `details.receipt/fields/timedOut` 必须参与结果文案，不能仅看总体 outcome。多设备阶段按 P2/D1 显示可展开设备组，单设备结果直接可见；见 `plan/2026-09-28-task-phase-disclosure.md`。开发版双阶段样例不属于真实任务。点击日期定位到该日第一个任务卡（跨日任务只在开始日计数），该日无任务才停在 00:00；选中日任务晚到时在第一张卡出现后补一次定位，之后的静默刷新不得再抢回视口。
- 设备时间轴见 `plan/2026-09-27-device-timeline-handoff.md`：`DeviceTimelineView` 必须包在 `DeviceSheet` 的 flex 子容器中，并保持 `timeline-area` 的 `height:0; flex:1; min-height:0`，否则微信 `scroll-view` 高度会等于全部内容，定位记录失效。设备选择只保存 ID，详情始终从最新读数派生；真实与本地演示记录严格分开。紧凑日历是浮在时间轴左上角的 `datefloat` 日期 chip + `cal-float` 浮层 pill（绝对定位、不占布局、点遮罩或选日收起）；区域常驻日历保持 inline 周条，点头展开月视图（箭头只在展开时出现）。两阶段任务只取消后续阶段时，设备记录须同时保留已发生阶段的结果和后续取消事实，不能统称“已取消”。见 `plan/2026-09-28-device-calendar-disclosure.md` 与 `plan/2026-09-28-device-cancelled-stage-receipt.md`。
- 定时 Task 提案在对话中使用 `TaskProposalCard`：流事件 `task.proposed/task.resolved` 和恢复快照 `turn.task` 共用 taskId；只有点击“创建任务”才调用确认接口。`scheduled/executing` 状态持续按 Task 详情轮询，终态停止；“放弃”只退役提案，不能误显示成已创建任务。工作台深链必须在授权时间轴返回目标 Task 后打开详情，见 `plan/2026-09-28-task-workbench-deeplink.md`。跨日任务仍在每天的区域时间轴显示，绘图只裁切当前日视口，不改变原始阶段时间或同日 B6 几何。微信端验收由用户完成。
- 到点执行后区域时间轴在页面可见时静默刷新，任务抽屉仅对 `scheduled/executing` 轮询详情；刷新不可清空旧卡片造成闪烁。阶段结果显示 `satisfied/verified/partial/failed/unconfirmed/missed/interrupted`，401 失败原因显示“创建者登录已失效”；设备记录以每个阶段实际结果为准，不把平台受理改写成物理完成。
- Office 定时 Task 可选 `interval` 独立起止与 ≥1 自由检查点（无两点业务上限）；确认后由正常扫描完整执行各点、不自主补终点控制。内部区分 `executing`+`executionActive:false`（等待下次操作）与 `executionActive:true`（设备调用中），两者前台均显示“进行中”；`report` 只在终态后由已持久化事实生成，设备按当前授权裁剪、台数按可见唯一设备统计。任务轮询经 `mergeTaskDetail` 合并：提案阶段可能只有 `at`/`actions`，先按 `at` 对齐再写 `id` 与 status，不得用详情的 devices 形状覆盖 actions；取消提案 `phases` 可为空，区域导航锚点取 `interval.startsAt` 或首阶段时间。沿用宿主 flex/`TaskDetailSheet`/B6 几何，报告渲染不调用模型。
- 工作台删除任务使用任务详情 `canCancel` 与 `version`，二次确认后调用取消接口；403/409 保留抽屉并刷新详情。区域时间轴隐藏已取消任务及轨道，记录数量也排除它们；历史和设备实际操作记录保留，未下发设备不得显示为故障。小程序交互验收由用户完成。
- Agent `list_tasks` 只读查询授权区域的某一天；取消必须先列出准确任务，再生成独立 `task.cancellation.proposed` 卡。卡片 `cancellationId` 与目标 `taskId` 不同；会话恢复按前者去重，保留原创建收据。确认调用取消提案接口，放弃/新消息/过期只退役提案；任务状态由真实 Task 详情驱动。
- 区域列表的 `attention` 只表示当前身份尚未查看的部分完成/失败/未核验任务，不能拿运行中状态或装饰圆点充当提示。进入/切换真实区域调用 `acknowledgeRegion`，只有服务端确认后清除本地提示；样例模式不得更新真实水位。工作台可见时常态 30 秒、任务执行中 5 秒刷新，隐藏后停止；小程序交互验收由用户完成。
- Task 详情独立读取当前授权照明现态，显示在执行收据之外；Office `switchStatus` 缺少执行时上报时间，当前显示“开启”不能把历史 `unconfirmed` 改成 `verified/completed`。现态读取失败不应抹掉任务收据。草案卡也只能根据本次回执及执行时回读决定结果标签，不能根据后来刷新到的现态把 `ACCEPTED` 改成“已达到目标”；所有现态查询不得用执行快照覆盖。
- 现态手动与执行后的延迟刷新共用`state-refresh.mjs`，只读设备状态，不等于定时轮询。2026-11-06按用户最新决定：不显示未知采样/同步/读数时间、旧状态一类辅助注记，缺时间保留null、不补当前时间；实际读取失败与影响计算的缺数仍如实表达。首页环境卡不单列采样行，详情仅显示确有值的真实时间；HTTP、NDJSON恢复、区域与草案仍保留`status/missingDeviceIds/observedAtByDevice/cache`，当前状态不改写历史回执。微信真实界面验收见后端`.scratch/local-data-sync/`，编译/夹具不能代替。
- 环境历史合页与选中身份统一经`domains/observations/environment-history.mjs`：来源ID不足以唯一标识样本，须保留时间、代码及缺ID命名空间。未知时间不画成当前点，明确null值保留为曲线断点，分页未完/缺行/质量异常不得被合页改成完整。只有完整覆盖且确实无样本才显示无采样；实际错误与质量原因可提示，不追加后台更新注记。工程/微信验收边界见后端`.scratch/local-data-sync/issues/06-environment-history.md`。
- 工作台只在真实时间轴成功返回且完成视图更新后调用 `acknowledgeRegion`；加载失败、样例模式、隐藏页面或被新请求替代的结果不得清除异常提示。
- `TaskDetailContent` 根节点是 `height:0;flex:1` 的 scroll-view，必须经宿主类（`content-host`/`task-content-host`，`flex:1;min-height:0;display:flex`）挂进 flex 容器；直接放进普通容器会塌成 0 高、详情空白（2026-09-28 抽屉栈重构踩过）。抽屉内 列表→设备→任务 三级导航栈见 `plan/2026-09-28-region-chrome-nav-motion.md`。
- 任务报告的节能行沿 `report.summary.energyImpact` 投影：只有至少一台设备实际调温后，服务端才生成节能块；全程关机、非制冷、已满足、只读巡检、调温前失败/取消时 `energyImpact` 为 `null`，详情和通知不显示该行。`basis:"assumption"` 的估算由服务端按各设备首次调温检查点记录的调前 `setpoint` 与公开假设参数（节电率/单台功率/电价）确定性计算，窗口截至 `min(任务区间终点, 报告生成时间)`；`energyImpactView` 按原型 `proto-energy-estimate.html` A 变体投影为节能卡：`hero`（≈度数大数字、说明脚注）+ 三格事实 + `formula` 公式与依据说明 + 设备调温前后行（`ac_inspection` 块聚合，adjusted 优先，before 取首次出现的调前 `setpoint`，超过 6 台折叠为「见检查点明细」）；`unavailable` 态走同款卡片版式（口径缺失徽标、纳入/调节/无需三格、已确认事实行）。估算标记与非实测说明常驻，详细公式由“计算说明”展开；`measured`/`statistics` 仍为单行口径文字。已调温但基线缺失或时长不足时显示明确的不可估算原因，不得由前端或模型补数字。

- Company 正式入口位于 A 仪表盘底部；从仪表盘进入两端对话后返回总览，两端同级入口统一位于总览，会话菜单只负责会话操作。路由 source 仅在页面创建时固定，API 显式传递，本端恢复拒绝错来源。Company 不消费 Office 区域/任务/播放入口。见 `plan/2026-10-03-company-readonly-handoff.md`（仓库根）。
- 微信页面卸载会销毁页面包的模块级内存；跨来源导航草稿须放 app globalData，并按 getAgentStorageScope() + source 分区，身份变化清空，不保存长期凭据。Company 返回后重进必须做真实输入/点击验收，纯 helper 断言不能证明此行为。

- 物联助手菜单入口为 `dashboard.vue`，首屏有**精简/详细**两种模式（顶部 segmented，默认精简，偏好存 `agent-dashboard-mode`）。精简模式为状态灯 + 2×2 状态块（原型 `proto-dashboard-directions.html` E 变体）：全部投影自已加载的概览/能耗/目录快照，唯一新增读取是 `listAgentTasks` 任务议程；安全块只按最近一条台账是否在近 30 天内给「有记录」，不暗示实时；能耗对比仅在上一个完整计量日存在时给差值，缺数显示「—」；状态灯汇总环境/用电/安全的注意项与分区错误。六个块点击进入原详情（环境趋势/能耗面板/安全台账/任务中心），「设备」（开 `CompanyDeviceDrawer` 全量目录，`drawerKind='catalog'`）与「通知」（进 TaskListSheet inbox 视图，未读数随议程请求一并由 `listNotifications` 取得，失败静默）同为状态块。详细模式为原晨报式：问候（`/account/me` 无 `name` 字段，真实姓名取 `userInfo.personalName`，再回退 name/nickname/脱敏手机号，`code` 是 openid 永不展示）、分类设备计数（`GET /api/agent/device-catalog?source=company`，覆盖 environment/energy/safety/ac/lighting/access/video 全部类别，点某类开单类设备抽屉，行只读无操作）、环境传感器、能耗统计、安全台账、自动化安排与双 Agent 入口；告警是本次读取的历史台账，不代表实时报警。设备图片统一走 `device-art/catalog.js` 的 `resolveDeviceArtwork`（位图素材 + video/observe/generic CSS 兜底），与区域抽屉同规，不得另造分类图标。
- 设备目录是后端持久化、后台同步的公司完整展示记录；旧`company-devices`是用户可见目录，继续服务授权业务。首页总数、分类及全部/单类明细统一读取新目录，不能回退旧数量，也不能把完整目录的底层ID用于状态、控制或任务。抽屉只展示位置/类型，不按类型宣称可控制；同步时间仍取后端`cache.updatedAt`。规格与证据见同级后端`.scratch/device-catalog/README.md`。
- 设备目录搜索与分组（2026-11-11）：区域、公司全量与单类目录共用`DeviceDirectoryControls`；搜索返回清空查询，关闭或换类别重置，设备详情返回保留查询。公司目录由`lib/dashboard.mjs`入口在后端目录数据到达时准备位置／类型两套分组、检索文本和展示字段；切换只选择现成分组，保留来源顺序，不在点击时排序、重新分类或计算图片。筛选以稳定设备键匹配分组，不依赖对象引用相同；不新增请求或改变授权及同步时间口径。
- 能耗统计：`GET /api/agent/company-energy-daily` 返回按 08:00 采样日边界差分的逐日用量、逐表 `daily` 明细、`comparison`（今日至今 vs 昨日同期/上周同日同期，含逐表 `meterUsage`）与逐日 `elapsedUsage`（与今日至今同一 elapsed 窗口的当日用量，供"vs 今日"公平对比——只拿所选日同时段对今日至今，不拿完整日比未过完的今天）。诚实口径：usage=null 显示「—」不补零不取绝对值；本项目末端表计量已确认，`basis.unit` 恒为 `'kWh'`（界面显示「度」）、`aggregation.status` 为 `verified`、默认 label 为 `当前授权电表合计`，已配置 policy 仍沿其 label/version/倍率；policy 中任何表脱离当前授权目录则整次请求失败，不回退旧口径。同窗口内回退/同刻冲突的表不计入增量，归入覆盖问题而非零值。`CompanyEnergyStrip` 为共享横滑日柱（斜排日期、选中居中、左端 `reach-left` 向前拼窗并 `didPrepend` 位移补偿）；首屏条带 `pull-enabled` 才开拉环（拉满松手开 `CompanyEnergySheet`），面板内条带不开。面板复用 `RegionCalendar` 跳远日期，`focus-date` 深链选中并自动补齐窗口。`CompanyEnergySheet`/`CompanyDeviceDrawer` 等挂在 `.sheet-body` 里的组件标签必须带 `class="event-host"`——组件在 mp-weixin 是真实 host 节点，无宿主 flex 约束时内部 `flex:1` 失效、scroll-view 等于内容高无法滚动；scroll-view 本体同步 `height:0; flex:1; min-height:0`（同 `TaskDetailContent` 规则）。同期对比在补数期 08:00/20:00 采样节奏下可能无实测边界——两侧任一为 null 即显示「—」，不得估算。领域事实见 `docs/research/2026-10-14-company-energy-domain-facts.md`。楼层/区域构成以权威位置优先：`meterRows`/`compositionFromUsage` 先取 `location`（上游 areaName，正报口径同 `meter.areaName || meter.name`），表名只在无位置时兜底；名称不含楼层的表（如“农旅办公室电表”，areaName=26楼农旅办公室）必须归入 26 楼，不得拆去“农旅”分组。详情复用 ObservationCard/DeviceSheet，切换身份或读取失败清理旧概览；正常刷新保留布局。Agent 报告卡的单表依据与原始采样由 `MeterReportDetails` 承载，单层导航（依据清单→原始采样，`back()` 逐级回退，不叠第二个 Sheet）；单表详情的功率因数行经 `meterReportPowerFactor` 生成，为采样点均值非时段平均。对话 `from=dashboard` 是入口标记；返回以真实页面栈为准，不授予来源或设备权限。

- Company 智慧空调复用现有草案/参数抽屉；页面 source 必须传到 AgentReplySurface → ActionPanel → ActionDraftCard 及 DraftSheetLayer，选择/确认/还原/取消/状态/参数/重核/收尾请求都显式带 Company。不能仅取消 readOnly 遮罩而让 API 缺省落到 Office；来源校验仍由服务端持久化会话决定。Company 观察视频仍未接入；定时/周期空调和只读简报已接入，报告、安排列表与收件箱保持本端来源。

- 周期卡与虚拟发生（2026-10-07）：`repeat` 提案确认仍走原任务接口，之后按 planId 读取 `getTaskPlan`；`mergeTaskPlan` 不改原提案 actions。未来发生 ID 含冒号，深链参数必须 encode/decode；实际 Task 的 occurrence 元数据用于替换旧虚拟链接。现有 Sheet/B6 共用，报告导航使用实际 latestTask.id。验收边界见 `plan/2026-10-07-office-recurring-first-loop-handoff.md`。
- 周期计划启停（2026-10-20）：`TaskListSheet` 与 `TaskDetailContent` 共用 `/agent/task-plans/:id/status`；手动停用只影响未来发生，当前 Task 不回滚。重新启用必须由用户确认，并由 Runtime fresh 重核完整目录、原目标与控制绑定。系统失效统一由 scanner 在当前 phase 收口后调用 `store.disablePlanForPhase`，不在前端或其他票据中复制通知/停用逻辑。

- 2026-10-07 业务补齐：收件箱为常规个人结束消息列表，打开同源原报告成功后标记已读；“我的安排”列表复用同一详情宿主，Company 不跳 Office 区域。Task/Plan 引用只固定身份、保留原输入且不自动发送，发送时 Runtime 读取真实最新事实；恢复/重试保持原轮引用。修改卡承载明确作用域与差异，确认/放弃经 task-changes 同源接口。

- 任务入口性能（2026-10-09）：工作台在区域/日期确定后同时读取日历与时间轴，不等时间轴返回才发起日历请求；两路仍独立校验身份、区域、可见性与请求代次。安排/周期/收件箱的等待主要来自Runtime fresh目录的串行读取，已并行并只合并同身份同来源在途GET，不以旧权限缓存替代。实测与真机边界见 `plan/2026-10-09-task-entry-performance-handoff.md`。

## 导航与状态恢复（2026-10-07）

- 安全历史列表与详情共用单层 Sheet，历史组件宿主也须 `flex:1;min-height:0;display:flex`，否则筛选可见而 scroll-view 高度为零。三类独立台账及旧 flooding 引用规则见 `plan/2026-10-09-safety-history-handoff.md`；目录/摘要失败不应禁用独立历史入口。列表通过统一缓存复用60秒；重读已加载范围时仍按每页20条沿游标读取，不能把已加载总条数改作首屏limit，否则详情返回无法复用分页缓存。见 `plan/2026-10-26-safety-ledger-cache-diagnosis-handoff.md`。

- 修改页面返回、Sheet、搜索、参数或日历时先读 `plan/2026-10-07-assistant-navigation-improvement-spec.md` 与对应 handoff。三个路由共用 `AssistantNav`；实际历史决定上一页，无历史由 `navigation.mjs` redirect 到默认父页。工作台新建任务定位 Office，source 在页面创建时固定。
- 修改普通读取、取消、缓存作废或错误通知时，沿用 `lib/reads.mjs` 与既有领域入口；先读 [ADR0008 普通读取的视图归属](../../docs/adr/0008-agent-page-deep-module-architecture.md#2026-11-07普通读取的视图归属)。成功、失败、收尾统一提交，领域读取模型不直接通知；控制及会话流保留业务生命周期。
- `NativeBackBoundary` 只承接微信返回，视觉仍由 DeviceSheet 的 transform/opacity 绘制。设备抽屉统一消费 日历→设备/任务 pane→搜索→关闭；日历通过暴露的 dismiss 方法交给所属抽屉，避免再独立挂返回容器。左侧返回退局部一层，右侧 X 关闭整层。
- onHide 暂停请求/刷新并保留浏览位置；onUnload 释放。恢复前与异步响应写入前都复核身份 scope；换身份立即清除旧会话、任务、目录和编辑状态。同身份的旧内容只用于退出动画/暂存，授权拒绝应清除，网络失败须显示重试。
- 对话阅读位置、原新消息草稿和正在编辑的旧消息分开，按 scope+source 存 app globalData，并以 conversationId/turnId 校验恢复。参数脏值离开需明确放弃；保存返回原搜索/列表，失败留在原处。确认失败保留面板并读取权威回执。
- 跨页入口有防连点与立即反馈；草案编辑抽屉首次使用才挂载。微信自动化要等待真实页面栈变化并核对画面；组件选择器成功不等于点击成功，夹具不能作为真实设备/真机证据。

- 常规安排/报告单层切换保留列表节点时，用显式 inline display:none/flex；微信把 v-show 编译为 hidden，带 display:flex 的 view 会继续显示，导致列表与报告同时占高度（2026-10-07 实际走查）。复验必须确认运行 WXML 已更新，不能只看磁盘 dist 时间。

- 页面切换性能（2026-10-08）：安排、收件箱、详情和设备抽屉首次打开才挂载；初始open=true的监听需immediate触发读取，不能依赖此前已发生的页面onShow。打开后保留实例，维持退出动画和返回位置。总览并行读取 summary/energy 分区，慢电表不阻塞其余概览；两路响应都核对身份、可见性和 requestId，任一路失败后作废另一旧响应。测量需区分页面出现、对话可用、读数返回，见 `plan/2026-10-08-navigation-performance-handoff.md`。

### 区域时间轴首屏加载

选中日期任务优先于相邻日期预加载。未取得该日快照前不能显示 0 条记录；已有记录在静默刷新时保留。旧区域/日期请求不得结束新页面的加载提示，需同时核对区域、日期、身份和请求序号。见 `plan/2026-10-13-region-timeline-loading-handoff.md`。

跨日时间轴按具体记录ID合并，保留较新version后再排除取消项；同一计划不同发生日有独立ID，不按planId折叠。后端逐日结果不能包含查询窗口外的普通即时历史；回归同时覆盖真实跨日区间。

- 2026-10-13 双 Agent 周期详情直接提供“取消本次/取消全部”，不使用“管理整个周期”引用替代取消。虚拟本次走计划 skip，实际本次走 Task cancel；全部走计划直接取消接口并取消剩余实际检查点。取消成功返回上一层并刷新，来源显式传递。见 `plan/2026-10-13-simple-task-cancellation-handoff.md`。
- 会话主体挂在真实组件 host 的横向 flex 容器时，根节点 .conv-root 必须保留 min-width:0；否则内容的 min-content 宽度会撑大整条会话，连正文、卡片和输入框一起越过视口。修改后在微信开发者工具读取 host/root/composer 的实际边界并核对长报告，不以编译成功替代布局验收。

- 业务错误展示（2026-10-15）：请求层保留服务端原因/编号，缺正文时显示 HTTP 状态和未提供原因；PDF下载通过 `downloadHttpError` 读取错误临时文件。页面保留实际错误字符串，完整原因使用正文或系统弹窗，不丢弃原因或只留被截断的toast。任务日历主区域用紧凑的“任务暂未加载/更新”及重试，完整服务端原因/编号通过“查看原因”系统弹窗呈现；失败不能显示为成功空日程。日历错误沿组件链传字符串，身份/区域切换仍丢弃迟到响应。规则与验证见 `plan/2026-10-15-business-failure-reasons-handoff.md`。
- 日历错误属性只用 `String`、默认空串；禁止 `[Boolean, String]`，Vue 会将表示成功的 `''` 转为 `true`，造成请求成功仍报错且重试不消失。设备日历 catch 保留实际原因，不能只置布尔值。复验需覆盖成功空串、失败原因及同月重试恢复标记。

- Agent每日夜间报告以`params.dailyWindow`区分普通期间统计：主值/分段/排名为20:00→次日08:00用电，日柱及峰值夜间按08:00结束日标记；不显示全天位置占比/小时曲线。缺测主值为“已取得夜间用电”，依据行显示有效/预计夜数及同日占比；历史无标记报告不改口径。见plan/2026-10-15-night-energy-analysis-fix.md。

- 首页月度对比（2026-10-20 修正）：日柱下方复用 `MonthlyEnergyComparison`，每月1日08:00起算，截止上海时间已到达的08:00/20:00采样；日统计最新采样允许落后一个周期，凌晨保留前晚20:00，跨月不能切回上月。左右环比/同比采用同日同刻；日期与投影统一走 `monthly-energy-view.mjs`。月初首个区间未形成属于等待采样，不能显示异常重试。点击环比/同比整块展开同一 `DeviceSheet` 的全部逐表对比，直接按ID配对已载入响应，按增量排序；缺数保留且零基期不算百分比，隐藏/刷新关闭明细，授权失效清空整组统计；同身份短时复用遵循下方首页缓存约定，不逐表追加请求。加载时按期独立显示流光骨架，未返回与真实缺数斜纹分开；禁用对比按钮也须显式透明，避免微信默认白底，动画遵守减少动态效果偏好。采样确实缺失或授权表集不同仍保留缺数态；旧区域饼环不再承担首页对比。短月、身份/显隐及验证边界见 `plan/2026-10-19-monthly-energy-dashboard-handoff.md`。

- Company任务中心：2026-10-22 重做为「全部任务/日历」+顶栏通知中心，仪表盘任务块为「接下来」小议程，入口/叠层/启停语义见 `../../plan/2026-10-22-task-center-redesign-handoff.md`；原日历轮约定见 `../../plan/2026-10-19-task-calendar-production.md`。自然日按上海00:00划分，周期投影参与日程；`TaskInboxContent`（通知中心）复用消息→任务→报告与成功读取后已读。确认成功经tasks-changed刷新宿主；新查询不得先清空同身份快照，身份变化立即清空。

- 能耗详情选日（2026-10-20）：同身份重开保留选日，历史空数据不改选今天；“现在”允许上海今天，今日至今只用comparison.currentDay及同窗对比。历史合并不覆盖最新比较上下文，迟到请求不重定位新选日；truncated缺数显示读取失败并允许重新请求，不能冒充普通无数据。见 `../../plan/2026-10-20-meter-history-navigation-fix.md`。

- 首页缓存（2026-10-20）：Company概览、目录、逐日与期间统计使用apis/agent/agent-read-cache.mjs同身份内存缓存，60秒内复用并合并在途，最多40项；过期快照最多保留5分钟作后台刷新占位。刷新按钮强制绕过，换Token/园区、401/403或确认/取消控制与任务时清理；失败/截断结果不延长有效期。月度对比隐藏时保留同身份快照，重新展示不清空闪烁。任务日历的月窗口自 2026-10-28 起同样进入这层快照（见下条）；关闭任务抽屉不算业务变更。见 `../../plan/2026-10-20-company-overview-cache-handoff.md`。
- 精简/详细模式切换（2026-10-27）：`dashboard.vue` 两个分支常驻，只切 inline `display`（详细子树首次展示才挂载 `detailMounted`，微信不能依赖 `v-show`/`hidden`），切模式不再销毁重建日柱、月度对比与议程。首页议程（62 天任务窗 + `limit=1` 未读数）走 `readAgentTasks`/`readAgentNotifications` 的同身份 60 秒快照，精简与详细共用；有快照时先落位再对齐，不回到「读取中」。任务窗与未读数并行读取（2026-10-28），各自持有 loaded/error：任务块只等任务窗、通知块只等未读数，一侧在途或失败不拖住另一侧；未读数失败显示「暂不可用」而非「无未读」。任务确认/取消与手动刷新仍立即失效或强制重读。回归见 `test/agent-read-cache.test.mjs`。
- 任务与通知列表快照（2026-10-27）：`TaskListSheet`（两端任务/周期安排）与 `TaskInboxContent`（两端通知首屏）改走同一读快照，进入 Agent 时 `AgentConversation.prewarmLists` 按序预取通知→任务首屏→周期安排；打开 Sheet 先 `peek` 落位再对齐，60 秒内不再等 Runtime。窗口键由 `taskListRange`（上海自然日）统一生成，Company「全部任务」首块与首页 62 天议程同键；执行结果窗取到今天结束，避免毫秒级 `now` 每次换键。手动刷新与数据变更后 `force`；周期启停只作废周期安排快照，已读只作废通知快照。回归见 `test/agent-read-cache.test.mjs`。
- 任务生命周期刷新（2026-11-04）：任务与通知事实归后端，前端不按时间推断执行成功。首页议程与日历共用 `taskPollDelay`，根据最新阶段状态和下一执行时刻安排重读；到期未推进短周期刷新，等待下一阶段有具体时间说明，首页保留少量最近结束结果。历史月与其他月份同为60秒快照，未完任务不因发生日期已过去而停止更新；日历轮询每次只发一个强制月窗或当日请求。保持身份切换与迟到响应保护。当前决定见 `../../docs/adr/0007-client-read-snapshots-for-task-and-notification-lists.md`，完整基础闭环见 `../../../iot-agent-backend/.scratch/agent-business-recovery/task-lifecycle.md`。
- 电表后台快照（2026-10-21）：Runtime 冷读可能返回 `status:'preparing'`，CompanyEnergySheet 必须显示“数据准备中”并允许重试，不能把该响应写入 `agent-read-cache.mjs`。命中 Runtime 完整报告时继续沿用本地 Company 读缓存；报告带 `cache.status:'stale'` 时保留数据显示，并在依据行标记后台更新或沿用上次完整数据。环境传感器不进入这层快照。

- 报告图表 SVG 必须同时声明与 viewBox 一致的数值 width/height；仅 viewBox 搭配 preserveAspectRatio="none" 会使图片固有尺寸退回 300×150，widthFix 下文字和条形被压扁。修复记录见 `../../plan/2026-10-20-report-chart-aspect-ratio-fix.md`。

- 任务创建反馈按 `confirmingTaskId` 只落在当前卡，全局 `busy` 继续禁用其他操作；等待不代表已创建。待确认/已创建/已结束保持互斥，新一轮确认清旧错误，失败清等待。真实微信验收与目录超时边界见 `plan/2026-10-25-task-create-wait-and-read-handoff.md`。

- 视觉设计（2026-11-04，G 方案 token 统一后）：Avoid unnecessary secondary labels and descriptions. Let the layout do the explaining.「正在后台更新/沿用上次完整数据/正在后台重试」这类状态注记不再单列次级文字；pill、数值、骨架和空态本身已自解释，只有真实错误原因（lastError/message）可在分区空态或依据行出现。

- 回答末尾操作（2026-11-10）：`AgentReplySurface`在本轮非运行、非流式、无错误且执行摘要未在整理/失败时显示淡入的复制图标，无分割线、无文字、无额外顶部间距，保留40×40px点击范围；复制成功仅切换勾号，保留无障碍标签。只复制有序终稿正文和已完成摘要，不含卡片或处理记录；成功回调触发反馈，换轮/重试/卸载清除反馈。该收口只表示回答结束，不表示设备控制完成。
