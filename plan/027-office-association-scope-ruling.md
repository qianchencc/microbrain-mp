# 027 · 范围裁定落地：账号级关联目录降级为 controlRef join 材料

日期：2026-09-17 · 状态：已落地并经真实网关验证（runtime c8a59dc）

## 裁定与事实链（勿再重复论证）

- 用户裁定：**可操作设备范围 = myOffice scoped 族（"我的办公室"页面那几个区域）**；账号级 `*AreaDevice/page` 只是控制 id 对照材料。
- 生产直连验证（09-16）：`*AreaDevice/page` 不按用户过滤，刘志龙与 superadmin 返回同一批记录（superadmin 名下 ac53/lighting159/access47，覆盖 26/27 楼、农旅、杭州、始版桥）。
- 症状（09-17 前端实测复现）：宽范围检索（"26楼"）返回 26 个位置 70 台设备，混入未来智城×5、顾问协会、档案室、前台、卫生间等非本账号区域设备。

## 改动（runtime src/iot/adapter.ts）

目录装配末端（`byPhysicalDevice` 之后）过滤：`sourceKeys` 全部以 `office-association.` 开头的物理设备退出 `normalized`。两条 controlRef join 路径（hubDeviceId 回填、物理设备合并）在过滤**之前**完成，控制链路与生产 506 防线不受影响。确认时授权校验（AUTHORIZED_SCOPE_CHANGED）天然继承新目录。

## 验证

- 红绿：新测试锚定「仅关联设备不可检索/不可达/不入词汇表，scoped 设备仍取得关联控制 id」。
- 全量：92 测试 86 过 6 挂——6 个失败在**无我改动的基线上同样失败**（并行会话在途工作），本改动零新增失败。
- 部署：3200/3201 均已重启至含本修复的 dist；受保护会话 eec895fb 完好。
- **真实网关验证（09-17 补完，专属开发账号 17276261949 / 5 区域）**：修复后目录从 74 台/26 位置收敛到 **25 台/5 区域**（lighting 15、ac 5、access 4、video 1）；宽范围检索 lighting "26楼" totalMatches=12 且 complete=true；无范围浏览门禁恰为本账号 4 个门（运营 1、院长室 2、杨国英 1）。范围裁定与"区域空=浏览"分支在生产上联合验证通过。
- 长期开发身份：token 一次性登录后落 `var/agent-identity.json`（0600，gitignored），工作流见 runtime AGENTS.md「开发身份与 token 工作流」——**禁止再为拿 token 登录该账号**（单会话语义，登录即顶号）。

## 波及与已知代价

- iotfake 夹具：无 scoped 办公室的 principal 目录合法为空（retention 测试已改坐 office-user-b）。
- admin 类以关联为主的账号：目录收敛到其 scoped 办公室（可能为空），ALREADY_SATISFIED 预剔除与权威读本就不可用于关联设备（09-16 审计），非本次引入。
- 旧会话候选集若含已出范围设备，restore 抛 "Device candidate set is stale"（既有语义，诚实降级）。

## 顺带修正

AGENTS.md（runtime）token 回收误诊：`ps eww -o command= -p <pid>` 输出用正则 `AGENT_DEV_IDENTITY=(\{[^}]*\})` 截取即可完整回收（09-16 的"无法回收"是按空格切分导致的截断）。已实测。
