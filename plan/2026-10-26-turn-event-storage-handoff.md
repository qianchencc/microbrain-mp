# 轮次轨迹改为逐事件追加（2026-10-26）

## 结论

- 生产 Runtime 已切到 `releases/20261026-7bac661`（16:28:38 CST），基于已部署的读预算修复 `a1881a9`。
- 根因不是"日志太多"，而是**每个轨迹事件都把整轮 `events_json` 数组重新序列化并整体写回**：写放大 O(n²)、每次都是主线程同步 SQLite 写并持有写锁。现在改成 `turn_events(turn_id, seq, payload_json)` 一事件一行 INSERT，恢复按 `seq` 重放。
- 旧库在启动时同一事务内拆行并删除 `events_json` 列，崩溃整体回滚；生产已迁移 6840 个事件 / 458 轮，`quick_check` ok，业务行数与迁移前一致。

## 为什么是它

`app.ts` 旧写入路径：

```ts
events.push(persisted);
database.prepare("UPDATE conversation_turns SET events_json = ? WHERE id = ?").run(JSON.stringify(events), turnId);
```

- 一轮 N 个事件，累计写字节 ≈ $\sum_{k=1}^{N} k\bar{s}$，即 O(n²)；流式正文每 120ms 合并一次也只是"少触发几次"，合并后仍然整轮重写。
- 生产库实测（迁移前）：458 轮、`events_json` 合计 25.3MB，最大单轮 3.79MB / 51 个事件 → 该轮累计重写约 184MB；全部历史约 1.0GB。放大源是 `observation.reported` 这类百 KB 级载荷。
- 每次重写都占主线程和唯一主连接的写锁，与电表回填、会话写入互相拖长；修 `busy_timeout` 之前直接 `database is locked`（并被映射成"当前账户身份暂不可用"），之后变成最多 5s 的主线程阻塞。
- 启动自愈还会每次解析全库 `events_json`（25MB），重启后 16s 出现的 4668ms 停顿即属此类。

## 改了什么

| 位置 | 变化 |
|---|---|
| schema | 新增 `turn_events(turn_id, seq, payload_json, type 生成列)`，`PRIMARY KEY (turn_id, seq)` `WITHOUT ROWID`，`type` 上建 `(type, turn_id)` 索引；`conversation_turns` 不再有 `events_json` |
| 迁移 | 启动时若检测到旧列：`BEGIN IMMEDIATE` → 逐轮拆行（先清该轮行）→ `ALTER TABLE ... DROP COLUMN events_json` → `COMMIT`；失败回滚，下次启动重试 |
| 写入 | 流式 `writeEvent` 与 `appendTurnEvent` 均改为单行 INSERT，序号取 `MAX(seq)+1`，载荷 `sequence` 与行 `seq` 同步 |
| 读取 | 恢复、当前会话、报告引用、历史隔离、引用报告查找全部按轮次分组读行；按类型筛选的路径用 `type` 索引，不再解析无关事件 |
| 启动自愈 | 只挑出"没有任何终态事件"的轮次（`type` 索引），不再全表 `JSON.parse` |
| 丢弃轮 | 删除 `conversation_turns` 行时同时删 `turn_events`，不留孤儿 |

## 验证

- Runtime 全量 **410/410 通过**，`typecheck` 0 错误；新增 `test/turn-events-storage.test.ts` 锁住"一事件一行、序号连续、旧库迁移后可恢复"。
- 迁移演练（16:20 `VACUUM INTO` 备份的本地副本，跑新构建 `buildApp`）：458 轮 / 6840 事件无丢失，`seq` 全部从 1 连续，`events_json` 列已删，`quick_check=ok`，`foreign_key_check` 0 条，`conversations/action_drafts/tasks/task_plans/report_artifacts/task_notifications/meter_history_samples` 行数完全不变；再启动一次仍为 6840/458（幂等）。
- 生产切换后实测：`healthz` 200（17ms），`events_json` 列已删，`turn_events=6840`、`conversation_turns=458`、序号无不连续、无"缺终态"轮次；`tasks=44`、`task_plans=10`、`report_artifacts=9`、`task_notifications=38`、`meter_history_samples=233645` 与迁移前一致。
- 发布前备份目录：`/opt/iot-agent-runtime/shared/backups/20261026-1620-turn-events/`（含 `VACUUM INTO` 主库、`.sessions`、密钥与 `runtime.env`）。

## 边界与未完成

- 生产**新写入**路径要等用户下一条真实消息才会在 `turn_events` 里增长；本地 HTTP 回归已覆盖同一路径。
- 事件载荷本身还没裁剪：`observation.reported` 单条可达 140KB，现在只写一次不再是放大源，但仍是磁盘与解析成本。
- 电表历史回填仍在主线程、仍是同步事务；未开 WAL。`busy_timeout=5000` 只是把硬失败换成有界阻塞。
- 删列不可逆：回滚必须停服务 → 用 16:20 备份覆盖主库与 `.sessions` → `quick_check` → 启动（规范见 `plan/2026-10-23-runtime-cloud-release-spec.md` §8.2）。

## 复核命令

```sh
ssh root@38.76.215.138 '
/opt/node22/bin/node --experimental-sqlite -e "
const {DatabaseSync}=require(\"node:sqlite\");
const db=new DatabaseSync(\"/opt/iot-agent-runtime/shared/var/real-runtime.sqlite\",{readOnly:true});
console.log(db.prepare(\"SELECT COUNT(*) c FROM turn_events\").get(),
  db.prepare(\"SELECT COUNT(*) c FROM (SELECT turn_id,COUNT(*) n,MAX(seq) m FROM turn_events GROUP BY turn_id) WHERE n!=m\").get());
db.close();"
journalctl -u iot-agent-runtime --since \"30 minutes ago\" --no-pager | grep "event-loop-stall"
'
```
