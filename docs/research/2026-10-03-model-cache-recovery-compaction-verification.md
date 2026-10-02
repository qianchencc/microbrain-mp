# 持久化恢复与压缩后的缓存核验

日期：2026-10-03。Runtime 基线 `ddb0d5f`；票 16 的本地诊断证据，无生产代码修改。既有连续文本/工具验证见 [09-30 记录](2026-09-30-model-cache-continuation-verification.md)。本次验证应用关闭重建后的压缩历史与暖前缀，不报告 OS 进程重启、真实工具轮或生产压力测试通过。

## 公开链路与边界

使用 `buildApp` 的 HTTP 创建/消息/current 接口、生产协议网关夹具及临时 SQLite。先以明示 seed runner 写入两轮合成惰性文本（80,010 / 96,010 字符），只返回用户消息，不伪造模型 usage 或摘要；关闭应用后重建同一库，使用实际 `createAgentHistoryLoader` 与 `createPiAgentRunner` 调用 `GLM-5.3-Flash`。得到真实摘要和第一轮回答，再次关闭重建后进行第二轮回答。

仅诊断模型描述的 contextWindow 为 56,000；沿现有默认 reserve 16,384、保留尾部 20,000 的算法。历史估算 44,006 > 触发线 39,616；实际保留尾部估算 24,003。没有修改生产 128,000 配置或 SDK/数据库 schema。合成填充用于触发同一压缩路径，不是设备事实，不作为业务查询结果。

捕获真实请求的 system/tools/messages 摘要与 SSE 原始 usage；只记录用量、hash、状态和耗时，未保存密钥、客户身份或请求正文。首个恢复创建 1 条 compaction，第二次恢复没有再创建；两次消息均完整返回 message.completed / run.completed，无工具事件。

## 实际用量

| 请求 | 原始输入 | 原始缓存读取 | SDK 非缓存输入 | SDK cacheRead | 输出 | 耗时 |
|---|---:|---:|---:|---:|---:|---:|
| 真实摘要 | 10,284 | 0 | 10,284 | 0 | 311 | 6.230 秒 |
| 压缩后首次续聊 | 16,987 | 0 | 16,987 | 0 | 102 | 22.633 秒 |
| 再次关闭重建后续聊 | 17,408 | 16,960 | 448 | 16,960 | 3 | 7.689 秒 |

三次均为 HTTP 200 / stop，原始 cached_tokens 与 SDK cacheRead 相等；输入总量 = SDK 非缓存 input + cacheRead。两次 Agent 请求的 system hash 都是 `c3a4b0df67a4eb9b`，tools hash 都是 `aae3ce8fc6d864c5`；消息数 4 → 7，第二次完整保留第一请求前缀，随后追加回答和本轮运行上下文。两次未传 prompt_cache_key。此单组耗时不构成性能基准。

官方定义缓存为自动识别重复上下文，原始计数取 `usage.prompt_tokens_details.cached_tokens`。[Z.ai 缓存文档](https://docs.z.ai/guides/capabilities/cache)。Langfuse 的 usage 类型与模型定义键应一致，缓存输入可单独记录。[Langfuse 用量文档](https://langfuse.com/docs/observability/features/token-and-cost-tracking)。本组“新压缩前缀首次为 0、下一次命中”与重新建立并复用前缀一致；不证明代理路由亲和性、缓存保留时长或所有生产请求必然命中。

## 未通过及未证明的部分

首个尝试用了 3 次模型请求，随后在压缩预测门槛处退出。恢复断言位于该门槛之后，实际上没有执行；失败记录遗漏逐请求 hash/raw usage，临时库也已清理。因此该尝试不作为恢复、工具或缓存计数证据。先前“首批恢复已通过”的中间表述已更正，不从未保存的字段推导结果。

补充尝试另用 3 次，累计严格 6 次后停止。Langfuse CLI 只读查询响应 200，但查询时间窗没有可复核 observations；零行不表示缓存为零，本次数值来自本地原始响应与 SDK，不宣称 Langfuse 落库通过。

应用关闭重建与压缩后暖复用已证明；独立 Node 进程恢复、带真实工具结果的跨进程恢复、生产窗口下自然达到压缩阈值和 Langfuse 实际入库仍未证明。09-30 的工具暖命中属于连续调用，不用来替代这些未验项。生产升级验收继续核对适用项，不用本组局部证明关闭全部缓存稳定性义务。

原始脱敏结果在 `/tmp/iot-cache-compaction-only-result.json`，已核对三条用量映射、压缩计数、完整前缀与零写入。最终 Node 进程及临时应用/库/探针源码已清理；没有真实 IoT、生产任务库、控制或通知。诊断记录交接见 [Runtime 回传](../../../iot-agent-runtime/plan/2026-10-03-model-cache-recovery-handoff.md)。

## OTLP 发送与查询补证

另发一条明确标注 `diagnostic/no-model` 的根 SPAN，复用生产 `createObservability` 与已有 `scripts/otlp-proxy.mjs`；仅临时将 baseUrl 指向本地 9600 代理，未改生产配置。没有 generation、模型调用、伪造 usage、设备请求或生产数据库。SDK `forceFlush()` 报 `Request timed out`，代理随后记录 `/api/public/otel/v1/traces` 的 2,493 字节 / 1 span 请求收到 200，摄取 job 为 `47d93deb-8582-4786-b259-fcaabd3832cf`。

一次 CLI observations 时间窗查询随后实际返回该 span：session `otlp-no-model-bd932d96-bcb1-4f9d-985e-f0515e0a67e7`、trace `0507988455ec1297bbc607d647b1ab53`、observation `5c6545381b0437f4`。开始/结束 UTC `2026-10-02T17:35:46.311Z`，服务端摄取回执 UTC `17:36:00.626Z`，查询响应 UTC `17:36:44`。这证明本次诊断根观测实际落库、会话属性存在；不补推先前模型 generation 已落库，也不改变缓存计数证据来源。

安装的 `@langfuse/otel@5.11.1` 从 `LANGFUSE_TIMEOUT` 取秒数，未配置时默认 5 秒；当前环境未设置。观测结束到摄取响应约 14.3 秒，包含序列化/传输/服务端处理，不能当作精确网络延迟。超时与服务端最终接收可以同时成立，因此 flush 超时或读 API 暂时零行都不能单独解释为缓存不命中。尚未证明应采用何种生产超时值，未擅自改配置或 SDK。探针进程终止，代理 PID 61347 已停止，临时源码删除。
