import globalConfig from '@/config'
import { getAgentHeaders } from '@/utils/agent-session'
import { createIdleWatchdog } from './idle-watchdog.mjs'
import { createNdjsonStreamDecoder, parseBufferedJson } from './ndjson.mjs'
import { transportError, createTerminalTracker } from './stream-errors.mjs'
import { requestJson } from './request.mjs'

const STREAM_IDLE_TIMEOUT_MS = 60000
const STREAM_REQUEST_TIMEOUT_MS = 300000
const CONFIRM_REQUEST_TIMEOUT_MS = 180000

const request = (url, method, data, timeout) => requestJson(globalConfig.agentUrl + url, method, data, getAgentHeaders(), timeout)

export const createConversation = () => request('/agent/conversations', 'POST')
export const restoreConversation = () => request('/agent/conversations/current', 'GET')
export const clearConversation = id => request(`/agent/conversations/${id}`, 'DELETE')
export const discardTurn = (conversationId, turnId) => request(`/agent/conversations/${conversationId}/turns/${turnId}`, 'DELETE')
export const confirmAction = (draftId, revision) => request(`/agent/action-drafts/${draftId}/confirm`, 'POST', { revision }, CONFIRM_REQUEST_TIMEOUT_MS)
export const updateSelection = (draftId, revision, selectedActionIds) => request(`/agent/action-drafts/${draftId}/selection`, 'PATCH', { revision, selectedActionIds })
export const retrySummary = draftId => request(`/agent/action-drafts/${draftId}/summary`, 'POST')
export const readDeviceStates = draftId => request(`/agent/action-drafts/${draftId}/device-states`, 'GET')
export const updateParameters = (draftId, revision, changes) => request(`/agent/action-drafts/${draftId}/parameters`, 'PATCH', { revision, changes })
export const revalidateAction = (draftId, revision) => request(`/agent/action-drafts/${draftId}/revalidate`, 'POST', { revision })
export const restoreAction = (draftId, revision) => request(`/agent/action-drafts/${draftId}/restore`, 'POST', { revision })
export const cancelAction = draftId => request(`/agent/action-drafts/${draftId}/cancel`, 'POST')
export const cancelRun = conversationId => request(`/agent/conversations/${conversationId}/runs/cancel`, 'POST')

export const streamMessage = (conversationId, content, onEvent) => {
	let task, watchdog, receivedChunk = false
	const terminal = createTerminalTracker()
	const decoder = createNdjsonStreamDecoder(event => {
		terminal.track(event)
		if (event?.type !== 'heartbeat') onEvent(event)
	})
	const promise = new Promise((resolve, reject) => {
		const options = {
			url: `${globalConfig.agentUrl}/agent/conversations/${conversationId}/messages`,
			method: 'POST',
			data: { content },
			dataType: 'text',
			responseType: 'arraybuffer',
			header: getAgentHeaders(true),
			enableChunked: true,
			timeout: STREAM_REQUEST_TIMEOUT_MS,
			success: response => {
				watchdog?.stop()
				try {
					if (!receivedChunk) consumeFinalResponse(response.data, decoder, event => { terminal.track(event); onEvent(event) })
					else decoder.end()
					if (response.statusCode >= 200 && response.statusCode < 300) {
						if (terminal.seen) resolve()
						else reject(transportError())
					} else {
						const body = parseErrorBody(response.data)
						const error = body?.message ? new Error(body.message) : transportError()
						if (body) error.data = body
						reject(error)
					}
				} catch (error) { reject(error) }
			},
			fail: error => {
				watchdog?.stop()
				console.warn('[agent-stream] 传输失败:', error?.errMsg)
				reject(transportError())
			}
		}

		// #ifdef MP-WEIXIN
		task = wx.request(options)
		if (task.onChunkReceived) {
			watchdog = createIdleWatchdog(STREAM_IDLE_TIMEOUT_MS, () => {
				reject(new Error('回答流超时，请重试'))
				task.abort()
			})
			task.onChunkReceived(({ data }) => {
				watchdog.kick()
				try { receivedChunk = true; decoder.push(data) }
				catch (error) { task.abort(); reject(error) }
			})
		}
		// #endif

		// #ifndef MP-WEIXIN
		task = uni.request(options)
		// #endif
	})

	return { promise, abort: () => task?.abort?.() }
}

const parseErrorBody = data => {
	if (!data) return null
	if (typeof data === 'object' && !(data instanceof ArrayBuffer)) return data
	try { return parseBufferedJson(data) } catch { return null }
}

const consumeFinalResponse = (data, decoder, onEvent) => {
	if (data instanceof ArrayBuffer) { decoder.end(data); return }
	String(data || '').split('\n').forEach(line => { const value = line.trim(); if (value) onEvent(JSON.parse(value)) })
}
