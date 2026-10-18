# 远端 Runtime 持久化部署记录

日期：2026-10-18

## 目标

将 `iot-agent-runtime` 的已提交版本 `6c19708` 持久化运行在 `admin@10.5.12.112` 的 `/vol2/1000/Plugins/` 下，同时保留该机器原有的 3200 端口服务。

## 部署结果

- 部署目录：`/vol2/1000/Plugins/iot-agent-runtime/`
- 当前发布：`releases/20261018-6c19708`
- 当前软链接：`current`
- Runtime 本地监听：`127.0.0.1:3210`
- Node：`v22.23.2`（符合 Runtime `>=22.19.0 <23`）
- 运行方式：远端 `tmux` 会话 `iot-agent-runtime`
- 开机恢复：按当前要求不启用；重启机器后需手动重新创建 tmux 会话
- IoT 网关：`https://ncim.577119.com`
- 公网主地址：`https://mp-agent.qianc.ltd`
- 公网备用别名：`https://iot-agent.qianc.ltd`
- 公网通道：远端已有 `frpc.service` 新增 `mp-agent` 与 `iot-agent` 两个 HTTP 代理，均指向 3210

## 配置边界

- Runtime 使用独立的远端 SQLite 数据库和加密配置密钥。
- 服务未配置固定 `AGENT_DEV_IDENTITY`；请求继续使用调用方提交的 Bearer 与租户标识。
- 本机 `.env`、固定开发身份和未提交源代码没有复制到远端。
- 远端原有 `3200` 端口属于 `wowwall-prod-app-1`，没有停止或覆盖。

## 验证

- 远端本地 `/healthz`：HTTP 200。
- 公网 `/healthz`：HTTP 200，返回 `iot-agent-runtime`、生产 IoT 模式和 `GLM-5.3-Flash`。
- `mp-agent.qianc.ltd` 与备用别名均已完成公网健康检查。
- 带真实身份的公网公司环境只读查询：HTTP 200，返回环境设备数据。
- 带真实身份的公网 Agent 探测：`run.started → message.completed → run.completed`，没有 `run.failed`。
- Node 22 重启后再次完成上述健康、只读和 Agent 流探测。
- Runtime 当前由 tmux 持有；FRP 公网通道继续由 `frpc.service` 管理。

## 回滚

- Runtime：将 `current` 指回旧 release 后重建 `iot-agent-runtime` tmux 会话。
- FRP：恢复 `/vol2/1000/Plugins/frpc/frpc.toml` 部署前的带时间戳备份，再重启 `frpc.service`。
