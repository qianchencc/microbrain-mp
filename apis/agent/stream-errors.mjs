// 传输层错误的统一出口：原始报错（request:fail / net::ERR_* 等）不进用户界面，
// 只留 console；流被截断（2xx 结束但未出现任何终态事件）同样按传输失败收口，
// 不允许产生「已思考 0 秒空轮」的幽灵态。
export const TRANSPORT_ERROR_TEXT = '回答流未正常结束，未取得完整结果，请重新连接'

// 结构化传输失败标志：页面凭 error.transport 识别语义，不比对用户可见文案。
export const transportError = cause => {
 const code = /\bERR_[A-Z_]+\b/.exec(String(cause || ''))?.[0]
 const reason = /timeout|timed out/i.test(String(cause || '')) ? '等待回答超时'
  : /abort/i.test(String(cause || '')) ? '请求已中止' : code ? `网络连接失败（${code}）` : ''
	const error = new Error(reason ? `${reason}，未取得完整结果` : TRANSPORT_ERROR_TEXT)
	error.transport = true
	return error
}

const TERMINAL_EVENT_TYPES = new Set(['run.completed', 'run.failed', 'run.aborted', 'run.awaiting_confirmation'])

export const createTerminalTracker = () => {
	let seen = false
	let errorBody = null
	return {
		track(event) {
			if (TERMINAL_EVENT_TYPES.has(event?.type)) seen = true
			if (!event?.type && typeof event?.code === 'string' && typeof event?.message === 'string') errorBody = event
		},
		get seen() { return seen },
		get errorBody() { return errorBody },
	}
}
