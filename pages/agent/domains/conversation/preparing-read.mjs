// 快照接口的 202 准备中应答：有界轮询直到就绪、超时或调用方失活。
// 超时或失活时返回最后一个准备中应答，调用方按既有 preparing 分支呈现；
// 真实错误（非 202）不在此吞并，照常抛给调用方的失败路径。

export async function readWhenReady(request, {
 active = () => true,
 onPreparing,
 sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
 deadlineMs = 120_000,
 now = Date.now,
} = {}) {
 const deadline = now() + deadlineMs
 let result = await request()
 while (result?.status === 'preparing') {
  onPreparing?.(result)
  if (now() >= deadline || !active()) return result
  await sleep(result.retryAfterMs ?? 2000)
  result = await request()
 }
 return result
}
