# Runtime 云端发布规范

日期：2026-10-23

本文取代 `AGENTS.md` 中 2026-10-14 记录的“本机 frpc → 本机 3200”开发预览链路。自 2026-10-23 起，Runtime 与视频播放器直接运行在云端服务器，公网域名不再经过旧机 frp。

## 1. 生产拓扑

```text
Cloudflare (proxied, TLS 由源站 Caddy 用 DNS-01 签发)
        │
        ▼
38.76.215.138:443  Caddy
        ├── mp-agent.qianc.ltd / iot-agent.qianc.ltd → 127.0.0.1:3210 (iot-agent-runtime)
        └── mp-video.qianc.ltd                       → 127.0.0.1:9415 (iot-video-player)
```

| 项 | 值 |
|---|---|
| 云服务器 | `root@38.76.215.138`，Ubuntu 24.04.1 LTS，x86_64，香港 |
| Node | `/opt/node22/bin/node`，v22.23.2（禁止改用系统 node） |
| Runtime 版本 | `releases/20261026-d1f39fc`，源码提交 `d1f39fc`（基于`48efa8b`，含普通Company空调权威面板核验；此前控制台与60s目录核验缓存均保留）；本次验收见第11节及同级Runtime的 `plan/2026-10-26-company-ac-readback-handoff.md` |
| Runtime 监听 | `127.0.0.1:3210` |
| 视频监听 | `127.0.0.1:9415` |
| 反向代理 | Caddy，配置 `/etc/caddy/Caddyfile` |
| 进程管理 | systemd：`iot-agent-runtime`、`iot-video-player`、`caddy` |
| 客户网关 | `https://ncim.577119.com`（新机直连，禁止走代理） |

需要指向 `38.76.215.138` 的 Cloudflare **origin A 记录**：

- `mp-agent.qianc.ltd`
- `iot-agent.qianc.ltd`
- `mp-video.qianc.ltd`

Cloudflare 开代理时，公网解析结果仍是 Cloudflare IP；改的是 origin。不要保留旧的 tokyo2/frp origin，否则会间歇性 404。

## 2. 目录与文件

```text
/opt/iot-agent-runtime/
├── current -> releases/20261023-60659f9
├── releases/<YYYYMMDD>-<shortsha>/
├── shared/
│   ├── runtime.env                  # 0600，唯一进程环境文件
│   ├── var/
│   │   ├── real-runtime.sqlite      # 主库
│   │   ├── real-runtime.sqlite.sessions
│   │   ├── config-secret-key        # 0600
│   │   └── task-credential-key      # 0600
│   └── backups/<YYYYMMDD>-<reason>/
└── video/                           # index.html / player.js / serve.mjs
```

`runtime.env` 当前内容（密钥已省略）：

```sh
NODE_ENV=production
HOST=127.0.0.1
PORT=3210
IOT_BASE_URL=https://ncim.577119.com
DATABASE_PATH=/opt/iot-agent-runtime/shared/var/real-runtime.sqlite
NO_PROXY=127.0.0.1,localhost,ncim.577119.com
CONFIG_SECRET_KEY=<0600 文件内容>
TASK_CREDENTIAL_KEY=<0600 文件内容>
```

约束：

- Runtime 只监听回环；80/443 只由 Caddy 暴露。
- 不设置 `HTTP_PROXY`/`HTTPS_PROXY`。新机直连 `ncim` 实测 20/20 成功、中位约 0.4s；如未来确需代理，必须把 `ncim.577119.com` 放进 `NO_PROXY`。
- `runtime.env`、两个 key 文件必须为 `0600`。
- `DATABASE_PATH` 的 `.sessions` 文件必须与主库同目录、同名后缀。

## 3. 发布前检查

