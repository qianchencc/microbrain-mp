# 核账证据维护

- 当前生产行为以current指向的提交为准；开发分支“已实现”与提交祖先关系须分别核对，cherry-pick还须比较实现。
- `run.completed`是对话终态；业务是否完成读Task/Phase/逐设备回执。`satisfied`没有下发，`verified`仅表示网关权威面板相符。
- 本目录探针是已知缺口的诊断，绿色表示复现成功。修复前先改为业务期望断言并观察红灯。
- 当前事实入口：[核账报告](../../plan/2026-10-26-company-automation-reliability-audit.md)。
