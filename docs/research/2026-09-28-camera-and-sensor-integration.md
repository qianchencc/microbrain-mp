# 摄像头与环境/消防/能耗传感器接入方案与业务场景

日期：2026-09-28
方式：Runtime 开发身份（普通用户权限，`var/agent-identity.json`，租户 XSJ）直连生产网关 `https://ncim.577119.com/micro-api` 只读复核；交互动作仅调用查询类（`view`/`onlineStatus`/`realTimeData`）。未执行任何控制、处置或状态切换写操作。本文是接入设计与场景设想，未改代码。

前置阅读：`2026-09-22-yunqi-model-capability-check.md`（型号实检）、`2026-09-18-runtime-verification-checklist-answers.md`（证据分级）、`plan/2026-09-18-customer-device-support-request.md`（客户请求清单）。

## 一、接口现状复核（2026-09-28）

| 能力 | 接口 | 今日实测结果 | 证据 |
| --- | --- | --- | --- |
| 视频 scoped 目录 | `office/device/page?type=SECURITY_PROTECTION&subClass=VIDEO` | 6 台：26楼运营走廊、27楼会议室/电梯口/大门/展厅/财务走廊；各带所属办公室与 hubDeviceId | 已实测只读 |
| 视频在线状态 | `iot-center interactive/{hub}/{onlineStatus}/down` | `{"onlineStatus":true}`；普通用户身份可用 | 已实测只读 |
| 视频实时取流 | `iot-center interactive/{hub}/{view}/down` | `{"result":true,"url":"wss://ncim.577119.com:6014/proxy/…"}`；**普通用户身份可用**（关闭 09-18 清单"普通用户 view 可用性未验"遗留项） | 已实测只读 |
| 环境实时读 | `interactive/{env-hub}/realTimeData/down` | `{"temp":"26","humidity":"57%","pm25":"34","pm10":"23","pm101":"60"}`；普通用户身份可用 | 已实测只读 |
| 环境影子值 | `iot-center home/yq/env/data` | 当前有值（temp 26.3 / humidity 57.9 / pm25 34.0 / pm10 23 / pm101 60.0） | 已实测只读 |
| 消防传感器目录 | `perception device/page`（FIRE 组） | 3 台全 ON_LINE：27楼茶水间光电感烟、水浸传感器、燃气感应器（perception id ≠ iot-center id，hubDeviceId 可 join） | 已实测只读 |
| 烟感/水浸告警史 | `perception fire/flooding/alarm/page` | 298 条（烟感 292 + 水浸 6），字段 `deviceId/deviceName/alarm/report`，最新 2024-04-13 | 已实测只读（陈旧，客户确认链路曾通） |
| 燃气告警史 | `perception fire/gas/alarm/page` | 78 条，最新 2024-04-20 | 已实测只读（陈旧） |
| 能源设备目录 | `energy equipment/page` | 43 台电表；字段含 `equipmentName/areaName/energyType/whetherOnline/feeSchemeName/electricMeterCategory` | 已实测只读 |
| 能源最新读数 | `energy realTimeRead/page` | 43 条，`readTime` 仍停留 2024-09-10（客户确认采集设备维修中）；字段含 `ia/ib/ic` 相电流、`totalActivePower`（样本为 null） | 已实测只读（陈旧） |
| 能耗统计族 | `electricData/*`、`statistics/*`、`waterUseInfo/*`、`gasUsageInfo/*` | 统计路径完整存在（用电对比/排名/分时/功率曲线/峰谷）；水表、燃气计量目录为空（现场无设备） | Swagger 定义 + 空目录实测 |
| 照度/光照传感器 | 型号表 13 个型号中无 | 不存在（云起环境传感器只覆盖温湿度 + PM2.5/PM10/PM1.0，无 CO₂/照度） | 已确认缺失 |

用户此前已确认的口径：时效性不是验收前提。因此陈旧的能耗读数与告警史**按"最新已知值 + 观测时间诚实标注"接入**，不因数据陈旧而阻塞开发。

## 二、范围模型：可控范围之外新增"观察范围"

2026-09-17 裁定（账号级目录只是 controlRef join 材料，不定义可操作范围）继续有效。本文为传感器接入新增并列的**观察范围（observation scope）**：

