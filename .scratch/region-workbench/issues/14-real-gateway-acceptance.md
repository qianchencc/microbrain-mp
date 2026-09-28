# 14 — 真实网关端到端验收

**Spec:** `.scratch/region-workbench/spec.md`（“Testing Decisions / 真实网关验收”）
**仓库:** iot-agent-runtime + mp（人工执行）

**What to build:** 在本地 3200 单实例（真实客户网关）与微信开发者工具中，走通区域工作台的完整业务闭环，并记录结果与发现的问题。

**Blocked by:** 07, 08, 09, 11, 12, 13

**Status:** ready-for-human

- [x] 按 runtime AGENTS.md 正确启动（先 build，身份只从 `var/agent-identity.json` 注入，配置任务凭据密钥）
- [ ] 在开发账号某区域，用 Agent 创建一个几分钟后开始的两阶段照明任务并确认；区域时间轴出现区间缎带
- [ ] 两个阶段按时执行，回读结果与设备实际状态一致；已达标设备显示为无操作
- [ ] 设备抽屉中该灯的设备时间轴出现两条定时记录；即时“关灯”出现即时记录
- [ ] 在工作台删除一个未开始的任务，在 Agent 中取消另一个，两者都显示为已取消且未执行
- [ ] 制造一次部分完成或失败（如包含离线设备），区域提示出现，打开后对本人消除
- [ ] 结论、截图与遗留问题记入 Comments；新问题另开票

## Comments

2026-09-28：Runtime `aac5f51` 构建后按 `start:local-real` 重启唯一 3200；`/healthz` 显示 production 网关和 `real-runtime.sqlite`，开发身份的区域只读接口返回 2 个授权区域。重启前数据库无 Task、托管凭据为 0；本项仅证明启动和只读连通，不证明定时任务执行、物理回读或小程序体验。见 `plan/2026-09-28-confirmation-fresh-scope-handoff.md`。
