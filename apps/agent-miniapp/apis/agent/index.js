import { agentUrl, getAgentHeaders } from '@/config'
import { createIdleWatchdog } from './idle-watchdog.mjs'
import { createNdjsonStreamDecoder, parseBufferedJson } from './ndjson.mjs'
import { TRANSPORT_ERROR_TEXT, createTerminalTracker } from './stream-errors.mjs'
import { requestJson } from './request.mjs'

// 单个事件之间超过该时长无任何分块，视为流已挂死（正常运行的模型/工具间隔远小于此）。
const STREAM_IDLE_TIMEOUT_MS = 60000
// 整条流式请求的总超时：真实目录下模型单轮可能远超 60s 默认值，静默期由服务端心跳续活。
const STREAM_REQUEST_TIMEOUT_MS = 300000

const getHeaders = (includeJson = false) => {
	const headers = getAgentHeaders()
	if (includeJson) headers['content-type'] = 'application/json'
	return headers
}

const request = (url, method, data) => requestJson(agentUrl + url, method, data, getHeaders())

// 消息接口的 409 等错误体是 arraybuffer（dataType text + responseType arraybuffer），复用解码器还原契约字段。
// 带契约 message 的错误（相位门等）原样透传；解析不出 message 的错误体按传输层失败消毒。
const parseErrorBody = data => {
	if (!data) return null
	if (typeof data === 'object' && !(data instanceof ArrayBuffer)) return data
	try { return parseBufferedJson(data) } catch { return null }
}
const parseErrorMessage = data => parseErrorBody(data)?.message || TRANSPORT_ERROR_TEXT

export const createConversation = () => request('/agent/conversations', 'POST')

export const restoreConversation = () => request('/agent/conversations/current', 'GET')
export const clearConversation = id => request(`/agent/conversations/${id}`, 'DELETE')
export const discardTurn = (conversationId, turnId) => request(`/agent/conversations/${conversationId}/turns/${turnId}`, 'DELETE')
export const confirmAction = (draftId, revision) => request(`/agent/action-drafts/${draftId}/confirm`, 'POST', { revision })
export const updateSelection = (draftId, revision, selectedActionIds) => request(`/agent/action-drafts/${draftId}/selection`, 'PATCH', { revision, selectedActionIds })
export const retrySummary = draftId => request(`/agent/action-drafts/${draftId}/summary`, 'POST')
export const readDeviceStates = draftId => request(`/agent/action-drafts/${draftId}/device-states`, 'GET')
export const updateParameters = (draftId, revision, changes) => request(`/agent/action-drafts/${draftId}/parameters`, 'PATCH', { revision, changes })
export const revalidateAction = (draftId, revision) => request(`/agent/action-drafts/${draftId}/revalidate`, 'POST', { revision })
export const restoreAction = (draftId, revision) => request(`/agent/action-drafts/${draftId}/restore`, 'POST', { revision })

export const cancelAction = draftId => request(`/agent/action-drafts/${draftId}/cancel`, 'POST')

export const streamMessage = (conversationId, content, onEvent) => {
	let task, watchdog, receivedChunk = false
	const terminal = createTerminalTracker()
	// 心跳是传输层保活事件，页面不消费；其余事件原样透传，终态哨兵顺路记账。
	const decoder = createNdjsonStreamDecoder(event => {
		terminal.track(event)
		if (event && event.type !== 'heartbeat') onEvent(event)
	})
	const promise = new Promise((resolve, reject) => {
		const options = {
			url: `${agentUrl}/agent/conversations/${conversationId}/messages`,
			method: 'POST',
			data: { content },
			dataType: 'text',
			responseType: 'arraybuffer',
			header: getHeaders(true),
			enableChunked: true,
			timeout: STREAM_REQUEST_TIMEOUT_MS,
			success: response => {
				watchdog?.stop()
				try {
					if (!receivedChunk) consumeFinalResponse(response.data, decoder, event => { terminal.track(event); onEvent(event) })
					else decoder.end()
					if (response.statusCode >= 200 && response.statusCode < 300) {
						// 2xx 但流上没有终态事件 = 传输层截断：不允许当成功收口（幽灵轮根因）。
						if (terminal.seen) resolve()
						else reject(new Error(TRANSPORT_ERROR_TEXT))
					} else {
						// 相位门等 409 契约需要原始响应体（code/draftId），不能只剩一句通用文案。
						const error = new Error(parseErrorMessage(response.data))
						const body = parseErrorBody(response.data)
						if (body) error.data = body
						reject(error)
					}
				} catch (error) {
					reject(error)
				}
			},
			fail: error => {
				watchdog?.stop()
				// fail 通道必然是传输层故障（断网/断流/超时中止）：原始 errMsg 只进日志，不进用户界面。
				console.warn('[agent-stream] 传输失败:', error?.errMsg)
				reject(new Error(TRANSPORT_ERROR_TEXT))
			}
		}

		// #ifdef MP-WEIXIN
		task = wx.request(options)
		if (task.onChunkReceived) {
			// 看门狗只在分块通道上武装：挂起的流不会触发 success/fail，必须主动 abort 收口，
			// 否则 isRunning 永久为真、整页 busy 冻结（2026-09-17 预览环境整页失联的根因）。
			watchdog = createIdleWatchdog(STREAM_IDLE_TIMEOUT_MS, () => {
				reject(new Error('回答流超时，请重试'))
				task.abort()
			})
			task.onChunkReceived(({ data }) => {
				watchdog.kick()
				try {
					receivedChunk = true
					decoder.push(data)
				} catch (error) {
					task.abort()
					reject(error)
				}
			})
		}
		// #endif

		// #ifndef MP-WEIXIN
		task = uni.request(options)
		// #endif
	})

	return {
		promise,
		abort: () => task?.abort?.()
	}
}

const consumeFinalResponse = (data, decoder, onEvent) => {
	if (data instanceof ArrayBuffer) {
		decoder.end(data)
		return
	}
	String(data || '').split('\n').forEach(line => {
		const value = line.trim()
		if (value) onEvent(JSON.parse(value))
	})
}
