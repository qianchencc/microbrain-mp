# 018 设备面板页面级重写与处理记录折叠修复

- 日期：2026-09-16
- 范围：`apps/agent-miniapp/pages/agent`
- 状态：已完成并验收

## 背景

用户反馈：控制面板/更多设备使用的底部面板组件"完全损坏"（被输入栏遮挡、坐标错位）；切换回输入法时输入区闪烁；处理记录展开/收起时文字跳动且无动画。

## 根因

1. `DeviceSheet` 依赖 `uni-popup`，但项目 `uni_modules` 只安装了 `uni-icons`，`uni-popup` 从未安装。编译产物中 `<uni-popup>` 是未注册标签：无遮罩、无 fixed 定位、无开关 API，面板实际是摊在草案卡片内的普通内容块，被页面级 composer 压住。上一轮的 `z-index:1000` 补丁无法生效。
2. 输入栏 textarea 用 `v-if` 切换语音胶囊，原生组件每次重挂载闪屏；键盘高度 0/正值抖动直接驱动页面高度，无去抖无过渡。
3. 处理记录折叠依赖 `grid-template-rows: 0fr/1fr` 过渡，小程序内核不执行该过渡（直接跳变）；箭头 up/down 字形互换引起布局跳动。

## 方案

- `DeviceSheet.vue` 全量重写为自绘组件：遮罩 + fixed 底层面板，v-if 挂载 + class 过渡（进入 240ms cubic-bezier、退出同曲线），保留拖拽把手下拉关闭与 × 关闭；`z-index:1000`。
- 新增 `DraftSheetLayer.vue` 挂在页面根（composer 之后），承载"全部设备"浏览器（swiper 分组/搜索/全选）与参数编辑器；`ActionDraftCard` 瘦身，仅通过 `configure`/`browse` 事件请求打开。
- 新增 `pages/agent/draft-sheet.mjs` 的 `sheetDraftFrom(turns, draftId)`：只有 `PENDING_CONFIRMATION` 草案可停留在面板；状态推进（执行/过期/取消）或草案被替换即自动关闭。
- 输入栏：textarea 与发送按钮常驻（`v-show` 切换），不再重挂载；`applyKeyboardHeight` 对 0 高度 120ms 去抖，页面高度/输入栏 padding 带 200ms 过渡。
- 处理记录：箭头改单图标 `rotate(180deg)` 过渡；展开高度用实测驱动（measure → height 过渡 → 300ms 后 height:auto 以兼容运行中内容增长），收起前先 pin 实测高度再动画归零，快速连点有状态守卫。

## 验收（微信开发者工具，真实编译产物）

- 长按真实待确认草案的设备卡片：面板完整弹出，遮罩变暗，输入栏被覆盖；温度步进 26→27、"1 台已修改"、保存到草案后面板关闭（真实 updateParameters 成功）。
- 折叠循环：展开（条目+箭头旋转向上）→ 收起（归零+箭头旋转向下）。
- `npm test` 34/34；`npm run build:weixin` 通过；编译产物无 uni-popup 残留；调试器 Errors: 0（Warnings: 10 为基础库弃用类提示，改动前已存在）。

## 附：会话状态设计审查结论（2026-09-16）

用户指出：待确认草案未处理即可继续对话、历史草案跨轮仍可操作。代码审查证实为模型缺陷而非补丁可修：`POST /messages` 不检查活草案（app.ts:324,331）、新提案不取代旧草案（app.ts:495）、五条草案路由无前沿检查（569/605/692/840）、模型上下文接收草案数组（1009）、`running` 仅存内存（261）。应然方案（会话单闸门状态机 + 六不变量 + 五闭环）已冻结于 `.scratch/conversation-phase-machine/`（spec + issues 01-07），按闭环推进，推进完成后各自 handoff。

## 追加：用户消息编辑态修复（2026-09-16 下午）

用户消息原位编辑卡片塌缩成窄条（右侧浮卡、左侧大片空白）、"重新发送"断行成"重新发/送"、无进出场动画。根因：`.user-editor` 无确定宽度——textarea 是原生组件，`width:100%` 撑不开 fit-content 父级，整链塌缩到按钮行最小宽度；按钮 `min-width:58px` 小于 4 字 CJK 文案固有宽度（68px），flex 收缩后断行。修复：编辑态 `width:88vw; max-width:320px`；`.message-action` 加 `white-space:nowrap`；进退场 CSS animation（`editor-in` 180ms / `editor-out` 160ms，transform-origin 右上），取消先播退场再卸载。对照 spectrumhq blocks ai-assistants：参考库消息级动作为流内 action row / 原位编辑、不弹层，本实现已对齐原位编辑形态。

