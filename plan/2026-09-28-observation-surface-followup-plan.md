# 观察响应面与 H5 播放页 — 就绪盘点与后续开发计划（2026-09-28）

2026-10-02 状态校正：下文为 09-28 制定时的计划。T1–T4 对应的观察事件、卡片、抽屉语义与播放接线后来已实现，不再作为未开发任务；当前 H5 部署配置与真机验收尚未完成。观察设备参与后台巡检是新的业务闭环，不等于重复实施此处 T1–T4。最新任务状态与流程见[任务总表](2026-09-30-agent-task-register.md)。

适用范围：客户小程序 `mp` + `iot-agent-runtime`（3200 单实例）。承接 wayfinder 票 03 与 `docs/research/2026-09-28-camera-and-sensor-integration.md`。

## 一、已就绪内容盘点

| 件 | 状态 | 证据 |
| --- | --- | --- |
| 观察范围运行时（环境/消防/能耗只读目录 + `query_alerts` + `video-stream` 端点 + observationOnly 门禁） | 已实现、生产实测 | Runtime `b5a6013`，48/48 测试 |
| 取流协议与官方 SDK 依赖 | 已裁决 | `/media` WS → PKD/rand → SDK 内部认证 → realplay；裸探针 `errPlatformIp` 系认证缺失非上游故障；token 无调用方绑定 |
| 端到端播放 | 已验证 | headless Chrome + 客户托管资产 + `monitor/down` 地址 → H.265 640×368 首帧、实时 OSD |
| SDK 资产托管 | 已具备 | `ncim.577119.com/owner/static/h5player/` 全量在位（h5player.min.js、playctrl1/1simd/2/3、talk/talkW），自建页可同域直接引用 |
| H5 播放页原型 | 已实现（拟物材质体系） | `pages/agent/proto-h5player.html`：取流/接入/播放/失败状态机、镀铬自动隐去、`JS_Stop` 清理、`deviceId` 与 `url` 双入参、`?debug=1`；加载/错误/缺参三态截图核验 |
| 观察响应面原型 | 已实现 | `pages/agent/proto-observation-surface.html`：`observation.reported` 事件形状 + 五场景 + A/B 呈现 |
| 上游频控特征 | 已发现 | 连发取流/孤儿会话 → `monitor/down` 与 `view` 均 `code:207` 空返回（账号级、全部摄像头同拒，>15min 未恢复）→ 重试是一等状态、`JS_Stop` 必须可靠 |
| 小程序侧观察呈现 | 未做 | 无 `observation.reported` 事件、无 `ObservationCard`、无 `getVideoStream` 封装 |
| 播放页部署位 | 未定（客户依赖） | 需 `ncim.577119.com` 下静态路径（或复用既有静态目录约定） |
| 区域抽屉观察语义 | 未修 | video 显示"开/关"（应在线/离线）、新 kind 全走齿轮占位图、点视频卡落空时间轴 |

## 二、理想效果

一条完整巡查链路：问"26楼运营走廊摄像头在线吗" → Agent 回 ObservationCard（在线点 + 「查看画面」）→ 点击经 webView 打开客户域 H5 → 玉墨深底播放页 ~3s 出画面、镀铬 3s 隐去 → 返回对话。同卡体系覆盖环境读数（来源标注）、能耗最新已知读数（陈旧如实标）、告警台账（时间+report 标记，无恢复语义）。区域抽屉内摄像头显示"在线"而非"开启"，点开进观察详情 pane 同样有「查看画面」。全程 observationOnly 设备进不了草案/任务；任何缺态/陈旧/上游失败都如实呈现，不编造。

## 三、开发票（blocking edges）

**T1 Runtime：`observation.reported` 流事件**（runtime 仓）
- 观察类查询结果（video onlineStatus、environment realTimeData、energy realTimeRead、query_alerts 聚合）以持久化 `observation.reported` 事件入 `events_json`，恢复即重放；设备行复用 `disposition:'none'` 语义；告警作为附加 block。
- Blocked by：无。独立可做。

**T2 mp：取流封装 + 「查看画面」链路**
- `apis/agent/index.js` 加 `getVideoStream(deviceId)`；播放页 URL 为配置项（dev 可空 → 按钮置灰"播放页接入中"）；`uni.navigateTo('/pages/webView/index?path='+enc(playerUrl)+'&name=…')`；不把 token 拼进 URL——H5 页自己带 token 调 video-stream。
- Blocked by：T5 的部署位（生产验收前）；开发期可先接线。
- 前置约定：H5 页生产模式收 `deviceId`，页内用 webView 注入的 `token`/`tenantCode` 调同域 `GET /micro-api/api/ai/agent/devices/:id/video-stream`。

**T3 mp：`ObservationCard` 组件**
- 按 proto-observation-surface 的 B 形态（逐块分卡）实现视频/环境/能耗/告警四块；陈旧文案口径与原型一致；视频行含「查看画面」动作（接 T2）。
- Blocked by：T1（事件形状落地才可接线）。

**T4 mp：区域抽屉观察语义 + 观察详情 pane**
- `region-device-view.mjs` 按 kind 分流状态文案（video→在线/离线、environment→读数摘要、energy→最新已知读数+readTime、safety→仅告警台账）；观察类分组并入"仅观察"；视频卡点开进三级栈的观察详情 pane（在线态 + 「查看画面」，不落空时间轴）；视频设备 artwork。
- Blocked by：无（语义修正独立）；pane 内「查看画面」依赖 T2。

**T5 客户域 H5 播放页生产化**
- 以 `proto-h5player.html` 为参考实现部署到 `ncim.577119.com/<path>`；`szBasePath` 指 `/owner/static/h5player/`（或自镜像解耦）；引入 jweixin 以 `wx.miniProgram.navigateBack` 返回；微信 webview 真机播放验收。
- Blocked by：客户确认部署路径（可发支持请求）；SDK 版本对齐 `2.1.3build20240125`。

**客户依赖清单（合并发一次）**：H5 部署路径；上游取流频控/会话上限口径（207 阈值与恢复窗口）；`alarm`/`report` 语义与处置权限；能耗采集恢复时间；回放接口计划。

## 四、建议顺序

T4（纯前端语义修正，先落地）→ T1 → T3 → T2（接线）→ T5（客户部署位到位后上线验收）。T5 未到前 T2 的播放按钮按"接入中"置灰上线亦可。

## 五、验收点

- Runtime：observation.reported 事件持久化/重放、恢复后不重放成新动作；
- mp：取流封装错误分层（取流失败≠播放失败≠离线）；ObservationCard 陈旧标注如实；
- H5：真机 webview 出流、重试换新 URL、pagehide 释放会话；
- 端到端：207/不可用场景下文案诚实不谎称离线。
