# Company 检查点 Agent 与任务附带报告交接

日期：2026-10-15。票01—03已实现并集成原客户项目；开发版真实只读链路和微信开发者工具交互已通过。票04尚待手机及正式客户网关验收，不能标为生产完备。

## 已交付

依据：原客户仓 `.scratch/company-checkpoint-agent/spec.md` 与四张票。只开放 Company、固定已确认电表的能耗分析；`result`只保存检查点结果，`report`在有有效事实时保存不可变报告。解读失败保留事实为partial，全无事实不制造报告。整个报告参与范围在查看、PDF、引用及会话恢复时重核，缺一表拒绝整份成果。

用户入口仍是任务收件箱：通知先进入Task，所属检查点增加一行报告；同一Sheet中查看长页与计量依据、逐层返回。引用保留输入草稿且不自动发送。预览、依据及PDF只用保存事实，不重新运行统计。

核心提交：

- Runtime `53cbaa9`：确认指令与受限检查点Agent。
- Runtime `55c41da`：原子保存报告、授权读取、引用及PDF。
- MP `a0ed14b`、`426fff8`：检查点指令展示与共享报告容器，接入收件箱、独立详情、安排列表及现有Office设备时间轴宿主；未新增Company设备时间轴。
- Runtime `5ed9bf9`：真实验收发现普通read提案漏保存分析指令，明确工具说明中分析必须使用`read.agent`、报告输出必须为`report`。

两仓功能worktree已集成原目录。保留Runtime `0e68fc8` 批量并发、MP `0e843fa` 固定范围电表统计，以及并行计量日与答复恢复提交。原目录用户未提交的首页/能耗UI、领域文档保持原状，没有混入本轮提交。集成前恢复点记录在 `/private/tmp/checkpoint-integration-recovery-20261015.json`，对应两仓 `wip/before-checkpoint-integration-20261015` 分支。

## 验证与证据

| 层次 | 结果与边界 |
| --- | --- |
| Runtime公开行为 | 干净功能版本全量236/236；最后工具说明修改后检查点/报告/普通Company任务15/15。类型检查、构建通过。并行答复恢复版本另有238/238，见其交接。 |
| MP | 原客户项目99/99；HBuilderX编译原项目mp-weixin成功，未导入功能worktree；仅既有基线警告。 |
| Standards/Spec | 字距修正、设备时间轴宿主统一报告容器后窄复核收口。 |
| 周期与区间 | 两次发生各用自己的上海日期和独立报告；并发/重启重扫不重复；多个检查点不提前结束区间、终点只生成一条消息。公开HTTP/扫描器回归覆盖。 |
| 权限与失败 | 双表撤一表时整份预览/PDF/引用/恢复拒绝；跨主体、租户、source；partial、无数据失败与result无产物均有公开行为回归。未在客户真实权限上做撤权实验。 |
| 浏览器真实组件 | 生产Vue组件配隔离外部接口：详情/收件箱/列表、320/390宽、依据返回、草稿、PDF失败、404清理；原任务滚动节点保留，70px往返仍为70px。不是微信证据。 |
| 客户微信开发者工具 | 原项目、真实登录态、开发版公网API：真实通知→Task→检查点报告→计量依据→返回；引用保留验收草稿，随后已恢复原输入并移除测试引用。报告与依据可滚动、往返保持位置。 |
| PDF | 真实保存报告GET前后一致，PDF为82,841字节且文件头正确；微信按钮点击后未显示错误。没有宣称手机PDF阅读器验收。 |

真实组件浏览器材料：`/private/tmp/checkpoint-report-ui/results.json`。最终回归日志：`/private/tmp/checkpoint-reviewed-runtime-tests.log`、`/private/tmp/checkpoint-prompt-regression.log`、`/private/tmp/checkpoint-original-mp-tests.log`、`/private/tmp/checkpoint-original-hbuilderx.log`。

微信截图：[收件箱](../docs/research/company-checkpoint-report/inbox.png)、[报告长页](../docs/research/company-checkpoint-report/report.png)、[计量依据](../docs/research/company-checkpoint-report/evidence.png)、[引用草稿](../docs/research/company-checkpoint-report/quote.png)。收件箱打开使用现有组件公开入口；其后的通知、报告、依据、返回、PDF和引用均点击原组件。未把原生actionSheet菜单的自动化困难当作已验证菜单点击。

