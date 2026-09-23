# Runtime 核对清单·作答

**日期**：2026-09-18（晚）　**作答人**：后端智能体（GLM）　**对应清单**：`plan/2026-09-18-runtime-verification-checklist.md`
**仓库基准**：`iot-agent-runtime` 工作树（codex 主线，含未提交改动）　**探测凭据**：普通用户 17276261949（`var/agent-identity.json` 长期 token，只读使用，未重新登录）+ superadmin（内存 token，脚本登录，会话内已弃置）

**作答约定**：A = 代码已证（附 文件:行号）；B = 现有凭据只读探测（附方法与结果）；C = 需客户（改写为最小索取项）。探测脚本位于 /tmp（会话结束即失效），全程只 GET、不调用任何 execute/down/控制接口、不把 Provider 目录当用户范围。所有输出脱敏：不记录 token、完整设备 id、办公室 elementId。

---

## 一、身份与隔离核对（票 01）

### 1. owner 键的真实生成与使用面

**A｜代码已证**：`sha256(tenantCode + Authorization)` 生成于 `src/app.ts:279-280`（ownerKey）。键控对象与证据：

| 对象 | 证据 |
| --- | --- |
| 会话归属（conversation_lifetimes.owner） | `src/app.ts:420`（创建时写入）、`src/app.ts:316-317`（每请求校验 owned） |
| 候选集归属（device_candidate_sets.principal_key） | `src/app.ts:559-560`（恢复时 principal_key 不匹配 → "Unknown candidate set"）、写入见 `src/app.ts:601-603` |
| 目录/状态/actionId 缓存分键（进程内） | `src/iot/adapter.ts:646-647`（principalKey）、`adapter.ts:134-135`（catalogCache）、`108-109`（两个状态缓存） |

**进程外持久化**：owner 哈希随 conversation_lifetimes / device_candidate_sets 落 SQLite（`real-runtime.sqlite`）。无任何按更弱键的回退查询（搜索全部 owner 查询均带 equality 条件）。

**无断裂的接缝**：未来插入 `principalId` 的位置即 ownerKey 的两个消费点（会话归属、候选集 principal_key）+ adapter 三个缓存分键——三处都已经是单点函数，改造面收敛。

### 2. 是否存在服务端 principalId 解析边界

**A（否）**：Runtime 全仓无稳定用户主体概念。身份解析只有一个入口 `getRequestIdentity`（`src/app.ts:1301-1314`）：从请求头直接取 `Authorization` + `tenantcode`，正则校验格式（`/^Bearer\s+\S+$/i`），不做任何 introspection、不调 SSO、不缓存。`devIdentityOverride`（`src/app.ts:297-302`）只在开发实例把 local-development 假身份整体替换。

**接缝现成**：将来挂接客户 SSO introspection 的单一位置就是 `getRequestIdentity`——一个函数改一处即可全链生效。

### 2b. tenantCode 语义与切换行为（清单 §4）

**A（上游参数+错误吞没）**：tenantCode 全链只作为（a）上游请求头 `tenantcode`（`src/iot/adapter.ts:632-635` requestHeaders）与（b）owner 键/落库隔离域（`app.ts:279`）。
**B（实测）**：同一 superadmin token 换租户头 `ZZZ` 或置空，`my/office` 返回 HTTP 200 + 业务码 204（"未找到数据"），**不报鉴权错误**。即：错误租户头不产生跨租户泄漏（内容为空），但也没有租户校验——上游把它当过滤参数。同一凭据切租户 = 数据空集而非报错，前端无感知切换的语义只能由客户契约回答。

### 3. 凭据泄漏面

