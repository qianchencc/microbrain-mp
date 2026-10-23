# 空调估算演示版发布与时间戳放宽

日期：2026-10-22。目标：让“空调调温任务 → 预计节电估算卡”这条演示链路在验收时可见，不建设完整计量体系。

## 发布

- Runtime 估算：`eea32d0`（`feat: estimate AC energy savings from recorded setpoint deltas`）。
- Runtime 演示放宽：`9a4f873`（`feat: allow bounded AC state freshness override for demos`）。
- Runtime 出现条件收敛：`ad65011`（`fix: only show AC energy impact after a real adjustment`）。
- 远端版本：`releases/20261022-ad65011`，`current` 已原子切换；唯一 `127.0.0.1:3210`，Node 22，production 网关，开发身份覆盖关闭。
- 发布门禁：运行中会话/草案/阶段、10 分钟内到期阶段与计划均为 0；主库与 sessions 库备份、`quick_check`、外键检查通过；业务行数前后一致。
- 健康检查：`/healthz` 返回 `status=ok`、`iotMode=production`、`devIdentityOverride=false`、`modelId=GLM-5.3-Flash`。
- 小程序展示：本地提交 `c931839`，开发编译产物 `pages/agent/task-detail-view.js` 已包含 `basis: assumption` 分支。
- 2026-10-22 补全：`c931839` 只接了紧凑行，与原型不符；现已按 `proto-energy-estimate.html` A 变体落为节能卡（hero 大数字＋非实测徽标＋三格事实＋公式依据＋设备调温前后行），`unavailable` 态同版式。视图模型与测试已更新，真机渲染验收待 HBuilderX 编译后确认。

## 演示用的状态时间戳放宽

- 代码：`apps/runtime/src/tasks/ac-inspection.ts` 读取可选环境变量 `AC_STATE_FRESHNESS_MS`；未设置时仍为默认两分钟。
- 远端启动脚本：`shared/run-runtime.sh` 在存在 `shared/var/ac-state-freshness-ms` 时导出该变量。
- 当前值：`31536000000`（一年），仅用于演示/联调；目的是允许使用平台最后已知状态，而不是因为 `valts` 年龄直接拒绝。
- 仍然保留的条件：设备字段必须存在，`power=on`、`mode=cool`、设定温度低于 26℃，才会下发；不会自动开机、改模式或改风速。
- 估算仍标记为“非实测”，使用 7%/℃、2.5kW、¥0.8/度的公开假设参数；历史报告不回填。

## 出现规则

- 只有至少一台设备实际 `adjusted` 时才生成节能块；全程关机、非制冷、已满足、只读巡检、调温前失败/取消时 `energyImpact` 为 `null`，详情和通知不显示该行。
- 已调温但缺少调前温度、调温时长不足或合计低于 0.1 度时，显示“已调温，但缺少可用的调前设定温度或调温时长不足，暂不展示估算数字”，不显示数字。
- 提前取消按 `min(区间终点, 报告生成时间)` 截断，不算到计划终点。
- 实测电表比较优先于假设估算；假设估算始终标注“估算 / 非实测”。

## 演示记录

- 任务：`3eb58ab1-a929-47db-a5d8-d6fac5c4a44e`，标签 `演示 · 26楼办公区空调调至26℃`，状态 `completed`。
- 阶段：`031e917a-a622-4e1f-9efc-9f60a205d32b`，单检查点，2 小时窗口；5 台 26 楼空调，调前设定 24/24/25/25/25℃，估算 `2.4 度 / ¥2.0`。
- 通知：`c71018b8-af32-4b18-afae-370004feed25`，未读，点击回到同一任务。
- 性质：直接写入演示 Runtime 数据库的展示夹具，**不是真实设备执行**；任务和通知标签均带“演示”。插入前备份：`shared/backups/demo-record-20261022T142351Z.sqlite`。
- 任务列表按租户/来源共享，其他 Company 账号也可能看到这条“演示”记录；演示结束应删除。
- 清理顺序：
  1. `DELETE FROM task_notifications WHERE task_id='3eb58ab1-a929-47db-a5d8-d6fac5c4a44e';`
  2. `DELETE FROM task_phase_devices WHERE phase_id='031e917a-a622-4e1f-9efc-9f60a205d32b';`
  3. `DELETE FROM task_phases WHERE task_id='3eb58ab1-a929-47db-a5d8-d6fac5c4a44e';`
  4. `DELETE FROM tasks WHERE id='3eb58ab1-a929-47db-a5d8-d6fac5c4a44e';`

## 当前限制

- 2026-10-22 晚间只读核验：公司 49 台空调全部 `power=off`，最近状态上报也已过期；因此今晚不会发生真实调温，也就不会生成估算数字。这是“没有调温”，不是“取不到状态”。
- 真实任务需要在办公时段、空调开机且制冷、设定温度低于 26℃ 时执行；建议 15 分钟窗口、15 分钟检查频率（一个检查点）。
- 估算卡只证明“按记录的调前温度估算”，不是电表实测，也不能作为确定节电或合同结论。

## 回退

1. 删除 `shared/var/ac-state-freshness-ms`。
2. 按既有门禁优雅停止 3210，用 `shared/run-runtime.sh` 重建 `iot-agent-runtime` tmux 会话。
3. 确认新进程环境不含 `AC_STATE_FRESHNESS_MS`，`/healthz` 正常。
4. 无数据库结构变更；除非明确评估，不恢复数据库备份。
