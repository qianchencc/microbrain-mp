# 云起型号设备接口能力实检

日期：2026-09-22
方式：superadmin 控制台登录态 + `page.fetch` 直连 `https://ncim.577119.com/micro-api`（`Authorization: bearer …` + `tenantcode: XSJ`）。除声明为查询类的交互动作外无写操作；不记录 Token、完整设备 ID 与云起凭据。

## 背景与口径

- 设备管理页型号下拉共 13 个型号。用户判定"云起系列基本涵盖合同设备类型"，本文逐一验证其真实接口能力。
- 判定沿用支持包证据等级（`2026-09-18-customer-device-expansion-support-package.md`）：provider 侧能力 ≠ Agent 用户范围能力。
- 所有云起设备的 `paramMap` 表明底层通道是 LifeSmart 云（`api.cn2.ilifesmart.com` app/wss + agt/me），平台侧驱动为"新世纪内网驱动"。

## 型号清单（`iot-center/model/list`）

| modelCode | mainType | 设备数 | 角色 |
| --- | --- | ---: | --- |
| SL-SW-NS3 | LIGHT | 136 | 云起星玉 3 路开关面板（照明，每回路一条设备记录） |
| YQ_AIR_CONDITION | AC | 66 | 云起智慧空调（已 E5） |
| MG-AC-CONTROLLER | AC | （三菱控制器） | 既有空调另一型号 |
| EHE-ACCESS-V2 / DS-K1T6-GS4F / DS-K1T673M | ACCESS | 48 | 门禁（海康系，非云起） |
| HIK-ISC-VIDEO | CAMERA | 35 | 视频（已验证实时预览） |
| HIK-ISC-EVENT-SERVICE | CAMERA | 1 | ISC 事件服务 |
| ENERGY-376.1 | ENER | 43 | 正泰电表（非云起） |
| YQ-ENV-SENSOR | ENVR | 1 | 云起环境监测传感器 |
| YQ-PSD | FIRE | 1 | 云起光电感烟探测器 |
| YQ-WFS | FIRE | 1 | 云起水浸传感器 |
| YQ-GAS-INDUCTOR | FIRE | 1 | 云起燃气感应器 |

云起系实际覆盖：照明、空调、环境、烟感、水浸、燃气（感应器）。合同中的电表（正泰）、门禁（海康）、视频（海康）不是云起型号；道闸、人员统计、水表/燃气计量在整个型号表中不存在。

## 逐型号实检结果

### 1. YQ-ENV-SENSOR（环境监测）— 读能力完整 ✓

唯一设备"环境监测"（code `YQ-ENV-SENSOR-01`），ON_LINE/NORMAL。

**两条可用读路径**：

```text
POST /micro-api/api/iot-center/interactive/{deviceId}/{actionId}/down
  actionType=realTimeData（realTimeDataHandler），body={}
  → {"code":200,"content":"{\"temp\":\"27\",\"humidity\":\"65%\",\"pm25\":\"12\",\"pm10\":\"9\",\"pm101\":\"18\"}"}
  （content 是 JSON 字符串，需二次 parse；实测实时返回）

GET /micro-api/api/iot-center/home/yq/env/data
  → {"temp":"27.4","humidity":"65.1","pm25":"12.0","pm10":"10","pm101":"19.0"}
  （平台影子值，与实时读略有差异；09-18 探测时 content 为空，本次有值——依赖设备最近上报）
```

字段：温度 ℃、湿度 %、PM2.5、PM10、PM1.0（`pm101`）。无控制动作（纯传感器）。**结论：遥测读能力完整可用**；但只有 1 台、无 installAddress，且不在任何 office 用户范围来源中。

### 2. YQ-PSD / YQ-WFS / YQ-GAS-INDUCTOR（消防感知）— 告警链路存在但语义未定 ⚠

三台设备（27楼茶水间：光电感烟、水浸、燃气）均 ON_LINE/NORMAL，各只有一个动作：

```text
actionType=collect_alarm（collectAlarmHandler，"采集告警"）
POST interactive/{deviceId}/{actionId}/down body={}
→ {"code":200,"message":"开始采集","content":null}
```

`collect_alarm` 是**异步采集触发**，不是查询——返回即"开始采集"，结果不落响应体。触发后复查告警表未出现新记录（设备当前无告警属正常）。

**告警数据通路**（`all/info` 的 `paramMap.alarmPostAddress` 证实）：

```text
LifeSmart 云 → 驱动 → POST /api/perception/fire/alarm/{projectCode}/{type}/yqAlarmReceive
type ∈ SMOKE / FLOODING / GAS
```

**历史告警查询**（实测数据分布）：

| 查询接口 | 记录数 | 实际设备来源 | 最新记录 |
| --- | ---: | --- | --- |
| `/perception/fire/flooding/alarm/page` | 298 | 烟感 292 条 + 水浸 6 条（**SMOKE 告警也落此表**，无独立 smoke 查询路径，`/fire/smoke/alarm/page` 404） | 2024-04-14 |
| `/perception/fire/gas/alarm/page` | 78 | 燃气感应器 | 2024-04-21 |
| `/perception/fire/alarm/page`、`/alarmRecord/page`、`/warnRecord/page` | 0 | — | — |

记录字段：`deviceId`（perception 侧 ID，≠ iot-center 设备 id）、`deviceName`、`elementId/elementName`（燃气有"凯迪中心"，烟感为 null）、`alarm`、`report`。292 条烟感记录中 alarm 全 true、report 部分 true——**alarm/report 生命周期语义仍未定义**（与既有结论一致）；无确认/关闭/处置接口证据；告警全部停留在 2024-03/04，近两年无新告警。

