# 四类服务、双 Agent 与仪表盘的接口边界

日期：2026-10-08。状态：当前源码与真实只读数据已核对；理想接线建议单列，无生产代码改动。

源码基线：mp `6381f17`；Runtime `fbd1028`。使用已保存的开发身份和租户，不重新登录；数量仅代表本身份本次返回，不代表所有员工或所有园区。凭据、账号信息和完整原始响应不写入本文。

## 结论与上一轮表述纠正

四个相关服务是 `office`、`iot-center`、`perception`、`energy`，公共前缀为 `https://ncim.577119.com/micro-api/api`。它们是后端业务模块，不与产品入口一一对应；例如员工状态读取会经过 `iot-center`，公司监控定位也有可复用的 `office` 接口。

员工 Office Agent 的设备成员由当前用户办公室及其设备接口确定；区域关联分页只回填控制引用。上一轮“原始六接口是员工完整范围来源”的表述不准确：它们是部分控制与映射契约，不能把三类关联目录的全量记录并入员工可见范围。该界限早在 [09-17 范围裁定](../../plan/027-office-association-scope-ruling.md) 已确定，当前代码仍执行，不需要重新讨论或改变权限政策。

公司 Agent 从公司来源取得已接入设备，仪表盘读取该来源的观察子集与我方任务摘要。公司来源不是“把底层 333 台全部当作可操作设备”。

## 实际接口用途表

以下路径省略公共前缀 `/micro-api/api`。

| 接口族 | 返回对象与关键关联 | 员工 Agent | 公司 Agent / 仪表盘 |
|---|---|---|---|
| `/office/office/member/my/office` | 用户被分配的办公室，`elementId` | 确定员工区域上下文 | 不拿来限定公司的观察目录 |
| `/office/app/device/ac/myOffice/pageByAc?elementId=...&type=AirCold` | 办公室空调设备引用、`hubDeviceId` | 确定该办公室空调成员 | 不用它替代公司空调目录 |
| `/office/device/page?elementId=...` | `LIGHTING`、`SECURITY_PROTECTION/ACCESS`、`SECURITY_PROTECTION/VIDEO` | 确定该办公室照明、门禁、视频成员 | 不用员工目录构造公司范围 |
| `/office/{ac,lighting,access}AreaDevice/page` | 区域控制关联记录；`id`、类型专属区域 ID、`hubDeviceId`、`hubActionInfoId` | 只映射已有员工设备的控制 ID，不新增成员 | 按具体公司能力可用于控制绑定调查；全量可读本身不是新操作授权 |
| `/office/app/device/{ac,lighting,access}/down` | 原始文档的控制协议，要求相应 `*AreaDeviceId` | 现有 Office 控制出口 | 当前公司空调使用下述底层交互，不混用这些 ID |
| `/iot-center/device/page` | 底层设备 `id`、型号、编码、`actionList` | 为已有员工设备映射动作/读取状态 | 按已核验型号取得公司空调/环境等设备；全目录只作能力盘点 |
| `/iot-center/interactive/{deviceId}/{actionId}/down` | 通用动作，既有查询也有真实控制 | 已授权空调详情、视频状态/取流等；查询与控制动作分别处理 | 公司空调控制/详情、环境读取；路径名不能判断副作用 |
| `/iot-center/home/yq/env/data` | 站点环境影子值 | 无 Office 范围契约时不开放 | 公司环境的明确标注兜底，不当作某办公室实测 |
| `/perception/device/page`、`/fire/{flooding,gas}/alarm/page` | 感知目录与告警；台账 `deviceId` 指向感知设备 | 当前没有 Office 安全设备来源，不开放 | 公司安全设备与历史台账；通知仍由客户微脑负责 |
| `/energy/equipment/page`、`/energy/realTimeRead/page` | 计量点 `id`，读数 `equipmentId`，能源 `areaId` | 当前无 Office 计量范围契约，不开放 | 公司电表目录/最新已知读数；历史电量统计待正式新接口 |
| `/office/app/device/monitor/myAreaList`、`/office/app/device/monitor/devicePage?areaFullCode=...`、`/office/monitorAreaDevice/page` | 智慧监控区域树与安装地址/底层摄像头映射 | 不把智慧监控全目录加进员工范围 | 已证可用于公司监控接线，但当前 Company 目录/取流未接通；证据见 [10-07 复核](../../plan/2026-10-07-history-interfaces-alert-inbox-handoff.md) |

