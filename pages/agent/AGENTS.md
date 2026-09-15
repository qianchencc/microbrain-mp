# Agent Page Notes

- 微信分块事件的 `data` 是 `ArrayBuffer`，中文 UTF-8 字节可能跨 chunk；所有 NDJSON 解析继续复用 `apis/agent/ndjson.mjs`。
- 正文事件是 `message.delta`（增量，后端已合并）+ `message.completed`（权威终稿）；终稿覆盖累积文本，`tool.started` 会收起工具前的中间评注。
- `tool.progress` 原位更新运行中步骤摘要（0 命中重试聚合为“正在修正检索范围…”）；`run.*` 收尾必须同时清 `running` 与 `streaming`，光标不得滞留。
- 失败轮的恢复入口是最近用户气泡的重试/编辑与错误卡片：重试沿用 `turn.content` 重发，失败轮本就未入服务端会话，无需新接口。
- Android 优先消费 `onChunkReceived`，其他平台保留完整 response 回退，两条路径必须产生相同业务事件。
- 开发凭据和生产登录态只在 `apis/agent/index.js` 组装，页面与组件不接触 header。
- `ACCEPTED` 表示上游受理，界面保留“暂无物理状态回执”说明；只有待确认卡片可发起真实控制。
- 恢复会话时以服务端 `draft/result` 为准；历史事件只恢复轨迹和正文，不能把已执行草案重放成待确认。
- 选项更新和确认携带最新 revision；执行结果的 summary 由服务端生成，重试回答不得重发设备控制。
- 原生迁移范围和验收状态见 `plan/001-native-agent-migration.md`；H5 预览不是小程序验收。
- 视觉为拟物材质体系（呢面/纸材/黄铜/玉漆），只用渐变+阴影实现，不引入 backdrop-filter；`prefers-reduced-motion` 下停用闪烁与脉冲。

