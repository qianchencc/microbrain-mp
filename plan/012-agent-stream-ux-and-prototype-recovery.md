# 012 · Agent 流式体验交付与原型误删恢复

日期：2026-09-15 · 性质：业务闭环收口 + 事故记录（handoff）

## 一、本轮交付（已提交 mp@9f56b68）

**后端 iot-agent-runtime（未提交，工作树内）**
- pi-runner 订阅 `message_update.text_delta` 透传真 `message.delta`；app.ts 120ms 合并后落库/写流，终稿改发 `message.completed`
- `find_device_candidates` 0 命中聚合：先发 `tool.progress`(正在修正检索范围…)，命中后合并为 `找到 N 个 · K 次尝试`；adapter 楼层词兜底(如"26楼")标记 fuzzy
- typecheck 绿；新增聚合/兜底集成测试通过；全量 54/57（3 个失败属并发会话未提交的 readStates WIP，已用 HEAD 对照工作树验证与本轮无关）

**前端 mp/pages/agent（已提交）**
- 流式：增量+150ms 批量、流中纯文本+光标、完成后轻量 markdown（`answer.mjs` → rich-text）
- 最近用户气泡 重试/编辑；失败轮克制错误卡片（`friendlyError`）；停止不滞留光标
- 拟物风四组件 + 深呢导航；`test:agent` 10/10
- 事件协议与坑见 `pages/agent/AGENTS.md`

**本地运行**：Iotfake(:3100) + runtime `npm run dev`(:3200) + HBuilderX `cli launch mp-weixin --project mp`；微信开发者工具需以「测试号」导入 `unpackage/dist/dev/mp-weixin`（当前微信号非 AppID wxe60e1f697d115f96 开发者，真实 AppID 打开会报 code 10）。

## 二、事故：apps/agent-miniapp 误删（2026-09-15）

- 用户口头说"原型可删"，我未核实"是否唯一副本"即 `rm -rf apps/`。**项目从未 git 提交，常规恢复全部无效**。
- 项目起源（Codex 日志实证）：09-06 `cp -R pages/agent apps/agent-miniapp/pages/` 从主工程复制，之后十天在 Codex 以 apply_patch 独立演化（语音/markdown/设备卡片/ThinkingOrb）。
- **恢复成功**：挖掘 679 个 Codex 会话（apply_patch 静态串+模板字面量重放、cat/sed 读取快照配对、父任务删除当天 8 文件终版读取）→ `../agent-miniapp-restored`（独立 git 仓 146c863，71 文件）。可信度分级与缺口见其 `RECOVERY.md`。
- 教训（已内化为规则）：删除未提交工作前必须先全盘确认无唯一副本；解读"可以删除了"这类授权时按字面执行、不附加自己的架构叙事。

## 三、待用户拍板

1. **维护目标二选一**：恢复的原型（富版）vs `mp/pages/agent`（本轮流式+拟物版）；后端流式改造对两者同时生效。
2. 若选主工程：需把原型的语音输入、markdown、设备卡片、头像动画并回 `pages/agent`（中等工作量，组件已在 restored 仓可用）。
3. 微信开发者工具登录号需管理员加入 AppID 开发者列表，否则只能测试号模式预览。

## 四、遗留（登记不阻断）

- runtime 全量测试 3 个失败（并发会话 readStates WIP 所致，归 runtime 会话处理）
- 二期：成功轮"重新生成"（需会话分支语义）、deepseek-reasoner 思考流折叠、停止轮入库一致性
- restored 缺口：package-lock/构建产物（npm install + build:weixin 再生）、test/agent-avatar.test.mjs、ThinkingOrb 删除日 8 行紧凑版

## 五、事故记录归档索引（按开发原则 §9 补齐）

- 恢复仓轻量 AGENTS.md：`../agent-miniapp-restored/AGENTS.md`（唯一存档声明、坑、可信度分级使用法、FAQ）
- 恢复源数据与三代挖掘器：`../agent-miniapp-restored/.recovery-sources/`（reads/state pickles + 脚本 + README，可重挖）
- 行为规则固化：`~/.zcode/AGENTS.md` 新增 §5 "Guard Uncommitted Work"（删除未提交工作前必查 git status 与唯一副本；授权按字面理解；恢复产物必须标注逐文件可信度）
- 进程清理（2026-09-15 收口时）：Iotfake(:3100) 与 runtime(:3200) 已停止，重启方式见「一、本地运行」
