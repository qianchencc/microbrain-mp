# 远端播放器补部署与开发者工具连接复核

## 已交付

`mp-video.qianc.ltd` 原先仍依赖 Mac 本机 H5 服务和 FRP，本机 FRP 停止后没有播放页可用。本轮将现有 `deploy/h5player/index.html`、`player.js` 与新增 `serve.mjs` 部署到远端，前端地址保持不变。

- SSH：`ssh -p 40022 admin@10.5.12.112`
- 发布目录：`/vol2/1000/Plugins/iot-agent-runtime/video/releases/20261019`
- 当前链接：`/vol2/1000/Plugins/iot-agent-runtime/video/current`
- 播放服务：`127.0.0.1:9415`，tmux 会话 `iot-video-player`，Node 22.23.2
- 公网页面：`https://mp-video.qianc.ltd/player.html`
- 取流 API：同源 `/api/agent/devices/:id/video-stream` 转发至远端 Runtime 3210
- SDK：同源 `/owner/static/h5player/*` 代理客户域官方资产，支持 worker/wasm 相对路径加载
- 公网：在远端现有 FRP 配置中添加 `mp-video`，修改前已备份并通过 `frpc verify`

只有视频取流 GET/HEAD 路径转发到 Runtime；匿名、缺园区及本地占位身份返回 401。其他 API 路径返回 404。页面、代理不记录凭据或短时效流地址，不使用开发身份回退。

## 验证证据

证据目录：`/private/tmp/mp-remote-diagnostic-20261019/`。截图包含现场画面，仅留本机，未提交。

- 公网页面与脚本 HTTP 200，内容 SHA-256 与本地源文件一致。
- 远端 SDK 读取 HTTP 200；实际浏览器 SDK/解码及 WSS 链路成功。
- Company 授权摄像头真实直播：`firstFrameDisplay` 为 640×368，页面显示“播放中”；截图相机烧录时间为 2026-10-19 19:19:10。
- 同摄像头直播切回放：窗口 18:49—19:19，`firstFrameDisplay` 为 1920×1080，页面显示“录像播放中”；截图烧录时间为 18:52:11，位于请求期间内。
- 退出调用原页面返回/JS_Stop 逻辑，随后关闭测试浏览器。
- 远端无身份视频请求 401、管理路径 404；两项服务均保留在 tmux，未启用新的开机服务。
- `npm run test:agent`：114/114；`node --check deploy/h5player/serve.mjs` 与 `git diff --check` 通过。

保留失败证据：直播首轮建立通道出现超时及 `0x12f900009`；回放首轮申请地址超过页面 20 秒期限。手动重试后均成功，独立回放取流复测约 5.3 秒。不能据成功重试宣称上游连接始终稳定；本轮保持现有播放器超时/重试行为。

## 开发者工具为何看似没有后端

本轮检查时未复现持续断连：源配置和已编译配置均为 `https://mp-agent.qianc.ltd/api`，远端 Runtime/tmux、FRP 及公网健康检查正常。

在真实开发者工具中使用当前登录态直接请求，环境接口 200（约 3.2 秒）、设备目录 200（约 9.8 秒，334 台）。重新进入仪表盘后，画面展示环境 1、电表 43、安全 3、空调 49、照明 156、门禁 47、视频 35；温度 27°C、湿度 71%、PM2.5 为 6，能耗日柱已显示。证据为 `dashboard.png`，当时存在无关蓝牙授权弹窗，未代用户处理。

此前失败发生时的微信请求日志未捕获，不能断言其具体原因；后台 curl 有一次设备目录约 21 秒，说明读取存在延迟。没有为此改写业务 UI 或猜测性调整身份/超时。

## 手动恢复与验收边界

机器重启后需手动运行：

```sh
tmux new-session -d -s iot-video-player 'cd /vol2/1000/Plugins/iot-agent-runtime/video/current && exec /home/admin/.nvm/versions/node/v22.23.2/bin/node serve.mjs'
```

Runtime 启动与 FRP 回滚见 [远端 Runtime 部署记录](2026-10-18-remote-runtime-deployment.md)。本轮只新增 `mp-video` 路由，已有 `mp-agent` 继续指向 3210。

真实直播/回放证据来自浏览器；微信 WebView 内点击、真机播放、业务域名以及 trial/release 的客户域部署仍需分别验收。