```sh
# 1) 确定提交并导出干净源码（不要带未提交改动）
cd /Users/qianchen/works/新发展/iot-agent-runtime
git status --short --branch
git archive --format=tar.gz -o /tmp/runtime-<sha>.tgz <sha>
scp /tmp/runtime-<sha>.tgz root@38.76.215.138:/tmp/

# 2) 新机连通性与版本
ssh root@38.76.215.138 'node -v 2>/dev/null || /opt/node22/bin/node -v'
ssh root@38.76.215.138 'curl -sS -o /dev/null -w "%{http_code} %{time_total}\n" https://ncim.577119.com/micro-api/api/ai/healthz'

# 3) 当前库完整性
ssh root@38.76.215.138 '/opt/node22/bin/node --experimental-sqlite -e "
const {DatabaseSync}=require(\"node:sqlite\");
const db=new DatabaseSync(\"/opt/iot-agent-runtime/shared/var/real-runtime.sqlite\",{readOnly:true});
console.log(db.prepare(\"pragma quick_check\").all());
"'

# 4) 当前版本与哈希
ssh root@38.76.215.138 'readlink -f /opt/iot-agent-runtime/current; sha256sum /opt/iot-agent-runtime/current/apps/runtime/dist/server.js'
```

门禁：

- 当前无 pending/executing Task phase；周期计划下一次发生不在发布窗口内（按实际业务确认）。
- 主库 `quick_check` 返回 `ok`。
- 新机直连客户网关成功；失败则停止发布，先查网络。
- 记录发布前业务行数。

## 4. 构建新 release

在云端新机执行，不要在 `current` 目录原地构建。首次构建需要 `build-essential`、`python3`（当前新机已安装）：

```sh
export PATH=/opt/node22/bin:$PATH
REL=/opt/iot-agent-runtime/releases/$(date +%Y%m%d)-<shortsha>
mkdir -p "$REL"
tar -xzf /tmp/runtime-<sha>.tgz -C "$REL"
cd "$REL"

npm ci --no-audit --no-fund
npm run build
# 根 build 依次构建 @iot/config-contract、@iot/runtime、@iot/admin；
# 控制台静态页必须存在 apps/admin/dist/index.html，否则 /admin/ 返回 404。

sha256sum apps/runtime/dist/server.js packages/config-contract/dist/index.js
ln -sfn "$REL" /opt/iot-agent-runtime/current.next
```

`981598d` 的基准哈希：

```text
apps/runtime/dist/server.js                         6dc51cc40a78cbf6d83a0c5da4c4320bf90468951196fef0441929faf7098337
packages/config-contract/dist/index.js              fd8053df59f4d0282e1b3feee548c0aa5a98467b484354661bb5d5c26ebb90a5
```

`2c66370` 只改 `observation.ts`，入口 `server.js` 哈希不变，必须额外核对变更模块：

```text
apps/runtime/dist/iot/observation.js                4496a315c9caa27ba5faddcfcff64ec6a95d21a39d1824a1ad12e0adb90797ee
```

`f241691`（租户电表历史表 + 请求驱动同步 + 本地报告读取）新增/变更模块：

```text
apps/runtime/dist/server.js                         0c13b9e2ad00230f6c9e29446e9697ab8212c290bff3d0dbfe64db7ca24103da
apps/runtime/dist/iot/observation.js                4496a315c9caa27ba5faddcfcff64ec6a95d21a39d1824a1ad12e0adb90797ee
apps/runtime/dist/energy/meter-history-store.js     18e2cf98a09adc2754efd6eed637ae19d2feeb1004b9f2518b8c0871da9b7a4a
apps/runtime/dist/energy/meter-sync.js              e0aec1d5293d9ab61ff13bbbe1aaa6f5f4108a09ba0f5f11ca4214b6c72a3126
```

`d590319` 去掉 60 页上限，`meter-sync.js` 更新为：

```text
apps/runtime/dist/energy/meter-sync.js              48ad6ab06e6e28f4879abb8f5e5d3ee803e929c712f54dd8f02c07a23dd4ceba
```

新提交以构建产物实测哈希为准，记录到发布交接；不要用手工复制的旧 `dist` 冒充新构建。入口哈希相同不代表模块未变。

## 5. 数据库与密钥变更

