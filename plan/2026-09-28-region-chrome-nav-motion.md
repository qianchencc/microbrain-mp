# 区域工作台 Chrome：悬浮 dock、居中选择器、抽屉导航栈、日历与动效

日期：2026-09-28 · 状态：已实现待微信端验收 · 依据：P2 原型 `.dock2`/`datefloat`/`.cal.compact` + 用户五点审查反馈

## 五项改造的落点

### 1. 悬浮 dock（认可原型 `.dock2` 模型）

- `region.vue` `.device-dock` 从布局内页脚改为 `position:absolute` 覆盖层：胶囊浮在时间轴上方，顶部 30px 渐变淡出带保留可读性；`pointer-events:none` 穿透渐变区，`dock-bar` 恢复交互。
- `RegionTimeline` 新增 `bottomPad` 属性（region 页传 78），以 `timeline-tail` spacer 扩充滚动余量——23 点档卡片可滑到胶囊上方不被遮挡。不用 `padding-bottom` 是出于 box-sizing 歧义。

### 2. 区域选择器顶部居中（两页统一）

- `pages/agent/region` 改 `navigationStyle: custom`，自绘导航行：`← 返回`（`uni.navigateBack`，失败回落 `reLaunch` 到 Agent 页）+ 居中 `RegionChip workbench`；原生"区域工作台"标题移除，chip 即 wayfinding。
- Agent 页：`RegionChip` 移入 `AgentHeader` 导航行 default slot；identity 收缩为 图标+状态点+箭头（"物联 Agent"文字标题让位，菜单入口保留）。
- 居中方式 = flex 居中于两侧控件之间的剩余区（iOS 惯例），非屏幕绝对居中；胶囊避让用共享的 `nav-metrics.js`（`statusBarHeight` + `getMenuButtonBoundingClientRect` → `barHeight`/`rightInset`，无胶囊环境 104px 兜底）。
- `RegionChip` 新增 `nav` 变体：去掉行 padding、行内居中。黄铜聚合提示点不变。

### 3. 日历（两个场景分离）

- **区域页**（inline 常驻）：去掉边框与底色融入 `#f4f7f5` 纸面；收拢态只留周条+"年月 ⌄"标题，月份箭头只在展开时出现（占位保留不跳动）；展开/收拢走 `max-height` 240ms `cubic-bezier(.32,.72,0,1)` 过渡。
- **抽屉内设备时间轴**（compact）：原型 `datefloat` + `.cal.compact` 模型——左上角浮动日期 chip，日历以绝对定位 pill 浮层盖在时间轴上（不推动布局），点遮罩或选日收起；入场 `translateY(-6px)+淡入` 180ms。
- `scroll-view` 加 `scroll-with-animation`：选日/定位走平滑滚动。

### 4. 筛选段

`类型/位置/状态` 段控件补 `background/color 180ms` 过渡；搜索切换沿用既有 260ms 位移。

### 5. 抽屉叠层 → 单层导航栈

- 抽出 `TaskDetailContent.vue`（详情主体 + 加载/轮询/现态/取消逻辑，`open` prop 改名 `active`）；`TaskDetailSheet` 变为 `DeviceSheet` 薄壳，区域时间轴直开任务不变。
- `RegionDeviceDrawer` 内建三级栈：`list → device → task`。pane 绝对定位叠放，`depth` 驱动 class：push = 新 pane `translateX(26%)+淡入`，下层 `-12%` 视差退让；pop 反向。退场 pane 由 `closing` 快照挂载 300ms 保证退出动画完整。
- 单遮罩、单把手、单安全区；标题栏返回钮按栈深出现；抽屉内取消任务仍上抛 `@cancelled` 刷新区域时间轴与月历。
- `state-refresh` 的 `auto()`（15s 冷却）用于目录/现态的被动刷新；详情仍按 `scheduled/executing` 10s 轮询。

## 动效清单（全部带 reduced-motion 降级）

| 交互 | 处理 |
| --- | --- |
| 抽屉 pane push/pop | 260ms `cubic-bezier(.32,.72,0,1)`，translateX 26%↔0 / -12% 视差 |
| 日历展开/收拢 | `max-height` 240ms 同曲线；compact 浮层 `translateY(-6px)+opacity` 180ms |
| 段控件/选日/状态灯/区域选项 | 颜色类 150–200ms ease 过渡 |
| chip/dock/卡片按压 | `scale(.95–.97)` 130–140ms ease-out |
| 空态/列表展开 | `opacity`/`translateY(4px)` 一次性入场 160ms，`backwards` fill |
| Sheet 拖拽 | 沿用 DeviceSheet 手势 1:1 跟手 + 速度交接，未改 |

## 验收点（微信开发者工具）

1. 两页 chip 顶部居中、避让胶囊；Agent 页 identity 点按弹会话菜单
2. 区域页返回键、侧滑返回正常
3. dock 胶囊浮在内容上、渐变区可滚动穿透、23 点档不被遮挡
4. 抽屉内 列表→设备→任务 单向栈、无第二遮罩、返回逐级
5. 抽屉内任务取消后区域时间轴与月历刷新
6. 设备时间轴 datefloat 浮层日历开合、选日收起
7. 区域日历展开/收拢平滑过渡
