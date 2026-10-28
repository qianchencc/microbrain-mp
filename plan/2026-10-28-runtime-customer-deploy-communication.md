# 2026-10-28 Runtime 客户仓库部署沟通

## 1. 现状

- 代码已推送到客户 GitLab `microbrain/iot-agent-backend`，分支 `stable` = `b2ca767`（2026-10-28 10:15），仓库此前为空。
- **尚未部署**；客户侧还没有这个服务在运行。
- 本地 Runtime `HEAD` 比已推送的 `b2ca767` 多 1 个提交 `f007780`（`chore(deploy): parameterize host, install paths and verification`）：把 `deploy/` 的 Caddy 样例、systemd 单元与 `tools/deploy.mjs` 从写死我方域名/路径改成模板与环境变量。
- 因此**先补推 `f007780` 再让客户部署**；否则客户会拿到写着 `mp-agent.qianc.ltd` 的 Caddy 样例，容易照抄错。
- 小程序侧：合并分支 `iot-agent-linglv`（`54eac47`）尚未发布；trial/release 的 Agent 地址仍是客户网关 `/micro-api/api/ai`，需要这个后端 + 网关路由就绪才有响应。

## 2. 沟通目标与顺序

1. 明确“部署什么、在哪部署、谁改网关、谁给模型 key、怎么验收”，避免只 pull 不配。
2. 顺序：补推部署模板 → 客户部署后端与网关路由 → developer/trial 联调真实鉴权和流式 → 我方发布含 `pages/agent/dashboard` 的小程序版本 → 客户再把告警卡片 `page` 切到契约路径。
3. 在“后端可用 + 小程序线上版本包含目标页”之前，**不要动正式版 card page**，否则发送会 `41030`。

## 3. 可直接发送的消息

> 以下整段可直接给对方（按实际域名/人名替换占位符）。

```text
关于物联 Agent 后端的部署，代码已经推到贵方 GitLab：microbrain/iot-agent-backend，分支 stable。
目前只是代码入库，还没在环境里跑起来。下面是我们建议的部署方式、需要贵方确认的事项和验收口径。

一、部署内容
- 服务：IoT Agent Runtime（Node.js，Fastify + SQLite），只监听回环，HTTPS 由反代终止。
- 运行要求：Linux x86_64/arm64，Node 22.19–22.x（不要用 Node 23+），systemd 托管，持久盘保存 SQLite。
- 部署文档与模板在仓库 deploy/：README、runtime.env.example、systemd、caddy，步骤是源码 → npm ci → npm run build → systemd → 反代。

二、需要贵方提供的环境信息（请确认）
1. 部署在测试机还是生产机？安装根目录（默认建议 /opt/iot-agent-runtime）与 Node 22 路径。
2. 对外域名与端口：Agent API 建议挂在现有网关下，保持小程序现有地址不变。
3. 网关由谁修改？需要支持：
   - /micro-api/api/ai/agent/* 转发到 127.0.0.1:3210/api/agent/*（去掉前缀、补 /api）；
   - 透传 Authorization 与 Tenantcode 请求头，不改写、不丢弃；
   - 关闭响应缓冲/压缩重写，支持分块传输（Agent 回复是 NDJSON 流式）；
   - 读超时放宽（建议 ≥300s），避免长回答被网关掐断。
4. 模型 API：首次启动可用 MODEL_BASE_URL / MODEL_ID / MODEL_API_KEY 导入，之后在 /admin/ 管理。请确认 key 由贵方提供还是沿用现有；若出口有白名单，需要放行模型域名。
5. 管理员与备份：/admin/ 的管理员密码放在 0600 文件；需要明确谁持有、谁负责 SQLite 备份（shared/var/*.sqlite 和 *.sessions）。
6. 部署窗口、是否允许我们远程只读验证、日志入口（journalctl 或日志平台）。

三、配置要点（模板里已写明）
- HOST=127.0.0.1、PORT=3210、DATABASE_PATH 指向持久盘、IOT_BASE_URL 指向贵方网关 origin；
- 生成两把长期密钥 CONFIG_SECRET_KEY / TASK_CREDENTIAL_KEY（各 32 字节 hex，0600，丢失后控制台配置与任务凭据无法解密）；
- ADMIN_ORIGIN 必须与浏览器访问 /admin/ 的地址完全一致；
- ADMIN_RESTART=1 依赖 systemd Restart=always；
- 必须执行 npm run build（只构建 runtime 会让 /admin/ 404）。

四、部署后我们这边会做的验收
1. GET /healthz = 200；GET /admin/ = 200；GET /api/admin/config = 401（未登录）；
2. 用真实 Bearer + Tenantcode 调 GET /api/agent/conversations/current = 200；
3. 走一轮带告警引用（customer_alert）的对话，确认流式分块到达、引用落库；
4. 读一次任务/通知/告警台账，确认与小程序数据一致；
5. 全程不做设备控制；需要控制时仍由用户在小程序里确认草案。

五、顺序提醒
小程序正式版目前还没有物联助手页面。请先部署后端并在开发版/体验版联调；等我们完成正式版发布后，再把告警卡片的跳转路径切到新页面。提前切正式版路径会因“页面不在现网版本”导致告警发送失败（41030）。

六、需要贵方回复的清单
[ ] 部署环境与安装根
[ ] 对外域名与网关修改人
[ ] 网关路径重写/头透传/流式/超时是否可满足
[ ] 模型 key 归属与出口白名单
[ ] 管理员归属与备份责任人
[ ] 部署时间窗与远程验证方式
```

## 4. 发送前我们要做的

1. 补推 `f007780` 到 `microbrain/iot-agent-backend` 的 `stable`（或让客户部署该提交），确认 `deploy/` 模板没有我方域名残留。
2. 准备一份最小部署包说明：env 模板、systemd、反代、验证 curl、回滚步骤（从 `deploy/README.md` 摘取，不额外写死路径）。
3. 准备模型配置方案：客户给 key 时的导入命令，或在 `/admin/` 里配置的字段清单。
4. 准备验收脚本/命令：`/healthz`、`/admin/`、401、真实身份 `conversations/current`、一轮带引用消息。
5. 确认小程序侧对应关系：trial/release 仍走 `/micro-api/api/ai`，开发版走 `mp-agent.qianc.ltd`（现有配置，不在本次改动范围）。

## 5. 风险与边界

- 密钥丢失不可恢复；SQLite 迁移只能前进，回滚必须是“回到上一个 release 且库未跨迁移”，旧代码读新库会启动失败。
- 网关若缓冲响应或改写 `Content-Type`，前端会表现为“一直转圈/一次性出现”，不是模型问题。
- 若客户网络不能访问 npm registry，`npm ci` 会失败；需要预打包 `node_modules` 或内网镜像，部署前先问清。
- 部署本身不影响告警发送；只有改正式版 card `page` 才会影响，且必须等小程序发布完成。
- 远程验证只做只读与真实身份的一轮对话，不做设备控制。

## 6. 参考

- 部署步骤与故障表：Runtime 仓库 `deploy/README.md`（`f007780` 起为通用模板）。
- 卡片跳转与后端部署后的预期效果：[消息卡片跳转探索第 7 节](2026-10-28-message-card-jump-exploration.md)。
- 已推送基线：`b2ca767`；建议部署 `f007780`。
