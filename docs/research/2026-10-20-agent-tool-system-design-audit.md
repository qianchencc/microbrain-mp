# Agent 工具体系设计盘点：现状契约、重叠与设计候选（2026-10-20）

日期：2026-10-20。基线：MP `3fedce6`（分支 `新世纪办公室`），Runtime `4ec44dc`（分支 `codex/multi-candidate-lighting-draft`）。本文件是应用户要求开展的工具体系设计探索与准备记录，不是实现声明、部署记录或验收结论；文中「事实」「建议」「未决」分别标注。无任何今日代码、测试或网络证据新增。

## 来源基线

以下行号为 Runtime `4ec44dc` 的近似位置，属已提交事实；Runtime 工作区另有未提交并行改动（adapter.ts 智慧三族 locationPaths、自身楼层优先，events.ts 同规则），不计入本盘点。已提交的既有事实含 Company 空调区域路径与观察读取 30 分钟有界兜底、401/403 拒绝兜底。

| 位置 | 覆盖内容 |
| --- | --- |
| `apps/runtime/src/agent/pi-runner.ts` 123–183 | 答复/执行摘要 |
| 同文件 266–400 | 参数契约 |
| 同文件 434–558 | 发现/详情/能力检查 |
| 同文件 572–754 | 即时动作/照明草案 |
| 同文件 756–875 | 通用任务提案 |
| 同文件 878–959 | 任务/状态/告警管理 |
| 同文件 961–1068 | 历史/统计/视频/安全 |
| 同文件 1070–1101 | 活动工具集与上下文 |
| 同文件 1105–1186 | 守卫与预算 |
| `apps/runtime/src/app.ts` 825–875、1036–1052、1090–1145、1280–1370、1451 | 已保存报告访问/恢复、类型化引用、解释只读与安全预检、候选重绑与收口上下文、物化新鲜边界 |
| `apps/runtime/src/tasks/company-night-closure.ts` 6–65、83–180 | 收口共享请求/生命周期与准备 |
| `apps/runtime/src/tasks/agent-invocation.ts` 76–175 | 检查点固定范围工具 |
| `apps/runtime/src/safety/events.ts` 31–67 | 告警记录/当前位置/摄像头匹配（未提交增补除外） |
| `apps/runtime/src/energy/meter-report.ts` | 既有统计类型/算法/覆盖口径 |

## 分类法

五类业务能力加一类答复协议（职责分类用，不等于六个工具名）：A 对象发现与证据；B 事实读取；C 计算与证据关联；D 动作/任务准备；E 既有业务对象的继续/读取/管理；F 答复协议。

## 当前主线工具清单（Company 活动注册为准，事实）

