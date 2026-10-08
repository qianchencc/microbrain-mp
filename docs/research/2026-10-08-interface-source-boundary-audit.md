# 四类服务、双 Agent 与仪表盘的接口边界

日期：2026-10-08。状态：当前源码与真实只读数据已核对；理想接线建议单列，无生产代码改动。

后续实施更新：票17已沿智慧空调区域/房间设备页限定 Company 成员；本次真实只读49台，底层55台中的6台不进入候选。Office仍2区域2空调，详见[来源对齐交接](../../plan/2026-10-08-company-smart-ac-source-handoff.md)。以下盘点数量与“当前”描述保留为首次调查时点证据。

源码基线：mp `6381f17`；Runtime `fbd1028`。使用已保存的开发身份和租户，不重新登录；数量仅代表本身份本次返回，不代表所有员工或所有园区。凭据、账号信息和完整原始响应不写入本文。

> **用户最终分层（2026-10-08，优先于下文调查中的待确认建议）：** 员工 Agent 走“我的办公室”，大 Agent 走“智慧xx”，仪表盘复用大 Agent 来源。不继续细究上游权限配置机制；Company 当前目录与智慧页面目录的偏差由我方适配修正，不向客户重复索取权限模型说明。已落实到 [ADR 0006](../adr/0006-dual-agent-sources-and-history-boundary.md)；当前任务与最小客户沟通项见 [对齐记录](../../plan/2026-10-08-page-interface-task-alignment.md)。

## 结论与上一轮表述纠正

四个相关服务是 `office`、`iot-center`、`perception`、`energy`，公共前缀为 `https://ncim.577119.com/micro-api/api`。它们是后端业务模块，不与产品入口一一对应；例如员工状态读取会经过 `iot-center`，公司监控定位也有可复用的 `office` 接口。

员工 Office Agent 的设备成员由当前用户办公室及其设备接口确定；区域关联分页只回填控制引用。上一轮“原始六接口是员工完整范围来源”的表述不准确：它们是部分控制与映射契约，不能把三类关联目录的全量记录并入员工可见范围。该界限早在 [09-17 范围裁定](../../plan/027-office-association-scope-ruling.md) 已确定，当前代码仍执行，不需要重新讨论或改变权限政策。

公司 Agent 当前从公司来源取得已接入设备，仪表盘读取该来源的观察子集与我方任务摘要。但这是数据接线事实，**尚不是“设备按人授权”已经核验的证据**。上一轮遗漏了区域角色、个人设备分组与通行权限这些不同关系，不能以服务前缀或接口可读代替授权模型核对。公司来源不是“把底层 333 台全部当作可操作设备”。

## 授权在哪一层限定区域（10-08 补充纠正）

授权关系在上游业务层，不在 `office` / `iot-center` 等服务名称本身。`Tenantcode` 选择租户；`elementId`、`areaFullCode` 是空间查询参数，单凭参数存在不能证明服务端校验当前用户的区域权限。

| 关系 | 接口与字段证据 | 已证范围 |
|---|---|---|
| 办公室成员→办公室→设备 | `/office/office/member/my/office` 的 `accountId → elementId`；区域内设备通过 `elementId` 查询 | 现行员工 Agent 使用该链路；本身份 2 个办公室、12 台设备。保留 09-17 范围裁定 |
| 用户→类型角色→类型区域→区域设备 | `/office/{ac,access,lighting,monitor}RoleAccount/list` 的 `accountId → *RoleId`；`/*AreaRole/list` 的 `*RoleId → *AreaId`；`/*AreaDevice/page` 的 `*AreaId → hubDeviceId` | 另一套区域角色配置确实存在，同样在 `office` 服务，不是直接“人→设备”的模型 |
| 用户侧智慧区域查询 | `/office/app/device/{ac,access,lighting,monitor}/myAreaList` 与 `/devicePage?areaFullCode=...`；Swagger 标为“我的区域列表”“我的设备分页查询” | owner H5 确实使用；单一身份查询不能证明每个入口都完整落实区域角色过滤，也不能替代员工办公室成员链路 |
| 个人设备分组 | `/perception/device/group/list?accountId=...`、`/group/device/list?groupId=...`；Office 也有同类分组 | 存在 `accountId → groupId → deviceId`，但未证实这是权限分配。智慧照明/视频页面将“设备”和“分组”分为不同页签；不能用分组直接裁定设备授权 |
| 通行账户权限 | `/transit/account/privilege/single/add` 定义 `accountId + elementIdList + privilegeType`，并提供账户权限查询及卡号/人脸下发 | 是通行权限业务；仍通过空间元素表达。不能直接当作 Company 通用远程控制的设备授权接口。本轮只读定义，未调用任何配置、下发或权限 POST |

