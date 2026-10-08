# Runtime 配置后台：审查与实施建议

日期：2026-10-08。状态：源码检查完成，尚未实施；用户已要求 monorepo + shadcn，下面的范围和生效方案为建议，尚未冻结为生产规格。

## 目标与基线

让开发/运维人员通过网页查看实际配置、修改大部分运行设置，并判断是否已经生效。这里的后台配置控制台与小程序的物联助手业务仪表盘是两个产品入口。

- 实施仓库：`/Users/qianchen/works/新发展/iot-agent-runtime`，检查时 HEAD `fbd1028`。
- 小程序仓库：`/Users/qianchen/works/新发展/mp`，检查时 HEAD `e06ab15`。
- 两仓均有安全台账详情/引用的未提交业务改动。它们不属于本任务，迁移前应重新检查并隔离；不能把当前工作区当成已提交基线。
- 当前 Runtime 根包是 Fastify/TypeScript/SQLite；没有 npm workspaces、配置读写 API 或管理员身份体系。`web/` 是 Vue Agent 测试端，`src/dashboard/routes.ts` 是 Company 业务数据 API，均不是配置后台。
- 本轮只读检查源码与官方组件文档；没有读出凭据、改运行配置、重启 Runtime、运行 scanner 或执行设备控制。

## 硬编码审查

以下行号对应检查时工作区。判断是设计风险与维护成本，不代表每个常量已经产生故障。

| 优先级 | 源码位置（Runtime 相对路径） | 当前事实与影响 | 处理建议 |
|---|---|---|---|
| P1 | `src/agent/model.ts:15`、`:17`、`:23`、`:28` | 任意 MODEL_ID 共用 reasoning=true、128000 上下文、16384 输出、固定兼容参数；价格全为0。换模型不能只改 ID；压缩时机/SDK 参数可能不匹配，费用0不能解释为真实免费 | 可编辑模型档案：连接、ID、上下文/输出、思考支持和兼容选项；价格未配置显示未配置。复用同一档案驱动主模型、摘要和收尾 |
| P1 | `src/runtime-config.ts:74`、`src/server.ts:18`、`:26` | 环境参数启动时读取；runner、history、adapter闭包固定。若只写配置表，活动服务仍用旧值 | 同时显示已保存配置与实际生效版本；启动配置保存为待重启，避免虚假“已生效” |
| P1 | `src/app.ts:189`、`:195`、`:197`、`src/server.ts:26` | buildApp 可注入草案TTL/运行超时/回读/控制超时，但生产入口没有全部接线 | 统一服务端校验与字段契约，逐项接入真实消费者 |
| P1 | `src/app.ts:467` | 现有 onRequest 只检查 `/api/agent/`，且验证的是客户业务身份；没有管理员角色验证 | `/api/admin/` 独立鉴权。客户设备 Token 和 local-development 替换不能赋予配置修改权限 |
| P1 | `src/runtime-config.ts:86`、`:100` | HEARTBEAT_MS非法值可变0，PORT非法值可回落3200；parseInt也接受尾随字符 | 严格校验整数/范围；错误留在表单与API响应，不静默改变含义 |
| P2 | `src/agent/pi-runner.ts:67` | maxAgentTurns=6、maxToolCalls=10 固定 | 后台高级运行预算，设置合理边界；每个新run固定配置快照 |
| P2 | `src/agent/pi-runner.ts:17`、`:21`、`:55`、`:114` | Office/Company系统提示、回复风格、任务管理和执行收尾在代码中，文案与硬约束交织 | 先开放两端业务补充与回复风格；展示有效提示预览/版本，保留权限、工具协议和确认约束。不要首期提供任意替换完整系统提示的入口 |
| P2 | `src/agent/history.ts:35`、`:40` | 压缩使用SDK默认设置，摘要思考等级固定low；未暴露可观测的配置来源 | 模型窗口、输出预算与压缩预留/保留量一致校验；高级项逐步开放，初版显示有效值 |
| P2 | `src/iot/adapter.ts:124`、`src/iot/observation.ts:69` | 目录60秒、权威状态3秒、动作ID600秒；观察模块另有动作ID600秒和能耗30秒常量 | 分用途缓存配置，所有消费者使用同一配置入口。能耗可采用更长TTL建议，但本轮不擅自调整 |
| P2 | `src/iot/observation.ts:66` | pageSize=100、alarmPageCap=5（最多500条窗口）；列表/报告若只截取固定条数，需要说明范围 | 分页大小/上限归入高级项；保持完整性判断，不能把局部读取当作全部目录或完整历史 |
| P2 | `src/server.ts:59`、`src/tasks/scanner.ts:30`、`:80` | 扫描15秒；目录读取30秒；阶段总执行预算按数量估算并限制90秒至10分钟 | 分清扫描周期与执行预算，展示有效值；改参数不能自行引入补执行、重试或改变任务授权 |
| P2 | `src/tasks/recurrence.ts:9`、`src/tasks/store.ts:692`、`src/iot/observation.ts:113` | +08:00在周期、日历投影与上游日期解析中重复 | 当前支持Asia/Shanghai，后台只读显示。将来多时区必须在计划上固定时区并迁移，不能加一个全局下拉框改写历史发生 |
| P2 | `src/observability/langfuse.ts:51`、`src/server.ts:25` | Langfuse三项齐备启动启用，缺项no-op；当前没有提示词管理接线 | 显示配置完整度、启用/停用和需重启状态；本地配置后台与Langfuse不能同时成为提示词权威来源 |
| P3 | `web/vite.config.js:8`、`.env.example` | 测试端proxy写死3200；env示例未列出全部生产必填项和可选项 | 本地3200默认可保留并显示来源；开发代理可配置。补齐部署示例，不把地址与密钥写进浏览器bundle |