**A｜代码已证（无泄漏）**：
- 模型上下文：`pi-runner.ts` 组装 systemPrompt 只含 device_context（目录词汇）/action_draft_context；工具结果投影 `projectCandidateSetForModel`（`handles.ts:35-56`）显式剔除 candidateSetId/snapshotId/真实设备 id，只留句柄。identity 不出现在任何模型可见字符串。
- 审计：`appendAudit`（`app.ts:1276-1298`）details 只含 deviceId（office 侧 id）/command/outcome；authorization 从不入 audit_events。
- 日志：Fastify `logger: false`（`app.ts:166`）；`onError`（`server.ts:51-58`）只打 error.stack + cause 链的 message。**B（实测复核）**：`grep -il "bearer|access_token"` 对 /tmp/runtime-3201.log 与 var/ 全部 server*.log 无命中。
- Langfuse（本地观测）：observation 只带 conversationId/tenantCode 标签与 trace 事件，不含凭据（`langfuse.ts` 全文）。
- 网关转发：identity 只经 `requestHeaders` 进入上游请求头，无日志化。
- **残留缺口（记入§还有其他吗）**：`device_candidate_sets.payload_json` 与 `conversation_turns.events_json` 持久化了候选集 payload（含 installAddress 等），虽不含凭据，但含设备位置事实——长期留存策略未定（对应清单 §7 会话清除语义）。

### 4. Token 刷新后的归属漂移实测

**A（机制已证）**：无任何按更弱键的回退路径（见 §1）。owner 键变化 → 旧会话 404（`app.ts:316-321`："会话已过期或不可用"）、旧候选集 "Unknown candidate set"（`app.ts:559-560`）。
**B（DB 实证）**：`real-runtime.sqlite` conversation_lifetimes 按 owner 前缀分组：**3 个不同 owner 前缀**（57627a84×7、07539340×3、566d9fe8×1），对应同一用户在 09-16/09-17/09-18 的 token 变化——漂移已实际发生过，旧会话全部不可恢复（与机制一致）。当前 token（09-17 起长期 token）owner 前缀 57627a84，持有 7 个活跃会话。
**结论**：影响半径 = 会话列表 + 候选集（不可恢复，符合票 01 不变量）；草案/审计按 tenant_code 落库不受影响；进程内缓存 60s TTL 自动过期，无跨 token 污染。

### 5. 执行前的设备范围重新核验

**A｜代码已证（重拉目录，非快照）**：confirm 路径 `app.ts:963`（`currentCatalog = await iot.loadDeviceCatalog(identity)`）在 EXECUTING 提交后、指令下发前重新加载目录（默认 TTL 60s，`server.ts:15` + `adapter.ts:118`）。撤权场景：`app.ts:970-975`——任一选中 action 的设备不在当前目录或 kind 不符 → `AUTHORIZED_SCOPE_CHANGED` 409，草案回滚 PENDING_CONFIRMATION。**没有会话级范围快照**：findDeviceCandidates 当轮与 confirm 时刻的目录可能不同，confirm 重拉兜底。另外目录加载失败 → 503 `AUTHORIZED_SCOPE_UNAVAILABLE`（`app.ts:964-968`），回滚待确认，不误执行。

### 6. 会话清除语义

**A｜代码已证**：DELETE conversations/:id（`app.ts:371-379`）：
- 删除：conversation_lifetimes.cleared=1、discarded_session_entries、PENDING_CONFIRMATION 草案 → CANCELLED。
- **不删除（保留）**：conversations 行、conversation_turns、action_drafts（终态历史）、device_candidate_sets、audit_events、pi-session 存储的模型会话条目（`.sessions` 文件）。
- 保护：EXECUTING 草案 / 在途运行时 409 拒绝清除（`app.ts:372`）。
- **缺口**：物理删除不存在，"清除"是逻辑标记；长期对象（审计除外）没有留存期策略。

### 7. 开发身份隔离

**A｜代码已证（启用条件收紧）**：`devIdentityOverride` 仅当 `AGENT_DEV_IDENTITY` 环境变量存在时注入（`server.ts:41-43`），且只替换 `local-development` 假身份（`app.ts:298-302`，正则 `/local-development/i`）。生产不配置该变量则整段逻辑不存在。正式前端带真实 Authorization 不受影响；非 /api/agent/ 路径不触发 hook（`app.ts:290`）。
**B（实测）**：3201 实例（生产网关）对伪造 token 的 `/current` 返回 `{"conversation":null}`（无泄漏）；/healthz 正常。

### 8. 审计 actor 记录

