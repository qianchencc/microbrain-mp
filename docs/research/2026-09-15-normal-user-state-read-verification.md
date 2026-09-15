# 普通用户状态读取权限复核（生产实测）

日期：2026-09-15

## 结论

[2026-09-15 生产状态读取实测](2026-09-15-production-state-read-and-provider-mapping.md)遗留的最高优先级架构风险已解除：**普通办公用户的 token 可以直接调用物联中心详情动作并取得权威全量状态**。Runtime 的 `readStates()` 维持"当前用户 token 直调"设计，无需改为服务侧凭据 + 服务端范围核验，[ADR 0005](../../../iot-agent-runtime/docs/adr/0005-office-scope-authoritative-provider-boundary.md) 的 provider 边界无需修订。

同时实测确认：scoped 接口对普通用户的范围收窄真实有效；物联中心账号级目录对普通用户**不做**过滤（333 台全量可读），进一步印证目录只能作为内部映射来源、不能作为授权范围的既有决策。

本次全部为只读请求（scoped 分页、目录分页、详情读取动作），未下发任何控制指令。按记录约定，不保存 token、凭据与完整 ID；设备以名称/编码指代。

## 验证身份与环境

- 身份：普通办公用户刘志龙（零律科技，`accountType: 1`，租户 `XSJ`），`/sso-api/account/me` 复核通过；名下恰好一个办公室「26楼运营办公区」。
- 途径：浏览器真实登录态，`Authorization` 头携带 token 直调生产接口。
- 曾遇到并排除的干扰：任务空间继承到的旧登录态已被服务端失效（全部 401），重新登录后恢复。

## 鉴权口径（工程注意事项）

| 网关 | 裸 uuid | 带 `bearer ` 前缀 |
| --- | --- | --- |
| `sso-api` | 200 | **401** |
| `micro-api` | 200 | 200 |

- Runtime 与探测统一使用**裸 uuid** 作为 `Authorization` 值即可同时通过两个网关。
- owner H5 的 `owner-mp-token` localStorage 必须存裸 uuid：若存成带前缀的值，H5 自身再拼一层前缀后 `account/me` 401，页面呈现「未授权」。此前 superadmin 观察到的部分「未授权」现象即源于此，属于前端存储口径问题，不是权限结论。
- 两个网关对头形式敏感度不同这一点应进入 Runtime 请求封装的测试用例。

## 范围收窄验证

| 数据源 | 普通用户实测 |
| --- | --- |
| `office/member/my/office` | 1 个办公室（26楼运营办公区） |
| `api/office/device/page?elementId=…` | 7 台，全部属于该办公室：空调 1、照明 4、门禁 2 |
| `api/iot-center/device/page` | 333 台全量（**未按用户过滤**） |

- 办公室设备构成与 2026-09-14 记录（2 空调 + 3 照明 + 2 门禁）不同，上游设备分配在两日间发生过变化；scoped 接口如实反映当前分配，不构成异常。
- 关联目录 `*AreaDevice/page` 的会话漂移现象本次未复核；scoped 接口未出现漂移，与 09-15 上午记录一致。

## scoped 路由族完整清单

来源：owner H5 生产 bundle 静态分析 + 页面运行时请求捕获，均经普通用户实测（除注明外全部 200）。

| 路由 | 用途 | 响应形状 |
| --- | --- | --- |
| `GET /sso-api/account/me` | 身份 | `{code, content{...}}` |
| `GET /api/office/office/member/my/office` | 我的办公室列表 | `content` 为数组 |
| `GET /api/office/office/member/my/office/member?elementId=` | 办公室成员 | `content` 为数组 |
| `GET /api/office/device/page?elementId=&type=&size=` | 通用 scoped 设备分页（type 可过滤，如 `LIGHTING`） | `content` 为 Spring 分页对象 |
| `GET /api/office/app/device/ac/myOffice/pageByAc?elementId=&type=AirCold&size=` | 空调专用 scoped 分页（带温度粗状态） | `content` 为数组 |
| `GET /api/office/app/device/ac/myOffice/detail/{scopedRecordId}` | 空调 scoped 详情（粗状态记录） | 单条记录 |
| `GET /api/office/app/device/{type}/myAreaList` / `devicePage` / `detail/{id}` / `POST …/{type}/down` | 智慧类 H5 页使用的同族路由（bundle 证实，本次未逐一实测） | — |