### 应保留的代码约束

设备协议常量和业务授权不应作为普通配置字段：`src/device-command.ts:3` 的已核验整数温度步长、模式/风速；`src/iot/adapter.ts:689` 的idx/type/val映射；授权来源路径与控制ID映射；Office/Company隔离；observationOnly；显式确认、执行幂等和结果真实性。

温度16–30在能力、validCommand、模型schema/提示中重复，应从权威能力定义派生，避免维护漂移；开放任意温度范围或0.5步长会撤销既有真机核验约束。设备协议扩展需要独立适配和证据。

历史任务的10分钟legacy窗口、提案时间约束与本次扫描预算也不能混成一个“任务超时”字段。需要在对应业务规格中分别处理。

## Monorepo 建议

在 Runtime 仓库内组织，保持小程序独立；复用现有服务端与SQLite。

```text
iot-agent-runtime/
  apps/runtime/            迁入现有src/test及运行入口
  apps/admin/              React + Vite + TypeScript + shadcn/ui
  packages/config-contract/ 共享字段类型、校验与脱敏响应契约
  web/                     现有Vue测试端保留
  package.json             npm workspaces与统一build/test入口
```

建议沿用npm与Node22，首期无需引入Turborepo或Next.js。shadcn组件先放admin内部；只有出现第二个真实React消费者时才抽共享ui包。配置契约包直接由API和表单共用，不抽取全套设备领域模型。

迁移前隔离未提交安全业务并建立可回溯checkpoint；按精确路径git mv。同步处理启动脚本、dist入口、env/var路径与sessions数据库位置：不能因cwd变化生成新数据库、任务加密密钥或开发身份。首次迁移后的完整回归用于验证这些路径风险。

开发时管理端通过Vite代理同源调用API；部署时由Fastify承载`/admin/`静态资源（或同源反向代理）。无需新增业务后端；静态页面可公开加载，配置数据和写API必须鉴权。

## 页面与配置范围

| 页面 | 首期内容 | 生效建议 |
|---|---|---|
| 运行概况 | 实际模型、网关来源、配置版本、已保存/生效差异、扫描器状态、观测启用状态 | 只读；不伪造缓存命中率、成本或网关健康 |
| 模型连接 | endpoint、model ID、替换密钥、窗口/输出、思考级别、兼容高级项 | 初版待受控重启；测试连接仅纯文本，不进入Agent设备工具 |
| Agent设置 | Office/Company业务补充、回复风格、运行/工具预算 | 每个新run固定版本；初版若无法热应用则标待重启 |
| 缓存与执行 | 各用途TTL、草案TTL、心跳、回读/指令等待、扫描周期 | 初版统一待重启；后续热更逐项处理旧缓存和在途执行 |
| 集成与观测 | IoT地址、Langfuse连接/密钥、启用状态 | 需重启；网关切换需绑定对应数据环境，不能让旧任务换网关执行 |
| 变更记录 | 修改人、时间、脱敏diff、版本、恢复上一配置 | 回退也是一次新版本，不回退Task/报告 |

