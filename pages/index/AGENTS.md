# 首页维护说明

- 首页助手入口在 `coms/index-con.vue`：公司物联助手进入 `/pages/agent/dashboard`，办公室物联助手进入 `/pages/agent/index?source=office`，复用原菜单的登录/确权显示条件。
- 名称分两行，复用 uni-icons；子 text 显式继承字号和行高，避免全局样式覆盖。入口不新增会话或后端接口。
