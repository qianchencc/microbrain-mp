# Agent 接入真实网关实测（读路径 + 草案，未控制）

日期：2026-09-16

## 结论

iot-agent-runtime 仅将 `IOT_BASE_URL` 指向 `https://ncim.577119.com` 后，**读路径全链路与草案生成已在生产环境跑通**：目录发现 → 状态读取 → 真实模型对话 → 真实状态感知的操作草案。全程未下发任何控制指令；草案生成后立即取消。发现并修复一个只有生产数据才会暴露的目录缺陷（installAddress 缺省，runtime 9673781）。

## 会话与凭据

- 身份：EgoLite 桌面客户端内已登录的普通办公用户（26楼运营办公区，租户 XSJ）。
- 提取路径：`~/Library/Application Support/Citro Labs/ego lite/Default/Local Storage/leveldb` 中 `owner-mp-token`（今天仍在活跃写入）。token 仅存放于 /tmp（0600）供当次 shell 使用，事后删除；不写入任何仓库文件。
- **鉴权口径（重要，与 09-15 记录存在差异）**：本会话实测 micro-api 网关**要求 `bearer ` 前缀**——裸 uuid 返回空响应体，`bearer <uuid>` 返回 200。09-15 记录为"裸 uuid 两个网关均可"。Runtime 对 Authorization 原样透传，前端/调用方必须发送网关实际接受的形式；该差异应进入请求封装测试用例。

## 生产数据形状（新证据）

1. **scoped 记录 `installAddress` 为 null**（pageByAc 与 device/page 均如此），位置信息只存在于设备名与 `my/office` 的 `elementName` 中。iotfake fixture 全部带 installAddress，故本地从未暴露。修复：`collectSourceDevices` 统一兜底——scoped 来源缺省取办公室 `elementName`，其余取空串（runtime 9673781，含回归测试）。楼层回退、模糊匹配、位置词表随之恢复。
2. 26楼运营办公区 scoped 范围实测：1 空调（开着·制冷·设定 25℃·自动风，权威详情与 scoped 粗状态一致）+ 4 照明（3 路确认关闭、1 路状态未知）+ 1 门禁（26楼东楼梯）。与 09-15 记录的 7 台相比门禁少 1 台，上游分配持续变化属正常。
3. 普通用户可读账号级关联目录（acAreaDevice/page 返回 53 条），控制 id 反查链路可用；目录聚合后发现农旅公共办公区 1/2 的照明（泛光灯/灯带），状态未知——Agent 如实按未知汇报，未冒认。

## Agent 实测（3201 实例，IOT_BASE_URL=生产网关）

- 问「26楼办公区现在有哪些设备开着」：模型两次检索候选 + 一次状态查询，回答与直连探测完全一致，对 6 路状态未知的照明明确说"无法确认"，未声称开/关。
- 「生成打开过道灯的草案」：草案含 4 路真实照明，前置状态 3 关 1 未知如实带入，位置兜底显示"26楼运营办公区"，相位进入待确认；随后取消（200）并删除全部 smoke 会话。
- 部署形态：独立实例 `PORT=3201 DATABASE_PATH=var/real-runtime.sqlite`（与 3200 iotfake 实例互不影响），运行含 9673781 与 7036da3 的 dist。

## 遗留

1. **控制下发未测试**：按约定未经逐次授权不执行真实控制；建议下一次经授权后对一路照明做 开→关→恢复 往返，实测 7036da3 的 25s 超时判定与照明回读受理语义。
2. 前端登录集成：agent-miniapp 的 `Bearer local-development`/`LOCAL` 硬编码需换成真实登录态注入（主工程 request.js 同源 token/tenantCode），这是接入客户小程序登录体系的前端侧闭环。
3. 鉴权头形式差异（本文件第 2 节）建议补进 adapter 鉴权透传测试。