## 本次真实数据盘点

### 员工范围与关联目录

| 对象 | 本次返回数量 | 含义 |
|---|---:|---|
| 当前用户办公室 | 2 | 先确定两个 `elementId`，分别查询设备 |
| 第一个办公室 | 空调 1、照明 4、门禁 1、视频 1 | 7 台 |
| 第二个办公室 | 空调 1、照明 3、门禁 1、视频 0 | 5 台；视频 204 表示该来源为空 |
| 原始文档的区域关联目录 | 空调 53、照明 159、门禁 47 | 共 259 条关联记录，不能代替以上 12 台员工设备 |
| Runtime `loadDeviceCatalog` 最终成员 | 空调 2、照明 7、门禁 2、视频 1 | 12 台、两个区域；没有仅来自 `office-association.*` 的成员 |

直接调用适配器公开目录方法验证：12 台均保留 `my-office.*` 来源；11 台可控设备均取得 `controlRef`。探针注入 fetch 仅允许明确目录 GET 路径，拒绝其他方法与路径，不启动服务/扫描器、不写数据库。

当前过滤证据：[目录装配与过滤](../../../iot-agent-runtime/src/iot/adapter.ts#L326)、[已声明来源](../../../iot-agent-runtime/src/iot/authorized-device-scope.ts)。`requiresOfficeContext=false` 不是允许扩大范围；末端会排除所有仅有关联来源的设备。

### 公司来源与底层盘点

| 对象 | 本次返回数量 | 当前接入含义 |
|---|---:|---|
| `iot-center` 全设备目录 | 333 | 底层注册记录，不是员工成员，也不是 333 台均已接通的公司控制能力 |
| 云起空调 `YQ_AIR_CONDITION` | 55 | 当前公司目录包含这 55 台；代码找到对应详情/控制动作并启用能力；本轮没有实际控制验收 |
| 环境 `YQ-ENV-SENSOR` | 1 | 公司观察设备 |
| 电表 `/energy/equipment/page` | 43 | 公司计量点，全部为当前能源目录中的电表 |
| 感知 `/perception/device/page` | 170 | 类型分布：视频 24、照明 132、消防 3、楼控 11；公司当前只接入其中消防 3 |
| 监控区域关联目录 | 35 | 已有监控材料；当前 Company 最终目录视频为 0，材料可用不等于已接入 |
| Runtime `loadCompanyDeviceCatalog` | 102 | 空调 55＋观察 47，照明/门禁/视频均为 0，无 Office 区域投影 |
| 仪表盘实际读取目录 | 47 | 环境 1＋电表 43＋安全 3，另查询我方任务摘要；不含 55 台公司空调或全园区 333 台 |

公司装配证据：[公司目录](../../../iot-agent-runtime/src/iot/adapter.ts#L141)、[公司空调型号与动作绑定](../../../iot-agent-runtime/src/iot/adapter.ts#L656)、[观察目录](../../../iot-agent-runtime/src/iot/observation.ts#L144)。仪表盘观察子集证据：[dashboard route](../../../iot-agent-runtime/src/dashboard/routes.ts#L31)。

## 同一设备的三层引用与两种空间

员工两台空调都出现在公司 55 台空调目录中。物理重叠不会让两端的任务、会话、收件箱或操作授权互通。

本次一台空调的实际映射：

| 层 | 返回值 | 用途 |
|---|---|---|
| Office scoped 设备 `id` | `40c136038feb492c0a9686dea75332c2` | 员工检索、草案和任务引用 |
| 空调区域关联 `id` | `db80360875e90738ad55d1b637ceb8e8` | `acAreaDeviceId` 控制入参 |
| `hubDeviceId` / `iot-center.id` | `8feece859b9444f78c121e6835c96419` | 动作与状态读取；公司目录对此底层设备采用自己的来源 |

员工 2 台空调、7 台照明、2 台门禁均能用 `hubDeviceId` 找到关联控制记录，且各自 scoped ID 与 control ID 不同；12 台均能在底层目录找到稳定对应。传错 ID 不是换个接口前缀能解决的问题。此处是客户已经返回的稳定映射，不按名称猜测。

能源目录的 43 个计量点 ID 本次均不等于 `iot-center` 设备 ID；读数自身 `id` 又是第三种记录 ID，须用 `equipmentId` 对应计量点。能源 `areaId` 与 Office `elementId` 也不能互换：本次运营办公区域与其电表区域为不同 ID。感知 `elementId`、Office 区域、智慧监控 `areaFullCode` 各属自己的空间来源；没有明确关系时不靠同名房间建立授权或统计汇总。

## 读数事实与字段差异

- Office 空调列表样本含 `switchStatus=false`、环境温度 25、目标温度 26，以及在线标记；这是列表粗状态。本轮未调用底层权威详情动作，不把它作为执行后物理结果。
- 公司环境影子接口返回温度 `27.7`、湿度 `51.5` 及 PM 字段，采样/更新时间为 null；请求返回时间不能替代采集时间，也没有证据把该站点值归属到员工两个办公室。
- 能源最新读数返回 43 条，`readTime` 介于 2024-09 与 2025-05；43 条 `totalActivePower` 均为 null。目录 43 台不代表 43 个有效读数。本次接口耗时约 13.4 秒，分页状态不能消除上游读取延迟。
- 烟感/水浸台账 298 条，抽样最新 `createdAt=2024-04-14`；燃气台账 157 条，抽样含 `createdAt=2026-10-08 09:53:47`。它们是台账创建时间；无恢复/当前态证据，不能据新记录推断正在持续泄漏，也不能再将所有安全台账一概描述成 2024 年旧数据。
- 感知实际目录返回安装位置字段 `installAddr`；当前 Company 观察映射读取 `installAddress`，会遗漏位置。这是后续接线需修正的字段适配，不是客户没有位置数据。本轮只登记，不修改代码。

## 理想接线建议

以下是根据现有决定和本轮数据形成的接线基准；未接入能力仍需对应实现切片，不因本次报告自动上线。

1. **员工 Agent**：当前身份→全部已分配 Office 区域→各区域的 scoped 设备。界面、候选、草案、Task 成员均由这份目录决定；关联与 provider 目录只服务这些成员的控制、状态和能力绑定。当前实现已符合这一核心边界。
2. **公司 Agent**：从本端身份可见且已核验的公司设备目录、感知目录、计量目录取得成员。按上游型号/动作区分可控、仅观察、尚未接入；设备类型扩展不直接暴露底层目录中所有动作。公司查询用自己空间字段，不依赖员工区域来授予范围。
3. **仪表盘**：复用公司来源与读数，明确统计的是“已接入观察设备”“已接入公司设备”还是“底层台账可见设备”。当前 47、102、333 是三种口径，不做一个无说明的“设备总数”；有效读数、采样时间、历史台账与实时状态分别呈现。
4. **引用、执行与通知**：保留 `source` 和本端对象 ID，内部单独保存控制/provider 引用；共享物理设备不合并两端 Task/Plan。任务结束→我方同源收件箱→同一报告；客户告警通知→完整引用→用户目的，保持 [10-07 职责决定](../../plan/2026-10-07-history-interfaces-alert-inbox-handoff.md)。

建议下一步按现有接口补 Company 监控目录/取流的同源接线，及感知位置字段适配；四项历史接口到位后再补能耗/环境趋势、回放与我方人数分析。当前没有证据需要客户另造 `iot-office` 服务，也不需要为了区分两个 Agent 建两份执行系统。

## 验证范围与限制

本轮分页拉取了相关目录，并从适配器公开方法核验最终成员；真实样本来自单一开发身份，不宣称所有账号范围、跨账号撤权或所有设备状态均已验证。两仓 tracked 基线干净；未修改 Runtime 或小程序业务代码。

所有直接请求为明确只读 GET；适配器探针禁止非白名单路径及非 GET。没有控制、场景切换、播放取流、告警写处置、事件订阅、模型对话、通知发送、Runtime 重启或调度触发。本轮记录当前可重复事实，不把接口声明、下发受理、历史数据和物理完成混称为同一种证据。
