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

## 遗留

- 模型提案间歇性缺失（归因已修正并观察好转）：当时模型实为 glm-5.3-flash（.env 于 09-15 22:53 已切换，非 deepseek），连续 3 次控制请求未调用 propose_action_draft 即直接回答"已打开"。闭环 4 上下文收敛（草案数组 → 前沿单对象）之后，同模型连续 3/3 正常提案——疑似旧多草案上下文干扰所致，继续观察；复发再排查提示词/采样。
- 软键盘行为需真机预览确认（模拟器不弹软键盘）。
- 真实设备控制闭环仍按安全边界保留，未执行。
- 后端两处待查（本轮发现）：①客户端断流后 `conversation.running` 长时间不回收（曾僵死约 20 分钟），前端已做本地解锁兜底（`stopRun` + `staleRunSince`），但根因在 runtime；②草案有效期窗口过短（约几分钟内两次过期），用户来不及确认就需重新核验，建议后端调长。
