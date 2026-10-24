# Agent「原因未确认」故障与修复

日期：2026-10-24
Runtime 提交：`45342e2`，发布目录 `/opt/iot-agent-runtime/releases/20261024-45342e2`
技术证据与复现细节：`iot-agent-runtime/plan/2026-10-24-session-writer-lease-recovery.md`

## 结论

真实对话失败发生在模型输出之后、写入会话历史之前：SQLite session 的 writer lease 因一次进程级 ≥30s 停顿过期，依赖库把租约丢失永久置位，此后同一会话每次落库都抛 `SessionError: writer lease was lost`。事件流里能看到模型正文，最终却以「Agent 处理失败：原因未确认」结束，且该轮没有写入历史。

生产数据可对照：`4755be57` 会话仅首轮写入 4 条 entry，之后 4 轮 `appended_entry_ids_json` 全为空；`writer_leases` 中 4 个会话的到期时间同时冻结在 09:11Z，而新会话持续正常续期。journal 的 realtime/monotonic 偏移无跳变，排除时钟问题。

## 修复

1. 写租约丢失后驱逐缓存会话、重新领取租约并重放该次追加（租约校验在写入事务之前，不会产生重复条目）；所有落库入口统一走该路径。
2. 租约放宽为 120s TTL / 15s 心跳，普通停顿不再触发丢失。
3. `[business-failure]` 增加原始错误类型、错误码与来源栈（不含消息文本），同类问题可直接定位。
4. 新增 `[event-loop-stall]` 遥测（最大阻塞 ≥2s 时输出），用于定位本次仍未确认的 30s 停顿来源。

## 验证

- Runtime 全量 372/372；新增回归用例在修复前稳定复现 `run.failed`，修复后两轮均 `run.completed` 且历史完整。
- 公网真实身份验证：新建会话正常答复 → 人工把该会话租约置为过期 → 再发消息返回 `run.completed`，日志出现一次 `[session-writer-recovered]`，session entries 2 → 4。
- 发布前 `quick_check=ok`、无在途阶段；数据库、`.sessions`、密钥与 `runtime.env` 已备份至 `shared/backups/20261024-1752-session-lease`。

## 遗留

- 30s 停顿的具体来源未确认；下次出现时按 `[event-loop-stall]` 与同窗口工具耗时定位（当时 `summarize_energy` 耗时 35s，正常 2.2s）。
- 开发身份创建 `source=company` 会话后访问/删除均报 `CONVERSATION_SOURCE_MISMATCH`，与本次故障无关，未处理。