发布前必须备份：

```sh
B=/opt/iot-agent-runtime/shared/backups/$(date +%Y%m%d-%H%M)-<reason>
mkdir -p "$B"
/opt/node22/bin/node --experimental-sqlite -e "
const {DatabaseSync}=require(\"node:sqlite\");
const db=new DatabaseSync(\"/opt/iot-agent-runtime/shared/var/real-runtime.sqlite\");
db.exec(\"VACUUM INTO '$B/real-runtime.sqlite'\");
db.close();
"
cp -p /opt/iot-agent-runtime/shared/var/real-runtime.sqlite.sessions "$B/"
cp -p /opt/iot-agent-runtime/shared/var/config-secret-key \
      /opt/iot-agent-runtime/shared/var/task-credential-key \
      /opt/iot-agent-runtime/shared/runtime.env "$B/"
chmod 600 "$B"/*
```

规则：

- 禁止对运行中的库直接 `cp`；使用 `VACUUM INTO`/`.backup`，或先停服务。
- schema 变更先在数据库副本上执行，核对 `quick_check`、`foreign_key_check` 与业务行数，再切生产。
- 行数基线（2026-10-23 迁移后）：`tasks=19`、`task_plans=6`、`report_artifacts=4`、`task_notifications=14`。后续发布以当次基线为准。
- 密钥只通过 `runtime.env` 注入；不要把密钥写进 unit、命令历史或提交。

## 6. 切换发布

```sh
# 1) 切代码（无 schema 变更时可用 restart 代替）
ssh root@38.76.215.138 '
  mv -Tf /opt/iot-agent-runtime/current.next /opt/iot-agent-runtime/current
  systemctl restart iot-agent-runtime
  sleep 2
  systemctl is-active iot-agent-runtime
'

# 2) 需要改 Caddy 时：先校验再 reload
ssh root@38.76.215.138 '
  set -a; . /etc/caddy/cloudflare.env; set +a
  caddy validate --config /etc/caddy/Caddyfile
  systemctl reload caddy
'

# 3) 视频变更
ssh root@38.76.215.138 'systemctl restart iot-video-player'
```

Caddy 关键路由：

```caddyfile
https://mp-agent.qianc.ltd, https://iot-agent.qianc.ltd {
	tls {
		dns cloudflare {env.CLOUDFLARE_API_TOKEN}
	}
	reverse_proxy 127.0.0.1:3210
}

https://mp-video.qianc.ltd {
	tls {
		dns cloudflare {env.CLOUDFLARE_API_TOKEN}
	}
	reverse_proxy 127.0.0.1:9415
}
```

不要把这些域名再指回 `127.0.0.1:18080`（frps）；旧机 frp 只保留其他无关隧道。

## 7. 发布后验收

| 检查 | 命令/标准 |
|---|---|
| 回环健康 | `curl 127.0.0.1:3210/healthz` → 200，`iotMode=production`、`iotOrigin=https://ncim.577119.com` |
| 公网健康 | `mp-agent`/`iot-agent`/`mp-video` 的 `/healthz` → 200，通常 <1s |
| 真实身份读 | 带真实 `authorization` + `tenantcode` 请求 `GET /api/agent/dashboard?source=company&section=summary` → 200 且 `errors=[]` |
| 超时率 | 发布后 10 分钟 `journalctl -u iot-agent-runtime` 中 `等待响应超时` = 0 |
| 数据完整 | `tasks`、`task_plans`、`report_artifacts`、`task_notifications` 行数与基线一致 |
| 视频 | `https://mp-video.qianc.ltd/` → 200 |
| 证书 | 直接解析 origin 测试：`curl --resolve <host>:443:38.76.215.138 https://<host>/healthz` → 200 |

2026-10-23 迁移实测：

- 公网 healthz：`mp-agent` 0.26s、`iot-agent` 0.29s、`mp-video` 0.26s。
- 真实身份 dashboard summary：4.6–7.2s，`errors=[]`（迁移前 36s 且任务摘要超时）。
- 新机直连 `ncim`：20/20 成功，中位约 0.4s，偶发 5–6s 尾延迟。

