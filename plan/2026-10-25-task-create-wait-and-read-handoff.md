# 创建等待反馈与电表任务查看闭环

本轮关闭票据[11](../.scratch/agent-error-recovery/issues/11-task-creation-wait.md)与其真实验收阻断[12](../.scratch/agent-error-recovery/issues/12-created-task-read-reliability.md)的冻结范围。整体恢复项目仍以[现有验收状态](2026-10-24-agent-error-recovery-acceptance-status.md)为准，不宣称长期稳定或全部设备控制验收完成。

## 最终行为与真实验收

- 当前创建卡立即显示“正在创建”、微信原生loading和业务等待说明；全局仍禁止重复操作。失败回到待确认，成功显示原任务入口；新确认清除上次错误。卡片状态互斥，其他卡不冒用创建状态。
- 真实微信旧代码：162ms按钮只禁用，无等待反馈，9650ms才scheduled。最终05：163ms可见loading/disabled，4216ms变scheduled，3621ms打开详情。04在等待期间收起再展开仍loading；双击后公开任务列表01–05各只有一个Task。
- 受控微信request503只验证失败UI：约684ms回到待确认，无虚假创建；随后真实成功没有残留旧错误。这一故障注入不是自然上游事故，也不是模型恢复验证。
- [加载画面](../docs/research/agent-error-recovery-acceptance/task-create-loading.jpg)来自实际生产确认在途04。03/04首次真实结果约9.97/10.56秒；仅并行创建者读取并未证明端到端加速。
- 打开04时自然复现GET503，编号cddce33c-bfcd-4cf1-8f6e-52440bf1d4d3，来源栈collectCompanySmartDevices→pageSourceRecords超时；当前任务只含43台电表。改为fresh energy后，同Task GET200约2156ms，真实微信重新打开4324ms。截图中的原能耗Task9cbf5c9d GET200约1188ms，此前约9042ms。样本有限，不是延迟SLA。

## 后端边界与发布

纯Company read.agent电表提案确认，以及创建者读取其已落地实际Task详情，复用检查点已有的当前energy授权目录，禁止旧快照fallback。详情分类读取当前持久化阶段/设备、租户、创建者、来源，不依赖旧提案。固定电表逐台重核；撤权不可见、energy读取失败503、跨来源404。控制/混合/Office/周期计划详情保留原完整授权路径，没有修改控制协议、轮询或通用缓存。

最终生产为`/opt/iot-agent-runtime/releases/20261025-84c7d71`，01:11:42 CST完成切换。该提交来自独立`fix/task-creation-wait-release`，从已验收67d2a09仅重放本轮提交：5287c7e（确认独立读取并行）与84c7d71（电表范围）。共享原分支对应7c33956/c16b7bd；并行会话1f113de/f0ddd33不在最终发布内。第一次7c33956构建曾带入前者，最终已纠正范围；未修改或丢弃并行源码。

发布前无执行中阶段/模型轮次，下一阶段01:30、计划07:00；备份`20261025-create-read-84c7d71`。切换前后tasks35、plans9、phases90、reports7、notifications27、conversations189一致，quick_check=ok、foreign_key_check=[]。原始备份/轨迹保持私密，不提交鉴权、姓名、思考、完整数据库。

本地/远端产物一致：

| 模块 | SHA256 |
| --- | --- |
| app.js | bbc9e00479f03866df0d5e918a67cb8a1ce37a1233648731889782ee73dc8d6c |
| tasks/routes.js | 8528e15dc30184251806d84ee0025130b0d46290fb31453488597fef66370c4c |
| tasks/store.js | 6b337fc316224d2f21d7fac257043bd3e514e045af09069b5ecb27fc96a5c8cb |

隔离发布源407/407、类型/构建通过，MP162/162；Spec和Standards双轴复核无阻断。小程序开发与production编译均成功，按用户要求无需上传/提审；编译产物仍在unpackage/dist/dev/mp-weixin及unpackage/dist/build/mp-weixin。

## 清理与后续

五份自建只读Task57a43fa2、2c046459、41ae34c7、c03712e1、8daa1179均已取消，未改变用户原任务、未提前执行，零设备控制；审计保留。原失败04被取消后仍按同Task实际重开，不是重新创建代替失败。验收是生产后端+微信模拟器，不能称物理真机。

控制任务完整目录依赖仍可能超时；截图空调任务bfc379d6与周期计划详情未纳入本轮收敛，不能宣称所有503消失。持续运行CPU/事件循环调查10、设备动作07与物理手机验收09仍沿原票据，不能被本轮的UI通过替代。

建议后续按ask-matt→diagnosing-bugs→既有HTTP/NDJSON TDD推进下一个具体业务；沿原对象身份核对503，不让用户重建任务。官方微信编译后若显示Paused in Debugger，先取截图确认并恢复/单次刷新；自动化超时不等同业务失败。临时mock在finally恢复；不以组件源码字符串测试代替真实界面。

持续运行限制的新增观测：01:11:42–01:19:15（约7.5分钟），11次event-loop-stall、最大4001ms，1次范围读取超时，未见租约丢失日志；该窗只有一项已取消阶段，没有新的成功到期交付。不能把服务健康或本轮创建通过称为持续运行稳定，调查仍属10。

工具复验记录：首次尝试用回调函数包装wx.request mock，自动化把返回的RequestTask当作响应，产生HTTP undefined；该次不计验收。最终采用官方静态503结果并在finally恢复，加载状态另由真实生产POST验证。临时隔离worktree已清理，发布分支/提交保留，未删除原仓无关未跟踪文件；最终关闭自建详情并收起Company面板，停止验收轮询。

发布后10分钟复核截至01:22:30：公网health200约0.64秒，服务active/自动重启计数0；14次event-loop-stall，最大4001ms，1次范围读取超时，0条租约丢失日志。没有新成功到期阶段，下一pending01:30。因此“10分钟零读取超时”检查未满足；保留已验证电表修复，原非电表读取与卡顿继续13/10，未声称整体验收通过。