Office 官方定义现在可正常读取：[Swagger](https://ncim.577119.com/micro-api/api/office/v2/api-docs)（`Accept: application/json`）。`/{类型}Area/authRole` 的 DTO 保存 `areaId + *RoleIdList`；`/{类型}RoleAccount/addBatch` 保存 `*RoleId + accountIdList`。这些配置接口只读取了文档，没有执行。

真实只读核对：当前身份在空调、门禁、照明、监控各有 1 条角色用户关系，返回的 `accountId` 均与当前账户一致；相应角色分别有 4、5、8、5 条区域绑定。未传 `areaFullCode` 的四类 `devicePage` 分别返回 53、47、156、35 台；这是同一身份下另一套目录，不等于员工 12 台范围。当前账户的 Office、perception 个人分组均为空，但 Company 目录仍有 102 台，说明当前代码没有用个人分组构造 Company 范围；这不证明分组是权限，也不证明 102 台越权。

必须区分小程序菜单与独立应用：当前小程序 `config/menu.json` 中，“智慧空调/照明/门禁/监控”和“我的办公室”均配置 `name=owner`，分别打开 `/owner/#/pages/{aircold,light,access,monitor,office}/index`。小程序开发版使用这份菜单，正式版菜单来自 SSO 资源接口，不把独立应用路由冒充该小程序菜单。已读取的 `/lighting/` 资产使用 `/perception/device/page`，`/access/` 使用 `/transit/device/page`，`/video/` 使用 `/perception/device/page/v2`，它们是另外的独立应用，**不能据此回答本小程序“智慧xx”页面的接口**。上一轮答复混入了这些独立应用，现纠正。

### 当前小程序五个入口的实际 owner 页面接口

下列路径仍省略 `/micro-api/api`。证据为 `config/menu.json`、owner 生产 `office.CAekgwnh.js`、`index.DST4_--l.js` 与五个页面 bundle；仅读取代码，没有点击控制或取流。

| 页面 | 区域/设备查询 | 操作出口 |
|---|---|---|
| 智慧空调 | `/office/app/device/ac/myAreaList` → `/office/app/device/ac/devicePage?areaFullCode=...`；详情 `/office/app/device/ac/detail/{id}` | `/office/app/device/ac/down`，传 `acAreaDeviceId` |
| 智慧照明 | `/office/app/device/lighting/myAreaList` → `/office/app/device/lighting/devicePage?areaFullCode=...` | `/office/app/device/lighting/down`，传 `lightingAreaDeviceId` |
| 智慧门禁 | `/office/app/device/access/myAreaList` → `/office/app/device/access/devicePage?areaFullCode=...`；首页原生 `AccessCon` 也使用此族 | `/office/app/device/access/down`，传 `accessAreaDeviceId` |
| 智慧监控 | `/office/app/device/monitor/myAreaList` → `/office/app/device/monitor/devicePage?areaFullCode=...` | `/office/app/device/monitor/down` 取得实时播放地址，传 `monitorAreaDeviceId` |
| 我的办公室 | `/office/office/member/my/office` → 按办公室 `elementId` 查询：空调 `/office/app/device/ac/myOffice/pageByAc?type=AirCold`；其余 `/office/device/page`，照明 `type=LIGHTING`，门禁/视频 `type=SECURITY_PROTECTION&subClass=ACCESS/VIDEO`；成员 `/office/office/member/my/office/member` | 空调同用 `/office/app/device/ac/down`，此模式传 `deviceInfoId`，详情 `/office/app/device/ac/myOffice/detail/{deviceInfoId}`；照明/门禁直接使用返回的 `hubDeviceId + deviceActionList.actionId` 调 `/iot-center/interactive/{deviceId}/{actionId}/down` |

所以这两组页面的目录都在 `office`，区别是**智慧区域树 `myAreaList + areaFullCode`** 与**办公室成员 `my/office + elementId`**。不能把“小程序智慧xx走 iot-center，而我的办公室走 office”当作实际目录分界。状态与控制可以另走 `iot-center`，不会改变目录所属链路；现行 Agent 的控制出口也不必与旧页面逐项相同。

当前 Company 空调适配器只传登录身份和租户，按 `modelCode=YQ_AIR_CONDITION` 拉 `iot-center/device/page`，以型号、编码与 `airCondition/acDetail` 动作筛选能力，没有显式查询用户设备分配或区域角色关系。上游可能在服务端按身份过滤，但本轮没有跨账号或正式契约证据证明它；动作存在也不是个人控制权限的证明。因此“Company 按人分配设备”的预期尚未完成接口对应，不能把 55 台空调/102 台目录标为已验证的个人授权范围。

此调查原建议继续核验 Company 用户授权模型；用户随后明确仅依赖页面业务分层，该建议已撤回。下一步按实际“智慧xx”页面目录修正 Company 接线，不以独立应用、个人分组或底层型号目录替代页面来源，也不复制一套我方授权后台。

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
| Runtime `loadCompanyDeviceCatalog` | 102 | 空调 55＋观察 47，照明/门禁/视频均为 0，无 Office 区域投影；为当前接入目录计数，尚未核验按人授权语义 |
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
2. **公司 Agent**：按用户最终决定，成员来自对应“智慧xx”页面的业务目录，再按实际动作区分可控、仅观察、尚未接入。当前空调直读底层型号目录与智慧页面不同，需由我方适配修正；不再以客户采用何种背后授权机制作为前置。公司查询用自己空间字段，不依赖员工办公室成员关系来取得范围。
3. **仪表盘**：复用公司来源与读数，明确统计的是“已接入观察设备”“已接入公司设备”还是“底层台账可见设备”。当前 47、102、333 是三种口径，不做一个无说明的“设备总数”；有效读数、采样时间、历史台账与实时状态分别呈现。
4. **引用、执行与通知**：保留 `source` 和本端对象 ID，内部单独保存控制/provider 引用；共享物理设备不合并两端 Task/Plan。任务结束→我方同源收件箱→同一报告；客户告警通知→完整引用→用户目的，保持 [10-07 职责决定](../../plan/2026-10-07-history-interfaces-alert-inbox-handoff.md)。

建议先按已确定的智慧页面目录修正 Company 接线，再按具体切片补监控目录/取流；感知位置字段兼容正在安全台账详情切片实施。四项历史接口到位后再补能耗/环境趋势、回放与我方人数分析。不再以 `iot-office` 服务名称或上游授权模型讨论阻塞接线；不需要为了区分两个 Agent 建两份执行系统。

## 验证范围与限制

本轮分页拉取了相关目录，并从适配器公开方法核验最终成员；真实样本来自单一开发身份，不宣称所有账号范围、跨账号撤权或所有设备状态均已验证。两仓 tracked 基线干净；未修改 Runtime 或小程序业务代码。

所有直接请求为明确只读 GET；适配器探针禁止非白名单路径及非 GET。没有控制、场景切换、播放取流、告警写处置、事件订阅、模型对话、通知发送、Runtime 重启或调度触发。本轮记录当前可重复事实，不把接口声明、下发受理、历史数据和物理完成混称为同一种证据。