- **来源**：office scoped 来源（video，已在 `authorizedScopeSources`）+ 账号级只读目录（environment=iot-center 环境传感器、safety=perception FIRE、energy=energy equipment）。
- **纪律**：观察设备只读——不进入 `propose_action_draft`/`propose_task` 成员（工具指令 schema 已天然只收照明/空调/门禁三类指令，目录层再加 `observationOnly` 标记并在草案/任务入口拒绝）；不出现在能力核验的可下发指令里（现状已返回空指令集）。
- **理由**：这些是站点级传感/计量/监控设施，客户自己的 H5 面板同样向租户用户展示同类数据；Agent 只读展示不扩大控制面。若客户后续要求按办公室隔离环境/能耗可见性，需要客户给出对应过滤接口，属客户依赖项。

这一步是**内部拍板项**：是否接受账号级只读目录作为观察范围来源。本文按"接受"设计方案。

## 三、Runtime 响应能力设计

### 3.1 目录与状态读（`readStates` 扩展）

| kind | 状态读路径 | 语义 |
| --- | --- | --- |
| video | hub join 后调用 `onlineStatus` 动作（短 TTL 缓存，与 acDetail 动作 id 缓存同构） | 布尔在线态；无控制语义 |
| environment | `realTimeData` 动作为主，`home/yq/env/data` 影子兜底 | `{temp, humidity, pm25, pm10, pm101}` + 观测时间；影子值标注来源 |
| energy | `realTimeRead` 按 equipmentId 查询 | 最新已知读数 + `readTime`；陈旧是标注不是拒绝 |
| safety | 无"当前是否报警"接口（perception 只有告警史，无遥测现值） | **不伪造状态**；该 kind 的响应能力是告警史查询，不是状态读 |

目录侧：`authorizedScopeSources` 增加 observation 来源三类（environment/safety/energy），标记 `observationOnly`；设备去重沿用 hub join。视频沿用现有 `my-office.video`。`domain.ts` 的 `DeviceState` 需扩展观察值结构（环境读数、能耗读数目前无法用 `DeviceCommand` 表达）。

### 3.2 新工具

- `query_alerts`：参数 `type∈{smoke,water,gas}`、时间范围、`unreported` 过滤；返回告警记录列表（时间、设备、位置、alarm/report）。smoke 与 water 同表（`fire/flooding/alarm`），按 `deviceName` 区分。
- `read_energy_readings`：按区域/设备名提示查电表最新读数；一期只读数与简单求和，不做报表。
- 视频取流端点：`GET /api/agent/devices/{id}/video-stream`——调用 `view` 动作现取现返，短时效 URL 不落库不缓存；供前端播放页使用（见 3.3）。
- `read_device_states` 的 kind 覆盖自然扩展到观察类型。

### 3.3 前端响应面（mp）

- **视频卡**：设备名 + 所在区域 + 在线点 +「查看画面」。播放路径分两步：
  - 一期：跳现有客户监控 H5 入口（`pages/webView` + 智慧监控菜单 route），卡片只承诺"打开监控"；
  - 二期：自建 H5 播放页（挂客户域名下）调取流端点播 wss 代理流——小程序原生 `<video>` 不支持该流，必须 H5 播放器，与既有回放原型结论一致（`docs/research/proto-region-panel` 相关记录）。
- **环境读数卡**：温度/湿度/PM2.5/PM10/PM1.0 网格 + 观测时间。
- **告警列表**：时间 + 设备 + 位置 + alarm/report 标记；最新记录是 2024 年时必须如实显示"最近一条为 2024-04"，不得暗示实时性；`report` 语义未获客户确认前，文案只写"平台标记已上报/未上报"。
- **能耗读数表**：读数 + `readTime`；数据未恢复期间诚实标注"采集维修中"。
- 区域工作台设备抽屉的分组已支持 video/environment/energy/safety（`region-device-view.mjs` kindNames），目录接入后这些设备自动出现在对应区域分组；设备卡进入设备时间轴仍按票 11 边界保持关闭。

## 四、分期切片

