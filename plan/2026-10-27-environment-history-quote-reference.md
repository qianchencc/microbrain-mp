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
- 未验：发送后的服务端引用重读/回复/恢复（开发版仍指向生产 Runtime，尚未部署本改动）；真机；已有草稿时的替换弹窗。

## 发布顺序

必须先发布包含 `environment_window` 的 Runtime，再发布 MP。旧 Runtime 会把它当作未知引用返回 400 `INVALID_REFERENCE`，单独发布 MP 会让该按钮从「只预填」退化为「发送失败」。

## 下一步

按云端发布规范部署 Runtime，再在真实 Company 会话确认引用发送、回复使用同一窗口并可恢复；然后决定是否把电表历史提示词迁移为结构化引用（需要独立的电表引用身份设计）。
