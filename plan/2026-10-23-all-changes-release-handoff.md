# 2026-10-23 全部待发布改动：部署与微信编译交接

用户要求继续完成“查看还有没有未发布的改动，都完成发布，然后重新编译”。本轮完成当前 MP 工作树与 Runtime 原工作树中已实现改动的集成、云端发布及微信开发/发行编译；没有实施探索文档中的新功能。

## Version and scope

- 云端当前：`/opt/iot-agent-runtime/releases/20261023-60659f9`，2026-10-23 14:47:37 CST 重启，14:47:40 监听就绪。
- 发布分支与工作树：Runtime `release/20261023-all`，`/private/tmp/runtime-all`。从已上线 `cb69787` 单向移植，保留生产电表全页同步、目录/任务读取缓存及 AC 电源类型热修复。
- 移植提交：`76299fb`（AC 检查点按窗口起点之后展开）、`0b20303`（延迟测试阈值）、`37130c0`（当前面板快照）、`e1c4886`（快照文档）；最终 `60659f9` 加入位置路径/安全摄像头楼层匹配、全部已读接口和回归，并完整解决延迟测试冲突。中间提交 `0b20303` 含未清理冲突标记，仅最终 `60659f9` 通过验证并发布，不单独使用该中间提交。
- 原 Runtime 工作树 `/Users/qianchen/works/新发展/iot-agent-runtime` 的 11 个 tracked WIP 文件与 `/tmp/runtime-wip.patch` 字节一致，已原样提交 `2651fdf`，其修改已包含在发布版。此原分支仍与生产分支分叉，后续部署以 `60659f9` 继续，不能直接用原分支替换生产。
- MP 业务及已有文档：`85dd8c8`，原分支 `新世纪办公室`，36 文件。具体修改见提交：能耗呈现/日期窗口/骨架、任务详情与收件箱、批量已读、对话推荐问法及配套记录。最终交接提交只更新文档和后续问题。
- 未完成的 Runtime `.scratch/agent-location-groups/` 与原工作树既有 `:memory:.sessions` 产物未纳入提交或发布。现有探索计划仅归档，不宣称其功能上线。

## Validation

- Runtime：系统 Node 26 全套 367/367；随后用要求的 Node 22 重验，默认全并发 366/367，唯一失败为 `energy-history-latency` 982ms > 700ms。未放宽阈值，限制测试文件并发为 4 后 367/367，类型检查通过；本地完整构建通过，云端用 Node 22.23.2 从源码 archive 安装并构建 config-contract/runtime 成功。
- Node 22 完整测试命令（Runtime 发布工作树）：`PATH=/opt/homebrew/opt/node@22/bin:$PATH node node_modules/tsx/dist/cli.mjs --test --test-concurrency=4 apps/runtime/test/**/*.test.ts`。日志 `/tmp/runtime-60659f9-node22-concurrency4-test.log`；默认并发失败日志 `/tmp/runtime-60659f9-node22-test.log`。计时断言存在并发调度敏感性，尚未修订。
- MP：`npm run test:agent` 156/156；两个源码工作树的 diff 检查通过。微信开发编译成功，发行编译 `DONE Build complete`。
- 本轮未触发新设备控制；既有 AC 真实开机验证见 [AC 电源修复交接](2026-10-23-ac-power-type-fix.md)。本轮没有再次核验物理开关状态，也没有用刷新后的状态改写历史回执。

## Cloud evidence and rollback

发布流程沿 [云端发布规范](2026-10-23-runtime-cloud-release-spec.md)。源码 archive 为 `/tmp/runtime-60659f9.tgz`，SHA256 `56697735efb189b7ff0232fef380377711c11494c0650839c702774ad1bbdbf5`。

