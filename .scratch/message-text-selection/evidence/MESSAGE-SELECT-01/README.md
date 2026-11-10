# MESSAGE-SELECT-01：用户消息与模型正文原生选字

2026-11-10。用户要求在 Agent 界面长按用户消息和模型正文，选择文字并复制。

## 定位与实现

- `UserMessage.vue` 原本未开启文本选择，为正文 text 添加 `:user-select="true"`。
- `AssistantMarkdown.vue` 原本设置 `selectable`；该属性不是微信 rich-text 的文本选择属性，替换为 `:user-select="true"`。沿用原段落、列表、加粗、代码和表格渲染，不新增长按菜单、复制按钮或自定义事件。
- 正常回复和 draftText 都复用 AssistantMarkdown；公司和办公室复用消息组件。本轮不改工具卡片、输入框、消息编辑/重试逻辑或后端。

## 官方契约

- [微信 text](https://developers.weixin.qq.com/miniprogram/dev/component/text.html)：selectable 已废弃，user-select 从基础库2.12.1支持；会影响节点显示模式。
- [微信 rich-text](https://developers.weixin.qq.com/miniprogram/dev/component/rich-text.html)：user-select 从基础库2.24.0支持，会使节点显示为block；其组件属性没有selectable。
- [uni-app rich-text](https://uniapp.dcloud.net.cn/component/rich-text.html)：selectable 的平台兼容范围为百度小程序，不应拿它开启微信选字。

## 已完成的工程与界面检查

1. HBuilderX mp-weixin 开发编译成功。实际WXML：用户正文 text 和模型 rich-text 均输出 `user-select="{{true}}"`。
2. 两个组件 Prettier check通过；`node --test test/agent-answer.test.mjs` 的段落/列表、表格、标题/代码/分隔线三项回归通过。
3. 真实开发者工具363px办公室会话加载已有用户消息和模型正文；原生组件属性查询均返回 `user-select: "true"`，当前用户正文尺寸30×24px，模型正文331×91px。[页面截图](./layout-363pt.png)仅证明内容和布局展示，不证明已选中或已复制。
4. 使用automator执行用户与模型正文longpress，并尝试持续touchstart约1.2秒。没有取得可见选区手柄或系统复制菜单，未读取剪贴板，也未将事件发送成功当作选字成功。

## 尚未验收

**真机原生长按选字、拖动选择范围、系统复制/剪贴板内容，以及跨段落和表格选择行为均未验收。** 自动化无法取得上述结果，当前只确认原生属性已下发、页面正常；不宣称用户完整操作路径已通过。

本轮未发送新消息、未创建任务、未点击任务确认/重试、未下发设备控制。保留其他工作区未提交改动。后续需在微信真机确认用户正文、模型普通段落/列表/表格，以及滚动和现有消息操作不冲突。