## 追加：编辑器聚焦压短页面修复（2026-09-16 傍晚）

用户截图：打开消息编辑器后整页被压短，底部留出约三分之一黑洞。根因：页面按 `100vh - keyboardHeight` 手动收缩的机制被全局 `uni.onKeyboardHeightChange` 驱动，编辑器内 textarea（走系统 `adjust-position` 自动上推）的键盘也触发收缩，形成双重补偿；模拟器不绘制键盘，黑洞直接可见，真机上则表现为顶栏被推出屏幕。修复：移除全局监听，`applyKeyboardHeight` 只接收 composer 自己的 `@keyboardheightchange`（只有它关闭了系统 adjust-position，需要手动补偿）。DevTools 实测：编辑器聚焦页面不再收缩，取消后正常收起。

## 追加：编辑态收起过渡（2026-09-16 夜）

用户反馈编辑态收起突兀。两个缺口：① 普通态（气泡 + 编辑/重试 chips）无入场动画，退场结束后硬切出现；② 点"重新发送"或 recoverable 状态翻转时走硬切路径，退场动画不播。修复：`.user-message`/`.message-actions` 加 `message-in` 入场（180ms 上浮淡入，插入即播）；三条收起路径（取消/提交/状态翻转）统一走 `closeEditor()`——先播 `editor-out` 160ms 再卸载。另修正上一轮宽度方案：`88vw` 在窄屏（320pt）上溢出正文区、右对齐下向左贴边（用户截图确认），改为 wrap 编辑态 `calc(100vw - 32px)`（恰为正文区内宽）上限 320px，编辑器 `width:100%`。

## 追加：操作行对齐 message-actions 与普通→编辑过渡（2026-09-16 深夜）

用户指出普通→编辑过渡僵硬、操作行与参考库不符。核对 spectrum `message-actions` 源码（registry JSON）：Ghost 变体为纯图标行（28px 按钮、14px 图标、neutral-400、gap 2px、w-fit、active scale(.92)+黑 4% 底、桌面 hover 显隐/移动端常显）。当前实现三处偏离：① 文字按钮而非图标行，且 uni-icons（compose/refreshempty）在原生端不渲染、只剩裸文字；② 普通→编辑是气泡瞬时卸载（无退场）+全宽白卡淡入，宽度/配色/圆角全跳变；③ 编辑器主按钮为裸绿字。修复：操作行换项目 SVG（compose.svg + 新增 refresh.svg，与 send/mic/check 同资产体系）Ghost 规格；进入编辑先播气泡 `message-out`（scale .97+淡出 140ms）再挂编辑器，`editor-in` 背景从气泡绿过渡到纸白、textarea 文字白→墨绿同步过渡（"气泡原地变形"观感）；编辑器主按钮改实底绿（对齐 error-state retry）。参考库无"编辑用户消息"block（registry 全量核对），主流产品均为气泡原地变形，故维持原位编辑路线。

## 追加：设备卡片手势重写与显示修正（2026-09-17 凌晨）

用户反馈四点：空调"状态未知"与"开启 · 25°C"并列误读、卡片高度不一致、轨道边缘渐隐带生硬、卡片几乎点不选/点不消。处理：① 点选/长按重写为原生 `@tap`/`@longpress`，删除自制 touch 状态机（card-press.mjs 及其测试）——其 `catchtouchmove` 吞掉 scroll-view 滚动（卡片上拖不动手轨/网格）、suppress 标记误吞滚动后那次 tap，是"点不动"的根因；环形进度随之移除，按压反馈改 hover-class 缩放，卡片高度统一 180px；② 轨道渐隐带 10→18px、内边距对齐；③ 当前状态未知时正文不再渲染"状态未知 →"起点，只保留图上角标一处（"开启 · 25°C"是指令目标而非当前状态；状态回读不可用属后端 readStates 范畴）。ADR 0001 增补修订记录。

## 追加：温度步长 0.5 与面板交互修正（2026-09-17）

