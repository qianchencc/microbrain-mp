# 025 · superadmin 三层完备性抽查（只读闭环）

日期：2026-09-16 ｜ 证据：`docs/research/2026-09-16-superadmin-three-layer-completeness.md`

## 本轮闭环

用 superadmin（更多区域，关联目录 259 条）在后端三层抽查 门禁/照明/空调 完备性，模型不参与：接口层 ✓ 完备（去重正确、授权边界正确）；操作层 ✓ 完备（控制 id/模板齐备）；**状态层 ✗ 关联来源设备全盲**（关联记录无 `code`，权威读前提缺失；粗状态仅覆盖 scoped 办公室）。

## 新登记票（本轮只记录不实现）

1. **关联设备状态盲区**：目录加载时用物联中心目录按 hubDeviceId 反查补齐 `code`（或按 id 直取 acDetail 动作 id），使权威读对关联设备可用。验收：superadmin 下抽样关联空调能返回权威状态。
2. （自 024 顺延）模型提案延迟、回读窗口标定、鉴权 bearer 口径测试——均未动。

## 踩坑

- 手写 client_secret 两处手误（`MTExNTI5` 是正确字面，源自 `store/modules/user.js`）→ 两次 207。凭据字符串必须从源码复制，不要凭记忆重打。
- 账号 my/office 只有 1 个（院长室）；admin 的「更多区域」全在关联目录，分析范围时要按 scoped ∪ assoc 并集看。
