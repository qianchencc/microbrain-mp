# B6 原生渲染接入记录

2026-09-27。状态：微信开发者工具已验证，选择 SVG 图片渲染。原 B6/P2 原型保持冻结。

## 当前实现

`pages/agent/timeline-geometry.mjs` 产生统一图形、标签、卡片坐标；`timeline-svg.mjs` 将图形交给小程序 `image`。卡片和时间文字仍为普通小程序视图。Canvas 候选及临时比较页已从正式源码移除。

保留 B6 的 34px/小时、跨日连续映射、右法线单侧缎带、同路径裁剪进度、端点不避让以及刻度/文字共同隐藏。卡片完成状态只改变卡片内容，不改时刻节点形状。多人或多任务重叠的独立轨道不在本票范围。

浏览器辅助核对：14:45 区间内、15:42 区间后、午夜；Canvas 与 SVG 外观相近，卡片点击能命中，跨日无 24:00。截图为浏览器中的实际几何模块输出，**不是微信原生页面截图**：

- [区间内](renderer-browser-1445.png)
- [区间后](renderer-browser-1542.png)
- [午夜](renderer-browser-midnight.png)

登录恢复后，在客户包中临时注册固定样例页，以相同 B6 场景比较两种渲染。微信 Canvas 2D 的曲线越过 `scroll-view` 顶部，进入导航、区域芯片和日期标题；SVG 图片则与普通文字、卡片保持同一滚动边界。按 390px 模拟器截图的页头区域统计，Canvas 有 99 个曲线色像素，SVG 为 0。问题来自原生图层裁切，页面测量的 `scroll-view` 高度 627px、图形与内容起点均为 -151px，布局坐标本身一致。

- [失效的 Canvas 空区域](renderer-wechat-canvas-before.png)
- [SVG 带任务样例](renderer-wechat-svg-cards.png)
- [SVG 正式空区域](renderer-wechat-svg-empty.png)

样例验证了 14:45 区间分界、00:00 单刻度、普通视图卡片点击和窄屏卡片内容；正式空区域按 P2 原型使用局部时间轴符号，避免无任务时铺满整日曲线。真实任务记录仍需经用户确认的一次设备操作验收，样例页不是实际业务数据。

## 组件复用

按项目顺序查看过 [Animate UI Sheet](https://animate-ui.com/docs/components/radix/sheet)、[Radio Group](https://animate-ui.com/docs/components/radix/radio-group)，[ReUI Sheet](https://reui.io/components/sheet)、[Timeline](https://reui.io/components/timeline)，以及 [shadcn Sheet](https://ui.shadcn.com/docs/components/base/sheet)、[Radio Group](https://ui.shadcn.com/docs/components/base/radio-group)。这些是 Web/React 控件，ReUI 的直线时间轴也不能保持冻结的 B6 几何。

客户小程序沿用现有 `DeviceSheet`、原生 `radio-group`、`uni-icons`；设备头像沿用现有 artwork 和 gear 兜底。没有新增依赖或重建 Sheet。

[uni-app Canvas 文档](https://uniapp.dcloud.net.cn/component/canvas.html)与[image 文档](https://uniapp.dcloud.io/component/image.html)作为平台参考；本轮只证明客户微信开发者工具中的 SVG data URI 能正常显示，真机表现仍由后续设备验收确认。

## 后续边界

区域选择、工作台返回 Agent 与会话中的区域切换分隔已在微信模拟器复验。真实任务卡片仍待一次明确确认的物理操作产生记录后验收；当前完成的是原生渲染、空状态和固定样例卡片。真机渲染、滚动与实际状态回读仍需现场确认。
