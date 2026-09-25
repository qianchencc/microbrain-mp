# Bottom Sheet 组件选型与重做依据

日期：2026-09-24

## 结论

当前 Agent 面板不再继续依赖 `uni-popup` 或 `uni-transition`。它们适合普通弹层，不适合作为可拖拽、可滚动、需要快速重开且必须保持遮罩同步的业务面板底座。

本项目采用“参考成熟组件的结构和状态边界，按当前 uni-app 经典微信渲染器重做”的路线，不直接引入 Web React 组件，也不把 Skyline 专用手势代码直接移植到经典渲染器。

## 一手资料对照

| 来源 | 得到的做法 | 对当前项目的适用性 |
|---|---|---|
| [WeUI 半屏弹窗文档](https://github.com/wechat-miniprogram/weui-miniprogram/blob/master/docs/half-screen-dialog.md) | `show`、遮罩点击、关闭事件、内容 slot 和底部操作区有清晰边界 | 适合作为经典小程序的生命周期与结构参考 |
| [WeUI 半屏弹窗源码](https://github.com/wechat-miniprogram/weui-miniprogram/blob/master/src/components/half-screen-dialog/half-screen-dialog.wxml) | 遮罩单独存在，遮罩 `touchmove` 被捕获，面板与遮罩分别做进出场状态；支持 root portal | 可借鉴；不能直接当作拖拽面板，因为它不是完整的可拖拽 FloatingPanel |
| [微信官方 Skyline bottom-sheet](https://raw.githubusercontent.com/wechat-miniprogram/miniprogram-demo/master/miniprogram/packageSkyline/pages/worklet/bottom-sheet/index.js) | 用 worklet shared value 管理位移；根据 `scrollTop` 和手势方向协商滚动与面板拖拽；结束后统一 timing 回弹 | 手势模型是高质量参考，但依赖 Skyline/worklet，当前经典渲染器不能直接使用 |
| [微信官方 Skyline bottom-sheet WXML](https://raw.githubusercontent.com/wechat-miniprogram/miniprogram-demo/master/miniprogram/packageSkyline/pages/worklet/bottom-sheet/index.wxml) | `pan-gesture-handler` 与 `vertical-drag-gesture-handler` 明确分工 | 说明拖拽和滚动必须有明确所有权，不能让两个容器同时争抢位移 |
| [TDesign MiniProgram](https://github.com/Tencent/tdesign-miniprogram) | Popup 有 visible、placement、overlay、prevent-scroll-through 等普通浮层契约 | 可参考普通 Popup API；其公开 issue [#4525](https://github.com/Tencent/tdesign-miniprogram/issues/4525) 明确组件库缺少可滑动 FloatingPanel，因此不适合作为本需求的直接答案 |
| [shadcn/ui Sheet](https://ui.shadcn.com/docs/components/base/sheet) | Sheet 由 Root、Content、Header、Footer 组合，显示状态和内容组合分离 | 仅作结构思想参考；它是 React/Radix 生态，不能直接进入当前 uni-app |
| [Animate UI Sheet](https://animate-ui.com/docs/components/radix/sheet) | 通过持久化内容、明确的 SheetContent 和可配置进出场过渡组织动画 | 仅作动画状态和组合方式参考；不是微信小程序运行时组件 |
| [uni-popup 官方文档](https://uniapp.dcloud.io/component/uniui/uni-popup.html) | 文档说明真机调试可能受 `setTimeout` 延迟影响，关闭默认存在 300ms 延迟，嵌套 `scroll-view` 也有风险 | 这些限制正好命中当前问题，因此不再作为底座 |

## 重做方案

### 组件结构

组件始终挂在页面级节点，不放进对话 `scroll-view`，也不由弹层组件负责卸载：

```text
sheet-host
├── sheet-mask
└── sheet-surface
    ├── handle
    ├── header
    └── scroll-view / content
```

只有 `sheet-surface` 拥有拖拽位移。遮罩不与 surface 共享 transform，也不由另一个组件异步销毁。

### 状态模型

使用显式阶段：

```text
closed -> opening -> open -> dragging -> settling
open -> closing -> closed
```

阶段变化只由一个 controller 负责。打开、遮罩关闭、横杆关闭、取消拖拽和重新打开都进入同一状态机；禁止再通过 popup 的内部 `showPopup/showTrans` 反推状态。

### 手势边界

- 第一版只允许横杆拖拽，避免内容滚动和面板拖拽同时抢占手势。
- 遮罩捕获 `touchmove`，禁止页面滚动穿透。
- 拖拽中关闭 CSS transition，松手后统一决定回弹或关闭。
- 回弹和关闭都只写同一个 surface 的 transform；遮罩透明度由同一阶段/同一手势状态驱动。
- 重新打开时清理旧的 inline transform，不依赖节点是否被卸载。

## 验收条件

在微信开发者工具和真机各执行一遍：

1. 打开面板，确认遮罩和面板同时出现。
2. 横杆下拉未过阈值，松手后回到原位。
3. 横杆下拉超过阈值，面板和遮罩一起关闭。
4. 关闭后立即重新打开，连续重复至少 5 次。
5. 拖拽过程中切换内容、打开搜索、滚动列表，不出现整页遮罩或面板上窜。
6. 点击遮罩关闭，页面恢复可交互。
7. 快速打开/关闭时不依赖延迟重试、不出现孤立遮罩。

源码测试只验证上述公共行为的稳定契约；最终结论以编译产物和真机重复操作为准。
