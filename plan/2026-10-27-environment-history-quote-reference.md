# 环境历史期间的结构化引用

日期：2026-10-27。状态：源码、Runtime 定向回归与微信开发编译通过；真实微信点击和真实公司会话尚未复验。

## 问题

环境历史 Sheet 的「向公司 Agent 询问此期间」此前只预填一段带起止时间的问题文本，消息里没有 `reference`。结果是输入区不出现引用条、`run.started` 不携带引用身份，Runtime 只能让模型从自然语言重新解析窗口；这不是产品既有的「引用到对话」语义（对比安全台账、任务和报告引用）。

## 现在

- 引用身份为 `{ type: 'environment_window', from, to }`，`from`/`to` 直接取服务端报告窗口；客户端另带展示用 `label`（`环境历史引用 · YYYY-MM-DD HH:mm 至 …`）。
- Runtime 只接受 Company 会话；要求带时区、`from <= to`，拒绝时返回 400 `INVALID_REFERENCE`。Office 引用不产生窗口读取。
- 发送时 Runtime 用与公开 GET 相同的 `queryEnvironmentHistory` 按当前 Company 授权重读该窗口，注入站点级事实并明确：`coverage.complete=false`/`nextPage` 非空表示未读全、颗粒物单位未确认、不能归属房间或设备、不能补零；该引用不是设备操作授权。
- 读取失败区分 400/403/401/503。引用身份写入 `run.started` 和恢复快照，编辑/重试继续使用原引用。
- 输入区仍预填同一个问题：空草稿直接可用；已有草稿只提示是否替换问题，引用本身不被清掉。环境深链 `environmentWindow` 同样改为引用加预填，不再只造提示词。
- 电表历史仍只有预填提示词，不在本次范围。

## 验证

- Runtime `environment-history.test.ts` 7/7：公司引用重读并注入样本与峰值、`run.started` 使用服务端窗口标签、重启恢复保留引用；Office、非时区时间和反向窗口均 400；环境读取 401 在发送时返回 401；零设备操作。Runtime 全仓类型检查通过。
- MP `node --test test/agent-*.test.mjs` 177/177（含新增 `agent-environment-quote`：窗口引用身份、无时区/反向拒绝、深链同时带引用与预填）；纯函数 smoke 覆盖窗口引用、展示标签、反向/无时区拒绝。
- HBuilderX `mp-weixin --compile true` 编译成功；日志中 `pages/check/detail/index.vue` 的 sourcemap/默认导出报错为该页既有构建告警，本次未改。
- 微信开发者工具实际项目（真实公司账号、2026-10-27 当天 15 个采样）：仪表盘进入环境趋势，点「向公司 Agent 询问此期间」后浮层输入区出现 `环境历史引用 · 2026-10-27 00:00 至 2026-10-27 23:59` 引用条和同窗口预填问题，未点发送。截图证据在本次会话，未落仓库。
- 未验：真实微信 UI 发送后的引用轮/恢复、真机、已有草稿时的替换弹窗。

## 发布

- 首次 2026-10-27 14:27 CST 按生产 `ca38bb1` 构建并切换 `releases/20261027-94b3654`；随后发现并行会话已在 14:18 构建、14:20 左右上线 `67646ba`（安全台账摄像头候选改走监控授权范围）。`94b3654` 不含该修复，构成短暂回退。
- 已改为基于 `67646ba` 合并，生成发布分支 `release/20261027-envquote-merged` 的 `c530add`；Runtime 全量 427/427、类型检查、完整构建通过，`14:37:46` 切换至 `releases/20261027-c530add`。归档 `/tmp/runtime-c530add.tgz`，SHA256 `4b07c46c58948212f4efea261430c3ca8cb0e70737d6f45fb06be0a10326d90e`。
- 本地与云端构建哈希一致：`server.js`=`126a3994d068d1ba675bc75699e09cbed41e70585106c3ca2026a1e43a0ca57e`，`app.js`=`0f470314f20341f634f4cabf9bca9979f648b9295d4b4ba70977e9643145e479`，`environment/history.js`=`e0584d1823dadacef2b3b929e3e98e045d609b28afa448e418dad94043087a90`，`safety/events.js`=`317678d339e58d025ce6e7656fb96b0b692af9bed87c562abeed7c4d1a8ec918`（并行发布修复保留），`config-contract`=`fd8053df…`。
- 备份：`/opt/iot-agent-runtime/shared/backups/20261027-1426-envquote-94b3654/` 与 `…/20261027-1437-merged-c530add/`（`VACUUM INTO` 主库、sessions、两个 key、runtime.env，均 0600）。备份与上线库 `quick_check=ok`、`foreign_key_check=[]`；业务行数 49/10/11/43 前后一致。已删除错误基线的 `releases/20261027-94b3654`，磁盘 58%；回滚目标 `releases/20261027-67646ba` 或 `ca38bb1`。
- 切换时长期空调任务 `341150d7…` 仍在区间内（至 23:59，每 30 分钟检查点），但无执行中阶段；重启后 14:30 检查点正常跑完（`partial`，原因“本区间已尝试或已让行，不自动重复调温”，与 24–27 点相同）。17:00/17:30 计划未落切换窗口。
- 真实身份冒烟（`c530add`）：
  - 环境引用：Company 会话创建 201，发送 `environment_window` 200/29.3s；`run.started` 标签“环境历史 · 2026-10-27 00:00 至 2026-10-27 23:59”，回复使用注入事实（27.6°C/12:00、15 条采样、说明 14:00 后尚无采样），无 `action.proposed`。
  - 安全摄像头候选：dashboard alerts 200/7.5s，取一条真实记录后 `/safety-events/.../cameras` 200/5.48s，1 个候选，未触及 15 秒预算；验证 `67646ba` 修复仍在。
- MP 发行构建完成：`unpackage/dist/build/mp-weixin/` 590 文件、3.5M，含 `pages/agent/environment-reference.js`；未上传微信、未提审。真实微信 UI 发送/恢复仍未验（已验引用条与预填）。

## 下一步

真实微信 UI 发送一次环境期间引用并返回恢复；再决定是否把电表历史提示词迁移为结构化引用（需要独立的电表引用身份设计）。
