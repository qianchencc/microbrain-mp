# 0001 — 业务事实使用 MySQL，Redis 仅承载非事实能力

Status: 采纳 · Date: 2026-10-28

Runtime 的单 SQLite 文件同时承载会话、事件、任务、报告和配置；客户选型清单要求 MySQL 与 Redis。用户已确认：Java 重构采用 MySQL 作为长期业务事实库，Redis 只用于缓存、分布式锁、幂等和限流；Pi session 首期保留 Node sidecar 的 SQLite backend，以降低 `pi-agent-core` 行为迁移风险。

## 决定

- Java 业务域的会话事实、NDJSON 事件、草案、任务、周期计划、通知、报告元数据、审计和配置修订使用 MySQL 持久化。
- Redis 不作为唯一事实来源；仅用于可重建的缓存、分布式锁、幂等键、限流和运行期协调。
- Node sidecar 首期继续使用 `@earendil-works/pi-session-backend-sqlite-node` 保存 Pi 内部 session、branch、compaction 和 discard 所需数据。
- Java 模块先定义仓储入口和行为测试，再接入 MySQL/Redis 实现；业务调用方不得依赖具体存储。
- Pi session 迁移到 MySQL-backed backend 不属于首个可运行闭环，需单独验证后再决定。

## 后果

- MySQL 迁移必须保留 `turn_events` 的逐事件追加、sequence 重放、幂等和终态恢复语义。
- Redis 故障不能导致业务事实丢失；可恢复缓存失效只能触发重建或受控降级。
- 首期存在 MySQL 与 Pi SQLite 两类持久化，需要分别备份、恢复和健康检查。
- `pom.xml` 可以在存储探针通过后引入 MySQL/Redis 依赖；在探针之前仍保持当前骨架可构建。
