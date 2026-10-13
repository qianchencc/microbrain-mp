# 告警上报属性展示移除交接

日期：2026-10-13

用户要求物联小程序不展示告警的上报属性。本轮删除 `SafetyHistoryList`、`SafetyEventDetail`、`ObservationCard` 的已上报/未上报/标记未知标签、相关说明及闲置样式；设备观察提示改为“仅提供历史告警记录”。展示约定已同步到 `pages/agent/AGENTS.md`。

验证：现有 Agent 测试 44/44 通过，HBuilderX 微信编译成功，四组件的 WXML/JS 编译产物不含相关标签。微信模拟器真实网关返回燃气台账20条，列表→详情实际点击验证标签已移除，设备名称、记录时间、台账来源与引用入口正常。对话告警卡通过编译产物核对，未新增模型对话；微信真机未验。

后台原始字段/接口与历史记录未改。工作区并行 TaskDetailContent、TaskInboxSheet、TaskListSheet 修改不属于本轮。

后续若调整告警展示，先读 `pages/agent/AGENTS.md`；建议技能：小范围UI修正无需新增流程，出现故障使用 diagnosing-bugs。
