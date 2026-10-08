# Office Scope Family 来源目录

日期：2026-09-14

2026-10-08 复核说明：本文件保留 09-14 调查状态；下面三类 `*AreaDevice/page` 曾被当作同级成员来源的结论已由 [09-17 范围裁定](../../plan/027-office-association-scope-ruling.md)替代。当前它们仅回填 scoped 设备的控制引用，不能增加员工范围成员；最新接口表和真实数据见 [10-08 盘点](2026-10-08-interface-source-boundary-audit.md)。

## 结论

物联 Agent 接管的是办公室/工作区业务层的同级用户设备接口集合，而不是某个页面的全部实现。“我的办公室”是一个已核验但不完整的来源；Agent 需要通过来源目录聚合所有已确认按当前用户过滤的同级接口。

云起智慧面板、云起通用设备目录、管理端办公室注册目录、感知目录和能源目录不属于用户范围来源。它们只能用于 provider 映射、状态/能力调查和诊断。

## 来源清单

| 来源 | 作用 | 当前判定 | 纳入条件 |
| --- | --- | --- | --- |
| `GET /micro-api/api/office/office/member/my/office` | 当前用户办公室上下文 | 已确认用户范围上下文 | 必须完成全部分页/完整性核验 |
| `GET /micro-api/api/office/app/device/ac/myOffice/pageByAc` | 办公室中央空调 | 已确认是“我的办公室”来源，但覆盖不完整 | 以 `elementId` 绑定用户办公室；记录 source key |
| `GET /micro-api/api/office/device/page` | 办公室照明、门禁、监控等页面设备 | 已确认是用户侧同级来源；客户上游负责按当前登录用户过滤 | 按当前用户 token 调用并纳入聚合；管理端同路径只是另一业务入口，不改变 Agent 边界 |
| `GET /micro-api/api/office/acAreaDevice/page` | 空调关联记录 | 已作为同级用户来源接入 Runtime | 使用当前用户 token；按 Office 关联记录 `id` 去重 |
| `GET /micro-api/api/office/lightingAreaDevice/page` | 照明关联记录 | 已作为同级用户来源接入 Runtime | 使用当前用户 token；按 Office 关联记录 `id` 去重 |
| `GET /micro-api/api/office/accessAreaDevice/page` | 门禁关联记录 | 已作为同级用户来源接入 Runtime | 使用当前用户 token；按 Office 关联记录 `id` 去重 |
| `GET /micro-api/api/office/app/device/access/myAreaList` | 门禁区域树 | 暂不作为主来源 | 只有证明属于 Office 用户层且能完整遍历时才纳入 |
| `GET /micro-api/api/office/app/device/access/devicePage` | 门禁区域设备 | 暂不作为主来源 | 先解释全部区域 204 的语义；不能用 204 推断整个范围为空 |
| `GET /micro-api/api/office/device/page`（管理上下文） | 管理注册目录 | 排除用户范围 | 仅管理/诊断 |
| `GET /micro-api/api/iot-center/device/page` | 云起底层目录 | 排除用户范围 | 仅 provider 映射/能力调查 |
| `GET /micro-api/api/perception/**`、`/micro-api/api/energy/**` | 感知、能源目录与状态 | 排除用户范围 | 仅状态/provider 数据源，除非客户另提供 Office 过滤契约 |

## 聚合规则

1. 先加载当前主体的办公室/区域上下文，再加载来源目录声明的每个设备来源。
2. 每个来源独立记录 `sourceKey`、请求上下文、分页完成度、观察时间和结果状态。来源返回 204 只表示该来源/类别为空。
3. 只有所有必需来源完成分页和完整性校验，聚合快照才可进入 Agent；当前 Runtime 对任一声明来源失败直接 fail closed，不以部分来源继续回答或执行。
4. 来源重复只能依据稳定的 Office 设备关联引用或客户提供的映射键去重；不能按名称、图片、安装地址或云起底层 ID 猜测合并。
5. 所有聚合设备都可进入统一注册和盘点；能力注册独立决定是否可进入草案和执行。
6. Provider 绑定永远不能产生新的用户范围成员。

## 当前 Runtime 落地（2026-09-14）

- 单一 Authorized Device Scope 加载路径已经替代旧目录兼容分支。
- 内部注册设备保留 `sourceKeys`、`officeIds` 和 `officeDeviceRef`；这些字段及 `hubDeviceId` 不进入 Prompt、候选或草案。
- 模型仍通过统一的 `find_device_candidates` 原子工具检索；Prompt 仅携带当前范围实际存在的类型及每类最多 8 个基础地点/名称词汇。
- AC、照明、门禁已经完成草案确认执行闭环；视频作为无控制能力的只读设备进入同一注册和检索链路。
- 环境、能源、消防等类型尚无已确认的同级用户来源，因此未用管理、感知、能源或云起目录回填。

## 当前真实观察值

“我的办公室”来源当前观察到 1 个办公室、2 台中央空调、3 台照明、2 台门禁、0 台监控，共 7 台。这是来源观察值，不是完整 Office Scope Family 的总量。

历史 `*AreaDevice/page` 观察到 47 台门禁、53 台空调、159 台照明，但不同入口/会话曾出现 204 或空结果。这些数量只能作为候选来源调查证据，不能直接与 7 台 union。

## 后续工程工作

- 将客户接口响应体接入 Runtime 的生产状态读取与执行后回读；这不是“接口没有响应体”，而是 Runtime 尚未消费全部状态响应。
- 在微信开发者工具中验证真实小程序登录态、当前用户 token 传递、消息流、草案确认和执行结果回传。
- 更多设备类型暂按产品决策保留扩展位，不在当前切片立即接入。
- 如果未来确实出现同一 Office 引用的字段冲突，再增加诊断记录；上游设备注册方式不属于 Agent 的权限或设备模型。
