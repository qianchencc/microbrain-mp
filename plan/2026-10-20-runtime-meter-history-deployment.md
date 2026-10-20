# 远端历史电表查询修复发布

日期：2026-10-20。用户明确要求前往远端服务器更新服务。本次只发布历史分页修复，按 future-tech-standards 的 REL-01/02/03 保留版本、备份与验证证据。

## 发布范围与版本

- 远端旧版：`6c19708`，目录 `releases/20261018-6c19708`；源文件哈希已与该提交核对一致。
- 发布分支：Runtime `release/meter-history-20261020`。在旧版上 cherry-pick 历史窗口修复 `0c4e281`，得到 `a4039b6`，仅4文件变化；未将本地主线其他报告、任务功能和未提交内容一并上线。
- 新版目录：`/vol2/1000/Plugins/iot-agent-runtime/releases/20261020-a4039b6`，`current` 已原子切换至该目录。
- 切换时间：2026-10-20 18:04:39 +08:00；tmux仍为 `iot-agent-runtime`，监听 `127.0.0.1:3210`，Node 22.23.2。公网仍为 `https://mp-agent.qianc.ltd`。
- 沿用 `shared/run-runtime.sh`、原SQLite、配置密钥与任务密钥；仍不启用开发身份回退、开机自启动。此次无数据库结构变更。

## 发布前后验证

- 停止前运行中对话、设备执行、执行中阶段和近期到点阶段均为0；对旧PID发送SIGTERM并等待退出。
- 发布分支本地构建及全量275项通过；远端构建和7项历史查询公开HTTP回归通过。远端原包省略开发工具/类型声明，本次仅补齐已锁定的pdfkit类型用于构建，以编译后的测试执行回归，未改业务依赖版本。
- 新旧依赖lock完全相同，静态依赖文件沿用旧release；新release的workspace链接指向自身目录。当前旧制品及依赖继续保留。
- 公网与回环healthz均200、生产网关、原数据库、devIdentityOverride=false；唯一3210监听对应新release。视频9415及公网视频healthz正常。
- 真实鉴权的公网历史查询通过：2025-10-01 08:00→10-20 08:00共43/43表、2398.04度，noData/partial为空、truncated=false；首次约43.7秒。随后10月1/2/3日分别127.40、143.97、129.83度，43表全覆盖、未截断，约4.6秒。客户模拟采样只证明查询和统计，不代表真实运行效果。
- 未执行设备控制或重新登录获取凭据。

## 备份、回滚与恢复

- 停止服务后用SQLite backup保存主库及sessions库，quick_check均ok；目录权限0700、备份文件0600：`/vol2/1000/Plugins/iot-agent-runtime/shared/backups/meter-history-20261020T100439Z`。
- 远端 `deployment.json` 记录旧/新PID、版本、备份路径和健康结果；本地验证摘要位于 `/private/tmp/meter-remote-deploy-20261020/`，不含身份凭据。
- 回滚时先核对运行任务，再优雅停止3210对应PID，将current原子指回 `releases/20261018-6c19708`，用原 `shared/run-runtime.sh` 重建 `iot-agent-runtime` tmux会话并验证公网。此次无schema变更，通常仅回退代码，不覆盖期间新增业务数据；备份仅用于需要恢复数据库时另行评估。
- 机器重启后仍需按既有约定手动启动tmux；本机FRP无需启动。此次不变更远端FRP或播放器。

小程序前端修复仍为 `b7229fa`，微信真机交互验收独立于本次后端发布。源码问题与行为范围见 [修复交接](2026-10-20-meter-history-navigation-fix.md)。后续建议技能：diagnosing-bugs、future-tech-standards、handoff。