## 真实只读业务结果

自然语言指定一次性检查点，仅分析26楼运营部电表2026-10-09 08:00至10-10 08:00，并对比前一等长期间和去年同期，要求保存报告；不创建周期安排、不控制设备。

第一次真实提案只保存普通read，却在回复中承诺报告。已保留失败事件，未确认或执行该提案。仅修改工具说明后，第二次相同业务目标得到完整`read.agent.objective/output`和精确单表范围，确认后于13:23到点执行，13:24收口：

- Task：`dc2017e8-dda1-4dde-95f7-51399cdb3f91`；报告：`fe05478b-ea88-4e92-9a9e-ffef4471b3f7`。
- 统计4.36度；环比基期2.01度；去年同期无有效采样，明确不可比，总结果partial。
- 报告保留客户模拟补数标识，不能用这些数值证明实际运行或节能效果。
- 产生一条任务结束通知，确认控制动作数为0，没有物理控制。
- 新会话引用已存报告，得到同比不可比的解释，`message.completed → run.completed`，业务工具调用为0，原报告前后完全一致。

这证明该次实际链路成功，不代表所有表达或未来上游故障均已覆盖。真实执行材料在受限目录 `/private/tmp/checkpoint-live-acceptance-20261015-attempt-02/`；首次失败在 `/private/tmp/checkpoint-live-acceptance-20261015/`，原始消息及身份配置不提交。

## 运行状态与恢复

本轮从干净功能worktree构建后复制生成物到原Runtime，未部署原目录并行WIP。重启前在途会话、执行阶段/草案、60秒内阶段与计划均为0；原SQLite已备份，身份、任务/配置密钥、管理员密码文件哈希保持一致，配置修订仍为2。受控切换记录：`/private/tmp/checkpoint-rollout-20261015/rollout.json`、`/private/tmp/checkpoint-rollout-20261015-prompt/rollout.json`。

随后并行答复恢复工作线在本任务结束后更新唯一3200，当前已知版本为Runtime `45431c0`（包含`5ed9bf9`与全部报告实现），PID44438、Node22、`127.0.0.1:3200`、真实客户网关和原数据库。具体运行验证见[最终答复恢复交接](2026-10-15-agent-final-reply-recovery-handoff.md)。本轮报告的重开和引用也在该运行版本通过。继续操作前必须重新核对监听与HEAD，不把PID当作长期配置。

## 未完成及下一步

票04保持blocked：手机/移动网络、真机Sheet手势与PDF阅读器，以及trial/release指向的正式客户网关尚无本功能验收证据。开发版`mp-agent.qianc.ltd`公网链路不能替代正式客户部署。需要可用手机预览/体验权限及客户正式网关部署入口后，按同一条已保存任务完成通知复验，毋须另建报告入口或再改产品模型。

现场步骤：打开公司Agent任务收件箱→本次部分完成通知→所属阶段报告→计量依据→返回→引用并核对草稿→下载PDF；然后在移动网络及正式客户版本重复，记录构建、网关和任务ID。若客户正式网关未部署新Runtime，先完成其发布，不能仅切换前端URL冒充上线。

环境经验：测试前先构建共享config-contract；真实提案验收必须核对结构化指令和范围，不能只看模型承诺；从干净构建部署以免混入并行WIP；微信自定义组件按实际组件边界定位，编译、组件夹具、开发者工具和手机证据分开。临时浏览器服务完成后清理，保留原客户IDE和唯一Runtime。

## Suggested skills

后续从ask-matt进入剩余验收；具体实施遵循implement/TDD与窄公共行为回归，必要时code-review；交互用ego-browser或微信实际自动化，完成后handoff记录。领域与导航已冻结，无需重新访谈。

后续更新：运营部今日分析缺数时的具体原因修复与当前Runtime版本见[2026-10-15缺数诊断](2026-10-15-checkpoint-no-data-handoff.md)；此处保留首轮验收证据。
