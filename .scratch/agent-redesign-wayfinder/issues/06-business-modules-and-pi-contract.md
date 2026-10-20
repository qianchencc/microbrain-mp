# Pi 与业务模块的职责和可组合接口

Status: open
Labels: wayfinder:grilling
Parent: [物联 Agent 重设计地图](../map.md)
Assignee: unassigned
Blocked by: [现状版本、能力与证据缺口基线](04-current-state-evidence-baseline.md)、[完整业务委托的交付与自主推进界限](05-complete-delegation-outcomes.md)
Mode: HITL

## Question

依据已核对的现状和已确认的完整交付，哪些行为交给 Pi 的语言/调查判断，哪些必须由确定性业务模块承接，业务之间通过什么事实与引用组合？哪些现有输入、恢复和结果职责应保留、深化、替换或退出？

## Context

首条控制候选已暴露改时重抄/重绑、核验政策分支和整集/子集问题；报告候选则已有声明式要求与事实准备。两者不能只因都返回提案或 completed 就套同一输入/终态；也不能为了减少工具数建万能入口。原始证据见[现状对照](../../../docs/research/2026-10-20-agent-delegation-current-state.md)。

## Resolution needed

明确业务模块 interface 与 seam、可选证据与必经准备、事实/意图/提案/Task/报告/引用生命周期及恢复；对每个保留/替换决定说明收益和退出旧复杂度的方式。先判断完整能力是否成立，再冻结最小接口；不编写生产代码，不预建工作流或通用注册表。

## Comments

- 2026-10-20：建图阶段开放；依赖事实基线与交付界限，不能直接把旧局部修订草案当 resolution。