注意：`app/device/ac/detail/{scopedRecordId}`（无 `myOffice` 段）用 myOffice 记录 id 调用返回业务码 506「区域设备不存在」，其 id 域不同，不要混用。

## 粗状态字段按设备类型（路径 A）

| 类型 | 来源 | 观测到的状态字段 |
| --- | --- | --- |
| 空调 | `pageByAc` | `switchStatus`（true）、`temperature`（26，环温）、`targetTemperature`（25）、`netStatus`、`workStatus`；`workMode`/`fanSpeed` 为 null |
| 空调 | 通用 `device/page` | `switchStatus` 为 null——空调的粗状态必须走 `pageByAc` |
| 照明 | 通用 `device/page` | `switchStatus`（true/false/null）、`netStatus`；`deviceActionList` 2 项（开/关） |
| 门禁 | 通用 `device/page` | `switchStatus` 为 null（无状态语义，只有受理）；`deviceActionList` 1 项（远程开门） |

## 权威详情动作实测（路径 B）

普通用户 token 直调 `POST /api/iot-center/interactive/{deviceId}/{detailActionId}/down`（body `{}`），对象为其办公室内的「空调-26办公区（机房前）」（编码 `YQ-AC-F26-33`）：

| 属性 | 实测值 | 说明 |
| --- | --- | --- |
| `O` | 1（开） | 与 scoped `switchStatus: true` 一致 |
| `tT` | 250 → 25℃ | 与 scoped `targetTemperature: 25` 一致 |
| `T` | 250 → 25℃ | scoped `temperature` 为 26，分钟级漂移属正常 |
| `MODE` | 3 | 语义仍未确认 |
| `F` | 101 | 语义仍未确认；此前 superadmin 观测到 100；`limF=LMHA` |
| `ALM` | 0 | 无告警 |
| `valts`/`lHeart`/`stat` | 齐全 | 秒级时效判断可用 |

- 详情动作 id 与控制动作 id 为模板级：与 superadmin 上午在另一台同型号空调观测到的值一致（控制 `1`，详情为同模板固定 id），跨设备复用成立。
- `hubDeviceId` === 物联中心设备 `id` 的免费映射在普通用户侧同样成立（scoped 记录与目录记录交叉核对）。

## 剩余待验证（不阻塞 issue 07 开工）

1. `MODE`/`F` 枚举语义：需一次经授权的真实控制观察，或对照云起面板；确认前草案侧标"未知"、不参与差量过滤。
2. 控制后详情反映新值的延迟分布（回读节奏）：需真实控制，建议并入桌面开发者工具验收时顺带测量。
3. 离线设备详情动作的超时/错误形态（目录中存在 1 台离线设备）。
4. 门禁是否存在门磁/状态读取动作（当前观测无）。
5. 智慧类 H5 同族路由（`myAreaList`/`devicePage`/`{type}/detail`）未逐一实测；Runtime 接入 `myOffice` 族已够用，暂不需要。

## 对 Runtime 的直接工程含义

1. issue 07 解除阻塞：字段映射与路由以本文件与上午的实测记录为准，全部有现成证据，无需再探测。
2. `readStates()` 两层：路径 A 用 `pageByAc`（空调）+ 通用 `device/page`（照明/门禁在线与开关粗状态）；路径 B 用物联中心详情动作做权威读，带 TTL 缓存与 `valts` 时效判断。
3. 鉴权封装统一用裸 uuid；`Authorization` 头形式进入测试。
4. 范围来源不变：Authorized Device Scope 由 scoped 族聚合；物联中心目录仅用于内部映射与诊断。
