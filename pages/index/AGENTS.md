# 首页维护说明

- 首页助手入口在 `coms/index-con.vue`：公司物联助手进入 `/pages/agent/dashboard`，复用原菜单的登录/确权显示条件。办公室物联助手不单独设入口（2026-10-27 移除），由仪表盘导航标题的「办公室」进入。
- 名称为单行「物联助手」，与其他菜单项一致；图标为 `static/iot-assistant-icon.png`（玉漆 blob 透明底 PNG，与 Agent 头像同一形象），`<image>` 直引本地资源。入口不新增会话或后端接口。
