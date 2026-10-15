# Company 夜间用电分析修复交接

规格与边界：[本轮规格](2026-10-15-night-energy-analysis-fix.md)。本轮通过 ask-matt → 诊断 → implement/TDD → Standards/Spec 双轴审查推进；复用现有统计工具与报告卡，无新页面/导航。

## 故障证据

截图原轮 `b8b55984-3a05-45f5-afb1-112f4f944ed3`：模型按上一轮全天总量top8逐台调用summarize_energy，原工具缺每日时段参数；得到单表结果后以普通文本伪XML标签结束，没有真正调用reply_to_user。Runtime因meterResults非空跳过答复补交，最后将逐次覆盖摘要发布为答案。这不是没有采样，也不是需要用户逐台检查。

## 已交付源码

- Runtime `6e19d52`：scope、日期跨度与dailyWindow分离，统一流一次计算全部范围；总量、分段、位置排名按夜间度数。逐表night保存完整窗口、有效/预计夜数与同表同日占比依据。模型收到全部表摘要，不接收逐夜明细膨胀上下文。
- mp `dc2e934`：现有卡明确每日20→08和夜间用电排名；缺测主值与逐表依据明确部分覆盖，日柱及峰值按08:00结束日。历史未标记报告保持原口径。
- 有统计结果但未提交最终答复时，预算内允许一次仅答复补交；失败保留卡并明示解读未完成。恢复与追问沿保存reportId，任一参与表撤权拒绝整份引用。

## 验证

- Runtime最终全量265/265，最终定向54/54；Runtime typecheck与根构建通过。
- mp Agent103/103；HBuilderX微信编译通过，编译产物已核对每日时段/排名/结束日期投影。
- 首轮Standards零发现；Spec发现1/2夜表错误标ok，已修为partial并增加公开HTTP状态断言。协议增量审查又发现JSON与旧函数system指令并存，已按传输替换协议并同步收尾指令；Standards复核确认消除，Spec无新增偏差。无未解决阻断项。
- 日/夜边界缺失、零夜间、读数回退、同刻冲突、窗口截短、排序指标反转、保存引用与撤权均有公共接口回归。

## 运行验收

首次受控更新已完成：无在途对话/草案/阶段、近期待执行阶段/计划后，精确停止原监听85812，经既有启动器启动89408，监听127.0.0.1:3200，Node22、原真实网关/数据库/身份/任务密钥保持。更新前曾检测到其他Company对话，等待其结束后才操作。

真实HTTP全公司查询：43台、60个完整夜间，夜间3919.11度；同批全天7782.43度，夜间占比50.36%。夜间前3为26楼会议室110.52、27楼财务办公室106.02、27楼备用1为104.04，与全天top8不同。

首次真实原问题（保留失败证据）：conversation 1031e1ed-fe94-48e6-a7eb-28751a843d00，turn 3ea8ca6a-9a24-41d0-80f4-f85ec2014ede，47.925秒，仅一次全范围统计，结果正确；但普通输出和一次强制函数补交均没有真实答复调用，因此解读未完成。此记录不能记为问答验收通过。临时证据 /tmp/night-energy-model-first-summary.json 和 /tmp/night-energy-model-first-events.jsonl。

进一步协议诊断：官方 [Chat Completion](https://docs.z.ai/api-reference/llm/chat-completion) 仅定义tool_choice:auto，并支持response_format:json_object；原来将required/指定函数当作保证是我方兼容假设错误。现GLM补交采用受支持JSON模式，不携带工具，严格校验唯一answer字符串再过滤；仍不额外重试、不把原普通正文/XML变成答案。非GLM保留原函数提交路径。真实SDK HTTP载荷夹具验证合法JSON接受、附带thinking字段整体拒绝。

最终Runtime提交 `efb88ae` 已构建、类型检查通过；再次确认五项运行前检查均为0，精确停止89408并启动唯一93654（127.0.0.1:3200、实际Node22）。新统计源码与协议改动均在运行版本，保留真实网关、原SQLite、身份和任务密钥。

最终同一原始问题真实复验通过：conversation `a0954dff-e1b2-4f2a-b45a-42ca37bc0629`，turn `56444e88-1b6e-4dcc-bb22-52edaf261973`，48.646秒；仅1次summarize_energy、1份报告 `8b94645b-dadd-4bd0-b868-74929de37017`，全部43表/60夜，窗口覆盖2580/2580表·夜。模型先取得统计，普通输出未提交；唯一JSON补交只有answer字段，正常发布message.completed并run.completed。答复给出真实计算的排名/占比，并说明模拟补数不能用于认定真实浪费，仅提出待核验方向。

请求跨度原样保留 `[2026-08-01 00:00, 2026-10-01 00:00)`；本次只纳入其中完整夜间，实际首尾为08-01 20:00→09-30 08:00共60夜，不把跨出请求终点的09-30 20:00→10-01 08:00偷加进来。

最终临时证据：/tmp/night-energy-model-summary.json、/tmp/night-energy-model-events.jsonl；首次失败证据另存，未覆盖。

原报告真实追问也通过：reference.type=energy_report、同reportId，回答3919.11÷7782.43≈50.36%，0次业务工具、0份新报告，run.completed。证据 /tmp/night-energy-followup-summary.json、/tmp/night-energy-followup.jsonl。追问正文虽明确给出08:00→08:00边界，仍出现“日历日”用词；准确领域名是“计量日”，卡片定义与计算均按计量日，未把分母改成00:00自然日。自由生成术语并非逐字模板保证。

所有真实复验均为只读，没有生成/确认设备操作。微信真机交互和正式客户入口仍未作为本轮验收证据。既有历史回答不回写，重新发送原问题才能运行新协议。

工作区并行内容保持未提交：Runtime根AGENTS/CONTEXT、位置分组材料及后来新增的adapter状态并发改动；mp首页能耗/浮层等用户改动。没有将它们混入夜间统计提交或回滚。未push。

## 本次回归设施解决的盲点

只在faux层检查tool_choice请求参数，不能证明上游实际支持强制函数选择。本轮补实际SDK的HTTP载荷与公开API行为回归，同时保留真实模型失败/成功证据。统计有效与答复已提交作为两个独立状态验收。

## 后续维护

建议技能：排查用diagnosing-bugs；实现用implement/TDD；稳定切片按code-review；仅新视觉/交互设计需要prototype。维护入口：Runtime apps/runtime/src/energy/AGENTS.md，mp pages/agent/AGENTS.md。上游2026补数不证明真实浪费，手机交互验收与源码/编译验证分开记录。