**A+B｜已证（当前为空壳）**：`appendAudit`（`app.ts:1285-1298`）的 actor_id 只在 `tenantCode === "LOCAL"` 时写 "LOCAL"，否则 **null**。**B（DB 实证）**：audit_events 115 条，actor_id 全部 null（G2 探测）。记录了 tenant_code + conversation_id + draft_id + details（含每台设备 command/outcome），但**没有"哪个凭据/主体/范围快照"**——审计能回答"哪个租户哪个会话干了什么"，不能回答"哪个人"。这是票 01 principalId 落地时必须一并补的审计字段。

### 9. 6 小时会话窗口

**A**：`cutoff = now - 6h`（`app.ts:278`）；owner 查询带 `last_active > cutoff`（DELETE 时放宽到无时限，`app.ts:317`）。会话闲置 6h 后不可达但数据保留。

---

## 二、现有 E5 闭环与适配器边界（票 03 基线）

### 10. Authorized Device Scope 的实际来源

**A｜代码已证**：来源清单 `src/iot/authorized-device-scope.ts`（全文 7 个来源）：`my-office.ac/lighting/access/video`（scoped，requiresOfficeContext: true，按 elementId 逐办公室拉取）+ `office-association.ac/lighting/access`（账号级，requiresOfficeContext: false）。聚合在 `adapter.ts` loadDeviceCatalog：office membership（`app 内 officeGet my/office`）→ 双循环拉取 → 三级合并（officeDeviceRef 去重 → hubDeviceId 物理设备合并，scoped 身份为准）→ **范围裁定（`adapter.ts:253-258`）：仅关联、无 scoped 来源的设备退出目录**。
**分页**：`pageSourceRecords`（`adapter.ts` 后半）：page 从 0 起、size=100、`last !== false` 终止、204 视为空。
**缓存**：进程内 catalogCache 按 principalKey 分键，TTL 60s（`server.ts:15`、`adapter.ts:118`）。
**请求生命周期读取次数**：正常一轮 = 1 次 loadDeviceCatalog（confirm 重拉 1 次）；readStates 命中缓存 0 次、过期重拉 1 次。

### 11. Provider 目录越界检查

**A｜代码已证（无越界路径）**：全仓对 `api/iot-center`、`api/perception`、`api/energy` 的引用只有三处用途：acDetail 动作 id 反查（`adapter.ts:578-592`，按设备 code 查 iot-center 目录，**只取 actionList 里的 actionId，不回填设备**）、状态权威读（`adapter.ts:594-601`，interactive/{id}/{actionId}/down POST 详情读取）、及测试。底层目录记录**从不进入** AuthorizedDeviceRecord 数组或目录快照——设备枚举只来自 authorizedScopeSources 的 7 个 Office 接口。**B**：本轮探测也确认普通用户 scoped 视频记录的 hubDeviceId 能 join 上 iot-center 333 台目录（C1 探测），证明 join 材料存在且方向正确（office→provider 单向）。

### 12. 草案→确认→执行→回读链路的设备类型通用性

**A｜代码已证**：
- **类型无关层**（新类型可直接复用）：候选集模型（domain.ts DeviceCandidateSet）、草案 CRUD/revision/frontier 语义（app.ts PATCH selection/parameters/restore/revalidate/confirm/cancel 路由）、执行快照与部分受理语义、审计事件（details 只记 kind/command/outcome）、回读调度（readback.ts 对全部类型运行，只对 ac 产生 verdict）。
- **按 kind 硬编码层**：`DeviceCommand` 联合（domain.ts:6-16，lighting closeOrOpen / ac 参数对象 / access controlType）、`validCommand`（device-command.ts）、能力声明（`adapter.ts:479`：lighting→[{closeOrOpen}], access→[{controlType:2}], 其余空数组 + ac 参数表）、控制下发（adapter.ts controlAc 仅 ac / controlSwitch 按 kind 组装 body）、模型工具 schema（pi-runner.ts proposeActionsParameters 按 kind 分参数槽）。
- **新类型接入实际改动面**：① domain.ts 扩 DeviceCommand 变体；② device-command.ts validCommand/commandDifference/commandSatisfied；③ adapter.ts inspectCapabilities 能力声明 + 新控制路由；④ pi-runner.ts 工具 schema + systemPrompt 措辞；⑤ 前端草案卡渲染。五层各一处，无横向扩散。
- **证据**：照明/空调/门禁三类的实际实现就是这条链路的三次实例化，复用度已验证。

