# B6 原生渲染接入记录

2026-09-27。状态：实现已编译，微信视觉选型未验收。原 B6/P2 原型保持冻结。

## 当前实现

`pages/agent/timeline-geometry.mjs` 产生统一图形、标签、卡片坐标；`timeline-canvas.mjs` 与 `timeline-svg.mjs` 分别消费同一份场景。生产 `RegionTimeline.vue` 暂以 Canvas 2D 为默认，SVG 为对比候选。卡片和时间文字仍为普通小程序视图，未画入 Canvas。

保留 B6 的 34px/小时、跨日连续映射、右法线单侧缎带、同路径裁剪进度、端点不避让以及刻度/文字共同隐藏。卡片完成状态只改变卡片内容，不改时刻节点形状。多人或多任务重叠的独立轨道不在本票范围。

浏览器辅助核对：14:45 区间内、15:42 区间后、午夜；Canvas 与 SVG 外观相近，卡片点击能命中，跨日无 24:00。截图为浏览器中的实际几何模块输出，**不是微信原生页面截图**：

- [区间内](renderer-browser-1445.png)
- [区间后](renderer-browser-1542.png)
- [午夜](renderer-browser-midnight.png)

微信客户包编译通过，但官方开发者工具 CLI 打开项目返回 `code 10 / 需要重新登录`。因此尚未完成微信截图叠加比较，也未删除落选渲染器，不能宣称票 02 完成。`timeline-preview.vue` 是固定样例比较页，当前未注册到生产 `pages.json`；验收时临时注册为普通页面或使用开发启动条件，保持客户首页为首路由，结束后移除比较入口。

## 组件复用

按项目顺序查看过 [Animate UI Sheet](https://animate-ui.com/docs/components/radix/sheet)、[Radio Group](https://animate-ui.com/docs/components/radix/radio-group)，[ReUI Sheet](https://reui.io/components/sheet)、[Timeline](https://reui.io/components/timeline)，以及 [shadcn Sheet](https://ui.shadcn.com/docs/components/base/sheet)、[Radio Group](https://ui.shadcn.com/docs/components/base/radio-group)。这些是 Web/React 控件，ReUI 的直线时间轴也不能保持冻结的 B6 几何。

客户小程序沿用现有 `DeviceSheet`、原生 `radio-group`、`uni-icons`；设备头像沿用现有 artwork 和 gear 兜底。没有新增依赖或重建 Sheet。

[uni-app Canvas 文档](https://uniapp.dcloud.net.cn/component/canvas.html)与[image 文档](https://uniapp.dcloud.io/component/image.html)作为平台参考。浏览器能加载 SVG data URI，不能推导微信 image 在各端同样支持；这也是必须实测的选型点。

## 下一步验收

1. 用户仅登录微信开发者工具；不要重新登录客户物联网专属开发账号。
2. 客户包临时打开比较页，切换 Canvas/SVG，核对 14:45、15:42、午夜、窄屏、卡片点击和滚动。
3. 与冻结 P2/B6 图叠加，确定唯一渲染器；删除落选实现、比较 prop 和比较页。
4. 验收真实区域切换、Agent 返回工作台、即时操作记录；真实控制仍需用户确认。
