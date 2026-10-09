# B5 时间轴节点与时刻排版设计稿

状态：已生成 B5 节点与时刻排版设计稿 `b5-node-time-concept-v2.png`。B4 原型冻结，不修改其曲线与区间实现。

原始输入：`b4-frozen-reference.png`。它是 B4 当前画面的截图，不是现行设计稿；现行唯一设计稿为 `b5-node-time-concept-v2.png`。

## 设计范围

- 保留 B4 的连续曲线、曲线右侧的实心玉绿区间、页头和整体信息密度。
- 只重新设计节点语言、左侧时间栏、区间起止时刻和“现在”的表达。
- 普通已过节点用小型灰色实心点；未来节点用小型灰色空心环；区间起点用玉绿实心点，终点用白心玉绿环；当前时间用更醒目的黄铜色节点。节点均与曲线同心，不改变轨道位置。
- `14:00` 与 `15:30` 分别对齐区间两端，不把结束时间挤在开始时间下方。`现在` 和 `15:42` 组成两行黄铜色标注，与 `15:30` 保持可读间距；横向当前时间虚线位于内容背后。
- 精确事件时间使用等宽数字、右对齐。次要整点只保留轻刻度；靠近事件时间时不重复标注。
- 移除演示滑杆、B1–B4 切换器和黑色手机外框。这些只是原型工具，不属于界面设计。

## 设计稿检查

- 选用第二版：主轴转向比首版明显，14:00–15:30 的实心区间沿曲线外侧延展；节点状态和左侧时刻有清晰层级。
- `15:30` 与 `现在 15:42` 分行分色，当前时间节点独立于区间终点，不把进度误画成空心容器。
- 生成图用于评审节点、排版和视觉节奏；曲线、区间边界和时间映射仍以冻结的 B4 代码为准。图中次要刻度和文字需在代码实现时精确绘制、校对。
- 首版探索图已清理；第二版修正提示词见 `b5-node-time-curve-correction.txt`。

## ImageGen 提示词

Use case: ui-mockup. Asset type: one high-fidelity portrait mobile app screen for a B5 timeline design review. Image 1 (`b4-frozen-reference.png`) is an edit target and layout reference. Preserve its Chinese office operations app identity, header "26F 办公区", selected "自动化" tab, week calendar, restrained white/cool-grey surfaces, existing card hierarchy, one continuous visibly bowed timeline curve, and the one-sided SOLID jade interval from 14:00 to 15:30. The curve must remain a graceful S-like path, never a straight vertical rule. The interval hugs that same path and widens gently to its right; it is not a hollow progress container.

Redesign only the timeline's nodes and time typography. Use a disciplined left time gutter with tabular numerals. Align "08:30", "12:00", "17:00" and "18:00" to ordinary event nodes. Align "14:00" to a solid jade interval-start node and "15:30" to a white-centered jade outline endpoint. Use tiny unlabeled secondary ticks where needed, suppressing any duplicate tick labels near event times. Give the current time a distinct amber node with a crisp white separation ring. Place a two-line callout "现在" above bold "15:42" in the left gutter, clearly separated from "15:30". Its thin amber dashed rule passes behind content, never through card text.

Ordinary completed nodes are small cool-grey filled circles with a white halo; future nodes are small open grey rings. Maintain a coherent scale and line weight across all node types. Keep labels readable without collisions. Preserve short Chinese task titles but make the timeline geometry, nodes and time typography the focus. Remove the prototype-only slider, variant switcher and black phone frame; show only the app screen. Palette: near-white, cool graphite, jade `#176b54`, restrained amber `#a66a13`. No glows, illustrative art, watermark, extra panels, duplicated time labels or explanatory copy. Render exact text, especially "26F 办公区", "自动化", "设备", "08:30", "12:00", "14:00", "15:30", "现在", "15:42", "17:00", "18:00".
