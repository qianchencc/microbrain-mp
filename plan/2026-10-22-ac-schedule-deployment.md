# 空调条件任务排程契约生产发布

日期：2026-10-22

## 发布结果

- 目标：`admin@10.5.12.112:40022`，Runtime `127.0.0.1:3210`。
- 旧版本：`releases/20261022-ad65011`。
- 新版本：`releases/20261022-981598d`，源码提交 `981598d`。
- `current` 已原子切换到新版本，唯一 3210 进程 cwd 指向新 release，Node `v22.23.2`。
- 本次包含从 `f1bcc1e` 之后的已提交 Runtime 变更，包括节能展示修复和空调排程契约；小程序前端未随本次 Runtime 发布。

## 发布前验证

- 干净 worktree `981598d`：Runtime 全量测试 355/355、typecheck、build 通过。
- staging 使用生产 SQLite 临时副本启动在 3211，healthz 通过；未使用生产数据库写入、真实身份或设备控制。
- 本地与远端 staging 的 Runtime dist 关键文件 SHA-256 一致：
  - `apps/runtime/dist/server.js`：`6dc51cc40a78cbf6d83a0c5da4c4320bf90468951196fef0441929faf7098337`
  - `packages/config-contract/dist/index.js`：`fd8053df59f4d0282e1b3feee548c0aa5a98467b484354661bb5d5c26ebb90a5`

## 门禁、备份与切换

- 切换前无 pending/executing Task phase；启用周期计划的下一次发生均超过 10 分钟；没有运行中会话。
- SQLite `quick_check` 通过。
- 数据库与 sessions 备份：`/vol2/1000/Plugins/iot-agent-runtime/shared/backups/ac-schedule-/`。
- 切换前后业务行数一致：`tasks=18`、`task_phases=23`、`task_phase_devices=118`、`report_artifacts=4`、`task_plans=6`、`task_notifications=14`。
- 切换后 `quick_check=ok`，`foreign_key_check` 返回 0 行。
- 仅演示使用的 `shared/var/ac-state-freshness-ms` 已移入上述备份，生产恢复默认两分钟状态新鲜度。

## 发布后验收

- 回环 healthz：200，`iotMode=production`、真实网关 `https://ncim.577119.com`、`devIdentityOverride=false`。
- `https://mp-agent.qianc.ltd/healthz`：200。
- `https://iot-agent.qianc.ltd/healthz`：200。
- 两个公网域名的真实身份 `GET /api/agent/conversations/current`：均为 200。
- 新 release dist 含 `needs_clarification` 和排程相关 Runtime 代码。
- 本次未创建或确认任务，未调用真实控制接口，未执行真实设备动作。

## 回滚

按同一门禁核对在途阶段后，优雅停止 3210，执行：

```sh
cd /vol2/1000/Plugins/iot-agent-runtime
ln -s releases/20261022-ad65011 current.next
mv -Tf current.next current
tmux kill-session -t iot-agent-runtime || true
tmux new-session -d -s iot-agent-runtime "exec /vol2/1000/Plugins/iot-agent-runtime/shared/run-runtime.sh"
```

如需恢复旧版演示状态，再从备份目录恢复 `ac-state-freshness-ms`；生产默认应保持该文件不存在。