## 8. 回滚

### 8.1 代码回滚

```sh
ssh root@38.76.215.138 '
  ln -sfn /opt/iot-agent-runtime/releases/<previous> /opt/iot-agent-runtime/current
  systemctl restart iot-agent-runtime
'
```

### 8.2 数据库回滚

停服务 → 用备份覆盖主库与 `.sessions` → `quick_check` → 启动。禁止在服务运行时覆盖。

### 8.3 Caddy 回滚

```sh
ssh root@38.76.215.138 '
  cp /etc/caddy/Caddyfile.before-agent-20261023 /etc/caddy/Caddyfile
  systemctl reload caddy
'
```

回滚前 Caddy 配置备份：`/etc/caddy/Caddyfile.before-agent-20261023`；本次迁移后配置备份：`/etc/caddy/Caddyfile.20261023-agent`。

### 8.4 回退到旧机

旧机 `admin@10.5.12.112:40022` 的 Runtime/视频已停止，但 release、数据库、密钥保留。回退步骤：

1. 恢复旧机 frpc 配置：`cp /vol2/1000/Plugins/frpc/frpc.toml.bak.20261023-migration /vol2/1000/Plugins/frpc/frpc.toml`，重启 frpc。
2. 按旧流程启动 Runtime（`shared/run-runtime.sh`）与视频播放器。
3. 将 Cloudflare origin A 改回旧链路入口；验证三个域名 healthz。
4. 旧机直连 `ncim` 仍不可用，必须保留其 `HTTP(S)_PROXY` 配置；这会恢复 1.6–7.2s 延迟和超时风险，只作短期回退。

## 9. 已知边界

- 新机在香港，到宁波客户网关走公网直连；偶发 5–6s 尾延迟。目录读超时仍为 5s；电表历史 500 行分页实测 4–7s，已单独使用 30s 预算（`2c66370`），不要把两者合并回同一个 5s 超时。
- 租户历史回填全部可访问页（当前约 473 页、236,377 行），单次 30 分钟预算，失败页按 `cursor_page` 续跑；不再按 60 页截断。同步是请求驱动，无人使用时不会在 03:00 准点执行，首个请求补跑。
- 模型地址当前为 `https://proxy.qianc.ltd/v1`，会绕 Cloudflare 回到本机；如模型调用成为瓶颈，可评估改为本机 `http://127.0.0.1:18081/v1`，但需先验证鉴权/域名绑定。
- 旧机 frpc 进程仍持有迁移前的三条隧道内存状态；本地端口已关闭，不影响公网。下次 frpc 重启后按新配置不再注册这三条。
- 发布后不要在 Cloudflare 保留多个 origin；多 origin 会让部分请求落到旧链路并出现 404。

## 10. 后端控制台

入口：`https://mp-agent.qianc.ltd/admin/`。页面与 `/api/admin/*` 由 Runtime 同源提供，Caddy 不额外限制路径；未部署 `apps/admin/dist` 或未配置管理员凭据时返回 404。

`/opt/iot-agent-runtime/shared/runtime.env` 需要（0600）：

```sh
ADMIN_PASSWORD_FILE=/opt/iot-agent-runtime/shared/var/admin-password
ADMIN_ORIGIN=https://mp-agent.qianc.ltd
ADMIN_RESTART=1
```

- `ADMIN_PASSWORD_FILE` 指向 0600 密码文件；页面可改密，改密写回该文件并撤销全部管理员会话。密码不写入源码、提交或本文件。
- `ADMIN_ORIGIN` 必须等于浏览器实际 origin；其他域的 POST 返回 403。请统一使用 `mp-agent` 入口，`iot-agent` 只用于只读页面。
- 登录限速 5 次/5 分钟/IP；管理员身份与客户 token 完全隔离。

保存与立即生效：