### 13. "已受理 vs 物理完成"的区分点

**A｜代码已证（三类各有明确收口）**：
- **门禁**：控制受理即止——controlSwitch 返回 accepted/rejected/timeout（`adapter.ts` controlSwitch），回读显式豁免（`readback.ts:37-41`：`readable = actions.filter(kind === "ac")`，门禁不读不猜，永远 unconfirmed→"指令已受理"表述）。
- **照明**：受理语义（timeout 按已受理计，`app.ts:1075-1080` timedOutActionIds）+ 粗状态布尔（scoped switchStatus）但无时间戳——回读确认基准 freshSinceMs 下不参与证实（`adapter.ts` readAcState fallback 注释：粗状态没有时间戳，无法证明上报晚于指令）。
- **空调**：受理（controlAc 逐字段 ACCEPTED/REJECTED）+ 权威回读（acDetail + valts ≥ commandAtMs−2s 容差，`adapter.ts` acStateFromDetail fresh()）。单次等待-重读 6s（`app.ts:1083-1090`、`readback.ts:37`），confirmed 才说达到目标，否则"暂未取得最终状态"。
- 回读窗口与超时语义：默认 6s（可注入假时钟）；控制超时 25s（照明实测 ~10.5s 回包）。未知结果（timeout）按已受理计且消息注明"结果以下次状态查询为准"（`app.ts:1077-1080, 1102-1105`）。

---

## 三、候选设备只读探测（E1–E3 证据整理）

> 探测方式：superadmin 内存 token + 普通用户长期 token，全部 GET；大小分页 ≤5 条样本。探测时间 2026-09-18 15:0x–15:2x UTC。

### 14. 视频（当前 E3）→ 维持 E3，路线图更清晰

