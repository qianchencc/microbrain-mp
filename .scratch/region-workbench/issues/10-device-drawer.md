# 10 — 设备抽屉：列表、状态、筛选搜索

**Spec:** `.scratch/region-workbench/spec.md`（“查询接口”“页面与组件”）
**设计来源:** 原型 P2 设备抽屉；现有 `DraftSheetLayer` 的“查看更多”标签与搜索交互
**仓库:** iot-agent-runtime + mp

**What to build:** 用户在区域工作台打开高抽屉，看到本区域全部授权设备（含不可控类型），以拟物精致的产品图卡片呈现。列表先出现，最后已知状态随后加载补上。可按类型、位置、状态标签筛选，点搜索图标后标签滑走、搜索框原位展开，匹配文字高亮。

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] `GET /api/agent/regions/:regionId/devices`：区域内全部授权设备（id、种类、名称、位置），名称位置来自目录事实
- [ ] `GET /api/agent/regions/:regionId/device-states`：平台影子最后已知值与年龄标注，不因年龄抹除
- [ ] 抽屉复用 `DeviceSheet` 底座；设备图使用现有设备图目录
- [ ] 筛选与搜索行为与 `DraftSheetLayer` 一致；筛选、搜索、高亮由视图模型产出，在微信操作流程中验收
- [ ] 状态加载失败不阻塞列表，只显示状态未知
- [ ] Runtime 测试：区域过滤、跨用户隔离、非本人区域 404
