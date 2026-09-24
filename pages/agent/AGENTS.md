# Agent Page Notes

- 微信分块事件的 `data` 是 `ArrayBuffer`，中文 UTF-8 字节可能跨 chunk；所有 NDJSON 解析继续复用 `apis/agent/ndjson.mjs`。
- 正文事件是 `message.delta`（增量，后端已合并）+ `message.completed`（权威终稿）；终稿覆盖累积文本，`tool.started` 会收起工具前的中间评注。
- `tool.progress` 原位更新运行中步骤摘要（0 命中重试聚合为“正在修正检索范围…”）；`run.*` 收尾必须同时清 `running` 与 `streaming`，光标不得滞留。
- 失败轮的恢复入口是最近用户气泡的重试/编辑与错误卡片：重试沿用 `turn.content` 重发，失败轮本就未入服务端会话，无需新接口。
- Android 优先消费 `onChunkReceived`，其他平台保留完整 response 回退，两条路径必须产生相同业务事件。
- 客户身份只通过 `utils/agent-session.js` 提供，`apis/agent/index.js` 只消费统一 header；页面与组件不接触 Token、Authorization 或 tenantCode。
- `ACCEPTED` 表示上游受理，界面保留“暂无物理状态回执”说明；只有待确认卡片可发起真实控制。
- 恢复会话时以服务端 `draft/result` 为准；历史事件只恢复轨迹和正文，不能把已执行草案重放成待确认。
- 选项更新和确认携带最新 revision；执行结果的 summary 由服务端生成，重试回答不得重发设备控制。
- 当前生产范围和验收状态见 `plan/2026-09-18-customer-miniapp-canonical-agent-migration.md`；H5 预览和独立回归壳都不能替代客户小程序验收。
- 视觉为拟物材质体系（呢面/纸材/黄铜/玉漆），只用渐变+阴影实现，不引入 backdrop-filter；`prefers-reduced-motion` 下停用闪烁与脉冲。
- 组件必须对宿主全局样式中立（2026-09-23 根因）：客户 `app.wxss` 继承 uni-app 模板 `view{font-size:28rpx;line-height:1.8}` 与 `input,text{font-size:30rpx}`——元素自身命中的规则优先于继承，会把组件内所有不带字号类的 `text`/`input`（highlightParts 循环子元素、`.from/.to`、裸文本）撑成 15px；每个 Agent 组件 scoped 样式首行固定 `view, text, input { font-size: inherit; line-height: inherit; }`，禁止删除。同理，scroll-view 隐藏滚动条必须用 `enhanced :show-scrollbar="false"`（同 .rail/.conversation 约定），非 enhanced 时该属性不生效——独立壳靠全局 `::-webkit-scrollbar{display:none}` 掩盖，客户壳没有这个全局规则会露滚动条。
- Agent 头像（`AgentAvatar.vue` + `avatar.js`）使用固定预计算 SVG body/eyes 分层，不按会话随机；保留扫视、眨眼、运行呼吸和 reduced-motion 完整行为；不得降级为通用图标方块，也不得重新引入 blobatar 依赖。
- 草案面板沿用 `DraftSheetLayer` + `DeviceSheet` 的本地 Sheet 底座：根节点常驻但关闭态 `pointer-events:none`，面板 `transform` 与遮罩 `opacity` 都由 Vue 的 `open/dragY` 状态驱动；横杆只在触摸期间直接跟手，松手后回弹或退场。不要重新接入 `uni-popup`/`uni-transition` 或 WXS `callMethod` 桥接；此前的异步生命周期和双层位移曾造成孤立遮罩及横杆失效。改动后核对 `test/agent-sheet-runtime.test.mjs` 与微信编译产物。
- 客户小程序是生产 Agent 主线；本目录必须复用客户会话，不得恢复独立 miniapp 的固定 `local-development`/`LOCAL` 身份。
- 开发阶段客户登录、用户、园区和物联网接口继续走客户公网；仅 Agent Runtime 指向本机 `127.0.0.1:3200`——它是唯一 Runtime 实例，直连真实客户网关，不存在模拟数据源。`trial/release` 不得依赖本机地址。
- Agent 页面进入前等待 `utils/agent-session.js` 的会话与园区上下文；页面和组件不得自行拼接 Authorization 或 tenantCode。
- 本目录已是生产 Agent 页面；新业务只在客户主线实现。独立 miniapp 已于 2026-09-24 迁出为同级仓库 `agent-miniapp`，仅用于复现问题，回补时只同步能够证明必要的最小修复。
