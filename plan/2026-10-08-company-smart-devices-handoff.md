# Company 智慧照明/门禁/监控接入交接

2026-10-08。票 18。承接票 17 的智慧页面来源模式，把大 Agent 剩余三类智慧设备接入 Company 目录与控制/取流链路。Runtime 提交 `2183ed6`；mp 提交 `e641ec6`。前置修复提交：Runtime `7e5ff0c`（观察目录 503 有界重试与并发合并）、mp `1a072c6`（总览失败状态显式呈现）。

## 接入内容

- **成员来源**：三类各自 `myAreaList` 区域树 → 叶子区域 `fullCode` → `devicePage`。真实验证 devicePage 为前缀聚合（父区域返回全部后代），只查叶子避免重复；树深度自适应递归，不假设恰好三级。
- **设备身份**：记录 `id`（即 `{lighting,access,monitor}AreaDeviceId`）。与空调不同，照明一个 hub 背多条独立回路（26 楼实测 156 条记录 / 136 hub），按 hub 去重会吞掉回路级控制，故按记录 id 建目录。
- **照明/门禁可控**：`controlRef = 记录 id`，复用既有 `/office/app/device/{kind}/down` 出口（照明 `closeOrOpen`，门禁 `controlType:2`）。草案确认、幂等、scope 重核、scanner 任务执行全部走既有 Company 链路。
- **监控 observationOnly**：检索可见、不进草案。取流走智慧页面出口 `monitor/down`（真实返回 `{result, url}` 字符串化 content，wss 短时效）；`openVideoStream` 增加 `source` 分支，Company 不复用 Office 的 iot-center view 动作。
- **粗状态**：照明 `switchStatus`（bool）、监控 `netStatus`（ON_LINE/OFF_LINE→bool）；按 `smartAreaCode` 分组重查对应叶子 devicePage。无时间戳语义与 Office 照明一致：参与展示与"已满足跳过"，回读仍只认 AC（readback.ts 仅 AC）。门禁无状态语义保持未知。
- **页面外设备**：底层目录有而智慧页面未返回的设备不进 Company 候选；Office 目录与员工"我的办公室"范围不受影响。
- **mp 侧**：`getVideoStream(deviceId, source)`；`openVideoPlayer` 携带 source；ObservationCard 的"查看画面"经 `props.source` 区分两端。

app.ts 的 Company `/api/agent/(regions|devices)` 守卫放开了 `devices/:id/video-stream`（仅取流），区域/设备浏览端点仍为 Office 专属。

## 验证

- Runtime 全量 **93/93**（新增 `company-smart-devices.test.ts` 5 条：目录成员/页面外排除、照明草案确认幂等、门禁一次开门、监控取流与作用域、粗状态读取零下发）。
- 类型检查、构建通过；两仓 `git diff --check` 通过。
- 真实只读核验（开发身份、真实网关）：
  - 目录：照明 156、空调 49、门禁 47、监控 35，与页面手工盘点一致；装配约 6 秒。
  - 状态：照明 switchStatus=false（26 楼样本）、监控 ON_LINE=true、门禁 null。
  - Company 监控取流：真实返回 `wss://ncim.577119.com:6014/proxy/...`。
- 提交拆分：adapter.ts 曾与并行会话的仪表盘分段改动交织，已用反向补丁精确分离，并行改动（dashboard/regions/observation kinds）保留在工作区未动、未混入。

## 边界与未验收

- 未执行真实照明/门禁控制（等用户明确场景）；微信开发者工具/真机的候选、草案、播放入口走查未做——需要 HBuilderX 重新编译后验证。
- Company 任务/周期对智慧照明/门禁的执行走既有机制，未做专项真实场景验收。
- 监控回放、PTZ、历史录像不在本票；四类历史接口仍等客户文档。
- 仪表盘仍按观察口径统计，不含智慧三类（是否纳入仪表盘计数待产品决定）。
- Runtime 3200 服务尚未用新构建重启（本轮验证用进程内真实调用完成）；重启前按规范检查无执行中对话/任务阶段。

## 下一步建议

1. 受控重启 3200 加载新构建；微信开发者工具验证 Company 对话检索照明/门禁/监控、"查看画面"取流。
2. 用户指定具体场景后执行真实照明控制验收（确认→下发→粗状态）。
3. 并行会话的仪表盘分段改动由其自行收口提交。