| # | 工具 | 输入（压缩） | 输出/副作用与选择语义 |
| --- | --- | --- | --- |
| 1 | find_device_candidates | kind + scopeText/scopeTerms + 软 deviceText/nameHints | 当前授权候选句柄、有界明细/分组、解析与完整性；可用时保存完整 allDevices，旧不完整记录不可补猜成员；硬范围 vs 软描述；建议非用户选择；可选证据工具，非必经编排 |
| 2 | get_device_details | candidateSetId + 选定 deviceIds/handles | 精确候选子集；不能发现未授权设备 |
| 3 | inspect_device_capabilities | 候选集选择 | 支持的规范化命令/参数；辅助用户决定时可选，强制校验在提案准备内部，不要求模型逐台检查 |
| 4 | read_device_states | 候选集/设备选择 | 状态+observedAt 与观察块，可发实时摄像头卡；无控制；陈旧/未知/时间如实标注 |
| 5 | query_alerts | 可选 types/days/unreportedOnly | 授权台账记录、total/latest、警告与观察块；非恢复状态；仅在当前来源目录含 safety 时出现；主线只接受相对天数，不带任意 from/to+设备级聚合（底层 HTTP 与读取器另有分页窗口） |
| 6 | query_environment_history | from/to/page | 站点采样历史、边界/覆盖；不自动归属房间；颗粒物未知单位不作合规结论 |
| 7 | query_energy_history | equipmentId/from/to/page | 原始累计采样+分页/latest 元数据；非区间消耗 |
| 8 | summarize_energy | scope（all/floor/位置/选择）、from/to、grain?、dailyWindow? | 已保存/投影电表统计、覆盖/边界证据；支持全范围固定 20:00–08:00 dailyWindow；服务端算总计与位置排名，模型不逐表求和 |
| 9 | compare_energy | axis（time/region）、scope、from/to、baseline? 或 other? | 差额/可比性/共同集合与证据；baseline 与 other 按轴互斥；单次比较只改时间或范围之一；既有算法保留 |
| 10 | review_safety_event | ledger+eventId+deviceId、cameraDeviceId? | 当前元数据与位置/楼层摄像头候选；多候选未选返回计数/澄清、不出卡；单选/选定生成对应观看卡并保留事件；当前候选不等于事发同址或看懂画面 |
| 11 | prepare_video_playback | 授权 deviceId+begin/end | 回放入口/窗口/卡；不请求流、不保证有录像；改会话产物不改硬件 |
| 12 | propose_action_draft | summary、candidateSetIds、actions、lighting?、excludedDeviceIds?、question? | 一份可确认即时草案或已满足结果；lighting 用 lightingDraftParameters，支持单/多候选集并集加排除，与专用工具共用 expandLightingScope，可与空调动作同草案；自动能力/状态校验并剔除已满足成员；50 上限只约束模型手写 actions，不约束服务端展开照明 |
| 13 | propose_lighting_draft | 单/多包含候选集+排除集/ID+开关 | 与 12 同一 helper 与 execute；并集/排除语义相同，Company 侧重叠属实；退役仅为候选方向，回归须保住并集/排除/混空调/已满足/恢复；Office 不动 |
| 14 | propose_task | label、candidateSetIds、interval?、repeat?、phases（at+lighting 或 actions 或 read） | TaskProposal；模型写数组上限 50，照明由服务端展开；未来目标含当前已满足设备；能力检查自动内置，非手工前置；阶段内 lighting 范围暂不能与显式空调/read 混排（actions 数组本身可含混合指令），属契约限制记录待业务准备时处理；无 interval 旧契约 1–2 阶段、interval≥1 任意检查点，沿用现行规则 |
| 15 | propose_company_night_closure | 共享 scopeTexts/excludeTexts + lightingAt/acAt | 收口澄清或就绪 TaskProposal+汇总计数与引用；照明/空调固定成员展开、能力校验、预检、requiresVerification 均由服务端；输入对两阶段同一范围/排除；不控制 |
| 16 | continue_company_night_closure | referenceId、已声明缺口 replacements、时间修改 | 保留服务端已解析成员/绑定；到期/来源/会话/成员漂移失效；不重建已登记任务；非通用续查接口 |
| 17 | list_tasks | date+regionId? | 来源授权的有界任务摘要列表；Company 来源不取 Office 区域 |
| 18 | list_task_plans | 空参 | 同来源授权周期计划 |
| 19 | get_task | task/task_plan + id | 当前对象/报告（按实际来源授权），并记录可取消资格所需已知 taskId；不等于全部已存报告检索（报告解释另有 app 级引用路径） |
| 20 | propose_task_change | type、id、operation、template? | 提议修改，非直接变更/控制；无模型可见版本参数，快照/版本/创建者/仅未来边界均在服务端校验 |
| 21 | propose_task_cancellation | taskId | 可确认取消提案，不按文字回滚/删除；当前要求 id 在 list_tasks 或 get_task 记录的 listedTaskIds 内再经 getCancelableTask 复核；能否用已验证直接对象引用去掉隐式前置属评审问题，非已观察缺陷 |
| 22 | reply_to_user | answer | 公开最终答复/澄清，过滤输出；无硬件/控制/任务授权；GLM 单答复重交可用 JSON 信封，沿用已证行为 |

## 暴露面差异（事实）

- Company 主线为上表；Office 仅共享发现/状态/能力/视频与动作/任务管理，不含 Company 历史/统计/收口/核查工具；query_alerts 仅在当前范围实际含 safety 时存在。
- input.energyReport 上下文零业务工具、仅 reply：同一报告的 explanation 有意不能再查/控制；改范围/窗口须走新查询而非重放旧卡。
- 执行摘要器仅 reply。计划内 Company 检查点 runner 只有 summarize_energy/compare_energy（服务端固定 meterIds）+ finish_checkpoint 或 publish_report（按预先确认的产物），同名但 schema/能力收窄，不属于主对话。报告是已确认检查点的持久产物，不新建调查报告/收件箱通道。
- 无任何直接硬件控制工具；确认/执行端点/扫描器在确定性服务端、工具箱之外。记录这些既有上下文不引入多智能体架构。

## 现状优点（建议保留）

即时草案的自动能力/状态检查、照明集合代数（并集/排除）、服务端电表统计算法/共同集合/覆盖口径、类型化引用与已存报告解释、严格 Task 确认与控制器执行、仅所选摄像头出卡。

## 主要问题（来源契约事实/风险，非实测失败率）

