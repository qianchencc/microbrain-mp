# 既有能力保留、候选合流与首条验证选择

Status: open
Labels: wayfinder:grilling
Parent: [物联 Agent 重设计地图](../map.md)
Assignee: unassigned
Blocked by: [Pi 与业务模块的职责和可组合接口](06-business-modules-and-pi-contract.md)
Mode: HITL

## Question

在新的业务职责与接口明确后，原项目成熟能力、两条隔离候选、已有 04–06 和报告工作如何衔接？以哪条完整用户委托作为首个验证切片，怎样证明新旧迁移没有丢能力或换弱结果标准？

## Context

[现状对照](../../../docs/research/2026-10-20-agent-delegation-current-state.md) 区分主线、候选与报告线；报告线已记录共享 pi-runner/app/read.agent.spec 等合流接缝。独立 worktree 不保证组合兼容，两个分支分别通过不等于集成通过。此票不批准实际合并、切服务或设备控制。

## Resolution needed

给出保留/替换/适配/历史只读的迁移清单、依赖与首个真实业务验证理由；区分局部离线、模型、网关、微信、生产与物理效果证据，保留回退和授权门槛。出口是交给 to-spec 的决策基线，再由 to-tickets 拆业务切片，不在地图上直接驱动实现。

## Comments

- 2026-10-20：建图阶段开放；未选定新实施切片，旧待验收项不因此关闭或自动放行。
