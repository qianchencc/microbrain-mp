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

## 遗留

- deepseek-chat 工具调用不稳定：本地探测连续 3 次控制请求未调用 `propose_device_action` 即直接回答"已打开"（同一时段模拟器内一次真实请求又成功提案，模型间歇性行为）。需后端排查（提示词/工具 schema/采样参数），前端无从规避。
- 软键盘行为需真机预览确认（模拟器不弹软键盘）。
- 真实设备控制闭环仍按安全边界保留，未执行。
- 后端两处待查（本轮发现）：①客户端断流后 `conversation.running` 长时间不回收（曾僵死约 20 分钟），前端已做本地解锁兜底（`stopRun` + `staleRunSince`），但根因在 runtime；②草案有效期窗口过短（约几分钟内两次过期），用户来不及确认就需重新核验，建议后端调长。
