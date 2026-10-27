# 安全台账摄像头候选范围修复发布交接

2026-10-27。承接[回放改进交接](2026-10-27-safety-playback-improvement-handoff.md)：回放入口已于 `efa1fb9` 改走监控授权目录，但安全台账/安全事件的「按当前位置查找监控」候选查询仍调用完整 `loadCompanyDeviceCatalog`，空调、照明、门禁等无关目录分页仍会耗尽统一 15 秒路由预算。用户超时编号 `04d938b4-d695-470d-a2d8-eb5f04514a5d` 日志显示卡在监控分页阶段。

## 改动与验证

Runtime `67646ba`（基于生产 `ca38bb1`，隔离工作树 `/private/tmp/runtime-safety-camera-timeout`，分支 `fix/safety-camera-scope`）：

- `apps/runtime/src/safety/events.ts`：候选查询改为 `loadCompanyDeviceCatalog(..., { cache: false, videoOnly: true })`，复用监控授权范围而非完整公司目录。
- `apps/runtime/test/safety-camera-review.test.ts`：新增回归断言，同一 Company 安全记录查询不访问无关设备目录。
- Runtime 全量 426/426、类型检查、完整构建通过。

## 发布事实

- 云端磁盘 100%（`/` 49G 满）：44 个历史 release 约 19G，journal 4G。清理后仅保留当前 `20261027-ca38bb1` 与回滚目标 `20261026-efa1fb9`，journal vacuum 至 500M，`apt-get clean`；磁盘降至 55%。旧 release 均可由 `git archive` 重建。
- 归档 `/tmp/runtime-safety-camera-67646ba.tgz`（本地 `/private/tmp/` 同名），服务器解包至 `releases/20261027-67646ba` 后 `npm ci` + `npm run build` 成功，`apps/admin/dist/index.html` 存在。
- 构建产物 SHA-256：
  - `apps/runtime/dist/server.js` `126a3994d068d1ba675bc75699e09cbed41e70585106c3ca2026a1e43a0ca57e`（入口未变，与 `efa1fb9`/`ca38bb1` 相同）
  - `apps/runtime/dist/safety/events.js` `317678d339e58d025ce6e7656fb96b0b692af9bed87c562abeed7c4d1a8ec918`（实际变更模块）
  - `packages/config-contract/dist/index.js` `fd8053df59f4d0282e1b3feee548c0aa5a98467b484354661bb5d5c26ebb90a5`（与基准相同）
- 发布前 quick_check=ok；无 due pending 阶段、无执行中阶段；周期任务「空调低温调节·49台」整体 executing 但无在途阶段，下一触发 06:30Z 不在切换窗口。
- 备份 `/opt/iot-agent-runtime/shared/backups/20261027-1421-safety-camera-67646ba`（VACUUM INTO + sessions + 两个 key + runtime.env，0600）。无 schema 变更。
- 14:19 UTC `mv -Tf current.next current` + restart；`runtime.started` 正常，healthz 200（production、ncim origin）。
- 行数前后一致：tasks 49、task_plans 10、task_phases 195、report_artifacts 11、task_notifications 43。
- 公网 healthz：mp-agent 0.154s、iot-agent 0.244s、mp-video 0.127s，均 200；发布后日志无 `等待响应超时`/error。

## 回退

无 schema 变化：`ln -sfn /opt/iot-agent-runtime/releases/20261027-ca38bb1 .../current`（或 `20261026-efa1fb9`）后 `systemctl restart iot-agent-runtime`，不恢复数据库。

## 后续合并（2026-10-27 14:37 CST）

并行会话的环境历史引用发布最初错误地以 `ca38bb1` 为基线（`94b3654`，14:27 切换），短暂覆盖了 `67646ba`。发现后已基于 `67646ba` 重新合并为 `c530add` 并切换为 `releases/20261027-c530add`；`safety/events.js` 仍为本修复的 `317678d339e58d025ce6e7656fb96b0b692af9bed87c562abeed7c4d1a8ec918`，`67646ba` 的候选范围行为未改变。真实摄像头候选冒烟 200/5.48s、1 个候选。回滚目标改为 `releases/20261027-67646ba`。详见[环境引用交接](2026-10-27-environment-history-quote-reference.md)。

## 待验收

- 真实安全台账「按当前位置查找监控」候选查询：确认不再请求非监控目录且 15 秒内返回。
- 原摄像头回放窗口真机复验（此前 efa1fb9 已验 1920×1080 画面，本轮只缩候选目录范围，回放链路未改）。
