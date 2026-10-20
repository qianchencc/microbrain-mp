# C 任务日历生产实现

状态：2026-10-19 用户已认可原型并要求完成生产构建。

范围：Company 首页直接选日，复用 RegionCalendar；默认上海今天，日程保留当天全部状态和周期发生。展开为日程／周期计划／收件箱；收件箱保持个人通知及读取任务成功后已读语义，报告仍附属于任务。复用任务结果、计划详情与取消确认。Office 原入口保留。

名称保留完整动作与范围，最大80字，时间/重复规则独立展示；历史被截断名称不推测修复。确认创建/修改成功后，首页和已挂载列表刷新，不等待扫描器。加载未完成不显示0项。按自然日00:00划分，区间跨日显示，投影不创建实体任务。

验证：Runtime 公开HTTP提案、确认、计划列表、发生保留完整名称；日历视图模型覆盖上海日期、跨日、周期发生和排序；微信编译与原生页面检查；复用既有通知授权/已读测试。完成后双轴审查及精确提交。保持并行能耗/UI修改，不执行设备控制。

## 实现与验证结果

- 首页由 `CompanyTaskOverview` 与共用 `TaskCalendarView` 承载；完整日程和首页使用相同上海日期投影。跨日显示续接段，列表包含周期投影，Office既有入口保持原行为。
- `TaskListSheet` 为Company提供日程／周期计划／收件箱；`TaskInboxContent`被独立入口及本抽屉共同使用。收件箱加入全部／未读／异常结果筛选及显式分页，读取任务成功后才标记已读。任务结果／附带报告继续使用既有TaskResultContent，未增加报告入口对象。
- 确认创建、修改或取消成功后通过tasks-changed通知宿主；首页返回和任务取消也会刷新。列表刷新保留同身份快照，身份变化立即清空；详情按ID重新授权读取。
- Runtime名称修复提交 `4ec44dc`：提案与修改保留完整名称，统一1–80字校验。HTTP回归覆盖提案、确认、计划详情、周期投影及改名。旧截断名称保持原值。
- MP Agent测试116/116；Runtime全量串行286/286；新增长名称修改HTTP定向1/1；Runtime类型检查、构建与diff检查通过。首次并行全量的两项安全台账测试遇到共享SQLite会话库争用，串行全量已通过，未修改相关模块。
- 微信开发者工具真实授权查询能打开新日历。另使用临时wx.request内存夹具验证长名称、周期计划、收件箱、结果读取和返回；夹具已恢复，不写入Runtime或客户数据库。该夹具不代表真实任务执行或手机验收。截图与日志在 `/tmp/task-calendar-production/`。
- 微信开发构建成功。HBuilderX的publish命令要求账号登录，因此用同一已安装5.24编译器及其自带Node直接执行正式build，结果为DONE Build complete，产物在 `unpackage/dist/build/mp-weixin/`，约6.1MB（全包）；保留既有Vue导入、样式及鸿蒙兼容告警。

## 交付边界

源码已进入原客户MP与Runtime工作分支。本轮未上传微信、未推送、未部署远端3210，也未发送真实控制。远端仍需受控更新到包含4ec44dc的版本，才会对新建／改名任务启用完整名称；旧线上12字截断仍存在于旧Runtime中。生产网关／手机的创建→刷新→到期执行最终验收尚未完成。

工作区有其他会话的能耗/UI修改，均保留；正式构建来自当前实际工作区，业务提交仅含本轮任务改动。原型继续保存在prototype/automation-arrangements分支d670a20，不混入生产路由。

建议后续技能：ask-matt、diagnosing-bugs（若真实创建刷新异常）、code-review；部署按Runtime现行规范检查活跃阶段及近时任务，保留远端3200其他服务。

正式编译须以 `/Applications/HBuilderX.app/Contents/HBuilderX/plugins/uniapp-cli-vite` 为工作目录，使用同安装目录 `plugins/node/node`（系统Node与编译器缓存字节码不兼容）。设置UNI_INPUT_DIR为客户MP绝对路径、UNI_OUTPUT_DIR为上述build产物目录、UNI_CLI_CONTEXT为该编译器目录、UNI_HBUILDERX_PLUGINS为plugins目录，再运行 `node_modules/@dcloudio/vite-plugin-uni/bin/uni.js build -p mp-weixin --config vite.config.js`。离开编译器目录直接运行会导致Vue解析路径错误。

双轴审查：Standards与Spec均已复核修复，无剩余阻塞。构建未上传微信；后端完整名称仍等待远端部署，不能把本地编译声明为线上验收。

## 2026-10-20 日历读取失败的展示修正

| Before | After | Why |
| --- | --- | --- |
| 原始设备范围错误和请求编号占据日历正文 | 紧凑提示“任务暂未加载/更新”，附重试与查看原因 | 区分日程读取失败和任务执行失败，完整诊断仍可查阅 |

`TaskCalendarView` 复用现有系统弹窗展示完整原始原因及编号；成功读取到空数组才展示空日程。沿用同身份快照与身份变化清理规则，不修改请求、授权或自动刷新策略。

验证：Agent 测试123/123；HBuilderX微信开发编译成功；真实Vue组件的隔离浏览器夹具覆盖首次失败、完整原因、重试成功空日程、刷新失败保留任务、身份切换清理，并检查320/355/390px宽度无横向溢出。证据在 `/private/tmp/task-calendar-error-ui/evidence.json`，测试/构建日志为 `/private/tmp/task-calendar-error-tests.log` 与 `/private/tmp/task-calendar-error-build.log`。

本次仅修正展示，截图中的上游超时原因未因此解决；系统弹窗为浏览器夹具捕获调用参数，微信真机点击验收仍待完成。未修改Runtime或执行设备控制。浏览器任务与临时服务已关闭。

后续技能：diagnosing-bugs（如继续排查接口超时）、ego-browser（界面复验）。
