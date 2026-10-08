# 双 Agent 接口区分交接

2026-10-08。完成：真实只读接口数据、设备/控制/provider 引用、两端最终目录与仪表盘口径已核对；追加区域角色及个人分组调查。Company 当前目录不等于已验证的按人授权范围；没有生产代码变更。

权威证据与理想接线表见 [接口层复核](../docs/research/2026-10-08-interface-source-boundary-audit.md)。其中区分当前事实与接线建议，具体请求、数量、映射示例及限制只在该文维护。

延续 [09-17 范围裁定](027-office-association-scope-ruling.md) 与 [双 Agent 来源 ADR](../docs/adr/0006-dual-agent-sources-and-history-boundary.md)：原始三类关联分页只作为 Office 控制引用对照；它们不能定义员工目录。上一轮把这三类接口描述成员工范围来源的措辞已纠正，实际代码过滤没有被回退。

用户指出上一轮遗漏授权模型后，追加读取 Office 官方 Swagger、智慧照明/门禁/视频 H5 资产与当前身份角色关系。Office 内另有用户→类型角色→类型区域→区域设备的授权配置，当前身份的四种角色各 1 条，分别绑定 4/5/8/5 条区域关系；同一服务里可以同时存在办公室成员链路和智慧区域角色链路。perception/Office 的个人设备分组并未证明是权限配置，transit 通行权限也不是 Company 全类型远程控制授权。未执行任何配置、控制、通行下发或权限 POST。

随后精确核对小程序菜单：当前 `config/menu.json` 的五个入口均指向 owner 子应用。其“智慧xx”使用 `office/app/device/{类型}/myAreaList + devicePage(areaFullCode)`；“我的办公室”使用 `office/member/my/office + elementId` 的专用/通用设备查询。上段调查的 `/lighting/`、`/access/`、`/video/` 是独立应用，不是该菜单目标，上一轮混用其接口描述小程序的措辞已纠正。完整查询/控制表与 ID 差异在报告维护。

尚未闭合：Company 适配器按型号直接读取 `iot-center/device/page`，没有显式查询设备对人的分配；上游是否自动过滤个人设备权限，仍需明确契约或差异账号证据。当前 55/102/47 是读取与接入计数，不是已核验的个人授权规模。下一步先确定 Company 各类设备的用户授权目录与现有代码对应，不能以服务前缀、个人分组或动作存在替代证明。Office 09-17 范围裁定保持。

上述契约明确后，才按对应切片核对已有 Company 监控材料和感知位置字段兼容。客户四项历史接口仍待正式文档，人员统计由我方分析回放；告警与任务收件箱边界沿 [10-07 交接](2026-10-07-history-interfaces-alert-inbox-handoff.md)。本报告没有把未实现的监控、统计或人员分析记为完成。

建议 skills：继续梳理使用 `ask-matt`；记录新术语/不可逆决定使用 `domain-modeling`（本仓库领域入口为 `CONTEXT.md`）；明确业务切片后使用 `implement`。交接阶段用 `handoff`，按本项目要求将交接保存在 `plan/`。
