# 安全台账回放改进交接

2026-10-27，用户认可后完成实现、审查、生产发布和真实SDK验收。闭环仅为安全台账关联摄像头的原窗口录像回放；Company直播复用相同目录入口。没有主动设备控制、权限框架迁移或小程序UI改动。初始证据见[10-26诊断](2026-10-26-safety-playback-timeout-diagnosis-handoff.md)。

## 结果与范围

原故障有两个先后暴露的阻断：取流先等待全部设备目录，任一无关照明/门禁等读取慢就耗尽15秒；地址可取后，客户SDK的2.8MB解码文件跨站加载25.4秒，又超过20秒首帧预算。两处均已修复，未延长等待期限。

Runtime `efa1fb91017c06f31d0c083bdd8089d2bb021aec`基于实际生产`d1f39fc`，在现有目录加载方法增加监控范围，复用原区域分页、身份隔离、TTL与成功快照缓存。视频范围与完整目录使用不同键，播放地址仍每次申请，不缓存。Company与Office保持独立，控制确认fresh核验未改。目录请求从61次缩为11次，另加1次录像申请；云端真实冷读9.611秒，发布后公网同一窗口8.742/2.027秒。这些是样本，不是固定延迟保证。

MP视频服务改动来自隔离提交`8b18a67`及测试修正`c204ca1`：既有SDK白名单优先读取部署目录`sdk/`，不存在则保持原固定客户代理。厂商同版主脚本、两个解码分支的Worker/Decoder共5个文件部署在云端，未加入Git；Caddy仅对视频站增加gzip。不改鉴权头、SDK调用时间格式、播放器脚本或小程序编译包。详情见[SDK镜像交接](2026-10-27-video-sdk-mirror-handoff.md)。

## 验证

- Runtime公开HTTP用例先红后绿，覆盖冷缓存无关设备不可用、视频/全量目录分离、短期复用、到期失败、撤权、账号/租户隔离和不完整目录拒绝。窄回归15/15、全量426/426、类型与完整构建通过。
- MP公开HTTP服务用例先红后绿，覆盖客户站离线时本地JS/HEAD可读、缺失资源保留代理失败、匿名取流401和管理路径404。全量172/172；审查发现的测试进程退出等待问题已修正，随后窄回归1/1通过。两轮产品标准/需求审查无阻塞项。
- Ego真实SDK：原摄像头「监控-26楼未来智城办公区」，原上海窗口`2026-10-16 10:57–11:27`，触发1920×1080首帧。官方原生截图烧录时间从10:56:55推进至10:59:00，后者在请求窗口内，画面人物位置变化。只以SDK报告时间或HTTP200判断可播均不足。
- 实际点击重新播放保持原窗口，再次触发首帧；截图烧录10:56:56属于起点邻近关键帧。旧实例停止。实际点击返回后SDK停止调用已完成、playing=false、canvasCount=0；浏览器任务已结束。
- 办公现场图片只留本机`/private/tmp/video-scope-browser-20261026/native-original-{1,2}.jpg`与`native-original-retry.jpg`，不入Git。手机微信WebView返回台账、完整30分钟连续播放未验收；SDK显示时间有数秒差异，因此本轮核对的是画面烧录时间。

测试日志：`/private/tmp/runtime-video-scope-{focused,full,typecheck,build}.log`、`/private/tmp/mp-video-sdk-full.log`。没有输出或保存到仓库的凭据、播放地址及WSS。

## 发布事实与回退

Runtime当前`/opt/iot-agent-runtime/current -> releases/20261026-efa1fb9`，归档SHA-256 `2c04299c89d4815a1f6b436dd5e8e1416dbaec37f364b69d5a5efbccbf426726`；独立安装构建日志在服务器`/tmp/runtime-efa1fb9-{install,build}.log`。适配器dist SHA-256 `86157864d7bba7728e9d7e6aaf2856f436d49086b06888e311783a7800c1b5bd`，server.js `126a3994d068d1ba675bc75699e09cbed41e70585106c3ca2026a1e43a0ca57e`。

发布前主库quick_check=ok，无执行中草案/阶段/对话，周期下一触发不在发布窗口。备份`/opt/iot-agent-runtime/shared/backups/20261026-2347-video-efa1fb9`。23:44/23:51前后任务46、计划10、阶段148、设备事实5487、报告9、通知40、会话202、事件6960相同；午夜正常任务可能随后增加业务行数，不据此要求永远不变。无schema变更。第一次候选解包与上传完成时间竞争而失败，校验完整归档后重建候选成功，未影响生产。

视频`/opt/iot-agent-runtime/video/serve.mjs` SHA-256 `37be8b585e5c8ffbd098d2c164f974d8907bbcac6671b9b3f817a04430503627`；`sdk -> sdk-20261027`，各资源来源/大小/哈希在该目录`manifest.json`。SIMD Decoder SHA-256 `0165675b52aee51eebf3a21c0e96b41b9f539f0d74a3eb9060a1c2a7bf50fa16`。源站回环HTTPS校验gzip线传1,010,689字节、解压后哈希一致；该回环耗时不能当公网性能结论。`player.js`/`index.html`未变。最终只读检查三个服务active、Runtime与视频health200，两处产品哈希匹配。

回退仅在确认无在途业务后进行：Runtime原子切回`releases/20261026-d1f39fc`并重启`iot-agent-runtime`；无schema变化不恢复数据库。视频可恢复`serve.mjs.before-sdk-20261027`并重启`iot-video-player`。Caddy恢复前先比对是否已有后续变更，原配置备份`/etc/caddy/Caddyfile.before-video-sdk-20261027`，校验后reload；不可覆盖其他会话后续配置。镜像资源目录可保留供复核。

## 身份权限复用判断

用户判断基本成立：凭据解析、账号身份核验、租户作用域、目录成员与hub绑定核验均应复用。本轮实际复用现有目录缓存和隔离键，只增加监控范围，避免每个视频入口重复拉全量目录。

复用不等于统一成同一有效期或同一种身份键：只读授权目录默认60秒TTL，过期失败不沿用旧授权；撤权在有效缓存期内最多延迟60秒可见。控制确认/下发必须fresh；长期会话/任务归属需要稳定账号身份，凭据派生缓存键随Token变化，用途不同。Company/Office权威来源也不能混用。更大范围身份工具收敛须单列范围并核对旧任务归属兼容，本轮不扩张为全库权限重构。

## 来源与继续入口

Runtime隔离工作树`/private/tmp/runtime-video-scope-20261026`、分支`fix/company-video-scope`；主Runtime旧工作树未作为发布源。MP隔离工作树`/private/tmp/mp-video-sdk-20261027`、分支`fix/video-sdk-mirror`，产品差异合入共享MP时保留其他会话未提交文件。建议后续仅补真机微信返回验证；若需身份复用治理，先冻结一个具体业务入口。技能：`diagnosing-bugs`、`ask-matt`、`implement`、`code-review`、`ego-browser`、`handoff`。
