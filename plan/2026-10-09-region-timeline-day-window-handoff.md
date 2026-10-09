# 区域时间轴跨日窗口滚动（2026-10-09）

## 行为契约

- 区域工作台时间轴是连续多日画布，滚动自然跨越自然日，无需逐日切换。
- 渲染窗口为 `date-2 … date+3`（右端钳到 `maxDate`）；滚动触上界向前 prepend 一天、触下界（未超 `maxDate`）向后 append 一天，窗口按需无界延伸。
- 滚动经过某天时以 `visible-date` 回写 `date`：标题、日历选中态、`N 条记录` 跟随视口内的天，而非固定选中日。
- 反向（日历选日 → 滚动定位）：`date` 变化若非滚动回声（`emittedDay`），定位到该日顶部；"今天"仍定位到"现在"。

## 实现要点

- `createTimeline` 本就按 `days` 渲染多日、跨日区间按视口裁切；新增导出 `TOP_PAD` 与 `scene.nowVisible`。
- `RegionTimeline` 新增 `start` prop（窗口首日，缺省 `date`）与 `visible-date`/`reach-start`/`reach-end` 事件；`days<2` 不发 `visible-date`，设备时间轴（单日）行为不变。
- prepend 补偿：`windowStart` 前移时 `scrollTop += delta*DAY_PX`（关 `scroll-with-animation` 一帧），视口内容不跳。
- `region.vue` 的任务从单日数组改为按天缓存 `dayTasks`：邻日静默预取、同日 30 秒内去重、`force` 刷新只走 `reloadWindow`/周期刷新；`RegionTimeline` 的 `:key` 不再含 `date`，切日不再重挂载。
- 空态语义：`timeline-empty` 只在**整个窗口无任务**时挂 slot；区域页的加载/错误提示改为 `timeline-body` 上的 `notice-layer` 覆盖层（`pointer-events:none`，重试按钮放行），单日错误不会被邻日任务掩盖。
- `acknowledgeRegion` 语义不变：选中日加载完成且页面可见即上报，滚动跨日同此。

## 验收边界

- 实测要核对：向上 prepend 时内容不跳动、滚动跨日时标题/日历选中态跟随、到达 `maxDate` 后不再向下延伸、日历选远日后窗口重锚定。
