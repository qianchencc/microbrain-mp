# Company 单表周比较接入

2026-10-13，源码、运行服务、真实只读模型链路及微信编译包走查已完成。用户选择独立原型 A（`prototype/weekly-energy-comparison`，`1274729`）并授权接入系统；诊断见 [前序证据](2026-10-13-weekly-energy-comparison-diagnosis.md)。

## 冻结范围

- Company 单计量点 `compare_energy_periods`；2–6 个完整周，默认4周与额外一周基期，最近窗口的当前周单列；历史endDate不混入无关当前周。默认周一08:00采样周；明确要求自然周使用零点边界。时间与日期固定上海时区。
- 使用上游 `epf` 原始累计示数：计算实际采样区间增量及同表增量环比。单位/倍率未确认，因此标题、轴和解读只称示数增量，不称kWh用量。当前客户临时模拟补数来源持续标注，不解释为真实节能或运行原因。
- 缺边界时显示窗口内最早至最晚实际采样增量，明确缩短窗口；不估算，不给这一周或以其为基期的环比。零基期不给百分比；精确零增量显示0；示数回退、同时间冲突和不足两时刻采样均不计算增量。
- 服务器处理分页，校验倒序并在越过所需起点时终止；有界预算未读完明确partial、不计算环比。模型不再逐页搬采样。权限仍重核，句柄跨轮恢复后绑定当前目录。
- 工具直接提供完整可比周的最高/最低与相邻升降summary，短窗不参与排序；模型引用已计算事实，避免自行算错极值。
- A图表位于现有ObservationCard：零基线、玉绿柱、斜纹短窗、虚线本周、数值与环比分层。支持逐周采样依据、同设备/窗口原始采样抽屉、报告身份引用。
- `energy_comparison`观察事件先保存报告，解读失败保留报告并允许重试解读。报告引用仅读取本会话保存事实，复核计量点授权，不重读历史或提供操作工具。后续真正改变窗口应发起新的比较请求。
- 同reportId状态更新原位合并，流式与恢复均不重复图表。继续追问只放入输入框，不自动发送；重试解读明确发送引用原报告的新一轮，保留原输入草稿。
- 首期不汇总43台电表，不接外部通知，不执行设备控制。公开API也提供同一计算；未新增独立仪表盘统计页面。

## 公开接口与证据

- GET `/api/agent/energy-comparison?source=company&equipmentId=...&weeks=4`，可指定 `endDate=YYYY-MM-DD`（已到达的周一）及 `boundaryHour=0|8`。
- 持久化结果通过`observation.reported.blocks[type=energy_comparison].report`恢复。
- 消息引用 `{type:"energy_report",reportId}`：本会话内查找已保存报告，核验来源、owner和当前电表权限。不能用任意报告ID跨人或跨来源读取。
- 不新增独立报告表，身份为已持久化事件中的reportId。报告包含逐周请求窗口、实际边界值/时间、增量、环比、原因、覆盖与解释状态。

## 验证与交付

- Runtime公开HTTP红绿测试覆盖正常增量/零基期、本周、额外基期、历史截止、跨来源/跨人、解读失败恢复与不重读、缺边界/回退/冲突、服务端极值。主线全量137/137、隔离基线136/136，最终summary修正后定向3/3、类型检查及Runtime构建通过。
- mp Agent全量41/41、HBuilder微信编译成功、两仓diff检查通过。两轴审查发现并修正20行分页约束、短窗误标估值、本周零值虚线、原始窗口丢时分/基期问题。历史endDate只显示历史窗口这一点已明确为范围边界。
- 真实3200公开比较接口：26楼运营部电表，约5.7秒，读取67条有效采样，含9月7日起额外基期。前三周增量19.10/25.33/19.86，环比+7.97%/+32.62%/−21.59%；末周14.04是10月5日08:00至10月10日08:00短窗增量，环比为空；本周缺测为空。
- 真实GLM-5.3-Flash对话“分析26楼运营部电表最近4个完整周的环比，周一起点，按08:00采样周比较”：只调用find_device_candidates与compare_energy_periods，约30.8秒，报告ready、run.completed。报告解释追问约6.7秒、零工具调用。首次模型解读误述短窗连续回落、进一步极值追问选错最低周；已增加服务端summary并复验：最高9月21日/25.33、最低9月14日/19.10，相邻变化先升后落，排除末周短窗，run.completed且零工具调用。
- 微信开发者工具使用实际编译组件、真实接口报告的隔离读取夹具走查：图表卡宽334px，SVG真实显示；点击末周展示实际起止采样；原始采样请求保持同meter及9月7日08:00含基期窗口；继续追问保留输入草稿并展示引用；解读失败保留图表，重试消息携带原reportId且草稿保留。该部分是UI夹具验证，不算微信真实NDJSON端到端或手机验收。临时wx.request包装已恢复。
- 唯一3200已按无在途对话/阶段检查后SIGTERM受控更新，仍是production网关、原real-runtime.sqlite和原加密配置/密钥。首次启动误带退役IOT_STATE_SOURCE被入口阻止，纠正后健康检查通过；SQLite回退副本位于gitignored var/energy-comparison-rollbacks/。实际最终运行构建含summary修正。

## 证据与提交

- Runtime提交：`22db10a`（工具/报告/授权/恢复）、`a77faa6`（确定性极值与相邻变化）。
- 微信图表：[正常报告](../docs/research/energy-comparison-integration/report.png)、[逐周依据](../docs/research/energy-comparison-integration/evidence.png)、[原始窗口](../docs/research/energy-comparison-integration/history.png)、[解读失败/草稿引用](../docs/research/energy-comparison-integration/explanation-failed.png)。截图采用上述隔离UI读取夹具。
- 临时真实记录位于/private/tmp/energy-comparison-live-report.json、energy-comparison-model-result.json及energy-comparison-interpret-check.json；没有保存或公开凭据。详细诊断仍以前序诊断文件为准。

## 使用与剩余边界

进入公司Agent询问“分析26楼运营部电表最近4周环比，周一起点”。明确自然周时使用零点边界；默认与现有08:00采样一致。报告上可点周标签、查看原始采样、继续追问；解读失败可单独重试。

- 上游最新历史仍停在10月10日08:00，来源仍是客户临时模拟补数；当前数据不能证明真实节能，单位/倍率不能自动视为kWh。
- 手机上SVG渲染、320px窄屏、原生日期picker和真实微信NDJSON全链路尚待验收。本轮没有物理设备控制。
- 各人/来源授权仍实时复核；本轮未建立长期目录缓存或公司计量集合汇总。
- 主工作区并行任务列表/区域/管理员改动已保留，不纳入本闭环提交。已有旧报告可继续解释，summary由同一已保存周事实派生，不重读历史。

## 后续建议技能

手机或微信链路异常使用diagnosing-bugs；边界与计算行为修改先使用tdd；继续视觉打磨使用emil-design-eng并参照A原型与本轮实际组件截图。
