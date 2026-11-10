# CATEGORY-META-01：设备分类副标题精简

2026-11-10。用户确认任务卡片裁切修复后，要求消防安全等设备分类标题下去掉“上次同步…”、“待更新”等文案。

## 变更

`pages/agent/dashboard.vue` 的分类设备抽屉副标题只显示设备数量；所有分类走同一条件。完整“设备目录”（drawerKind=catalog）仍通过既有 directorySyncLabel 显示一次后端 cache.updatedAt 与 stale 提示，遵守目录旧值披露约定。不改缓存、目录同步、准备中/错误状态、数量或设备权限。

## 前端证据

开发者工具 HUAWEI nova 12 Pro，windowWidth=363，同一登录账号的真实页面：

1. 公司总览 → 消防安全，标题下实际节点文本为 `3 台`，无同步时间与待更新，截图见 [分类页头](./category-header.png)。
2. 关闭 → 设备目录“查看全部”，实际节点文本为 `332 台 · 同步于 11-10 09:52`，截图见 [目录页头](./directory-header.png)。后台若返回 stale，继续由原格式器显示上次同步与待更新；本轮真实返回为 fresh，未伪造 stale 状态验收。
3. 两个抽屉均可正常关闭。未执行设备控制、创建任务或发送通知。

HBuilderX mp-weixin 开发编译成功；dashboard.vue Prettier check 通过。文案变更未新增快照/源码断言测试。仅验证模拟器，未由代理验证真机。工作区另有 CompanyDeviceDrawer 等未提交修改，不纳入本次提交。
