# 远端电表快照与答复协议更新发布

日期：2026-10-21。用户要求整理后端未发布更新并完成远端发布。本次按既有 releases/current 原子切换惯例执行，沿 REL 门禁、备份与验证证据。

## 发布范围与版本

- 远端旧版：`releases/20261021-8a6ef14`（当日上午 scheduled-safety 发布）。
- 新版目录：`/vol2/1000/Plugins/iot-agent-runtime/releases/20261021-b501d11`，`current` 已原子切换。
- 发布内容（8a6ef14..b501d11 共 13 提交）：
  - `b501d11` Company 电表报告持久快照：冷请求 202 准备中 + 后台构建；过期先回旧快照后台刷新；刷新失败保留旧值；401/403 清理该身份快照。
  - `687d85e` 历史电表页定位串行探测改有界并行（≤4）。
  - `64ada25` Company 目录快照跨 Agent 读共享；`0f1f5e3` 缓存新鲜度修正。
  - `a0f79d0` `reply_to_user` 退役，普通答复直接流式发布；`5175170` 事件 turn-local `sequence`；`73a548f` 模型分段计时。
  - 其余为文档记录提交。
- 依赖零变化：staging 复用上一 release 的 `node_modules`（相对 workspace 链接自动指向新目录），远端 Node 22.23.2 构建。
- 数据库无存量表结构变更；快照表由代码惰性创建，复用主 SQLite。

## 切换与门禁

- 切换工具 `releases/switch-meter-snapshot.py`（沿上次脚本适配）：门禁 5 项全 0（运行中会话/执行中草案/执行中阶段/近到期阶段/近到期计划），SIGTERM 优雅退出旧 PID 2475168。
- SQLite backup 主库+sessions 至 `shared/backups/meter-snapshot-20261021T131247Z`，quick_check ok，目录 0700、文件 0600。
- 新 PID 10274，cwd 核对为新 release，唯一 3210 监听，Node v22.23.2；`deployment.json` 记录于备份目录与 `shared/meter-snapshot-deployment.json`。
- 切换时间：2026-10-21 21:12:49 +08:00；tmux 会话 `iot-agent-runtime` 重建，健康检查通过，否则自动回指旧版（脚本内置回滚）。

## 发布前后验证（真实鉴权，公网）

- 回环与公网 `mp-agent`/`iot-agent` 两别名 healthz 均 200，iotMode=production、devIdentityOverride=false。
- 电表快照端到端：冷请求 `GET /api/agent/company-meter-report`（2025-10-01 08:00→10-20 08:00，全部电表）返回 `202 ENERGY_REPORT_PREPARING`；约 45 秒后同请求 `200`，`cache.status=ready`、`total=2398.04 度`、`coverage.meters=43/43`、`noData/partial` 为空、`truncated=false`——与 10-20 实测基准值一致。
- Agent 流探测（office 会话，问候语）：`run.started seq=1 → message.delta seq=2 → message.completed seq=3 → run.completed seq=4`，普通答复经新链路直接流式发布，无 `run.failed`。
- 未执行设备控制；未重新登录任何账号；公司来源会话探测因开发身份为 Office 域返回 `CONVERSATION_SOURCE_MISMATCH`（符合预期，公司读路径已由电表接口验证）。

## 回滚

停止并核对在途任务后，将 `current` 原子指回 `releases/20261021-8a6ef14`，用 `shared/run-runtime.sh` 重建 `iot-agent-runtime` tmux 会话并验证公网。快照表为新增表，回退旧版不读取即无副作用；备份仅用于需要恢复数据库时另行评估。

## 边界

- 小程序前端配套（`076d3f9` 缓存保护与 `d54b065` 有序 item 流）属微信侧发布，不在本次后端发布范围。
- 草稿通道协议（`e3712b4`，`codex/agent-response-05` worktree）未经真实验收，**未随本次上线**；本机 worktree 保留待续验。