| 期 | 内容 | 规模 | 依赖 |
| --- | --- | --- | --- |
| P1 只读问答 | observation 目录来源 + 四类状态读/告警史/能耗读数 + Agent 文本应答 | Runtime 1–2 票 | 内部观察范围拍板 |
| P2 视频响应面 | 视频卡 + 监控入口 + 取流端点 | mp 1 票 + Runtime 0.5 票 | P1；播放页形态拍板 |
| P3 能耗统计 | `electricData`/`statistics` 族接入：对比、排名、分时、峰谷 | 1–2 票 | 数据恢复后才有业务意义，接口可先接 |
| P4 告警处置闭环 | `PUT report` 处置、责任人、测试告警端到端 | 1 票 | 客户材料（alarm/report 语义、处置权限） |

明确不做（一期）：传感器自动控制；基于传感器读数的自动联动执行（只出建议）；消防/燃气无人值守自动化；水表/燃气计量（无设备）。

## 五、业务场景设想

1. **安保巡查问答**："27楼展厅的摄像头在线吗？" → 在线态 + 视频卡 +「查看画面」。巡查人员逐层问一圈即可完成在线巡检，不必逐个打开客户监控 H5。
2. **环境舒适度问答**："现在办公室空气怎么样？" → 温度 26°C / 湿度 57% / PM2.5 34；PM 偏高时 Agent 给出"建议开启空调送风/新风"的**只读建议**（联动执行属远期）。
3. **安全值守问答**："最近有烟感报警吗？有没处理过的吗？" → 告警史 + `report=false` 过滤；"上个月燃气有过告警吗" 同构。
4. **能耗问答**："26楼运营部电表现在读数多少？" → 最新已知读数 + readTime；数据恢复后升级为"这月用了多少电、环比上月、哪个区域用电最高"。
5. **每日巡检简报**（复用 Task 报告语言，只读生成）：一条简报卡 = 摄像头在线 6/6 + 环境读数 + 未处置告警 0 条 + 能耗概览。这是 B12 值班巡检简报方向的首个低成本切片：全部只读、无控制副作用。
6. **区域工作台扩展**：区域页设备抽屉出现该区域的摄像头/传感器分组；区域卡增加环境读数小部件；告警史进入设备时间轴（与 Task 操作、人工操作并列"平台事件"类记录，需先定投影规则）。
7. **远期联动设想**（一期全部只建议不执行）：PM2.5 持续超标 → 建议新风任务；夜间某区域能耗异常 → 值班提醒；烟感新告警 → 收件箱 + 订阅消息推送（复用通知分级设计）。

## 六、拍板记录与客户依赖

**内部拍板（2026-09-28，用户确认）**：
1. 观察范围裁定：**通过**——账号级只读目录进入用户可见观察范围，标记 `observationOnly`，永不进入草案/任务成员。
2. 播放页形态：**自建 H5 播放页**（不先进客户监控 H5 入口）；播放页视觉与交互设计后续交由设计 agent 完成，Runtime 先提供取流端点。

**客户依赖**（多数已在支持请求清单中，保持不重复索取）：
1. `alarm`/`report` 正式语义与处置接口权限（P4 前置）；
2. 能耗采集恢复时间（P3 业务意义前置）；
3. 回放接口（视频仅剩此项，客户已答"海康能力后续逐步暴露"）。

## 七、实施记录（P1 + 取流端点）

- 2026-09-28 已实施：observation 目录来源（environment/safety/energy）、`readStates` 扩展（video→`onlineStatus`、environment→`realTimeData`+影子兜底、energy→`realTimeRead`）、`query_alerts` 告警史查询、`GET /api/agent/devices/:id/video-stream` 取流端点（现取现返不落库）、草案/任务对 observation 设备的拒绝门禁。
- 形态收敛：能耗读数不设独立工具，由 `read_device_states` 覆盖（43 台单页可全量返回）；告警史用独立 `query_alerts` 工具。

## 八、取流协议试播记录（2026-09-28，原型探针）

取流端点返回的 `wss://ncim.577119.com:6014/proxy/{内网媒体节点:559}/openUrl/{7位token}` 是海康 iSecure/综合安防 H5 私有双层 WS 协议的播放地址。用逆向社区客户端（holmesian/hik_ws_client）与客户 `owner` SPA 内打包的官方 h5player 2.1.3 构建产物逐字节核对后确认：

