# 10 — 设备抽屉：列表、状态、筛选搜索

**Spec:** `.scratch/region-workbench/spec.md`（“查询接口”“页面与组件”）
**设计来源:** 原型 P2 设备抽屉；现有 `DraftSheetLayer` 的“查看更多”标签与搜索交互
**仓库:** iot-agent-runtime + mp

**What to build:** 用户在区域工作台打开高抽屉，看到本区域全部授权设备（含不可控类型），以拟物精致的产品图卡片呈现。列表先出现，最后已知状态随后加载补上。可按类型、位置、状态标签筛选，点搜索图标后标签滑走、搜索框原位展开，匹配文字高亮。

**Blocked by:** 03

**Status:** implemented — 微信模拟器已验证，真机待验

- [x] `GET /api/agent/regions/:regionId/devices`：区域内全部授权设备（id、种类、名称、位置），名称位置来自目录事实
- [x] `GET /api/agent/regions/:regionId/device-states`：平台影子最后已知值与年龄标注，不因年龄抹除
- [x] 抽屉复用 `DeviceSheet` 底座；设备图使用现有设备图目录
- [x] 类型/位置/状态互斥分组、搜索过滤及高亮由视图模型产出，在微信模拟器操作流程中验收
- [x] 状态加载失败不阻塞列表，只显示状态未知
- [x] Runtime 测试：区域过滤、跨用户隔离、非本人区域 404

## Comments

2026-09-27：真实客户登录态在微信模拟器读取两个授权区域，分别为 5 台和 7 台；检查了分组、搜索、关闭重开、状态后补和 P2 原型布局。仅只读，没有设备控制。状态请求可能明显慢于目录；真机手势与性能仍待验收。交接见 `plan/2026-09-27-region-device-browser-handoff.md`。
