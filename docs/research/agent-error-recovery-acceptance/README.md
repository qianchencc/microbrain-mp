# Agent 错误恢复验收证据

日期：2026-10-24，整体仍在推进，未声明全部完成。当前权威状态见 [验收状态](../../../plan/2026-10-24-agent-error-recovery-acceptance-status.md)，规格和必需证据见 [验收矩阵](../../../.scratch/agent-error-recovery/acceptance.md)。

[evidence.json](evidence.json) 只保留公开事件分类、对象关联、确认状态和脱敏结果，不包含鉴权、内部思考、原始历史、全设备绑定或数据库副本。原始轨迹仅在私密临时目录用于复核。

- 隔离真实模型/网关：只读瞬时失败、工具后模型建连失败、两次提案参数错误、周期管理重放、租约恢复、持续失败止损、真实墙钟检查点与一次读取故障。受控故障与自然错误分别保留；没有设备控制写入。
- 生产微信开发者工具：实际查询、创建/确认临时只读报告、通知中心打开报告、引用任务并修改确认。它是真实生产后端+微信模拟器证据，不能代表物理手机/移动网络。
- [21:08 报告画面](production-report-partial.png)：43/43、5148.84度；缺少可校验统计要求仍标记部分完成。这不是完整性通过。
- [第二项任务修改确认](production-task-change-confirmed.png)：名称已改，原21:33时间及成员保留。该次执行随后因目录持续连接超时失败；修改成功不能代替到期交付。

失败记录保留：`scheduled-failed-fa8e3cf` 是本地历史接入前翻页超时；生产第一项报告为legacy partial；第二项到期为目录连接超时。补丁后的新闭环待真实验证，不能用单元测试或健康检查覆盖这些失败。

- [完整报告/上海期间](production-report-completed-shanghai.jpg)：第三项22:07实际到期，43/43、5148.84度、completed，通知打开后重开同一保存报告；UTC与上海期间显示已对齐。
- [第四项修改确认](production-fourth-change-confirmed.jpg)：确认改名且原22:22保留，但随后到期授权目录超时，无报告。不得据这张画面宣称连续闭环通过。
- 补充真实隔离：报告preparing后ready再遇模型失败仍交付原附件；停止后计数稳定；即时草案只读恢复/还原/自然过期重核/放弃，错误source404、零设备写；六月两期均43台有效，16天2730.93度对14天2417.91度，按日均比较。
- e3b8f54在隔离真实模型/网关中，已于22:40实际到期完成固定43台电表报告；无关消防目录持续503未被调用，报告43/43、5148.84度，零控制。22:42已发布生产，第五项连续闭环验收进行中；全部失败与未验项保留，不能声称整体完成。

- [第五项改名确认](production-fifth-change-confirmed.jpg) → [第五项完整报告](production-fifth-report-completed.jpg) → [沿原任务追问](production-fifth-followup.jpg)：22:54实际到期、22:54:43完成，43/43、5148.84度，Task/43成员/spec/原时刻一致；第五项A13通过，前四项失败保留。
- [取消状态真实答复](production-cancel-status-verified.jpg)：09e Runtime67d2a09在23:14:54发布；保留原历史的真实模型仍依据当前CANCELLED回答，生产微信同样准确，无新草案或控制。
- [可见即时草案取消](production-draft-visible-cancelled.jpg)：取消勾选revision2、重新勾选revision3、取消后GET200/CANCELLED/resultnull。一次只读核对503后同一GET恢复200，未确认控制。
- 最终交接：[生产闭环交接](../../../plan/2026-10-24-agent-error-recovery-production-handoff.md)。新真实设备下发缺具体授权，物理手机断流缺连接接口；协议/隔离/模拟器证据不能代替这两项，整体仍in-progress。

- [任务创建等待](task-create-loading.jpg)：11/12微信生产只读验收，当前卡原生loading、重复点击禁止、收起重开仍等待；最终新任务约4.22秒创建、3.62秒打开详情。纯电表报告改为当前energy范围核验，无关智慧目录超时不再阻断；仍验证撤权不可见、当前energy不可用503。五份自建Task全部取消，零设备控制。完整限制与发布版本见[交接](../../../plan/2026-10-25-task-create-wait-and-read-handoff.md)。