1. 契约层次需要澄清：裸证据浏览与完整目标封装并存本身不是缺陷（原始分页浏览、可选能力检查确有用处，不应笼统删除）；问题是调用方难分辨哪些是可选证据、哪些是必经确定性准备、各自结果/核验契约是否一致。收口的严格结果政策与通用路径「受理即完成」的旧口径不能靠措辞静默升级；结果/核验政策本身是候选设计选择之一，须随业务迁移逐条证明，历史报告保持原口径。
2. 新建任务入口重叠、提案路由过多。
3. 模型手写 AC/read 选择与 >50 数组上限 vs 服务端完整范围能力不匹配。
4. 收口输入只有共享范围，不能表达分阶段独立范围（已由[分阶段范围反例](../../plan/2026-10-20-company-closure-contract-probe.md)冻结证明形态等价不等于范围等价）。
5. 同阶段 lighting 范围与显式空调/read 不能混排的契约限制。
6. 续接形态不一致与隐式前置（取消需先列入 listedTaskIds）。
7. 可选浏览与必经确定性准备区分不清。

## 候选策略（建议，未批准为实施）

- A 保留原语 API、仅改提示/命名：迁移成本最低，仍由模型枚举与编排，单独采用不够。
- B（建议方向）深化既有业务模块/接口：目标规格（范围/排除或已验证精确选择）；仅动作/任务准备另按每阶段目标/动作/时间表达，只读调查的请求与结果保持独立可组合、不套阶段结构；服务器准备完整已校验计划/结果，Pi 选择意图与调查方向。发现/读取保留为可选独立证据工具，不规定 find→inspect→read→propose 固定脚本；出处/精度/取舍留在服务端；即时与未来授权语义保持分离，内部准备仅在有重叠真实调用方后共享。具体工具名、根 schema、helper 抽取未决，待候选设计与验证；不预设 Type.Union 根或 propose_task 别名。
- C 每个完整场景一个专用工具：演示路径短，但膨胀命名/重复并强加模板，不作总方向。有界便捷模板可展开为同一业务准备，但不得成为竞争权威路径或重定义用户范围。不做任意动作 JSON 巨型工具、通用工作流/OperationPlan/Investigation/注册表平台。

## 职责分工规则（建议）

Pi：理解自然语言、澄清真实歧义、选择有证据的下一步、解释。服务端：当前授权/来源、成员展开、排除、能力校验、数值计算、完整性、预检、快照、确认、执行、回读、分类。历史意图不等于授权；候选不等于选定；受理不等于已核验。模型可使用可选能力/读取证据，业务内部顺序不可见。

## 生命周期（建议沿用现状局部扩展）

| 对象 | 规则 |
| --- | --- |
| 未决目标/缺口 | 服务端持有的引用 |
| 已解析选定目标 | 固定成员身份与出处，按当前授权重绑 |
| 未确认提案 | 沿用现有版本/到期/被取代消息策略 |
| 已登记任务 | 稳定 ID+带版本修改，超出收口引用有效期 |
| 已存事实/报告 | 原始数值/成员/窗口与历史元数据不可变；解释不重新统计/抽样、不执行控制，但仍核验当前访问权限（可含上游元数据读取），不是「零读取」 |
| 新窗口/范围 | 新结果 |
| 当前摄像头元数据 | 不作事发时安装证明 |
| 取消提案 | 与 Task 本体区分 |

既有机制先局部扩展；出现真实重复调用方后再抽取相同校验，不预建通用引用注册表。

## 保留边界

未知不自动重试、三路控制器组、完整成员安全、照明未核验诚实口径保留。单台状态不可读可形成带未知事实的低风险提案；授权/范围/能力不可读则阻塞，不为成功缩范围。仅显示名变化且稳定身份/绑定不变，不因目录指纹单独变化普遍失效；旧范围词重新解析若改变实际成员则使待确认引用失效。能耗 areaName 优先与摄像头自身楼层/树兜底沿共用口径，未提交并行改动不盲目并入。不按名称/hub 做照明物理去重。

## 测试接缝与既有套件（沿用约定）

公开接缝：buildApp HTTP 消息/恢复/引用/确认/任务详情/报告 + 注入协议夹具的确定性扫描器；供应商线编码经注入模型 HTTP，不接真实端点；适配器原始映射仅在映射变化时测。不断言私有表、提示词字符串或工具计数；以可观察业务事实/写入判风险。既有相关套件：company-batch-plan、company-closure-clarification、company-night-closure-execution、mixed-scope-draft、whole-floor-exclusion、scheduled-lighting-scope、task-reference-management、task-plan-management、energy-business、safety-camera-review、final-answer-channel。

未决：确切工具名/根 schema/分阶段输入编码、GLM 端点对所选 schema 的实际接受度（注入抓包仅证 SDK 本地序列化，不构成兼容性通过）、各业务切片内旧入口具体去向。接口议程见[工具体系设计准备](../../plan/2026-10-20-agent-tool-system-design-preparation.md)。