- 保存只写加密修订版本，不重启、不执行任务；页面显示“已保存的配置等待生效”。
- 设置 `ADMIN_RESTART=1` 后页面出现“立即生效”按钮；`POST /api/admin/apply` 仅在 saved ≠ active 时可用。
- 存在进行中的对话运行、执行总结、`EXECUTING` 草案或 `executing` 任务阶段时返回 409，不打断业务。
- 空闲时接口先返回 200，再让进程收到 SIGTERM；进程先收口 `onClose`（在途电表同步可能耗时数十秒，最长受 systemd `TimeoutStopSec` 约束），再由 systemd `Restart=always` 拉起并加载新修订。管理员会话随进程清除，必须重新登录；发布前先确认没有执行中的草案或任务阶段。
- 未启用 `ADMIN_RESTART` 的部署按钮显示“需手动重启后端”，行为不变。

缓存策略：任务/计划列表、详情、时间轴、日历的全量目录授权核验共用 `catalogTtlMs`（生产 60000ms）缓存；确认、取消、已读和扫描器仍强制 fresh。撤权对只读视图最多延迟 60 秒生效。

## 11. 变更记录

- 2026-10-26 22:46：发布`d1f39fc`（生产`48efa8b`上仅接Company空调核验修复），普通即时/定时回读按新读取的权威面板目标匹配，snapshot不读写普通状态缓存；Office/照明/门禁不变，控制等待仍默认6秒。422/422、类型/完整根构建、双轴审查通过；真实只读3台旧规则null/新规则有效，原Task状态与报告哈希不变，零新增控制。发布前后任务46/计划10/阶段148/设备事实5487/报告9/通知40/会话202/事件6960，quick_check=ok、FK0。备份`20261026-224602-company-ac-readback-d1f39fc`，无schema变更，回滚只切回48efa8b。固定22:46:05–22:56:05观察：响应/连接超时、lease丢失、DB锁均0，active/NRestarts=0；仍有24条event-loop-stall、最大3158ms，性能问题保留后续处理。

- 2026-10-26：首次尝试发布 `aaa5b81`（旧工作分支）失败并回滚到 `7bac661`：该分支缺少同日 turn → `turn_events` 的迁移，生产库已删 `conversation_turns.events_json`，进程启动即报 `no such column: events_json`。未写入业务数据。
- 2026-10-26：发布 `48efa8b`（生产主线 `c9001ca` 上的控制台重启等待修正，含此前 `9bc25e1`/`bc6158d`/`e927dca`）。公网 `/admin/` 与静态资源 200，登录/保存/真实 UI“立即生效”与重启通过；配置收敛到 v8，`heartbeatMs=15000`、`catalogTtlMs=60000`、`pendingRestart=false`。重启在途同步收口实测可达 40s，面板轮询已放宽到 120s。`quick_check=ok`，无执行中草案或阶段；任务/通知在窗口内因真实业务新增为 45/39，无删除或重置。
- 2026-10-23：Runtime/视频从旧机 `10.5.12.112:3210`（经 frp + 东京代理）迁移到 `38.76.215.138` 直连；公网 healthz 0.26–0.29s，dashboard 4.6–7.2s 且无错误；旧后端停止，frpc 三条隧道移除，数据库与密钥备份保留。
- 2026-10-23：发布 `2c66370`，电表历史分页单独使用 30s 超时；4–5 月全量报告预热后返回 `dataMeters=43`、`truncated=false`、`cache.status=ready`，修复此前 `等待响应超时` 导致的“电表数据准备中”循环。
- 2026-10-23：发布 `d590319`，租户级 `meter_history_samples`/`meter_sync_state` 全量回填完成：476 页、236,377 行读取，233,387 条唯一采样，覆盖 2024-05-23 至 2026-10-23；耗时 14.4 分钟，无截断，同步期间身份 503 为 0。历史每天 03:00 后首个请求刷新全部页，最新每小时增量；报告只读本地样本，不再返回 202。无稳定同步身份、无前台同步调用；细节见 `plan/2026-10-23-energy-cache-prewarm-plan.md`。