- **`/proxy/{dev}/openUrl/{token}` 不是面向客户端的 WS 端点**：直接 upgrade 返回 mgc 404，属预期——token 不走该路径握手。
- **正确链路**：`wss://{外网代理}:6014/media?version=0.1&cipherSuites=0&sessionID=&proxy={dev}` 建立 WS（**不带 Sec-WebSocket-Protocol**，服务端不协商子协议）→ 服务端下发 `{"PKD","rand"}` → 客户端发 `{sequence:0,cmd:"realplay",url:"ws://{dev}/openUrl/{token}"}` → 此后应接 SDP 与媒体帧。与客户 SPA 打包代码中的 URL 变换、套接字构造、realplay 载荷完全一致。
- ~~**当前卡点在上游**~~（09-28 晚间实测推翻，见下文第八节之二）：裸 `realplay`（无认证字段或字段为空）返回 `{"errorCode":24317633,"errorMsg":"errPlatformIp=;errPlatformName=sb68tg==","statusCode":1,"statusString":"ERROR"}`——该错误**不是平台路由失败，而是 realplay 认证缺失的服务端拒绝**，错误文案有误导性。
- **设计结论**：播放页必须内嵌海康官方 h5player SDK（wasm 解码 + 私有协议 + PKD/rand 认证计算，JSPlugin 形态），自研解码器不可行；`view`→前端→JSPlugin 的"现取现返"交接模式与协议兼容；回放命令 `playback` 在同一协议内已见形态（客户依赖第 3 项不变）。

## 八之二、端到端播放验证（2026-09-28 晚，自建页面实测通过）

用户在客户监控 H5 实测"能播"后，用**官方 h5player 本体 + 自建最小页面**在真实浏览器（headless Chrome 154）完成端到端验证：

- **播放成功**：`new JSPlugin({szId, szBasePath}).JS_Play(url, {playURL:url, mode:0}, 1)` → WS `onopen` → PKD/rand hello（`version:"2.0"`,`cipherSuite:"0"`）→ SDK 内部完成认证 → 服务端返回 `{"errorCode":0,"statusString":"OK","sdp":"v=0…"}` → IMKH 媒体头 → **首帧解码成功：H.265 640×368**，`PlayM4_Play sucessed`，JS_Play promise resolve；截图确认画面为实时视频（OSD 时间戳与当前时间一致）。
- **裸探针失败的根因**：PKD/rand 服务端握手要求 realplay 命令携带认证字段（`key`/`authorization`/`token`，由 PKD+rand+iv 经 AES/HMAC/SHA256 派生，SDK 内部完成）。我此前探针发送空字段或缺字段 → 服务端拒绝并报 `errPlatformIp=`（误导性文案）。**认证是协议必要环节，只有官方 SDK 能做**——进一步坐实"必须嵌官方 SDK"的结论。
- **token 无调用方绑定**：`POST /api/office/app/device/monitor/down`（`{monitorAreaDeviceId, noTip:true}`，服务端 python 调用、无浏览器 cookie）颁发的 URL 在另一浏览器上下文直接可播 → Runtime 代取模式（`video-stream` 端点）在浏览器侧可放，**不存在会话绑定问题**。
- **SDK 资产已在客户域托管，零部署成本**：`https://ncim.577119.com/owner/static/h5player/` 全量在位——`h5player.min.js`(874KB)、`playctrl1/`、`playctrl1simd/`、`playctrl2/`、`playctrl3/`(+wasm+worker)、`talk/`、`talkW/`。自建页只要挂在 `ncim.577119.com` 任意路径（同域可加载 worker/wasm），`szBasePath:"/owner/static/h5player/"` 即可，**唯一需要新增部署的是页面 HTML 本身**（微信业务域名白名单已覆盖该域）。备选：复制该目录到播放页自身路径，解耦 owner 目录变动风险。
- **解码路径选择**：无 SharedArrayBuffer（headless Chrome / 微信 WebView 同此特征）→ `decoder1.0`（`playctrl1simd/`，x86 simd wasm；iOS 等非 simd 走 `playctrl1/`）；有 SAB → `playctrl3/`（decoder2.0）。全部资产已托管，无需裁剪。
- **监控设备目录补充**：`GET /app/device/monitor/devicePage` 为账号级监控设备台账（35 台），`monitor/down` 按其 `id` 取流；`监控-26楼运营走廊` 与 `监控-26楼运营走廊2` 是不同摄像头（hubDeviceId 各异）。Agent 链路继续走 Runtime `video-stream` 端点（观察范围边界更小、语义正确），`monitor/down` 仅作对照证据。

**H5 播放页最小验证实现**（实测可播，供生产页面参考）：

