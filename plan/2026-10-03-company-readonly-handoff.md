# Company 只读对话：前端与联调交接

日期：2026-10-03。票 02；批准范围见 [核心规格](2026-10-02-dual-agent-automation-spec.md)，后端实现与权限边界见 [Runtime 交接](../../iot-agent-runtime/plan/2026-10-03-company-readonly-handoff.md)，Runtime 提交 `ddb0d5f`。

## 交付范围

复用现有 Agent 页、输入框、回复、观察卡材质。Office 与 Company 的路由、会话创建/恢复/继续、清除/停止/末轮删除均显式携带本端来源，未建立全局可变来源。Company 不读 Office 区域、不启动 Office 任务轮询、不展示控制/任务操作或视频播放入口；当前已接入环境/能耗/安全台账，不声称已接入公司全部设备、统计或自动化。

当前 Company 入口为 Office 对话内的临时最小入口；票 09 负责 A 仪表盘与正式展开归属，不替换整个客户小程序首页。复杂任务管理仍交给 Agent，未新增前台业务编辑器。

## 验证事实

Runtime Node 22 全量 59/59、类型检查/构建通过，规格与标准两轴审查完成。mp 既有 Agent 公开行为测试 18/18 通过，HBuilder Vue3 微信编译成功（既有 pages/check/detail/index.vue sourcemap/default-export warning 不影响退出 0）。实际微信开发者工具中使用官方自动化 SDK 做输入和点击：进入 Company、发问、读取协议夹具、展示环境/陈旧能耗/安全缺态/台账四块、返回后恢复同一 Company 会话；流式请求固定 source=company。没有向页面直接 setData 注入结果。

临时本地夹具仅返回明示测试数据，不访问真实模型或物联网，不发送通知。首次夹具工具参数漏传 deviceText 导致检索失败，修正夹具后成功，不改产品代码掩盖失败。本轮不构成真实微脑/生产 Runtime/微信真机验收；最终正式环境验证仍归票 15。

走查发现办公室顶栏入口被长区域名挤压，已改为现有会话菜单中的“打开公司 Agent”；Company 保留可见返回按钮。Company 页面卸载会销毁模块级缓存，草稿已移至应用 globalData 内存并按 session scope + source 分区，不写本地持久存储。重新编译后真实点开菜单、进入/返回/重进：Office 与 Company 的各自草稿分别保留，Company 观察卡从服务端恢复，顶栏不再重叠。

临时截图 `/tmp/company-readonly-wechat.png`、`/tmp/office-company-entry-final.png`、`/tmp/company-restored-final.png` 仅为本机诊断证据，不进入提交。官方 SDK 连接已断开，临时 3200 服务关闭；没有重启真实 Runtime。

## 真实网关只读补证（2026-10-03）

使用既有开发身份经 `ncim.577119.com` 的真实上游核验，从公开会话创建/消息/current 接口进入；临时 SQLite、确定性的只读 runner，仅调用当前候选与读取回调，没有真实模型调用。Office 返回照明 7 / 空调 2 / 门禁 2 / 视频 1；Company 返回环境 1 / 能耗 43 / 安全 3，Company 请求路径没有 Office 目录，两端 current 恢复均匹配自身 ID/source。

Company 本次取得环境 1 条非空读数；43 个电表目录仍加载，并调用读取路径，但未得到有效能耗读数，安全设备没有伪造实时状态。安全台账总数 387、最新事件时间 `2026-10-02T13:01:25.000Z`，这里只证明上游台账可读，不表示当前仍报警/已处置/已恢复。缺读数不能从本次汇总进一步区分接口失败还是采集空缺；后续维修演示仍需遵守 D04 的显式覆盖规则。

第一轮分类统计误以为 DeviceState 自带 kind，已修正为使用候选目录的类型；二次只补 Company 分类读数核对，不将错误的分类统计列作证据。两轮合计 0 模型请求、0 提案/控制；未读取或修改生产任务库，未启动监听服务或 scanDueTasks。临时应用/库关闭清理。源目录与授权路径已获真实只读补证，但真实模型到页面、正式服务和真机仍由对应验收补齐，不能把确定性 runner 当成模型能力证明。

## 后续与接手

A 仪表盘、能耗维修演示、Company 周期简报/控制、告警跳转与 H5、结束通知仍是独立票，不能以本次观察卡验收关闭。票 03 区间边界和 D04/D05 未决按已有问题等待决定；票 16 缓存恢复可独立推进。

Suggested skills: ask-matt → implement/tdd；必要 code-review；切片结束用 handoff。继续对齐 `pages/agent/proto-observation-surface.html` 与生产组件，旧原型账号级 Office 样例不覆盖现行来源裁定。