- **用户范围证据（B）**：普通用户 scoped `device/page?type=SECURITY_PROTECTION&subClass=VIDEO` 在"26楼运营办公区"返回 1 台（监控-26楼运营走廊，ON_LINE），另一办公室 204。**来源声明已在 authorizedScopeSources**（my-office.video）且运行时已拉取——视频目录发现已属 Authorized Device Scope，非 provider 越界。
- **稳定身份（B）**：scoped 记录 hubDeviceId 与 iot-center 333 台目录**逐字符 join 成功**（C1 探测）；perception 侧 24 台视频全部带 hubDeviceId + code（C2）。身份三段式（office ref → hub → 动作）与空调同构。
- **流/回放/鉴权线索（B，只编目）**：iot-center 视频模板"海康ISC监控"（modelCode HIK-ISC-VIDEO，35 台）actionList 含 **`view`（cameraHikIscViewHandler）与 `onlineStatus`（cameraHikIscPointStatusHandler）** 动作（E2 探测）——view 动作即取流端点的 provider 级线索（interactive/{deviceId}/{view-action-id}/down 形态预期可返回播放地址），但**未调用**。perception 侧另有 ISC 事件/人脸/车辆配置路径（E5 编目：/isc/eventInfo/page、/isc/face/application/*、/isc/plateFormConfig/*）。
- **距 E4 还缺**：view 动作的真实响应契约（流地址格式、过期、播放鉴权）；普通用户权限下 view 动作可用性（本轮未验）；回放接口是否存在；播放审计要求。**全部为 C 类客户材料**——建议索取项见 §四。

### 15. 电表/能源（当前 E2）→ 维持 E2

- **B（复测）**：realTimeRead 全 43 台 readTime 分布 **2024-09-10 ~ 2025-05-27**，距今 16–24 个月（E4 探测）。**客户已确认（2026-09-18）：采集设备故障，非权限或接口问题**。接口链路（目录、读数、统计聚合）本身可用，属客户侧数据停摆；采集恢复前能源切片维持 E2，能力如实注册为"只读历史/目录证据 + 数据滞后已知"，不据此做实时类业务。
- **计量层级（B）**：equipment 43 台含 equipmentName（"26楼运营部电表"）、areaId/areaName（"26楼运营部"）、energyType=ELECTRICITY、厂商（正泰）、remoteControl=0、whetherOnline=1——区域归属性可辨认，但**园区/楼栋/分表层级树未显式提供**（getEquipmentOfAreaTree 路径存在未调用）。
- **历史/区间形态（B）**：路径存在且丰富（F1 编目 40 条：electricData/{activePowerStat,voltageStat,…}、energy/cost/electric/history、statistics/*、homeInformation/energyTrend 等），POST 形态为主。**未调用**（大分页/统计聚合接口，避免误触）。
- **距 E4 缺**：数据新鲜度根因（采集停摆 or 权限）；历史口径（日/月冻结值 vs 累计曲线）；areaId 与 Office 区域的映射；报表契约。C 类。

### 16. 漏感知/消防（当前 E1/E2）→ **水浸报警上调至 E2**

- **B（新证据）**：`perception/fire/flooding/alarm/page` 返回 **298 条真实告警记录**（200，非 204），字段含 deviceId/deviceName/elementId/elementName/**alarm(boolean)/report(boolean)**（D6+E3 样本）。首条样本为"27楼茶水间光电感烟探测器" alarm=true report=false——**告警生命周期字段（alarm/report 语义）真实存在且有数据**。感烟探测器事件已进 perception 目录（E3 样本即来自该页）。
- **维持 E1/E2 的部分**：fire/equipment、fire/alarm、alarmRecord、warnRecord 均 204/0 条（B11-B14）——主告警通道无数据；fire/gas、infraredEquipment、ammeter、distribution 均 204（D3-D5、D7）——燃气/红外/配电目录为空。
- **距 E4 缺**：alarm/report 的完整生命周期语义（产生/恢复/确认/关闭）；责任人/确认接口；演练事件。flooding/alarm 是唯一有数据的告警源，可作为消防切片首选调查对象。C 类。

### 17. GET 形式场景/状态切换接口编目（只编目，不调用）

**B｜全量编目**（4 服务 Swagger，需 `accept: application/json`，否则 springfox 返回 Json@toString 文本）：

| 服务 | GET 形式疑似副作用路径 |
| --- | --- |
| iot-center | `/down/link/history/page`（命名含 down 但为历史分页，低风险） |
| perception | `/bas/ac/run/scenario/execute/{id}`、`/lighting/circuit/{id}/status/{status}`、`/lighting/scene/info/{id}/execute`、`/lighting/scene/info/{id}/{enable}`（4 条真实动作） |
| energy | 无 |
| office | `/office/scenario/{id}/execute`（1 条） |
| （另） | office `/acDownRecord/*`、perception `/bas/ac/run/status/{list,page}` 为只读记录（命名踩正则，人工排除） |

**计 5 条真实 GET 副作用接口**。全部不调用。

### 18. 其余候选快速过筛

**B｜逐项**：水表（energy waterPaging）204、燃气（gasPaging）204、感知电表（ammeter）204、红外（infraredEquipment）204、配电（distribution）204、人数/密度（全 Swagger 无 person/density 路径，E5）——**全部维持 E0/E1，卡在"认证账号下无数据"**。环境数据（`iot-center/home/yq/env/data`）HTTP 200 业务码 200 但 content 为空（B8）。照明回路（lighting/circuit/page）129 条真实数据维持既有记录（D8）。

---

## 四、汇总输出

### 4.1 需客户补齐的最小清单（C 类聚合，按支持包字段组织）

**身份与租户（票 01）**

| # | 索取项 | 对应验收案例 |
| --- | --- | --- |
| C1-1 | 稳定用户主体来源：Agent 可用的 principalId 字段（SSO introspection 端点或 JWT claim 名），及 Token 刷新/撤销/多端规则 | 案例 1（A/B 隔离）、案例 2（刷新漂移） |
| C1-2 | tenantCode 列表与切换语义：合法租户清单、同一 Token 跨租户是否合法、切换时的会话策略 | 案例 4（园区切换） |
| C1-2b | `local-development` 假身份与真实 token 混布时（历史 owner 漂移 ×3 的根因说明或确认无害） | 案例 2 |
| C1-3 | 审计 actor 契约：是否要求记录到人（当前 actor_id=null）；如要求，提供主体 ID 来源 | 案例 8（审计归属） |
| C1-4 | 退出/后台运行政策：退出登录后 6h 窗口内在途运行与后台规则的处理 | 案例 6、7 |

**设备扩展（票 03）**

| # | 索取项 | 对应验收案例 |
| --- | --- | --- |
| C3-1 | 视频 view 动作契约：海康ISC view 响应（流地址/过期/鉴权）、普通用户可用性、回放接口是否存在 | 视频切片 |
| C3-2 | ~~能源数据链路状态~~ **已关闭（09-18 客户确认：采集设备故障）**。剩余：恢复后通知机制、历史口径（日/月冻结值 vs 累计曲线）、areaId ↔ Office elementId 映射 | 能源切片 |
| C3-3 | 水浸报警 lifecycle：alarm/report 字段语义、确认/关闭接口、责任人模型 | 消防切片 |
| C3-2b | 计量层级：energy equipment areaId ↔ Office elementId 的映射或树接口用法 | 能源切片 |
| C4 | 测试条件：测试租户/账号/设备、故障注入手段、5 条 GET 副作用接口的幂等说明 | 全部切片 |
| C5 | 验收证据：视频取流、能源日报、水浸处置的期望对话/组件/审计样例 | 全部切片 |

### 4.2 决策票回填建议（只出建议文本，不修改 .scratch/）

**票 01（真实 MP 身份与隔离）建议追加**：
> - 2026-09-18 核对完成：owner 键机制、会话/候选集归属、撤权重核、凭据无泄漏已代码实证；开发身份隔离条件已证（devIdentityOverride 仅在 AGENT_DEV_IDENTITY 注入时生效）。three owner 前缀实证 token 漂移影响半径=会话+候选集不可恢复，草案/审计按 tenantCode 不受影响。
> - 新增确认项：审计 actor_id 当前恒为 null，principalId 落地时须同步补审计字段；tenantCode 错误头返回空集而非报错，租户校验缺失属上游行为。

**票 03（设备扩展支持包）建议追加**：
> - 2026-09-15/18 探测复核：视频维持 E3（scoped 发现 + hub join 已证，view/onlineStatus 动作编目完成，取流契约待客户）；能源维持 E2（readTime 滞后 16-24 个月复测成立）；水浸报警上调 E1→E2（298 条真实记录含 alarm/report 字段）；水/气/红外/配电/人数维持 E0/E1（目录全空）。GET 副作用接口全量编目 5 条（perception 4 + office 1）。
> - 新增确认项：视频 view 动作契约、能源采集链路状态、水浸 alarm/report 生命周期语义。

## 还有其他吗？

1. **owner 键漂移已实际发生**（09-16/17/18 三个前缀）但无业务影响记录——建议在票 01 回填时说明漂移根因（token 重新登录顶掉）与现行缓解（长期 token）。
2. **`authoritativeStateCache` 不按 principal 分键**（`adapter.ts:608` cacheKey = kind:officeDeviceRef）：两个不同用户请求同一台设备时，A 用户的权威读结果 3s 内可能被 B 用户命中。隐私影响为零（同一目录设备），但**跨用户的缓存串味**在共享 3201 实例的开发场景是真实行为，生产多用户下同样存在。建议作为小改进登记，不阻塞票 01。
2b. **acDetailActionCache 同样不按 principal 分键**（按设备 code），但 actionId 是模板级公开数据，无隐私影响；仅与上一条同源的工程债。
3. **候选集 payload 长期留存**（device_candidate_sets 不随会话清除删除）：含设备位置事实，留存策略未定。与 §7 会话清除语义一起归属"长期对象留存期"议题。
4. **能源 43 台 newest=2025-05-27**：~~如果采集链路已停摆……~~ **已确认（09-18）：客户侧采集设备故障。** Runtime 侧动作：能力图如实标注"数据滞后已知、链路可用"，等待客户修复通知后复测新鲜度再评估 E2→E4。