用户指出温度 0.1 步进无证据、加减不居中、模式/风速选不中。证据链：0.1 出自 runtime `device-command.ts` 的 `acParameters`（人工维护、无实测出处）。修复：① runtime step 0.1→0.5（产品约定 2026-09-16），命令校验精度同步收紧为 0.5 网格（`v*2` 取整）；runtime typecheck + 67/67 通过。② 前端 ParameterEditor 兜底步长同步 0.5，步进按 `1/step` 网格量化，手输非网格值仍走 invalid 提示。③ 步进器改对称三段布局（按钮 | 数字 flex:1 居中 | 按钮），数字与单位垂直居中。④ SlidingSegments 移除全套 `.stop` 触摸劫持（与设备卡片同款病灶：吞滚动 + swiped 误吞点击），点击改原生 @tap、滑动用无劫持 touchstart/end 位移判定、滑动后 350ms 屏蔽 tap 防双触发。注：旧草案的 parameters 存有旧步长 0.1，0.5 对新提案生效；面板视觉验证受阻于后端 revalidate 超时（见遗留）。

## 追加：处理记录展开"凭空空白"修正（2026-09-17）

用户反馈展开处理记录时先展开到草案、随后下方凭空多出一块空白。根因：实测高度方案在展开时把高度钉在测量值上、300ms 后切 `height:auto`——多轮同构组件下 `.trace__clip` 类名选择可能命中别的实例，或测量与内容稳定有时间差，切换瞬间高度跳变。修复：放弃测量方案，改 `max-height: 0 ↔ 640px` 过渡（overflow:hidden）——盒子高度恒等于 min(内容, 上限)，CSS 布局保证贴合，不存在钉错高度；JS 测量/settle 代码全部移除。

## 追加：手轨边缘细线修正（2026-09-17）

用户反馈卡片横向滚动至边缘时有"不属于卡片和过渡"的细线。根因：边缘渐隐用 `::before/::after` 半透明色带覆盖层（页面底色 #f4f7f5 → 透明）叠在卡片上方——被色带盖住的卡片描边/图片边缘透出残留，与 overflow 硬切边界叠加形成细线。修复：删除色带覆盖层，改在 `.rail`（scroll-view）上用 `-webkit-mask-image`/`mask-image` 线性渐变做 alpha 蒙版（两端各 20px），卡片内容连同描边整体透明渐隐。

## 追加：长按环形进度恢复（2026-09-17）

用户指出其此前要求的环形进度条在原生 @longpress 改造中被移除。恢复方式：自有计时（550ms，环从按下即走 conic-gradient 进度，进度 ≥90° 才渲染避免快速点击闪环），转满 emit configure；监听不带 .stop（不阻断外层滚动），位移 >10px 视为滚动取消计时；完成后的随行 tap 用一次性 holdDone 状态屏蔽；选择仍走原生 @tap。原生 @longpress（350ms、无进度回调）与进度环互斥，已移除。

## 追加：更多设备编辑页滑动过渡与返回按钮、步进图标居中（2026-09-17）

用户反馈：① 更多设备浏览器长按卡片进入编辑页缺少平滑右滑过渡；② 编辑页缺少退出按钮（应平滑左滑回列表）；③ 温度加减图标在圆内不居中。修复：① 浏览器 swiper 的两个页面常驻渲染（原第二页 `v-if="current"` 与 current 变更同帧挂载导致 swiper 跳变不动画），编辑页内容改内部 v-if；② 返回按钮改明示退出（新增 back.svg 左箭头 + 设备名，40px 触控高，按压缩放），tap 平滑左滑回列表；③ 步进按钮原 `line-height:40px` + inline image + baseline 排版导致图标偏移，改 flex 居中 + `display:block`（SVG 路径本身居中，无需改资产）。

## 追加：面板过期不再被踢 + 关闭永远允许（2026-09-17）

用户报告并自诊：更多设备面板打开期间点把手面板直接消失、点外部不收起——疑为草案过期所致。确认两个叠加问题：① 面板 open 门控基于 `sheetDraftFrom`（仅 PENDING），草案在面板打开期间过期 → open 瞬间变 false → 面板滑走消失（用户正操作时全部选择丢失）；② 关闭操作（遮罩/把手/×）被 busy 门控，busy 卡死时用户无法退出。修复：面板跟随轮次草案对象本身（不再按状态踢除）——过期转只读 + 面板内 stale 提示条（"核验已过期…"+ 重新核验按钮，核验成功原地恢复可编辑）；仅草案被新提案取代（draftId 消失）或轮次清理时自动关闭；关闭操作移除 busy 门控。`draft-sheet.mjs`/`agent-sheet.test.mjs` 随之删除。

## 追加：更多设备去状态门控 + 横杠拖拽重做（2026-09-17，emil-design-eng）

