# 安全历史分类、详情与引用交接

日期：2026-10-09。范围：历史观察票 01。源码、真实只读网关与微信开发者工具操作已完成；手机真机、320px窄屏和原生日期选择器手动触摸未验，不标全环境完成。其余八票保持各自前置条件。

## 业务与实现

仪表盘安全入口不等待摘要；Company 观察卡提供“按类别和日期查看历史”。单层 Sheet 中燃气/烟感/水浸分类、日期窗口、分页、记录详情、返回和引用复用原有组件。列表宿主保留 flex 链，详情返回保留原筛选与记录。引用不自动发送、不丢原输入，发送仍由 Runtime 核验原 ledger/eventId/deviceId。

Runtime 新增 Company-only `GET /api/agent/safety-events`，独立 smoke 台账接入原详情/消息引用。每批最多扫描三页，固定查询窗口、身份绑定游标、完整记录排序，不提前称精确总量。显式 last 优先，满页缺少元数据继续读取；错误响应不伪装成空历史。新水浸列表排除已确定的烟感混表；旧 flooding 烟感引用仍沿原端点读取。

## 验收证据

- 真实唯一 3200 已构建重启，监听 `0.0.0.0`、直连客户网关，沿用真实身份和数据库；重启前无执行中阶段/对话。本轮没有控制设备。
- 实测分类查询：燃气首批20条/1118ms；烟感20条/915ms、最新2024-04-27；水浸6条/1860ms、排除292条、最新2024-03-30。这是当前读取证据，不是所有租户/所有时间的精确业务总量。
- 上游 `createdAt,id,deviceId` 多字段排序只读 GET 200；满页/last:false/数字ID同时间跨页/无时区/重复参数/坏日期/错误页/旧引用与新烟感引用经公开 HTTP 回归。
- 微信实际分类切换、烟感20→35分页、详情返回35条保留、真实水浸引用→消息解释、烟感引用时原草稿完全保留并显式发送。没有使用请求 mock。
- [烟感列表](../docs/research/history-observation-acceptance/smoke-history.png)、[详情](../docs/research/history-observation-acceptance/smoke-detail.png)、[引用与原输入](../docs/research/history-observation-acceptance/smoke-quote.png)、[水浸解释](../docs/research/history-observation-acceptance/water-answer.png)。蓝牙弹窗早期遮挡验收，后来以 Escape 关闭；这些归档截图均无该遮挡。
- Runtime 全量106/106、目标3/3；类型检查/构建通过。MP27/27、微信编译通过。双轴审查发现的分页、旧数字ID、入口耦合、样式继承与坏响应问题已修正；`git diff --check`通过。

## 剩余边界与下一步

手机与窄屏验收尚无证据；微信日期 picker 只核对绑定和布局，未完成原生触摸选择。一次真实水浸解释耗时48秒，模型延迟属于独立性能项；不能把它与约1秒的历史接口读取混为一项，也不声称对话延迟已解决。

下一条按票02推进 Company/仪表盘环境趋势，先修 PM10/PM1.0 语义，站点历史不猜设备归属。统计与视频仍按[交付地图](2026-10-09-history-observation-ticket-map.md)的局部门槛推进。Runtime 同期他人修改的 CONTEXT.md 待选项未纳入本票。

建议后续技能：implement、tdd；稳定闭环后 code-review，界面交互复用现有设计约定。
