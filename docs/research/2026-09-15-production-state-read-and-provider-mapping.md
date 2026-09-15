# 生产状态读取路径与 provider 映射实测

日期：2026-09-15

## 结论

生产状态读取的两条路径已实测打通，`readStates()` 的生产适配不再存在未知接口：Office 用户侧 scoped 接口自带粗粒度状态；物联中心设备详情动作返回权威全量状态。Office 设备引用到物联中心设备的映射是免费字段（`hubDeviceId`），无需向客户申请任何新关联契约。剩余工作全部是 Runtime 侧工程实现。

本次探测使用 egolite 管理端登录态（superadmin），全部为只读请求（GET 分页 + 详情读取动作），未下发任何控制指令。按记录约定，不保存 token、办公室 ID、设备 ID 或凭据。

## 状态读取的两条已验证路径

### 路径 A：Office scoped 接口自带粗状态

此前记录（[2026-09-08 清单](2026-09-08-customer-miniapp-iot-api-inventory.md)）把 Office 目录一律视为"关联记录，不含状态"。本次复核修正：`app/device/**` scoped 分页（按 `elementId` 绑定用户办公室）的响应体自带状态字段，与 `*AreaDevice/page` 关联目录（确实无状态）是两个层次。

| 字段 | 含义 | 实测 |
| --- | --- | --- |
| `switchStatus` | 开关 | 空调、照明均有值 |
| `netStatus` | 在线状态 | `ON_LINE` |
| `workStatus` | 工作状态 | `NORMAL` |
| `temperature` / `targetTemperature` | 当前/设定温度 | 空调有值，照明为 null |
| `workMode` / `fanSpeed` | 模式/风速 | **实测均为 null**（权威值在路径 B） |

照明 scoped 记录还附带 `deviceActionList`（打开/关闭模板动作）。

### 路径 B：物联中心详情动作返回权威全状态

```text
POST /micro-api/api/iot-center/interactive/{deviceId}/{detailActionId}/down   body: {}
```

详情动作（`actionType: acDetail`，`handler: acDetailHandler`）从设备 `actionList` 中取得。实测院长室空调返回云起属性集：

| 属性 | 含义 | 实测值 | 说明 |
| --- | --- | --- | --- |
| `O` | 电源 | `0` | 关 |
| `MODE` | 运行模式 | `3` | 枚举语义待确认 |
| `F` | 风速 | `100` | 档位语义待确认；`limF=LMHA` 暗示 低/中/高/自动 |
| `tT` | 设定温度 | `250` → 25℃ | ÷10；`limtT=5,35,0.5` 即 5–35℃ 步进 0.5 |
| `T` | 环境温度 | `300` → 30℃ | ÷10 |
| `ALM` | 告警 | `0` | 无故障 |
| `lHeart` / `stat` | 心跳/状态 | 秒级时间戳 / `1` | 时效判断依据 |

每个属性带独立 `valts` 更新时间戳，可区分"值新鲜"与"设备关闭时的旧值"（本次 `O` 与 `T` 的时间戳即不一致）。

## 设备映射：hubDeviceId 直连物联中心

- Office 记录的 `hubDeviceId` 与 `api/iot-center/device/page` 记录的 `id` **逐字符一致**（两台办公室空调样本均验证）。
- Office 空调记录的 `hubActionInfoId`（值 `"1"`）即物联中心控制动作 id（`airCondition` / `acControlHandler`）。
- 详情动作 id 从物联中心记录的 `actionList` 取得，属模板级动作，跨设备同型号复用。

即：Office 引用 → 物联中心设备 → 动作集，三段全部有现成字段，无名称/位置猜测。[2026-09-14 范围契约](2026-09-14-my-office-device-scope-contract.md)中"实际契约需要时才在内部 binding 中映射云起底层引用"的条件现已满足。

## 范围过滤与 H5 权限判定复核

- 同一 superadmin token：scoped `myOffice/pageByAc` 返回 2 台（本办公室），全局 `acAreaDevice/page` 返回 53 条关联。用户过滤真实有效。
- owner H5 空调页（`/owner/#/pages/aircold/index`，注入 `token/tenantCode/timestamp` 查询参数）对 superadmin 显示"未授权"：其链路为 `/sso-api/account/me` → `ac/myAreaList`，后者返回业务码 204（无空调区域授权）。属区域成员关系为空，不是凭据或接口问题。
- 本次 curl 直连 `acAreaDevice/page` 返回 53 条，与 [2026-09-08 清单](2026-09-08-customer-miniapp-iot-api-inventory.md)记录的 2026-09-11 浏览器会话 204 再次形成对照：关联目录结果随会话/入口漂移的现象仍存在，scoped 接口未见此现象。

## Runtime 工程含义

1. `readStates()` 生产实现采用两层：路径 A 做廉价粗状态（搭目录加载的便车），路径 B 做权威读（带 TTL 缓存与 `valts` 时效判断）。
2. 字段映射按上表；`MODE`/`F` 枚举语义确认前，草案侧对应参数标注"未知"，不参与差量过滤。
3. 执行后回读：控制 → 等待 → 详情动作再读；失败时明确表述"指令已受理，暂未取得最终状态"。2026-09-11 已有一次生产实证（设定温度 24→25℃ 后详情回读一致）。
4. 控制链路无需改动：Runtime 已接 Office `app/device/ac/down`；物联中心通用下行接口为等价备选。

## 待验证清单（测试环境补充工作）

1. **普通用户 token 复核（最高优先级）**：本次全部结论基于 superadmin。需用普通办公用户登录态验证两点——scoped 接口的范围收窄是否符合预期；普通用户是否有权调用 `iot-center` 详情动作。若后者被拒，权威状态路径需改为 Runtime 服务侧凭据 + 服务端范围核验，属于架构性调整，必须提前暴露。
2. **`MODE`/`F` 枚举语义**：需一次经授权的真实控制（开机并切换模式/风速，观察详情值变化），或对照云起面板显示。
3. **回读时效窗口**：控制后详情反映新值的延迟分布，决定 Runtime 等待-再读的节奏。
4. **离线设备行为**：物联中心 333 台中 1 台离线；用该设备验证详情动作的超时/错误形态。
5. **门禁状态语义**：门禁下行响应只代表受理；检查门禁设备 `actionList` 是否存在门磁/状态读取动作，决定门禁回读能否闭合。
6. **关联目录会话漂移**：`*AreaDevice/page` 随入口/会话返回 53 或 204 的差异原因；Runtime 加载范围时对 204 与失败的区分处理。
7. **参数边界**：`limtT` 5–35℃ 步进 0.5 之外的目标值已知会被业务码 207 拒绝；边界应前置到草案校验。
8. **Iotfake 对齐**：本地 Iotfake 状态模型改为镜像真实属性集（`O/MODE/F/tT/T/ALM` + `valts`），使 `readStates` 映射代码在本地与生产走同一形状。
9. **端到端验收**（沿 [plan/011] 既定项）：桌面开发者工具真实登录态全链路，其次真机。
