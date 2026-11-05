---
status: accepted
---

# Agent 页面采用领域深模块，不引入 TypeScript 包模板

Agent 页面已经是客户小程序的生产主线，但当前 117 个文件把页面宿主、领域投影、请求适配和原型资料混在同一局部空间；最大的会话、任务和报表文件同时暴露大量实现细节，维护者需要了解文件路径而不是稳定的领域接口。决定继续保持 uni-app、Vue 和 JavaScript/MJS，保留现有路由入口，以 conversation、tasks、observations、energy、actions、navigation 为领域模块；每个领域通过少量入口文件公开行为，具体实现放入私有子目录，页面宿主只负责生命周期、导航和组合。采用 expand–migrate–contract 迁移，先建立入口并迁移调用方，再删除旧入口和未使用实现；测试通过领域入口验证可观察行为。暂不引入 TypeScript `src/packages` 示例结构、路径别名或 TypeScript 专用配置；待目录稳定后再接入适配 JavaScript/MJS/Vue 的依赖边界检查。

## Considered Options

- **直接套用 TypeScript deep-module Skill 模板**：拒绝。仓库没有 TypeScript 包根、tsconfig 或可接入的类型检查命令，新增示例包会制造与 uni-app 路由无关的目录和依赖。
- **只重命名目录，不收敛模块接口**：拒绝。把 `components` 改成客户旧代码中的 `coms` 只能改变名称，不能减少调用方对实现文件的了解。
- **保持当前平铺结构**：拒绝。当前没有循环依赖，但领域入口不清晰、超大宿主文件和大 API 入口会继续扩大维护半径。

## Consequences

路由地址和业务行为保持不变；调用方会改为依赖领域入口，短期需要分批迁移和回归。原型资料与生产代码分离后，文档引用必须同步更新。最终可在不触碰其他领域的情况下修改单个领域，并用边界检查防止新的内部深导入。

## 2026-11-05：高耦合流程的实现归属

本轮保持现有 Vue3 `script setup` 与 JS/MJS；不为接近客户旧页面而改成 Options API，或把 `components` 改名。可读性采用展开模板、状态修改及样式声明；领域规则不回填到 Vue 中。

| 公开入口 | 行为模块 | 页面保留的职责 |
| --- | --- | --- |
| `lib/tasks.mjs` | `planPresentation` 统一周期状态、下次时间和能力；`createPlanManagement` 管理确认后的身份校验、版本冲突恢复、单项／批量暂停与取消 | 列表／详情展示、弹窗与 toast 适配、导航 |
| `lib/conversation.mjs` | `createConversationOperations` 拥有流连接、逐草案选区串行化、确认流程、恢复快照确认栅栏和显式停止 | 输入与草稿 hydration、滚动、弹层、恢复数据落位、宿主生命周期 |
| `lib/energy.mjs` | `createEnergyPanel` 拥有每日／固定窗口读取、历史需求队列、保留快照、电表集合变化与身份失效 | 能耗投影、日历显示、条带定位、生命周期转发 |
| `lib/dashboard.mjs` | `createCompanyOverview` 拥有分区并发读取、快照缓存、通知计数和统一身份失效 | 展示投影、抽屉与导航、告警深链入口 |

新模块不依赖 Vue 或 uni 全局；生产使用 `reactive` 创建可观察展示状态，测试使用普通对象。页面只读取展示事实并调用行为，不接管内部请求序号、队列或确认集合。业务成功仍以服务端返回为准，断流不等于取消；已有结果的失败刷新不更新原始数据时间、不补零。

状态转换回归分别在 `test/agent-{plan-management,conversation-operations,energy-panel,company-overview}.test.mjs`，通过公开入口执行；边界检查阻止 Vue 绕过入口直接导入这四个实现。实施及真实小程序证据见[维护性票据](../../.scratch/agent-maintainability/issues/01-readable-deep-modules.md)。
