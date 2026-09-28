# 08 — 区域工作台删除任务

**Spec:** `.scratch/region-workbench/spec.md`（“Agent 工具与任务富面”中的取消接口、“任务抽屉”）
**领域:** `CONTEXT.md` 任务取消；ADR 0004 第 4 条
**仓库:** iot-agent-runtime + mp

**What to build:** 用户在任务抽屉中点“删除任务”，二次确认后：未开始的任务整体取消，执行中的任务取消剩余阶段，已发生的设备动作不回滚。任务仍留在时间轴上，变淡并标“已取消”。已结束的任务不显示删除。授权不覆盖任务全部设备的用户无法删除，任务在打开后被他人改变时删除明确失败。

**Blocked by:** 05, 06

**Status:** implemented — pending user miniapp acceptance

- [x] `POST /api/agent/tasks/:id/cancel`（带版本）：未开始整体 `cancelled`；执行中剩余 `pending` 阶段置 `cancelled`、已执行阶段结果保留；已结束 409；权限不足 403；版本冲突 409；终态时删除托管凭据
- [x] 时间轴接口返回“是否可取消”，抽屉据此显示按钮
- [x] 删除前二次确认；成功后抽屉与时间轴刷新为已取消样式
- [x] 被取消的阶段不再被扫描执行
- [x] 少量 HTTP/扫描测试保护越权、版本冲突和取消后不下发
- [ ] 按钮、确认弹窗与已取消样式由用户在微信小程序中验收

## Comments

2026-09-28：Runtime `0b44f94` 与 mp `3275984` 已实现取消闭环，公开 HTTP 场景见 `test/task-cancellation.test.ts`。`f649c74` 的 P2 卡片收敛曾移除可见状态短文案，本轮恢复取消态“已取消”标签；真实小程序操作仍由用户验收。