**结论**：告警产生→落库→分页查询链路在 2024 年真实工作过（可编目为"曾连通"）；但当前无可控的告警注入手段验证端到端，处置生命周期与责任人规则仍属客户材料缺口。

### 3. SL-SW-NS3（云起星玉开关面板/照明）— 控制已通，状态回读实测超时 ⚠

136 台（每回路一条记录，paramMap 含 `currentLoop`/`loopNumber`）。动作四个：

```text
open（打开）/ close（关闭）/ OPEN_OR_CLOSE（面板打开关闭）—— 控制类，未调用
GET_SWITCH_STATUS（获取开关状态，getSwitchStatusHandler + SwitchStatusParser）—— 查询类
```

`GET_SWITCH_STATUS` 参数契约（`/action/param/list?actionId=…`）：必填 `loop`（回路，MULTIPLE_SELECT，dictCode=Loop）。

```text
body={}             → code 207 "请检查设备配置的开关路数和请求回路"（参数校验生效）
body={"loop":"N"}   → code 506 "操作超时,请重试!"（4 台设备 × 多 loop 值全部超时）
```

**结论**：参数格式已确认为 `{"loop":"回路号"}`，但状态查询经 LifeSmart 通道**一致超时**——照明权威回读在该动作上当前不可用，与既有"照明=仅受理"验收口径一致；`switchStatus` 粗状态布尔仍是无时间戳的兜底。照明控制本身经 office 链路已是 E5，不受影响。

## 对 Agent 接入的判断

| 能力 | provider 侧 | 用户范围（office 来源） | 判定 |
| --- | --- | --- | --- |
| 环境读数 | ✓ 双路径实测有数据 | ✗ 无 scoped 来源 | E2→可做只读探针；进 Agent 需先解决范围来源 |
| 烟感/水浸/燃气告警 | 历史链路证明 + collect 触发 | ✗ | E2；alarm/report 语义、处置接口、推送订阅仍是客户项 |
| 照明控制+状态 | 控制 ✓ / GET_SWITCH_STATUS 超时 | ✓（lighting 回路已在 scope） | 维持 E5（仅受理口径）；状态回读待通道修复 |
| 空调、门禁、视频、电表 | 既有结论不变 | — | 见支持包 |

**新发现需要更正的记录**：

1. 09-18 清单把水浸告警表记作"水浸告警 298 条"——实际该表 292 条来自**烟感**、仅 6 条是水浸；SMOKE 类型没有独立查询页。
2. `home/yq/env/data` 本次返回有效数据（09-18 探测为空）——它是影子读数，空值不代表接口失效。
3. `collect_alarm` 是触发式动作（返回"开始采集"），不是同步查询；消费侧仍是分页告警表。

**架构事实**：四类传感器经 LifeSmart 云接入，告警经 `yqAlarmReceive` 推入 perception；iot-center 侧无状态影子查询（`/up/link/history`、`/down/link/history` 均空），perception 侧只有告警表没有遥测当前值——传感器"当前是否报警中"无直接接口，只能由最新告警记录推断。

## 补充实检（2026-09-22 二轮）：处置接口存在

Swagger 定义确认告警记录可更新，处置语义大概率就是 `report` 字段：

| 接口 | 请求体字段 | 判断 |
| --- | --- | --- |
| `PUT /fire/alarm/{id}` | `version, report` | 消防通用告警处置 |
| `PUT /fire/flooding/alarm/{id}` | `version, report` | 水浸（+烟感）告警处置 |
| `PUT /fire/gas/alarm/{id}` | `version, report` | 燃气告警处置 |
| `PUT /warn/{id}` | `version, processStatus, jobDescription` | 通用警告处理（更完整的处置模型） |
| `PUT /warnRecord/{id}` | `version, status, remark` | 预警记录处置 |
| `warnReceiver/*` CRUD | `ammeterId, name, userId, contact` | 预警接收人——**但绑定 ammeterId**，消防侧责任人模型未见 |
| `/fire/home/{start}/{end}/warnProcess/count` | — | "报警和故障处理数"——证明平台有"已处理"统计口径 |

数据印证：烟感 292 条中 183 条 `report=true`、水浸 6 条全 `report=true`、燃气 78 条基本 `report=false`——`report` 是被人工标记过的字段，非纯上报标志。

**由此消防告警生命周期修正为**：`alarm=true`（事件发生，append-only）→ `PUT report=true`（人工处置标记）。未验证项：PUT 实际权限与返回、report 的正式业务语义（已确认/已处置/已上报）、是否有"恢复/消警"记录类型（现有记录全部 alarm=true，无恢复行——**"当前是否仍在报警"无法从表数据判定**）。

## 客户回复（2026-09-22）

- 电表：采集设备维修中（与读数停滞一致，等恢复后复测新鲜度）；
- 门禁/摄像头：海康系，授权我方直接调海康接口；
- 视频：物联网平台当前只暴露直播流一个接口，海康更多能力后续逐步暴露——**回放等能力不是被否，是未暴露**；
- 传感器/环境：客户反问业务需求，要求我方先明确要什么能力。

## 仍未关闭的问题（客户侧）

- `alarm`/`report` 正式语义确认 + "告警恢复"如何表达（恢复事件是否落表、当前告警态如何判定）；
- `PUT report` 处置接口的权限与业务约束（谁能处置、是否需要审批）；
- 新告警从设备到表的时延，以及能否触发一次测试告警做端到端验证；
- 消防告警的责任人/通知规则（warnReceiver 只绑定 ammeterId，消防侧未见）；
- GET_SWITCH_STATUS 506 超时的根因（LifeSmart 通道 or 面板不支持状态查询）；
- 传感器进入用户范围的正当来源（office 关联接口扩展或书面范围裁定）；
- 环境数据历史趋势接口缺失（只有实时读+影子值，无历史曲线）。