```html
<div id="playWnd"></div>
<script src="/owner/static/h5player/h5player.min.js"></script>
<script>
// url = Runtime GET /api/agent/devices/:id/video-stream 返回的 wss 地址
var plugin = new JSPlugin({
  szId: 'playWnd', iWidth: 640, iHeight: 360,
  szBasePath: '/owner/static/h5player/',
  oStyle: { borderWidth: 0, background: 'transparent' }, openDebug: false
});
plugin.JS_Play(url, { playURL: url, mode: 0 }, 1)
  .then(function(){ /* playing */ })
  .catch(function(){ /* 取流重试：重新请求 video-stream 换新 URL 再播 */ });
// 页面关闭前：plugin.JS_Stop && plugin.JS_Stop(); 释放解码与 WS
</script>
```

注意 `oStyle` 只认十六进制色值——`rgba(...)`/`transparent` 传入会回落默认金色选中框（`borderSelect:#FFCC00`）；单画面播放页须显式 `borderWidth:0`。

**按拟物材质体系重做的播放页原型**：`pages/agent/proto-h5player.html`（替换了早前的调试探针 `proto-h5player-probe.html`，已删）。玉墨渐变深底（非纯黑）+ 深色毛毡控件（内发丝线/内顶高光/按压缩放）+ 纸面错误卡 + 玉绿呼吸指示灯 + 实时徽标；播放中顶部/底部镀铬 3s 自动隐去、点按唤回；`?debug=1` 开底部日志抽屉；入参 `url`（直参）或 `deviceId+api+token+tenant`（页内取流）。加载/错误/无参三态已截图核验；直播态因下述上游限流待复验。

**取流上游存在会话/频控上限（09-28 晚实测）**：连续取流并遗留未优雅关闭的播放会话后，`monitor/down` 与 Runtime `view` 两条路径同时对**该账号下所有摄像头**返回 `code:207` 空内容（非 401/非设备级）。含义：openUrl token 颁发消耗上游会话名额且过期回收较慢；生产页必须把"取流暂时不可用"做成可稍后重试的一等状态（原型已按此设计），且 `JS_Stop` 清理必须可靠执行以减少孤儿会话。

**H5 播放页生产规格（设计 agent 输入）**：

- 路由入参优先 `deviceId`（不穿越长寿命凭据/URL）；页面用 webView 注入的 `token`/`tenantCode` 作 `Authorization`/`Tenantcode` 头调 `GET /api/agent/devices/:id/video-stream` 现取短时效 URL（生产下同域 `/micro-api/api/ai`，零新增鉴权）。兜底可收 `stream=` 直参（小程序侧先取流再跳转）。
- 状态机：取流中 → SDK 初始化 → 播放中 → 断流/错误（可重试，重试必须重新取流，旧 URL 短时效）；取流 404/503 与 SDK 播放错误分开呈现，不谎报"摄像头离线"（在线态另有 `onlineStatus`）。
- 生命周期：页面隐藏/卸载时 `JS_Stop`；`beforeunload`/`pagehide` 都要挂。
- 能力边界：实时预览单画面（iMaxSplit=1）；无音频对讲（不加载 talk 资产）、无录像（不加载 transform 资产）、无回放（接口未暴露）。
- 部署：页面 + 可选 SDK 目录镜像放 `ncim.577119.com` 下任一路径；微信业务域名已覆盖。
- 视觉沿用拟物材质体系（玉绿渐变/纸面/黄铜点缀，渐变+内阴影+发丝线，无 backdrop-filter）；播放区为玉墨深底（非纯黑）以保证画面可读性与镀铬对比度；`prefers-reduced-motion` 下停用呼吸动画。参考实现 `pages/agent/proto-h5player.html`。

## 证据分级

- **已实测只读（2026-09-28，普通用户身份）**：office 视频目录、`view`/`onlineStatus`/`realTimeData` 查询动作、环境影子、perception FIRE 目录、烟感/水浸/燃气告警史、能源设备目录与最新读数、水/气计量空目录。
- **Swagger 定义未调用**：`electricData/*` 与 `statistics/*` 统计族、`PUT /fire/*/alarm/{id}` 处置、`homeInformation/equipmentStatistics`。
- **确认缺失**：照度/CO₂ 传感器、水表/燃气计量设备、人员统计接口、道闸契约。