用户判定上轮改动失败：① 更多设备点击不应受草案状态限制；② 横杠拖拽收起在所有情况下失效。修复：① openSheetBrowser 仅要求草案存在——过期/取消/已完成均可展开只读浏览（过期提示条带"重新核验"，取消为纯提示；卡片相位按草案状态渲染 expired/cancelled）。② 横杠拖拽按动量交互标准重做：抓取区扩大为横杠+整个头部；拖拽期间内联覆盖 transform/transition/animation（进场 animation 无论何种状态都不与手指位移竞争，这是失效根因的隔离）；向下全跟随、向上 1/3 阻尼；收起判定=轻扫（速度>0.5px/ms）或拖过 64px，否则弹回；多指忽略，touchcancel 复位。

## 追加：面板结构铁律与隐形遮罩死锁修复（2026-09-17 深夜）

用户报告"横杠一按菜单就消失、后续全部点不了"。两个根因：① 前一版把进场 animation 与拖拽 transform 放同一元素，拖拽时内联 animation:none、松手移除——每次松手进场动画重放（面板先掉出屏幕再滑回），表现为"按住就消失"；② 面板 mounted 意外滞留时，透明全屏 mask（z-index 1000）把整页点击吃光（重新核验/更多设备全部点不动；DevTools 模拟器窗口分离/切换时状态跨视图存活可触发）。修复照抄 vaul/Base UI drawer 结构：wrap 元素只管进出场动画、内层 sheet 只管拖拽 transform，永不同元素；`.sheet-root` 非显示态 pointer-events:none（shown 时 auto），状态即使卡住也不拦截页面。拖拽规格对齐 vaul：轻扫 >0.5px/ms 或拖过 200px 收起，否则 320ms iOS 曲线回弹。DevTools 实测序列：拖拽收起 ✓ → 重开按住不动松开不消失 ✓ → 再拖仍收起 ✓；重编译后重新核验/更多设备点击恢复 ✓。

## 追加：预览环境整页失联（busy 永久冻结）+ 横杠误关闭（2026-09-17）

用户在预览环境报告：鼠标 hover 仅"更多设备"变可点状、点开后面板内无法任何操作；主页面顶部与输入框仍可交互，卡片完全无法交互；点横杆仍触发面板消失。代码审查定位（不再依赖 DevTools 复现）：

- **整页失联根因 = `busy` 永久卡真**。禁用矩阵逐项吻合现象：卡片/面板内容全部 `:disabled="busy"`；`openSheetBrowser` 恰好无 busy 门控（所以"只有更多设备能点"）；Header `identity` 按钮无 disabled 属性（busy 时仍可点、弹 toast）；composer 只被 `mutating || hasExecution` 禁用、`isRunning` 不禁输入（所以"顶部和输入框仍可交互"）。busy 三来源中 `mutating` 各路径均有 try/finally（60s 默认超时兜底）、`hasExecution` 有轮询自愈，唯独 **`isRunning` 有两条永久卡死路径**：① `streamMessage` 为 enableChunked 流式、无任何看门狗——流挂起时 success/fail 永不回调，且 `schedule()` 轮询条件 `isRunning && !activeRequest` 被挂起的 activeRequest 抑制，服务端恢复也无法自愈；② 服务端 `conversation.running` 僵死（runtime 仅启动时治愈 running 相位，app.ts:226；运行中僵死无治愈，且 DELETE 会话在 activeRuns/EXECUTING 时 409）。当时实测服务端健康（running=false），判定用户命中的是①（前端本地挂起）。
- **修复**：① `streamMessage` 接入空闲看门狗（`apis/agent/idle-watchdog.mjs`：60s 无分块 → 先以"回答流超时，请重试"reject 再 abort；success/fail/onChunkReceived 分别 stop/kick；仅 MP-WEIXIN 分块通道武装）——isRunning 从此不可能本地永久卡死。② 「清除会话」逃生口：Header `disabled` 改为仅表示无会话（去掉 busy），`clearHistory` 去 busy 门控——能否在运行中清除由服务端 409 权威决定（"请等待当前请求结束后清除"），busy 卡死时用户始终有自救手段。③ 横杠误关闭：轻扫判定加位移门槛（`pages/agent/sheet-drag.mjs`：`|位移|>8px` 才允许 flick>0.5px/ms 收起）——鼠标/模拟器一次点击会合成 1~3px 高速度 touchmove，旧判定把它当成轻扫收起，即"点横杆面板消失"。
- 测试：`agent-idle-watchdog.test.mjs`（触发一次/kick 续命/stop 取消）、`agent-sheet-drag.test.mjs`（200px 收起/带位移轻扫收起/微抖不收起/低速弹回）；全量 32/32 通过，`build:weixin` 通过且产物含看门狗与门槛判定。
- 同时更正 AGENTS 旧注：`stopRun` 的 staleRunSince 本地解锁已随"相位服务端权威"移除，勿复活。

