# 电表三方向重设计交接

2026-10-13；当前阶段：设计与可操作原型待体验评审。

当前方向见 [设计稿](2026-10-13-meter-business-redesign.md)。它替代固定周/月组件作为统计交付的方向；不代表新增生产功能已上线。

原型 worktree：`/Users/qianchen/works/新发展/mp-meter-business-prototype`。
分支：`prototype/meter-statistics-comparison-inspection`，提交 `dd1d694`。
入口：`http://127.0.0.1:8426/pages/agent/proto-meter-business.html`。
实现文件及截图：原型分支 `pages/agent/proto-meter-business.html`、`docs/research/meter-business-redesign/`。

已确定：三业务分别处理统计总量/构成、期间对比、规则检查；任意起止窗口；沿用 A 视觉；采样依据与原始采样用底部单层抽屉；无额外自动文字解读步骤。

未定：检查是否同时覆盖数据质量和有明确规则的用电变化。已异步询问用户，尚未收到回答；原型按两类并存的推荐范围展示。用户体验尚未回传，不能称设计最终验收。

下一条生产闭环：任意窗口统计工具→确定性区间计算/覆盖→结构化统计结果→统计主卡；不用周/月对比替代。建议先执行 `to-spec` / `to-tickets` 固化评审后的三个业务闭环，再按 `implement` / `tdd` 推进统计。检查范围尚未确定不会阻塞统计。

工作区：本轮只提交设计/术语/入口，原型另分支提交。mp 留有早先 CompanyEnergyReport、解读流移除及并行任务列表/区域等修改；Runtime 留有先前终止报告后模型轮次的修改和并行 CONTEXT。这些均未由本轮部署或纳入设计提交；实施前重新检查差异和基线，不整包提交、不覆盖用户工作。

旧未提交的月度报告计划/交接已加“被替代”标记，仅作历史记录。真实 3200 未由本轮重启。所有原型数值、已核验单位/集合、检查案例均为演示假设。
