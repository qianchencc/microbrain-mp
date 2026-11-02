# 物联助手视觉 token

本轮只统一适合直接共享的现有视觉值，不迁移 G 方案布局，也不改变现有业务状态。生产 token 的唯一手工维护位置是 `pages/agent/styles/_tokens.scss`；文件内只有 Sass 变量，按组件局部导入并在编译时展开，不修改全局 `uni.scss` 或客户小程序其他模块。

## 当前范围

- 品牌强调、主要文字、辅助文字、页面背景和警告文字：沿用现有值。
- 紧凑字号、中等圆角和小间距：沿用现有值。
- `pages/agent/` 内使用这些相同值的 Vue 样式按用途接入；无需在运行时读取 CSS 自定义属性。`pages/agent/prototypes/` 是设计原型，不消费生产 token。
- 一个数值相同不等于语义相同；新样式应先确认用途，缺少合适的语义角色时增加角色，不应为了复用而改变视觉或业务语义。

## 暂保留的硬编码

1. 模板中的 `uni-icons`、`switch`、`radio` 等颜色属性仍是字面值，例如 `pages/agent/dashboard.vue` 和 `pages/agent/components/tasks/TaskListSheet.vue`。Sass 变量不能直接供模板属性使用；需要确认微信编译方案后再统一，不能另外手写一份 JS 色表冒充同一来源。
2. JavaScript 生成的 SVG 与图表仍保留原值，例如 `pages/agent/domains/shared/avatar.js`、`pages/agent/domains/energy/energy-chart.mjs`、`pages/agent/domains/regions/timeline-geometry.mjs` 和 `pages/agent/components/energy/CompanyEnergyStrip.vue`。它们被编码为 data URI，不能直接继承页面 CSS；后续应从同一来源提供颜色并验证输出。
3. 带透明度的八位十六进制、渐变、阴影、部分状态色以及尚未确认可共享角色的字体、边距和圆角仍保持原样。它们的相同色相不一定代表同一用途，不应直接做字符串替换。
4. `ActionDraftCard.vue`、`DraftSheetLayer.vue`、`TaskDetailContent.vue` 在本轮开始前已有其他未提交修改，未改动；其视觉硬编码保留，待原有改动合并后按相同原则迁移。
5. 设备产品图及其他图片素材不是可直接继承样式的颜色，保留原资源。

## 后续切换 G 语言

G 只作为已选的后续视觉方向，本轮 token 默认值仍为当前生产视觉。将来切换前，需要补齐实际使用的语义角色，处理上述模板/JS/SVG 入口，并在微信开发者工具或真机分别检查首页、二级面板、公司和办公室 Agent、区域工作台及准备中/错误等状态。安全、失败和禁用色不能仅因品牌色变化而失去各自语义；单测和编译不能替代真实界面验收。
