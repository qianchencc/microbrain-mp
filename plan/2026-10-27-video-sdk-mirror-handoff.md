# 视频播放解码资源镜像

范围：安全台账回放取流改进后的真实播放验收阻断项。Runtime监控专用目录修复`efa1fb9`已发布，原窗口取流200（8.7秒/2.0秒），但本机Ego真实播放器的原窗口、重试、直播和近期录像均等待首帧超时。

诊断确认：WebSocket已open；解码Worker报`importScripts`加载失败，实际路径是`playctrl1simd/DecodeWorker.js`，该Worker导入同目录`Decoder.js`。解码文件2,777,370字节，云端直接读取实测25.4秒；播放器此前每次从客户站代理该文件且不缓存，超过20秒画面期限。最初根路径`DecodeWorker.js`探测返回HTML属于错误探测路径，不作为实际Worker文件损坏的证据。

最小实现：`serve.mjs`在既有SDK路径白名单内优先读取部署目录`sdk/`的静态文件，不存在时继续原固定客户代理。身份头、视频取流转发和播放器时间语义不改。云端准备同版`h5player.min.js`，以及`playctrl1`/`playctrl1simd`各自的`DecodeWorker.js`和`Decoder.js`，文件及SHA-256放`/opt/iot-agent-runtime/video/sdk-20261027/manifest.json`。这些厂商资源不进仓库。Caddy视频站点启用`encode gzip`。

验收：公开HTTP服务回归先红（502）后绿，证明客户SDK站不可用时本地镜像仍返回可执行JS与HEAD，缺失镜像继续代理并明确失败，匿名取流401、管理路径404。MP全量172/172通过（`/private/tmp/mp-video-sdk-full.log`）；审查发现的测试子进程退出等待问题已修正，随后针对性1/1通过。标准与需求审查无产品阻塞项，无小程序Vue或编译包变更。

已在生产激活同版SDK镜像、本地静态读取及Caddy gzip；`serve.mjs` SHA-256为`37be8b585e5c8ffbd098d2c164f974d8907bbcac6671b9b3f817a04430503627`。Runtime、视频、Caddy均active，健康200。原服务备份`/opt/iot-agent-runtime/video/serve.mjs.before-sdk-20261027`，Caddy备份`/etc/caddy/Caddyfile.before-video-sdk-20261027`；本轮未更改`player.js`与`index.html`。

Ego真实SDK原窗口首帧1920×1080，官方SDK原生截图中摄像机烧录时间从10:56:55推进到10:59:00，后者位于请求的10:57–11:27。重新播放同一窗口再次出现首帧，截图10:56:56为起点邻近关键帧；旧实例已停止。点击返回后停止调用完成、playing=false、canvasCount=0。图片含办公现场，仅留`/private/tmp/video-scope-browser-20261026/`，不入Git。手机微信WebView返回台账及完整30分钟连续播放尚未验收。整体发布、证据和回滚见[总交接](2026-10-27-safety-playback-improvement-handoff.md)。

隔离工作树`/private/tmp/mp-video-sdk-20261027`，基线`27c972b`。生产原`serve.mjs`哈希与该基线一致；不纳入主工作树并行任务呈现改动。发布前备份原服务文件与Caddy配置，保留代理回退；SDK镜像准备失败或拿到HTML不得激活。建议技能：`code-review`、`ego-browser`、`handoff`。
