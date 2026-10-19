# 04 — 大范围确认与分阶段结果原型

Status: in-progress
Wayfinder: prototype
Blocked by: 01, 02, 03

## Question

在不逐台堆叠设备卡片的前提下，用户能否看懂并确认跨区域夜间办公收口：包含范围、排除范围、两阶段时间、已满足/不可读/待下发数量，以及执行后的阶段结果、部分失败和未知结果。

## Prototype boundary

- 只验证用户状态模型和信息层级，不接 Runtime、不写生产组件、不保存数据。
- 需要覆盖：待确认、阶段执行中、部分完成、结果未知、最终收口。
- 结果应能回到同一 Task 上下文，不创建独立报告收件箱。

## Prototype

- 页面：[proto-company-night-closure.html](../../../pages/agent/proto-company-night-closure.html)
- URL 状态：`?state=plan`、`?state=executing`、`?state=partial`、`?state=complete`
- 已完成：内联脚本 `node --check`、`git diff --check`。

该原型只验证状态关系和信息层级，不代表生产 UI 已实现，也不连接 Runtime。