数据库路径、HOST/PORT、开发身份、管理员引导凭据、TASK_CREDENTIAL_KEY及配置密钥保留部署引导配置；后台只读显示必要状态。更换任务密钥需要迁移托管凭据，不能做普通“保存”操作。

## 最小配置模型与生效规则

- 服务端拥有字段白名单、默认值、合法范围、敏感标记与applyMode。表单消费同一契约，不维护第二份默认值或后台任意key/value编辑器。
- bootstrap配置由部署环境提供；可管理设置持久化到SQLite。建议明确指定的环境覆盖项优先于DB，再到代码默认；界面显示来源，环境锁定字段拒绝表单保存，消除两套权威配置。
- 版本化保存使用expectedRevision，服务端事务更新配置和脱敏变更记录；并发409后要求重新读取。
- 首期采用全局实例配置；Office/Company只分开其业务补充文案。客户多租户配置需要单独规格。
- 密钥只支持替换/保留/明确清除，读取返回configured状态，不返回原文或可复原的掩码。若网页替换密钥，需独立稳定的配置加密引导密钥；历史diff与回退不存明文，部署环境密钥不复制到数据库。
- 第一版保存不自动杀服务、不自动扫描或设备下发。显示savedRevision、activeRevision、pendingRestart与受影响字段；后续受控应用必须等待在途调用、保留任务快照并重新建立依赖。
- 修改提示词不让动态时间/用户名进入系统缓存前缀；追踪有效配置/提示版本。模型缓存命中需要真实上游证据，后台开关无法保证缓存命中。
- 管理员身份与业务身份分离。建议首版供开发/运维使用：引导凭据换取HttpOnly会话、写操作验证同源/CSRF、独立审计修改人。是否直接面向客户管理员尚待用户答复；若需要，应接客户SSO的实际管理员角色，不凭设备访问权限推断。

## 首条可用业务闭环与后续顺序

1. **模型配置闭环**：管理员登录→读取实际配置→修改连接/模型档案→校验/纯文本测试→保存版本→显示待重启→受控重启后读取实际版本→重新打开页面仍一致。交付monorepo与可构建shadcn页面一起完成，不以空壳“搭建完成”收口。
2. **运行与缓存设置**：接线已有注入项和观察模块TTL，补齐高级设置与边界说明；验证实际消费者读取，旧执行使用其固定配置。
3. **两端提示补充与观测设置**：版本化配置、有效提示预览、变更记录/回退与脱敏观测；之后按需求逐项开放热应用。

首条预算约600–1000行手写业务代码，基础首期完整范围约1200–2000行，另计shadcn生成组件与机械迁移。只是范围预算，不是工期承诺；若明显超出，先切分业务能力。

验收从公开管理HTTP和浏览器进入：未登录/非管理员不能读写；非法与跨字段冲突无副作用；并发更新冲突明确；密钥不进入响应/日志/构建产物；保存/生效/重启状态准确；重启保留数据库和既有任务；纯文本连接测试不触发IoT。现有业务回归、类型检查、根目录统一build、桌面/窄屏表单实际操作通过后提交。

## 已核对组件与依据

先查看Animate UI与ReUI的可复用组件，再按用户指定采用shadcn常规后台结构；首期以清晰表单、侧栏和状态反馈为主。

- [Animate UI组件目录](https://animate-ui.com/docs/components)
- [ReUI组件文档](https://reui.io/docs)
- [shadcn monorepo支持](https://ui.shadcn.com/docs/monorepo)
- [shadcn Vite安装](https://ui.shadcn.com/docs/installation/vite)
- [Sidebar](https://ui.shadcn.com/docs/components/sidebar)、[Field](https://ui.shadcn.com/docs/components/field)、[Tabs](https://ui.shadcn.com/docs/components/tabs)、[Alert Dialog](https://ui.shadcn.com/docs/components/alert-dialog)
- [Langfuse提示词管理](https://langfuse.com/docs/prompt-management/get-started)：能力已核对，本轮不迁移到Langfuse，现有接入仅观测。未来若选远程提示词管理，应明确唯一权威来源与降级规则。

## 接手入口

建议技能：ask-matt继续收口“运维/客户管理员”和“保存/生效”两项；to-spec/to-tickets形成实施规格；implement/tdd按单个公开配置闭环推进；界面使用设计类skill，浏览器验收；handoff在每轮完成后记录到plan。

本次答复请求的是检查后汇报，代码迁移与后台实施尚未开始。后台任务应保持登记，不再从自动化、告警或小程序仪表盘工作中推定已经覆盖。
