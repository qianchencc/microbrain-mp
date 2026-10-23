# 首页双助手入口交接

已完成：首页原“物联助手”改为“公司物联助手”，旁边新增“办公室物联助手”。

- 公司入口：`/pages/agent/dashboard`，沿用仪表盘和公司 Agent 浮层。
- 办公室入口：`/pages/agent/index?source=office`，直接进入现有办公室对话页。
- 两入口复用原菜单的登录/确权条件，名称分两行显示，分别使用对话和房屋图标。
- 继续走 `goPage` 的 navigateTo，正常返回按实际页面栈回首页；原 source 会话隔离机制不变。

实现：`pages/index/coms/index-con.vue`；维护说明：`pages/index/AGENTS.md`。

## 验证

- Agent 测试 156/156 通过。
- HBuilderX 微信开发版编译成功，产物包含两个入口及 source=office。
- 既有 uniCloud 未关联、check/detail sourcemap/default 导出、img 选择器与鸿蒙 UA 告警仍在，本轮未涉及。
- 微信开发者工具自动读取失败（应用绑定/图像获取错误），未完成模拟器点击或真机验收。

## 接续

重新加载微信开发包，分别检查两个入口目标和返回首页，重进检查历史与草稿归属，并核对窄屏两行文案。

本轮不涉及后端部署，未上传或发布微信小程序。
