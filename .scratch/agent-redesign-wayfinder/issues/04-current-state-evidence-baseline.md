# 现状版本、能力与证据缺口基线

Status: open
Labels: wayfinder:task
Parent: [物联 Agent 重设计地图](../map.md)
Assignee: unassigned
Blocked by: None
Mode: AFK（本地事实核对；联网另需授权）

## Question

以什么可复核的版本与证据基线描述“系统现在能做什么”，并把活动服务未知、主仓 WIP、隔离候选和历史验收分开？哪些事实足以支持继续设计，哪些只能作为待验证声明？

## Context

[本轮事实对照](../../../docs/research/2026-10-20-agent-delegation-current-state.md) 已提供初始读数，但没有完成全链路验收；报告契约的未提交声明与实际已提交 HEAD 就存在水位差。源码、夹具、真实模型、网关、微信与物理效果不得互相替代。不能为了核对启动服务、读生产业务库或使用真实身份。

## Resolution needed

给出各业务族可引用的版本、证据范围和未知项；活动版本无法无侵入确认时明确留下未知，不凭本地 HEAD 或历史 PID 断言线上能力。不要求在本票验证所有业务或做测试平台。发现需要新的权限/现场证据时先报告，不自行越过。

## Comments

- 2026-10-20：建图时创建，未认领、未解决；当前材料是初始取证，不是 resolution。
