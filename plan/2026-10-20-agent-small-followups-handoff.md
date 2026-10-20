# Agent 小修跟进交接（2026-10-20）

图表修复 `26c3226` 保持原样未触碰；本轮只做五个展示层小修，未发布、未控制设备。

## 改动

1. `pages/agent/task-detail-view.mjs`：`executionResult(device, source)` 与 `resultText(device, source)` 增加可选来源参数，默认行为不变；仅 `agentSource === 'company'` 且 `outcome === 'unknown'` 时返回 `结果未知`/warn 色调，Office 及缺省调用仍 `明确报错 · 结果未知`/fail。`device-timeline-view.mjs` 未改动，单参数调用维持原口径。新增导出 `taskRequirementsText(task)`：只按接口返回的 `task.phases` 汇总执行要求（agent 阶段用 readAgentView 的 periodText/comparisonText，无 spec 时用显式 objectiveText；ac 阶段用 readAcView title+criteriaText；其余阶段取 observe:true 目标的 readTargetText，但泛化 observe 的 energy 类改用不含期间断言的 `读取电表数据`，避免把可能是历史报告的目标说成“最新能耗”），多阶段去重后以 `；` 连接；无阶段要求但有非 observe 目标的控制阶段时回退 `按计划时间执行`；不从 template/label/history 还原要求。
2. `pages/agent/components/TaskListSheet.vue`：Company 周期计划列表新增可选执行要求副标题行；selectedPlan 摘要新增「执行要求」行（均 `source === 'company'` 且文本非空才渲染）。`下一次`/`下一次安排` 相关文案统一为 `下一次执行`（行内前缀、摘要标签、「暂无下一次执行」、只取消下一次执行弹窗、恢复确认 `下一次执行：时间`）。
3. `pages/agent/components/TaskDetailContent.vue`：详情 `下一次执行 · ...` 前缀与恢复确认 `下一次执行：` 同步；发生身份等其它文案未动。
4. `pages/agent/components/ObservationCard.vue`：acStateText 模式段改用 `ac-draft.js` 的 `modeLabels`，cool/heat/dry/fan/auto 本地化，未知代码原样保留。
5. `pages/agent/components/TaskInboxContent.vue`：本地 dateTime 改为 `fmtShanghaiDateTime`（observation-view），保留斜杠格式并追加 `（上海时间）`；无效输入仍返回空串。通知筛选、已读、接口逻辑未动。

## 证据

- 红线：`/private/tmp/agent-followups/red-unknown.log`（Company unknown 断言先失败）。
- 绿线：`/private/tmp/agent-followups/green-unknown.log`（timeline+observation 25 过 0 败）。
- 全量：`/private/tmp/agent-followups/test-agent-full.log`（`npm run test:agent`，145 过 0 败；在最后一项电表摘要措辞修正前执行，未重复跑全量）。
- 最终定向回归：`/private/tmp/agent-followups/green-final-timeline.log`（措辞修正后 timeline 15 过 0 败）。
- 最终编译：`/private/tmp/agent-followups/compile-final.log`（HBuilderX CLI mp-weixin 编译成功；既有 check/detail sourcemap 警告与鸿蒙提示保留）。
- 回归新增于 `test/agent-timeline.test.mjs`：Company/Office unknown 与 rejected 口径、taskRequirementsText 计划契约（含剥离 read 元数据不从 template 还原、去重、控制回退、空阶段）。

## 未验收边界

- 未做微信/真机验收：Company 计划列表「执行要求」行、收件箱时间显示、空调巡检模式文案、详情未知结果提示均需在客户微信环境走查。
- `taskRequirementsText` 只展示接口已返回事实；旧计划若服务端未返回 read 元数据，界面不会补猜，需求缺口仍在服务端数据层。
- 工作树还有主页/能耗/定位等未提交 WIP（dashboard、energy-chart、CONTEXT、AGENTS 等），不属于本轮范围，原样保留。
