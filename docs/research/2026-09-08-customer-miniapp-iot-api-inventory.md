# 客户小程序物联设备接口清单

首次整理：2026-09-08；权限与链路补充：2026-09-14

## 结论

客户当前用户权限模型由办公室/工作区接口表达：用户模板决定可选设备，用户应用用户模板；区域注册设备并添加可操作人员。普通用户分配办公室后，只能在“我的办公室”看到该工作区内的可操作设备。云起通用目录是底层 provider/control plane，不是 Agent 的用户授权目录。

客户原有资料明确交付并说明控制语义的远程设备能力仍有三类：门禁、中央空调、照明。每类各有一个分页目录接口和一个控制接口，共 6 个 office 业务接口。2026-09-11 至 2026-09-14 的复核又确认，账号级上下文可以读取云起物联中心、感知和能源服务中的更广底层目录；对云起智慧空调的授权生产控制也已成功。但这些事实不能扩大普通用户的 Agent 操作范围，必须以办公室设备范围为准。

客户原生小程序源码并没有直接实现三类设备的完整页面：它只直接调用了门禁区域、区域门禁列表和开门接口。智慧门禁、智慧空调、智慧照明和智慧监控的菜单入口默认进入客户站点中的 H5 页面，因此仅检查这个小程序仓库无法还原这些 H5 页面的全部内部请求。

