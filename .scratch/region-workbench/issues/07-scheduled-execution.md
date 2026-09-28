# 07 — 到点执行

**Spec:** `.scratch/region-workbench/spec.md`（“Runtime：执行器”）
**领域:** ADR 0004 执行规则 1–3、6、7；`CONTEXT.md` 任务执行、错过的阶段、执行身份
**仓库:** iot-agent-runtime + mp

**What to build:** 已安排的任务在阶段时刻自动执行：以创建者身份读取阶段全部设备，只对未达标设备下发并回读，已达标记为成功的无操作。两个阶段各自独立执行。时间轴卡片、任务抽屉和对话中的任务卡都能看到执行中、已完成、部分完成、失败、已错过的状态与逐设备结果。

**Blocked by:** 01, 06

**Status:** implemented — pending user miniapp and real-gateway acceptance

- [x] 构建出的 Runtime 暴露“执行一次到期扫描”方法；生产按默认 15 秒周期调用
- [x] 扫描以 CAS 认领到期 `pending` 阶段；到期超过 10 分钟的置 `missed` 不执行；确认时首阶段已到期但在窗口内则立即执行
- [x] 执行：解密凭据 → 以创建者身份加载授权设备范围 → 缺失或越权设备记 `missing` → 其余交给 01 的执行模块 → 写逐设备结果 → 汇总阶段与任务状态
- [x] 上游 401/授权不可用：阶段 `failed`，原因“创建者登录已失效”
- [x] 任务终态即删除托管凭据；启动时残留 `executing` 阶段置 `interrupted`，不补跑
- [x] 前一阶段失败不影响后一阶段执行
- [x] 视图模型与页面已接线执行中（玉绿）、部分完成（黄铜）、失败、已错过、创建者登录已失效
- [x] Runtime 公开流程测试覆盖已达标无操作、按需下发、阶段独立、补执行窗口、401、终态凭据删除、启动自愈、越权设备和重复扫描不下发
- [ ] 用户在客户微信小程序验收状态与逐设备结果；真实网关执行与回读见票 14

## Comments

2026-09-28：实现与证据见 `plan/2026-09-28-scheduled-execution-handoff.md`、Runtime `test/scheduled-task.test.ts` 和 `test/scheduled-execution.test.ts`。Runtime `1c3947f` 在既有公开场景中补上持久化凭据“确认后存在、终态后消失”的断言；39 项 Runtime 测试、typecheck、build 通过。未执行真实设备控制，不能据此关闭票 14。
