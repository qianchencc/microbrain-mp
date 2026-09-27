# 02 — 小程序：B6 几何模块与渲染选型

**Spec:** `.scratch/region-workbench/spec.md`（“小程序：时间轴几何模块”“小程序：时间轴渲染”）
**设计合同:** `docs/research/proto-region-panel/b6-timeline-design.md`；原型 `pages/agent/proto-region-workbench.html?variant=P2`
**仓库:** mp

**What to build:** 把 B6 时间轴几何从原型抽成与渲染方式无关的纯函数模块，并在真实客户小程序里用固定样例数据画出一条与原型一致的时间轴。同时实现 canvas 2d 与“生成 SVG 字符串后以图片显示”两种渲染，在微信开发者工具中与原型截图叠加对比，保留保真度更高者、删除另一种，并把对比结论写进本票 Comments。

**Blocked by:** None — can start immediately

**Status:** implemented — blocked-on-wechat-login（渲染选型未完成）

- [x] 几何模块提供：`railX(y)`、34px/小时映射与跨日紧凑映射、单侧缎带路径（左边为曲线、右边沿右法线）、刻度与刻度文字统一显隐、午夜仅一次 `00:00` 且无 `24:00`、当前时刻标签整组隐藏判定、端点与当前时刻节点坐标（不避让）
- [x] 少量 `node --test` 验证公开时刻映射与跨日边界；曲线、缎带、刻度和标签按截图验收，不锁定路径字符串或采样点快照
- [x] 渲染满足：进度两层同一路径、深色层裁剪到当前时刻；无独立多边形、无额外前沿线；节点与刻度样式与 B6 一致
- [x] 卡片与时间文字为普通视图，按几何坐标绝对定位叠在图形上，点击可响应
- [ ] 两种渲染的叠加对比截图与结论记录在 Comments，落选实现已删除
- [x] 原型文件未被修改；组件遵守 `pages/agent/AGENTS.md` 的宿主字体中和与 scroll-view 约定

## Comments

2026-09-27：几何、两种渲染器、普通视图覆盖和客户编译完成。只保留 1 项公共时间映射测试。浏览器辅助截图与平台/成熟组件调查见 `docs/research/proto-region-panel/2026-09-27-native-renderer-status.md`。微信官方 CLI 返回 code 10，需要用户登录开发者工具；最终微信视觉比较、唯一渲染器选择及删除落选实现尚未完成。Canvas 当前只是默认候选。
