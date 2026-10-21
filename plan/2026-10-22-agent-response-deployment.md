# Agent 响应可靠性更新远端发布

日期：2026-10-22。发布目标为 `admin@10.5.12.112:40022` 上的 Runtime，不是公网出口云主机。公网地址仅通过该机器的 FRP 转发到本机 `127.0.0.1:3210`。

## 发布版本

- 源码提交：`03c552d`。
- 代码变更来源：`eca37eb`，修复无工具副作用前的模型连接超时；`03c552d` 补充最终验证差异记录。
- 旧版本：`releases/20261021-fc46c6e`。
- 新版本：`releases/20261022-03c552d`。
- 当前软链接已原子切换到新版本。
- 远端 Runtime 继续使用真实客户网关、原 SQLite、原配置密钥和任务凭据密钥；没有开启开发身份覆盖。

## 发布门禁

- 本地 Node 22 类型检查通过。
- 本地 Node 22 构建通过。
- Runtime 串行全量测试：343/343 通过。
- 切换前运行中会话、执行中草案、执行中阶段、10 分钟内到期阶段、10 分钟内到期计划均为 0。
- 主库和 sessions 库已备份至远端：
  `shared/backups/agent-response-20261022-20261021T161304Z/`。
- 备份 `PRAGMA quick_check` 通过；切换后主库 `quick_check` 和 `foreign_key_check` 通过。
- 业务行数切换前后保持一致：tasks 15、task_phases 20、task_phase_devices 111、report_artifacts 4、task_plans 6、task_notifications 11。

## 线上验证

- 新进程 PID：537755；唯一监听：`127.0.0.1:3210`；Node 22.23.2。
- 回环和两个公网别名 `/healthz` 均返回 200，Runtime 为 production，`devIdentityOverride=false`。
- 真实办公室身份问候：HTTP 200，事件以 `message.completed → run.completed` 收口。
- 真实办公室设备草案：HTTP 200，先调用 `find_device_candidates` 和 `propose_lighting_draft`，随后进入 `run.awaiting_confirmation`；未确认、未下发设备控制。
- Company 电表窗口首读约 1–1.7 秒返回 `202 ENERGY_REPORT_PREPARING`；后台准备完成后同窗口约 1.9 秒返回 ready，43/43 表、`truncated=false`，没有把历史分页等待暴露给前台。

## 回滚

先按既有门禁核对运行中会话和阶段，优雅停止 3210，再将 `current` 原子指回 `releases/20261021-fc46c6e`，使用 `shared/run-runtime.sh` 重建 `iot-agent-runtime` tmux 会话并重新验证健康检查和真实只读流。数据库备份只在评估增量后使用，不随代码回滚自动覆盖线上数据。

本次没有发布小程序未提交改动，没有执行真实设备控制，也没有重新登录客户账号。
