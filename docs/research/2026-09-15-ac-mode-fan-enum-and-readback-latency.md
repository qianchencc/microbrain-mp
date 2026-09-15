# 空调 MODE/F 枚举破译与回读延迟实测（授权控制）

日期：2026-09-15

## 结论

经用户授权对「空调-26办公区（机房前）」（`YQ-AC-F26-33`）执行真实模式/风速/温度控制并逐次回读详情，**`MODE` 与 `F` 的枚举语义已破译**，执行后回读延迟已实测（温度 ≤2.4s、模式 ≤4s）。实验后设备状态完全恢复基线（开 · 制冷 · 风速自动 · 25℃）。对照明做了开关往返，控制被受理但留有两个待解细节（见下）。

本记录补充 [2026-09-15 生产状态读取实测](2026-09-15-production-state-read-and-provider-mapping.md) 与 [普通用户复核](2026-09-15-normal-user-state-read-verification.md)。按约定不保存 token 与完整 ID。

## MODE 枚举（actionType acDetail 的 MODE 属性）

| 模板 | MODE 值 |
| --- | --- |
| `AC_MODE_FAN`（送风） | 2 |
| `AC_MODE_COOL`（制冷） | 3 |
| `AC_MODE_HEAT`（制热） | 4 |
| `AC_MODE_DRY`（除湿） | 5 |
| `AC_MODE_AUTO`（自动） | 7 |

0/1/6 未观测到对应模板。基线 MODE=3 且发送 COOL 后无变化，交叉印证 3=制冷。

## F 风速枚举（limF=LMHA）

| 模板 | F 值 | 结果 |
| --- | --- | --- |
| `AC_FAN_SPEED_LOW` | 15 | 200 |
| `AC_FAN_SPEED_MIDDLE` | — | **业务码 207 拒绝（两次复测一致）**，中档值未知 |
| `AC_FAN_SPEED_HIGH` | 75 | 200 |
| （无模板） | 101 | 自动档：设备基线即 101；`AC_FAN_SPEED_AUTO` 模板不存在（HTTP 400）；`AC_MODE_AUTO` 不改变 F |

恢复 101 只能走物联中心通用下行（见下）。**草案侧建议：风速提供 低/高/自动 三档；中档在上游修复前不可用，选择中档时明确降级说明。**

## 控制路由的 id 域（重要工程教训）

`POST /api/office/app/device/ac/down` 的 `acAreaDeviceId` **只接受账号级 `acAreaDevice/page` 记录 id**；传 myOffice scoped 记录 id 返回业务码 506「区域设备不存在」。照明控制同理使用 `lightingAreaDevice/page` 记录 id。

- 若设备范围来自 myOffice scoped 族，执行前必须用 `hubDeviceId` 反查账号级 `*AreaDevice/page` 取控制 id（`?hubDeviceId=` 过滤实测有效）。
- 当前 Runtime 以账号级 `*AreaDevice/page` 为目录来源时不受影响；ADR 0007 的 Office Scope Family 聚合落地时必须处理这个 join。

## 执行后回读延迟（详情动作）

| 控制项 | 首次可观察到新值的时点 |
| --- | --- |
| 设定温度 tT（25→26） | ≤2.4s（首个采样点即已更新） |
| 模式 MODE | ≤4s（采样间隔分辨率） |
| 风速 F | ≤4s（同上） |

ticket 10 的默认等待窗口建议 5–8s 单次重读，不做轮询。

## 物联中心通用下行的参数形状

`POST /api/iot-center/interactive/{deviceId}/1/down`（airCondition 控制动作）：

- 裸对象 `{"idx":"F","type":206,"val":101,"v":101}` → 200，设备风速实际变为自动档。
- 数组包裹 `[{...}]` → 506「操作超时」。
- 与 2026-09-11 记录一致：简化 `{"F":101}` 会被 207 拒绝。

## 照明实测与遗留

对照明「过道-2回路格栅灯」（原状态开）执行 关→开 往返，两次控制均 200 受理，终态与原状一致：

1. **scoped `switchStatus` 在控制后 8 秒窗口内未变化**（OFF 后仍 true）：要么该控制实际未作用于该回路，要么 scoped 粗状态同步周期 >8s。未获物理观测确认，暂不能下结论。
2. 目录中照明开关存在 `GET_SWITCH_STATUS` 读取动作，但 body `{}` 返回 207「请检查设备配置的开关路数和请求回路」——**多回路面板需要回路参数**，参数形状待定（设备名中的「N回路」即回路号）。

对照明的权威回读路径（路径 B）在回路参数确认前不可用；在此之前照明的执行语义只有「已受理」+ scoped 粗状态（时效未定）。

## 对 Runtime 工程的更新

1. issue 07：`MODE`/`F` 枚举表直接采用本文；风速中档不可用；差量过滤现在可以正确比较模式与风速（自动=101，低=15，高=75）。
2. issue 10：等待窗口默认 5–8s；照明回读在回路参数确认前降级为受理语义。
3. 控制执行的 id join（scoped→账号级）写入实现注意事项。
