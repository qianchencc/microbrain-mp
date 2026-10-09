# 历史观察与双 Agent 视频：准备阶段交接

日期：2026-10-09。目标：下一轮从三类安全台账的完整用户闭环开始实施。用户已基本认可场景方向，本轮授权是按流程具体准备，尚未指示本轮直接改业务代码。

## 已完成与权威入口

- `ask-matt → to-spec → to-tickets` 的正式准备完成；词汇已补入 [CONTEXT](../CONTEXT.md)，无重复新建 GLOSSARY 或相同来源 ADR。
- [正式规格](2026-10-09-history-observation-spec.md)固定范围、公开行为测试入口、交互/等待要求与 E01–E04；[交付地图](2026-10-09-history-observation-ticket-map.md)包含九票依赖和代码量初估。
- 九票正文在 `plan/history-observation-tickets/`，一票一文件、进入 Git；本地 `.scratch/history-observation-integration/` 维护状态/回传并链接正文。两边不复制验收全文。源码入口和实测差异只见 [已提交接入方案](2026-10-09-history-interfaces-business-integration.md)，无需重做六接口探测。
- 本批旧父票不关闭。电量方向/统计边界、汇总集合、人数口径仍是局部 needs-info，不阻止首批。视频部署仅阻塞对应实际环境验收，开发验证可准备。

## 下一轮执行

先读 01 正文和现行页面/Runtime AGENTS，复核两仓状态与来源事实。用户要求窄公共接口行为测试，已有 public HTTP/NDJSON 与生产协议夹具符合预期，无须再为 routine seam 选择请求批准。

可开始 frontier 为 01、02、03、05，建议实际先做 01；04 依赖 03，06 依赖 05/E01，07 依赖 06/E03，08 依赖 01/04，09 依赖 04/E04。不存在“全部后端做好才开始 UI”的前置，也不并行修改同一观察组件。

| 工作目录/入口 | 实施时的用途 |
|---|---|
| `/Users/qianchen/works/新发展/mp` | 唯一客户小程序主线；编译与实际微信交互 |
| `/Users/qianchen/works/新发展/iot-agent-runtime` | Runtime monorepo；从根目录执行 Node 22 npm 命令 |
| Runtime `apps/runtime/src/safety/events.ts`、`iot/observation.ts`、`domain.ts` | 01 的 ledger 身份、新列表、混表及旧引用兼容 |
| Runtime `apps/runtime/test/safety-event-reference.test.ts`、`company-dashboard.test.ts`、`observation-events.test.ts` | 复用公开详情/引用、分区与恢复场景 |
| mp `pages/agent/dashboard.vue`、`components/ObservationCard.vue`、安全详情与引用入口 | 01 的普通列表/详情、草稿引用和返回；沿当前实际组件名查找 |
| mp `test/AGENTS.md`、`pages/agent/AGENTS.md` | 禁止源码正则充当 UI 验收；单层 Sheet/来源/状态保留约束 |

验证命令在对应仓库根：Runtime `npm test`、`npm run typecheck`、`npm run build`；mp `npm run test:agent` 与 HBuilderX 微信编译，外加本票真实微信操作。不要仅为准备文档重跑全套业务测试或重启服务。

## 基线、并行内容与运行边界

准备开始时 mp HEAD `4aaf1c5`，Runtime HEAD `b5736f3` 且干净。mp 的 `config/index.js` 与六个历史探索文件为用户/旧会话内容，未混入准备提交。提交前再次看状态；尤其不要提交读取本地凭据历史的旧 gen.py。

本轮没有改业务代码/配置、没有取流/登录/控制/通知发送、没有重启。唯一真实 Runtime 的 LAN/IP/进程健康在实施验收时重查，不把前次 IP/时延当现状。重启必须先确认没有在途对话/执行阶段，再按既有单一 3200 启动规范处理；永不恢复 3100/3201 或模拟源。

已有观察卡曾因旧 HBuilder 产物不含 observation.reported 而不显示：新块接入后要确认真正运行的微信包含新事件消费与组件，不单看磁盘时间。不得在日志或交接粘贴身份、token、短期流地址。

## 当前验收状态

准备完成；文档相对链接、票据编号/依赖无环、状态与局部门槛一致和提交范围已检查。组件资料有一手链接，最终图表/回放效果待对应业务验证。既有六接口的可调用性不等于新九票已经实现或实际可用。

## Suggested skills

下一轮用 `implement` 驱动 01，`tdd` 沿公开业务接口；必要稳定切片用 `code-review`；UI 实作/走查用 `emil-design-eng` 与项目既有微信工具；闭环写 `handoff` 到 plan。回放模式或提取解码先用独立 `prototype`；E01/E03/E04 需要用户业务决定时用 `grill-with-docs`，不能靠通用算法或字段默认值替用户定口径。
