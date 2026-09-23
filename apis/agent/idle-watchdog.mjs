// 流式请求看门狗：enableChunked 请求挂起（服务端不关流）时 wx.request 的
// success/fail 永不回调，isRunning 将永久卡死且轮询被 activeRequest 抑制。
// 空闲超过 timeoutMs 即触发 onTimeout（由调用方 abort + 以明确文案 reject）。
export function createIdleWatchdog(timeoutMs, onTimeout) {
	let timer = null
	const arm = () => {
		clearTimeout(timer)
		timer = setTimeout(onTimeout, timeoutMs)
	}
	arm()
	return { kick: arm, stop: () => clearTimeout(timer) }
}
