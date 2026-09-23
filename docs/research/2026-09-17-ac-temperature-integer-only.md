# 空调设定温度整数-only 实证（0.5 步进是接口规格而非设备事实）

日期：2026-09-17

## 结论

limtT 模板声明的 `5,35,0.5` 步进在该机型/链路上不真实生效：**网关受理分数度设定、平台影子回读也如实记录分数度，但物理设备静默截断成整数**。产品契约收敛为整数温度，`acParameters.temperature.step = 1`。

## 证据链（var/real-runtime.sqlite 真实记录）

草案 `6a26e079`，用户把温度从 24 改为 **24.5**（PATCH 落库值确认为 24.5，前后端 0.5 校验均放行）：

1. confirm 时 adapter 发出 `AC_TEMPERATURE` + `temperature: 245`（`Math.round(24.5 * 10)`，符合 °C×10 契约）；
2. 网关回执 **ACCEPTED**；
3. ~12 秒后权威回读（iot-center `interactive/{hub}/{acDetail}/down`）返回 **tT=245**，平台自认设定已是 24.5，系统如实标 confirmed；
4. **物理设备实际仍停在 24**（用户现场确认）。随后设 25 的草案走相同链路，设备正常落 25。

## 推论

- 整条"卡片 → 草案 → 下发 → 回读"链路没有截断：245 编码正确、回读如实。**tT 在该场景是"最后一次下发值"的影子回声，不能等同于设备物理事实**——分数度下回读确认是假阳性。
- 整数温度下影子与物理一致（24→25、26 均实证），故整数设定语义可靠；`freshSinceMs` 回读确认对整数指令仍有效。

## 落地

- runtime：`acParameters.temperature.step=1`；`validCommand` 用 `Number.isInteger` 拒绝分数度（工具层、物化、PATCH、revalidate、confirm 五处共用同一闸门）；模型 schema `multipleOf:1` + 提示词明示"该机型不支持 0.5 步进"。
- 前端：编辑粒度下限 1（`acTemperatureStep` = `Math.max(1, 设备step)`），旧草案残留的 0.5/0.1 参数快照同样按整数网格编辑，与服务端校验一致。

## 遗留

- 若后续接入其他机型，应以真机下探验证为准再放开分数度——接口规格声明（limtT）不构成设备能力证据。
