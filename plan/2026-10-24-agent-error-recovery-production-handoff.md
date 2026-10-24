# Agent错误恢复：生产闭环交接

整体仍in-progress；核心工程、隔离真实模型/网关与生产只读连续业务已验收。当前权威入口：[验收状态](2026-10-24-agent-error-recovery-acceptance-status.md)。完整历史、范围与依赖不要重新推导，分别读[规格](../.scratch/agent-error-recovery/spec.md)、[执行地图](../.scratch/agent-error-recovery/execution.md)、[验收边界](../.scratch/agent-error-recovery/acceptance.md)和[脱敏证据](../docs/research/agent-error-recovery-acceptance/README.md)。

## 已完成的业务闭环

- 生产Runtime `67d2a09`，23:14:54发布；上一版e3b8f54，备份error-recovery-67d2a09，app两地哈希d65d13e2064b09a8cbc301615e7a670803869a7d3b0395a487b8e381eefa8fb1，runner71873fb7d5787ec8d6676aeb51d41a2d9853ec8be06ff76eec90e40278805213。405/405、类型/构建、双轴审查通过。MP业务a5dca32，162/162、微信开发及production编译通过，尚未上传发布微信版本。
- A13第五项：查询→创建/确认→引用改名确认→原22:54实际执行→22:54:43完整报告→唯一通知→微信通知打开→同Task追问。Task ef316fd8、report4151d302、notification8d0f3a4f；固定43表/spec/时间未变，43/43、5148.84度、无缺表/partial。前四次失败保留，不拼接成通过。
- 09e：取消草案终态未传模型，导致历史提案仍被称待确认。公开接口先红后绿，仅增加当前latestDraft摘要；复制旧会话历史的隔离真实模型与生产微信均准确回答CANCELLED/不再待确认/未下发。
- 即时可见UI草案9bb0f24a：取消勾选revision2→恢复选择revision3→取消→GET200/CANCELLED/resultnull。只读核对曾503，一次相同GET恢复200；未重提案/重放/确认，零设备控制。

## 接下来只补缺少的验收证据

1. 新真实设备动作尚无具体批准；已有[最小控制方案](2026-10-24-agent-recovery-control-acceptance-proposal.md)。待明确批准后，代理重新读取指定空调原状，严格两次产品确认27→28→27；保持关闭/模式/风速，任何未知先取原回执和现态，不盲重发。批准不是物理效果证明，分别记录平台受理/权威回读/现场效果。
2. 物理手机移动网/前后台断流未验，缺可连接设备接口，已异步询问连接信息。代理操作可用真机，不能改成让用户代验，不能把模拟器称真机。
3. 上述缺项补齐前，07/09与总体不标done。统计CPU长停未复现单列10调查，不做猜测算法修复，也不声称根因已知。

## 清理与约束

所有本票临时Plan已取消；生产测试Task已完成或失败，保留审计；两份生产即时草案已取消。未触碰用户既有计划，未执行任何真实设备控制。隔离实例与私密DB副本停删，13216转发精确终止，3216/9229关闭，生产active且NRestarts0。私密原始轨迹仅/tmp/recovery-evidence（0700/0600），不提交鉴权/思考/全库/姓名。

自动化注意：Company浮层收起使用transform/opacity，size非零不能证明可见；用orb的“打开/收起公司Agent”标签与截图确认。没有确认当前任务名/ID不点历史卡。业务在途禁止编译重载。SDK截图额度故障走官方simulator_screenshot，不清用户缓存。

## 建议技能

ask-matt沿已批准票据继续；具体新阻断用diagnosing-bugs→既有HTTP/NDJSON接缝TDD→必要窄code-review。真实界面沿微信官方automator/CLI；一个业务闭环后按用户要求handoff到plan/。不重新进行已批准的规格/seam采访，不让验收设施或无关架构成为主线。
