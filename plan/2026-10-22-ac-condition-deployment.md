# 空调周期条件检查发布（远端 3210）

日期：2026-10-22。发布目标为 `admin@10.5.12.112:40022` 上的 Runtime；公网 `mp-agent.qianc.ltd` / `iot-agent.qianc.ltd` 仍只通过该机器的 FRP 转发到 `127.0.0.1:3210`。

## 版本与范围

- 源码提交：`f1bcc1e`（`feat: add bounded recurring AC condition checks`）。
- 包含提交：`03c552d..f1bcc1e` 共 3 个（`6711ad6` 回复排版约束、`aba062d` 能耗语义、`f1bcc1e` 空调条件检查）。
- 旧版本：`releases/20261022-03c552d`；新版本：`releases/20261022-f1bcc1e`，`current` 已原子切换。
- 依赖零变化：`package-lock.json`、`apps/runtime/package.json` 与旧版一致；staging 以硬链接复用旧 release 的 `node_modules`，远端 Node `v22.23.2` 构建。
- 数据库无表结构变更；沿用主 SQLite、配置密钥与任务凭据密钥，未开启开发身份回退，未改远端 FRP 和视频服务。

## 发布门禁

- 干净 worktree（`git worktree add --detach f1bcc1e`）+ `npm ci`：Runtime 全量 `350/350`，typecheck、build 通过。
- 本地构建与远端 staging 构建的 `apps/runtime/dist` 逐文件 SHA-256 全部一致。
- 远端 staging 运行 6 项定向回归（空调窗口/频率/标题/周期、报告摘要与节能口径）全部通过。
- 首次门禁检查发现 1 个 `running` 公司会话（14:40:29 以 `run.awaiting_confirmation` 收口），未强制切换；约 30 秒后会话转 `idle`，重新执行门禁。
- 切换时门禁 5 项全 0：运行中会话、执行中草案、执行中阶段、10 分钟内到期阶段、10 分钟内到期计划。
- 主库与 sessions 库已备份至 `shared/backups/ac-condition-20261022T064049Z/`（目录 0700、文件 0600），`quick_check` 通过；切换后主库 `quick_check`、`foreign_key_check` 通过，业务行数前后一致：tasks 16、task_phases 21、task_phase_devices 112、report_artifacts 4、task_plans 6、task_notifications 12。

## 线上验证

- 新 PID `3036875`；唯一 `127.0.0.1:3210` 监听；cwd 为 `releases/20261022-f1bcc1e`；Node `v22.23.2`；tmux 会话 `iot-agent-runtime` 重建。
- 回环与两个公网别名 `/healthz` 均 200：`iotMode=production`、`devIdentityOverride=false`、`modelId=GLM-5.3-Flash`。
- 真实身份只读：`GET /api/agent/conversations/current` 200；`GET /api/agent/notifications?source=company&limit=5` 200（5 条，未读 0），通知摘要投影在新版本正常运行。
- 新代码已上线：`dist/tasks/task-title.js`、`dist/tasks/report-summary.js` 存在于 `current`，构建产物含服务器派生标题。
- 本次未创建提案、未执行设备控制、未调用模型对话、未重新登录客户账号。

## 回滚

按既有门禁核对在途会话/阶段后，优雅停止 3210，将 `current` 原子指回 `releases/20261022-03c552d`，用 `shared/run-runtime.sh` 重建 `iot-agent-runtime` tmux 会话并复验健康检查与真实只读接口。本次无表结构变更，通常只回退代码；备份仅在需要恢复数据库时单独评估。

## 边界

- 只发布 Runtime；小程序前端提交 `64b7648` 未随本次发布，微信真机渲染与交互验收独立进行。
- 真实空调条件检查的到期执行、设备回读和节能展示仍需用户明确授权后单独验收；本次不声称已验证真实设备控制。