## 追加：预览失联终审=scroll-view 塌陷 + 横向分段菜单统一（2026-09-17）

两件事收口：

- **整页失联终审根因 = scroll-view 高度塌陷**（此前两轮误诊：busy 冻结→修了看门狗；草案状态静默→修了 toast，均非根因）。模式：`flex:1; height:0` 直接写在 scroll-view 上 → 微信 webview 盒子 0 高、内容被 enhanced 层画出但命中盒全灭；AX 证据=scroll-view 内全部子元素 bounds 塌缩（y=170,h=1px）而 scroll-view 外元素（header/composer）几何正常——与"顶部和输入框可点、卡片全死"逐点吻合。修复=确定性高度链：外包 `flex:1; min-height:0; overflow:hidden` 的 view + 内层 `height:100%`，落点三处：`index.vue` 会话列表（conversation-shell）、`ParameterEditor.vue`（content-shell）、`DraftSheetLayer.vue` 设备网格（device-scroll-shell，后随并行会话 8ed31d2 一并入库）。铁律已写入 AGENTS。
- **横向分段菜单（"横杆菜单"，kitze.io 研究成果）统一**：用户裁定——更多设备面板与长按空调卡面板的横杆交互"完全是两个回事"，以空调面板（`SlidingSegments`：滑动指示块/220ms 过渡/统一禁用态）为标准。代码事实：`SlidingSegments` 全仓库仅 ParameterEditor（仅 AC 可达）使用；全部设备分组（区域/类型/选择）是第二套手写 32px 胶囊 chips。修复：DraftSheetLayer 分组切换替换为 `SlidingSegments`（默认绿 thumb，`.group-segments{flex:1}`），删除 `.modes/.mode/.fill` 自绘样式；AGENTS 增补"一切横向分段切换统一用 SlidingSegments，禁止自绘胶囊 tab"。面板拖拽横杆本身两个面板共用同一 DeviceSheet 实例与事件绑定（产物核验 bindtouchstart/catchtouchmove 完整），无代码层差异。
- 顺带收口（误诊期间实施的 UX 兜底，保留）：只读/禁用卡片点击 toast 原因（`device-card-state.js` tapBlockHint）、CANCELLED 草案文案改"操作已取消，未执行。发送新指令可重新下达。"（不再误称"已过期"）、编辑页 stale-note 按状态显示（仅 EXPIRED 给重新核验按钮）。32/32 测试通过。

## 追加：温度滑块实时更新与 0.5 步长下限（2026-09-17）

用户指出空调面板滑块拖动中温度不实时更新、步长应为 0.5。两处修复（ParameterEditor）：① 滑块补绑 `@changing`（此前仅 `@change`，松手才生效——微信 slider 语义），拖动中大数字与底部目标摘要实时跟随；② `temperatureStep` 加 0.5 下限 `Math.max(0.5, 设备step)`——旧草案 parameters 残留 0.1 时编辑粒度仍按 0.5（滑块吸附、步进器量化、手输 invalid 网格校验同用有效步长）。32/32 测试、build:weixin 通过，产物核对 bindchanging 与 Math.max(.5 均在。

## 遗留

- 模型提案间歇性缺失（归因已修正并观察好转）：当时模型实为 glm-5.3-flash（.env 于 09-15 22:53 已切换，非 deepseek），连续 3 次控制请求未调用 propose_action_draft 即直接回答"已打开"。闭环 4 上下文收敛（草案数组 → 前沿单对象）之后，同模型连续 3/3 正常提案——疑似旧多草案上下文干扰所致，继续观察；复发再排查提示词/采样。
- 软键盘行为需真机预览确认（模拟器不弹软键盘）。
- 真实设备控制闭环仍按安全边界保留，未执行。
- 后端两处待查（本轮发现）：①客户端断流后 `conversation.running` 长时间不回收（曾僵死约 20 分钟），前端已做本地解锁兜底（`stopRun` + `staleRunSince`），但根因在 runtime；②草案有效期窗口过短（约几分钟内两次过期），用户来不及确认就需重新核验，建议后端调长。
- revalidate/readStates 无超时上限（本轮发现）：网关不可达时 revalidate 请求挂起至前端超时（"连接超时中，请稍后重试"），重新核验路径被阻塞。建议 runtime 给 revalidate（app.ts:714 一带）及 readStates 调用传 `AbortSignal.timeout`（参照 summarizeExecution 的 60s 做法）。
