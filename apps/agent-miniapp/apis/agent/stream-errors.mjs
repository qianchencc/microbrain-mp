// 传输层错误的统一出口：原始报错（request:fail / net::ERR_* 等）不进用户界面，
// 只留 console；流被截断（2xx 结束但未出现任何终态事件）同样按传输失败收口，
// 不允许产生「已思考 0 秒空轮」的幽灵态。
export const TRANSPORT_ERROR_TEXT = '连接中断，请重试'

// 结构化传输失败标志：页面凭 error.transport 识别语义，不比对用户可见文案。
export const transportError = () => {
	const error = new Error(TRANSPORT_ERROR_TEXT)
	error.transport = true
	return error
}

const TERMINAL_EVENT_TYPES = new Set(['run.completed', 'run.failed', 'run.aborted', 'run.awaiting_confirmation'])

export const createTerminalTracker = () => {
	let seen = false
	return {
		track(event) { if (TERMINAL_EVENT_TYPES.has(event?.type)) seen = true },
		get seen() { return seen },
	}
}
