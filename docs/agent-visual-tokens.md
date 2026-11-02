# 物联助手视觉 token

仪表盘采用 G 方案的浅蓝灰视觉，生产 token 的唯一手工维护位置是 `pages/agent/styles/_tokens.scss`；文件内只有 Sass 变量，按组件局部导入并在编译时展开，不修改全局 `uni.scss` 或客户小程序其他模块。

## 当前范围

- 品牌强调、主要文字、辅助文字和页面背景采用 G 方案的蓝灰色；警告文字仍保留独立状态色。
- 紧凑字号、中等圆角和小间距：沿用现有值。
- `pages/agent/` 内使用这些相同值的 Vue 样式按用途接入；无需在运行时读取 CSS 自定义属性。`pages/agent/prototypes/` 是设计原型，不消费生产 token。
- 一个数值相同不等于语义相同；新样式应先确认用途，缺少合适的语义角色时增加角色，不应为了复用而改变视觉或业务语义。

## 暂保留的硬编码

1. 模板中的 `uni-icons`、`switch`、`radio` 等颜色属性仍是字面值，例如 `pages/agent/dashboard.vue` 和 `pages/agent/components/tasks/TaskListSheet.vue`。Sass 变量不能直接供模板属性使用；需要确认微信编译方案后再统一，不能另外手写一份 JS 色表冒充同一来源。
2. JavaScript 生成的 SVG 与图表不能直接继承页面 CSS；`pages/agent/domains/shared/avatar.js` 的静态头像主体已对齐强调色，供公司和办公室 Agent 共用，修改强调色时须同步检查。`pages/agent/domains/energy/energy-chart.mjs`、`pages/agent/domains/regions/timeline-geometry.mjs` 和 `pages/agent/components/energy/CompanyEnergyStrip.vue` 的图表仍保留原值，后续应从同一来源提供颜色并验证输出。
3. 带透明度的八位十六进制、渐变、阴影、部分状态色以及尚未确认可共享角色的字体、边距和圆角仍保持原样。它们的相同色相不一定代表同一用途，不应直接做字符串替换。
4. `ActionDraftCard.vue`、`DraftSheetLayer.vue`、`TaskDetailContent.vue` 未在前一轮 token 迁移中改动；其视觉硬编码仍保留，不属于本轮仪表盘布局调整。
5. 设备产品图及其他图片素材不是可直接继承样式的颜色，保留原资源。

## 仪表盘与验收边界

仪表盘只有一套布局，不再读取或保存精简、详细模式偏好。环境主卡、设备目录、安全台账、通知、日能耗、任务与 Agent 入口使用真实数据和现有组件；准备中、不可用和旧数据仍按各自状态展示。安全摘要表示历史台账，不代表实时告警；设备目录为只读。

首页用电卡展示最近完整计量日及截至该日的七天缩略柱；缺失或不完整的日不补零。点击卡片进入完整能耗统计，日用电、月度对比及逐表明细保留在面板内；有界单表历史不显示公司月度汇总。

模板属性、图表、SVG 及未迁移组件仍保留上述硬编码，因此基础 token 切换不等于全链路换肤。安全、失败和禁用色不能仅因品牌色变化而失去各自语义；单测和编译不能替代微信开发者工具或真机的真实界面验收。