设备目录分页响应主要是关联记录和安装信息，不应把它当作实时状态响应。客户侧已有状态/详情响应体可供读取；当前缺口是 Runtime 尚未把这些生产响应接入 `readStates()` 和执行后回读。若某个办公室目录接口本身不携带状态，应由内部 provider 适配已确认的状态/详情接口，不能借此扩大用户设备范围。[Runtime adapter](../../../iot-agent-runtime/src/iot/adapter.ts#L39-L52)

## 请求公共约定

| 项目 | 当前结论 |
| --- | --- |
| 生产域名 | `https://ncim.577119.com` |
| 网关前缀 | `/micro-api` |
| 设备接口前缀 | `/micro-api/api/office` |
| 认证请求头 | `Authorization: Bearer ...` |
| 租户请求头 | `tenantCode`；客户文档写作 `Tenantcode`，HTTP 头大小写不敏感 |
| 查询成功码 | 客户文档示例是业务码 `0`；2026-09-03 只读实测为业务码 `200` |
| 控制成功结构 | `ResponseInfo<string>`，即 `{ code, content: "", message }` |

小程序将环境域名和 `/micro-api` 组合成 `baseUrl`。[config/index.js](../../config/index.js#L5-L29) 请求封装会从当前登录态取得 Token，并从用户当前园区取得租户 ID，分别写入 `Authorization` 和 `tenantCode`。[apis/request.js](../../apis/request.js#L7-L20)

## 正式设备接口

### 1. 门禁设备分页查询

`GET /micro-api/api/office/accessAreaDevice/page`

用途：查询当前账号有权看到的门禁关联设备。Runtime 使用该接口构建门禁目录；2026-09-03 只读账号实测得到 47 条记录。[契约覆盖](../../../Iotfake/docs/contract-coverage.md#L3-L21)

常用查询参数：

| 参数 | 含义 |
| --- | --- |
| `page` | 页码，从 0 开始 |
| `size` | 每页数量；实测最大按 500 处理 |
| `sort` | Spring Page 排序，例如 `id,desc` |
| `accessAreaId` | 门禁区域关联 ID |
| `hubDeviceId` | 底层设备 ID |
| `name` | 别名；当前生产实测未产生过滤效果 |
| `fulltext` | 全文检索；当前生产实测未产生过滤效果 |
| `isDelete` | 逻辑删除；当前生产实测未产生过滤效果 |
| `tenantCode` | 文档参数；当前生产实测未产生过滤效果，授权以请求头身份为准 |

响应核心字段：

```text
content.content[].id                 控制接口使用的门禁关联记录 ID
content.content[].accessAreaId       门禁区域 ID
content.content[].hubDeviceId        底层设备 ID
content.content[].hubActionInfoId    中心设备操作 ID
content.content[].name               展示名称
content.content[].installAddress     安装位置
content.totalElements/totalPages     分页总量
content.first/last/number/size       分页状态
```

来源：客户《微脑设备控制接口》门禁分页章节；生产行为记录见 [contract-coverage.md](../../../Iotfake/docs/contract-coverage.md#L23-L33)。

### 2. 门禁控制

`POST /micro-api/api/office/app/device/access/down`

请求体：

```json
{
  "accessAreaDeviceId": "门禁分页记录的 id",
  "controlType": 2
}
```

文档枚举为 `0=常开`、`1=门闭`、`2=门开`、`3=常闭`，但客户明确注明当前只有 `2`（开门）可用。原生小程序也固定发送 `controlType: 2`。[apis/office/index.js](../../apis/office/index.js#L9-L10) [AccessCon.vue](../../pages/index/coms/AccessCon.vue#L149-L159)

该接口返回的是指令受理结果，不是门磁状态，不能据此断言门仍处于打开状态。

### 3. 中央空调分页查询

`GET /micro-api/api/office/acAreaDevice/page`

用途：查询当前账号可见的中央空调关联记录。2026-09-03 只读账号实测得到 53 条记录。[契约覆盖](../../../Iotfake/docs/contract-coverage.md#L3-L18)

2026-09-11 的最终复核发现，同一自然日内的不同登录会话对该接口出现过“53 条”和“业务码 204、0 条”两种结果；与此同时，App 中的云起智慧空调仍可通过 `api-iot-center` 正常控制。该接口的账号、会话或业务上下文边界尚未澄清，不能用它的空结果推断所有空调不可控制。

查询参数与门禁分页一致，其中区域参数为 `acAreaId`。响应设备字段相同，其中区域字段为 `acAreaId`。目录记录没有提供当前开关、模式、风速、设定温度或室温。

### 4. 中央空调控制

`POST /micro-api/api/office/app/device/ac/down`

请求体：

```json
{
  "acAreaDeviceId": "空调分页记录的 id",
  "deviceInfoId": "可选；底层设备 id",
  "acDeviceParamTemplate": "AC_OPEN",
  "temperature": 250
}
```

`acDeviceParamTemplate` 支持：

| 模板 | 操作 |
| --- | --- |
| `AC_OPEN` / `AC_CLOSE` | 开机 / 关机 |
| `AC_MODE_AUTO` | 自动模式 |
| `AC_MODE_FAN` | 送风模式 |
| `AC_MODE_COOL` | 制冷模式 |
| `AC_MODE_HEAT` | 制热模式 |
| `AC_MODE_DRY` | 除湿模式 |
| `AC_FAN_SPEED_LOW` | 低风速 |
| `AC_FAN_SPEED_MIDDLE` | 中风速 |
| `AC_FAN_SPEED_HIGH` | 高风速 |
| `AC_TEMPERATURE` | 调整设定温度 |

温度使用摄氏度乘 10 的整数表示，范围为 `160–300`。例如 25°C 传 `250`。每次请求只表达一个控制项；Runtime 因此会把一次多参数草案拆成多个上游原子请求。[Runtime adapter](../../../iot-agent-runtime/src/iot/adapter.ts#L89-L107)

### 5. 照明设备分页查询

`GET /micro-api/api/office/lightingAreaDevice/page`

用途：查询当前账号可见的照明关联记录。2026-09-03 只读账号实测得到 159 条记录。[契约覆盖](../../../Iotfake/docs/contract-coverage.md#L3-L19)

查询参数与门禁分页一致，其中区域参数为 `lightingAreaId`。响应设备字段相同，其中区域字段为 `lightingAreaId`。目录记录没有提供当前亮灭状态。

### 6. 照明控制

`POST /micro-api/api/office/app/device/lighting/down`

请求体：

```json
{
  "lightingAreaDeviceId": "照明分页记录的 id",
  "closeOrOpen": 0
}
```

`closeOrOpen: 0` 表示关闭，`1` 表示打开。响应只表示指令是否被受理，不提供操作后的灯具状态。

## 原生小程序门禁页面专用接口

这两个接口没有出现在客户提供的 6 接口文档中，但存在于原生小程序源码，并在 2026-09-03 做过只读生产核验。

### 7. 门禁区域树

`GET /micro-api/api/office/app/device/access/myAreaList`

参数：`parentId`。

原生页面首先使用硬编码根节点 `6814b370dbef70513407e0a90e42d5b4` 查询楼层，再以楼层 ID 查询房间。[AccessCon.vue](../../pages/index/coms/AccessCon.vue#L75-L76) [AccessCon.vue](../../pages/index/coms/AccessCon.vue#L108-L125)

页面实际使用的区域字段至少包括：`id`、`name`、`fullCode`。

### 8. 指定区域的门禁设备

`GET /micro-api/api/office/app/device/access/devicePage`

参数：`areaFullCode`，来源于区域树房间节点的 `fullCode`。[AccessCon.vue](../../pages/index/coms/AccessCon.vue#L127-L140)

已知异常：2026-09-03 对现有生产区域查询均返回业务码 `204`。Iotfake 为了让客户原生页面可开发，按区域 `fullCode` 将其关联到正式门禁分页数据；这属于本地兼容行为，不能视为生产契约已经正常。[contract-coverage.md](../../../Iotfake/docs/contract-coverage.md#L44-L47)

## 其他相关能力

### 9. 环境数据接口

`GET /micro-api/api/iot-center/home/yq/env/data`

源码注释为“查询环境设备信息”，但当前仓库没有页面调用它，也没有响应模型或生产核验记录。[apis/home/index.js](../../apis/home/index.js#L21-L25)

因此它只能标记为“接口声明存在，业务用途和返回字段未确认”，不应直接接入 Agent。

### 微信 BLE 广播

这不是 HTTP 接口。小程序可调用微信的 `openBluetoothAdapter`、`createBLEPeripheralServer` 和 `startAdvertising`，广播用户当前卡号转换出的 4 字节 manufacturer data。[utils/blue.js](../../utils/blue.js#L1-L61) [pages/user/index.vue](../../pages/user/index.vue#L107-L170)

当前 UI 将它称为“蓝牙广播”。[pages/user/index.vue](../../pages/user/index.vue#L40-L47) 源码没有提供远程设备目录、设备选择或操作结果，因此暂时不应把它归入 Agent 的门禁、照明或空调原子工具。

## 公网 Swagger 中发现的其他物联接口

2026-09-08 对客户公网 Swagger 做了只读检查。服务清单可由 [`/micro-api/swagger-resources`](https://ncim.577119.com/micro-api/swagger-resources) 公开读取。以下接口“存在于公网定义”不等于当前账号有权调用，也不等于已经通过新世纪项目的业务验收。

### `api-iot-center`：物联网引擎

Swagger：[`/micro-api/api/iot-center/v2/api-docs`](https://ncim.577119.com/micro-api/api/iot-center/v2/api-docs)，共约 72 条路径。

- 通用设备：`/device/`、`/device/page`、`/device/list`、`/device/{id}`、`/device/import`、`/device/{id}/all/info`、`/device/{id}/action/list`、`/device/class/statistics/{tenantCode}`。
- 动作与参数：`/device/action/*`、`/device/param/*`、`/action/param/*`、`/profile/param/*`、`/profile/template/*`。
- 型号与驱动：`/model/*`、`/driver/*`。
- 通用设备交互：`POST /interactive/{deviceId}/{actionId}/down`、`POST /interactive/{workerId}/up`、`POST /to/interactive/{deviceId}/{actionId}/down`。
- 监控目录：`GET /video/ehe/page`。
- 门禁与交互记录：`/access/history/page`、`/interactive/history/access/*`、`/hik/isc/date/{projectCode}/accessEventReceive`。
- 环境数据：`GET /home/yq/env/data`。
- `/to/device/*`、`/to/element/*`、`/to/interactive/*` 看起来是服务间 Feign 能力，不应直接暴露为 Agent 工具。

### `api-perception`：智能物联

Swagger：[`/micro-api/api/perception/v2/api-docs`](https://ncim.577119.com/micro-api/api/perception/v2/api-docs)，共约 177 条路径。

- 通用设备与空间：`/device/*`、`/element/*`、`/facility/*`、`/device/group/*`、`/group/device/*`。
- 照明：`/lighting/circuit/*`、`/lighting/base/setting/*`、`/lighting/scenario/setting/*`、`/lighting/scene/info/*`、`/lighting/strategy/*`、`/lighting/warn/*`。
- 照明直接动作：`GET /lighting/circuit/{id}/status/{status}`、`GET /lighting/scene/info/{id}/execute`、`GET /lighting/scene/info/{id}/{enable}`。
- 空调：`/bas/ac/run/status/*`、`/bas/ac/run/scenario/*`、`/bas/ac/run/strategy/*`、`/bas/ac/alarm/rule/*`、`/bas/ac/alarm/record/*`。
- 空调场景执行：`GET /bas/ac/run/scenario/execute/{id}`。
- 视频与周界：`/videoEquipment/*`、`/hostEquipment/*`、`/hostEquipmentConfig/*`、`/hostEquipmentParameter/*`、`/infraredEquipment/*`、`/isc/event*`、`/isc/face/application/*`、`/isc/plateFormConfig/*`。
- 消防：`/fire/equipment/*`、`/fire/alarm/*`、`/fire/fight/*`、`/fire/flooding/*`、`/fire/gas/*`、`/fire/safe/*`、`/fire/tank/*`、`/fire/home/*`。
- 变配电：`/ammeter/*`、`/distribution/equipment/*`、`/distribution/equipmentCondition/*`、`/dist/electricity/*`。
- 告警：`/alarmRecord/*`、`/warn/*`、`/warnRule/*`、`/warnRecord/*`、`/warnReceiver/*`、`/subscriber/*`。

部分“状态切换”和“场景执行”在 Swagger 中被定义为 GET。接入前需要确认其真实副作用、鉴权、幂等性和防重复执行机制，不能直接按普通查询处理。

### `api-energy`：能源系统

Swagger：[`/micro-api/api/energy/v2/api-docs`](https://ncim.577119.com/micro-api/api/energy/v2/api-docs)，共约 86 条路径。

- 能源设备与区域：`/equipment/*`、`/area/*`、`/equipment/getEquipmentOfAreaTree`。
- 实时和当前数据：`/realTimeRead/page`、`/currentElectricity/page`、`/electricData/*`。
- 电力指标：电流、电压、有功/无功功率、功率因数、线温、电量和能耗统计。
- 水气计量：`/waterUseInfo/*`、`/gasUsageInfo/*`。
- 在线、操作和消息记录：`/onlineRecord/*`、`/operationRecord/*`、`/messageRecord/*`。
- 阈值与预警：`/electricMeterThreshold/*`、`/preWarning/*`。
- 计费与峰谷方案：`/energy/cost/*`、`/feeScheme/*`、`/peakValleyPlan/*`、`/timeScheme/*`。

### 公网设备类型汇总

目前公网定义至少覆盖：门禁、中央空调、照明、视频监控、人脸识别、周界主机、红外设备、消防设备、可燃气体、水浸、水压、水位、安全用电、配电设备、电表、水表、燃气计量、环境检测和通用物联网设备。

当前 Agent 的用户设备权威来源应为办公室/工作区设备接口；`api-office` 的门禁、中央空调和照明是已知业务控制入口。`api-iot-center`、`api-perception` 和 `api-energy` 的目录和动作可用于云起 provider 映射、状态和能力调查，但不得直接作为 Agent 用户设备范围。

办公室层同级用户设备接口族共同表达当前用户的办公室分配和设备范围；“我的办公室”只是其中一个不完整实现。“智慧空调”等“智慧”入口直接进入云起面板，不参与 Agent 范围发现。云起通用目录数量不能用来推断普通用户的可操作设备数量。

## 2026-09-11 测试账号权限复核

当前登录租户为 `XSJ`。使用现有登录态执行只读目录请求时，没有遇到 401 或 403。需要注意：`api-office` 三类关联目录曾成功返回下表数量，但 2026-09-11 14:28 的最终浏览器会话复核中，门禁和空调关联目录又返回了业务码 204 和 0 条记录；这说明“同一账号”之外还存在未识别的会话、入口或业务上下文差异。

| 数据源 | 已成功读取数量 | 目录摘要 |
| --- | ---: | --- |
| `api-office/accessAreaDevice/page` | 47 | 门禁关联记录 |
| `api-office/acAreaDevice/page` | 53 | 空调关联记录 |
| `api-office/lightingAreaDevice/page` | 159 | 照明关联记录 |
| `api-iot-center/device/page` | 333 | 账号可见的通用底层设备目录 |
| `api-perception/device/page` | 170 | 照明 132、视频 24、楼宇控制 11、消防 3 |
| `api-perception/lighting/circuit/page` | 129 | 照明回路 |
| `api-energy/equipment/page` | 43 | 能源设备，当前样本均为电表类目录 |

通用底层目录的设备模板包括：136 个照明开关、66 个空调设备或控制器、48 个门禁设备、43 个能源设备、35 个监控设备、1 个监控事件服务，以及环境、烟感、燃气和水浸设备各 1 个。332 个设备报告在线，1 个离线；333 个设备的工作状态均为正常。

原 `api-office` 三类目录与 2026-09-03 Iotfake 快照逐字段指纹完全一致，因此现有门禁、空调和照明测试数据无需刷新。三类关联记录共引用 230 个不同底层设备；通用目录中另有 103 个设备没有进入这三类关联目录，主要是能源、监控、三菱空调控制器和传感器。

复核指纹只覆盖接入所需的非敏感发现字段：

| 目录 | SHA-256 |
| --- | --- |
| 物联中心 333 个设备 | `b633e7ab1695f96b3485396a1061105a4521d67622b8deb4f1d6060b109c29c1` |
| 感知 170 个设备 | `0b35df7666e12ab62ae8ae4d2c8858fb78988ea43c97e7fb2bc23f799c454348` |
| 感知 129 个照明回路 | `f13b3298801b42a545ceeea2f85fbe727d14e58d54b89b370d48e5e47529f50a` |
| 能源 43 个设备 | `3669d3813d89915439f3a779f75b844839ad49f87c40ec647021d180e71b97d5` |

门禁区域树仍返回 3 个顶层区域和 5 个子区域，但所有 `devicePage?areaFullCode=...` 请求仍返回业务码 204、`message: "未找到数据！"` 和 `content: null`。

空调状态和能源读数的首次大分页请求曾超时。2026-09-11 进一步使用小分页复核后，两类接口均能返回 HTTP 200、业务码 200，因此不能再把首次超时视为权限或接口不可用：

- `/api/perception/bas/ac/run/status/page` 返回 11 条空调运行状态记录。逐页核验后，11 条记录的电源、模式、风速、设定温度、回风温度、故障等 9 个关键字段全部为 `null`。这只说明该感知数据集没有有效遥测，不能代表物联中心中的全部空调。
- `/api/energy/realTimeRead/page` 和 `/api/energy/currentElectricity/page` 均返回 43 条设备数据，单条分页约 1–1.5 秒。样本存在相电流/功率和累计电量，但 `readTime` 为 2024-09-10，实时性需要客户确认。

剩余问题分别是区域门禁关联为空、感知空调数据集的遥测字段为空、`api-office` 关联目录结果随会话或入口不一致，以及能源“实时”数据时间较旧，不是简单的账号被 401/403 拒绝。

结论：当前账号已经获得跨四个服务的广泛只读设备目录权限，足以开始扩展测试目录。是否拥有后台所称的“全部权限”仍无法仅凭响应证明，因为权限全集和应见设备基线没有独立清单；目前没有发现显式鉴权拒绝。

## 云起智慧空调生产控制实测

核验时间：2026-09-11。用户明确授权将“空调-26办公区（机房前）”的设定温度提高 1°C。

该设备在 `api-iot-center/device/page` 中的分类为：

| 字段 | 值 |
| --- | --- |
| 模板 | 云起智慧空调 |
| 型号 | `YQ_AIR_CONDITION` |
| 网络状态 | `ON_LINE` |
| 工作状态 | `NORMAL` |
| 详情动作 | `acDetail` / `acDetailHandler` |
| 控制动作 | `airCondition` / `acControlHandler` |

通过设备自身的详情动作回读到：电源开启、设定温度 24°C、环境温度 24°C。控制使用物联中心通用下行接口：

```text
POST /micro-api/api/iot-center/interactive/{deviceId}/{actionId}/down
```

云起温度属性采用设备详情返回的属性描述：

```json
{
  "idx": "tT",
  "type": 136,
  "val": 250
}
```

简化参数 `{ "tT": 250 }` 被平台以业务码 207“设置失败”拒绝，设备状态未变化。使用完整属性参数后，平台返回业务码 200，云起侧返回 `code: 0`、`status: "ok"`；再次调用详情动作，设定温度已经从 24°C 更新为 25°C，电源仍为开启。记录中不保存设备 ID、动作 ID、Token 或云起凭据。

这次实测否定了“所有空调都无法控制”或“所有空调状态都为空”的外推。当前至少存在三个不同视角：

1. `api-office/acAreaDevice/page`：客户文档中的区域设备关联目录，结果存在会话或入口差异。
2. `api-perception/bas/ac/run/status/page`：包含 11 条记录但关键遥测全部为空的感知数据集。
3. `api-iot-center` 云起智慧空调：详情和控制动作均已生产实测成功。

“智慧空调”属于云起面板，不是 Agent 的独立范围入口；Agent 使用客户小程序当前登录用户对应的 Office 用户设备接口集合。云起 `acControlHandler` 的实测证明底层控制响应体和控制能力存在，Runtime 只需在已授权设备引用上完成适配，不需要理解或复制上游设备注册流程。

## 小程序页面与接口的真实关系

| 页面/入口 | 实际形态 | 当前仓库中的接口实现 |
| --- | --- | --- |
| 首页门禁卡片 | 原生 UniApp 组件 | 区域树、区域设备、开门 |
| 智慧门禁 | 客户 H5 WebView 菜单 | 当前仓库仅保存跳转 URI |
| 智慧空调 | 客户 H5 WebView 菜单 | 当前仓库仅保存跳转 URI |
| 智慧照明 | 客户 H5 WebView 菜单 | 当前仓库仅保存跳转 URI |
| 智慧监控 | 客户 H5 WebView 菜单 | 当前仓库仅保存跳转 URI，没有摄像头接口文档 |
| 我的办公室 | 客户 H5 WebView 菜单 | 当前仓库仅保存跳转 URI |

菜单 URI 分别为 `/pages/access/index`、`/pages/aircold/index`、`/pages/light/index`、`/pages/monitor/index` 等，并由 `webJump` 放入小程序 WebView。[config/menu.json](../../config/menu.json#L47-L93) [utils/tools.js](../../utils/tools.js#L82-L136)

浏览器只读检查 `https://ncim.577119.com/` 时，当前登录态进入的是 `/portal/platform/index`。直接附加小程序页面 hash 仍由该桌面 Portal 接管，因此没有在浏览器中安全获得 H5 设备页的额外网络契约；本清单不把未观察到的请求推断成正式接口。

后续生产动作实测已经证明云起智慧空调具备通用交互控制能力，但这只证明 provider 能力，不证明 Agent 可以使用账号级云起目录扩大用户范围。Office 用户设备接口族才是 Agent 的发现入口；“我的办公室”只是其中一个来源；云起通用交互只应隐藏在 provider adapter 内。

## 当前 Agent 对接覆盖

Runtime 当前已对接：

- 三类 `*AreaDevice/page` 目录接口；每类完整翻页后在本地进行账号范围内的设备检索。[Runtime adapter](../../../iot-agent-runtime/src/iot/adapter.ts#L54-L86)
- 门禁开门、照明开关、空调 11 个原子控制动作。[Runtime adapter](../../../iot-agent-runtime/src/iot/adapter.ts#L89-L125)
- 原生门禁区域树和 `devicePage` 没有作为 Agent 目录来源；Agent 使用更完整的 `accessAreaDevice/page`。
- 客户状态/详情接口已有响应体和生产观测记录；当前缺口是 Runtime 尚未完成生产 `readStates()` 适配。Iotfake 的 `/__iotfake/state` 只用于本地确定性测试，不替代客户状态接口。[Runtime adapter](../../../iot-agent-runtime/src/iot/adapter.ts)

## 对接缺口和建议向客户确认的接口

按优先级建议确认：

1. 将已有三类设备状态/详情响应体接入 Runtime 的生产 `readStates()`，并在执行后形成可验证回读。
2. 将已有控制响应中的受理结果与状态结果分别映射，避免把“已受理”表达成“已完成”。
3. 在微信开发者工具中验证小程序登录态 token 能被 Agent 请求继承；固定 token 仅是测试环境的单用户注入方式。
4. 更多设备类型暂不接入，保持统一注册层预留。

## 证据分级

- **已实测只读**：三类 office 分页目录、门禁区域树、物联中心通用设备目录、感知设备与照明回路目录、能源设备目录；具体结果见 Iotfake 契约覆盖记录和 2026-09-11 复核章节。
- **客户文档定义、未调用生产控制**：门禁、空调、照明三个控制接口。
- **客户原生源码直接调用**：门禁区域树、区域门禁列表、开门。
- **仅作为 provider/菜单证据**：环境数据及各“智慧”云起面板；它们不构成 Agent 范围，除非未来客户明确提供对应用户过滤接口。
- **本地测试专用**：所有 `/__iotfake/**` 路径，绝不属于客户生产契约。