- 备份：`/opt/iot-agent-runtime/shared/backups/20261023-1445-all-60659f9/`，主库通过 `VACUUM INTO` 备份，sessions/两个 key/runtime.env 一并保存，文件权限均 0600。备份和上线后主库 `quick_check=ok`、`foreign_key_check=[]`。
- 业务行数发布前后相同：tasks=21、task_plans=6、report_artifacts=4、task_notifications=16。补核备份与上线库均无 pending/executing 阶段、无 EXECUTING 草案；6 个 PENDING_CONFIRMATION 草案保留。两条启用周期的 next_at 分别为 10-24 11:41、10-26 09:00（上海时间），不落发布窗口。
- Runtime systemd active，唯一回环 127.0.0.1:3210；mp-agent/iot-agent/mp-video 公网健康均 HTTP 200，mp-agent 直连 origin TLS 健康 HTTP 200。客户网关匿名 healthz 返回 401，仅证明连通；真实鉴权读取另行验证。
- 公网真实身份：Company dashboard summary HTTP 200、errors=[]（11.208s）；notifications HTTP 200（0.873s）。凭据仅从本地受保护身份文件读入内存，未打印或写入本交接。
- 首十分钟仍有一次设备目录读取超时，编号 `c8559479-8887-4dc4-8f10-75585a2bcb2d`。已登记 [后续问题](../.scratch/runtime-cloud-release/issues/01-authorized-catalog-timeout.md)；本次不满足规范的“首十分钟零超时”目标，不能宣布彻底消除上游超时。
- 回滚代码目标为先前 `releases/20261023-cb69787`，按规范切换 current 并重启；本次无新增 schema，沿用原共享数据库与密钥。需要恢复数据库时按规范先停服务。

本地与云端变更模块 SHA256 一致（入口 server.js 哈希未变化，不能只核对入口）：

| Module | SHA256 |
| --- | --- |
| `apps/runtime/dist/iot/adapter.js` | `547fc9b23d10295af11ec87d6481c97801b4c2585c152564262e2980dd413ac8` |
| `apps/runtime/dist/tasks/notifications.js` | `314bbc269ac27c003dcf8eeb4c48865212a8f4c6d5483d59e87984aadfdfec31` |

## WeChat artifacts

- 开发版：`unpackage/dist/dev/mp-weixin/`，HBuilderX 5.24 CLI `launch mp-weixin --project '/Users/qianchen/works/新发展/mp' --compile true` 成功。
- 发行构建：`unpackage/dist/build/mp-weixin/`，580 文件、1,928,406 bytes（编译目录总量，不代表微信上传包计算）。两套产物均包含 `seen-all` 请求与 `EnergySkeleton`。
- 发行构建日志：`/tmp/mp-release-85dd8c8-build.log`；保留原有 check/detail Vue/sourcemap、img 选择器和鸿蒙 UA 告警。开发启动还有既有 uniCloud 未关联提示；编译本身成功。
- 尚未上传/提交微信审核，也未做此次新界面的微信真机交互验收。开发 envVersion 使用云端 Agent；trial/release 仍使用既有客户网关，不因发行构建自动切至开发域名。

发行构建以 HBuilderX 编译器目录为 cwd，用其自带 Node：

```sh
cd /Applications/HBuilderX.app/Contents/HBuilderX/plugins/uniapp-cli-vite
UNI_INPUT_DIR='/Users/qianchen/works/新发展/mp' \
UNI_OUTPUT_DIR='/Users/qianchen/works/新发展/mp/unpackage/dist/build/mp-weixin' \
UNI_CLI_CONTEXT='/Applications/HBuilderX.app/Contents/HBuilderX/plugins/uniapp-cli-vite' \
UNI_HBUILDERX_PLUGINS='/Applications/HBuilderX.app/Contents/HBuilderX/plugins' \
'/Applications/HBuilderX.app/Contents/HBuilderX/plugins/node/node' \
node_modules/@dcloudio/vite-plugin-uni/bin/uni.js build -p mp-weixin --config vite.config.js
```

## Suggested skills

- `diagnosing-bugs`：继续调查后续目录超时或默认并发下的计时抖动。
- `handoff`：后续真实微信验收完成后更新交付边界。

不需要重新部署或扩大实现范围即可查看当前编译产物。源码没有推送远端 Git；云端部署已完成。
