import { agentUrl, getAgentHeaders } from '@/config'
import { createNdjsonStreamDecoder } from './ndjson.mjs'
import { requestJson } from './request.mjs'

const getHeaders = (includeJson = false) => {
	const headers = getAgentHeaders()
	if (includeJson) headers['content-type'] = 'application/json'
	return headers
}

const request = (url, method, data) => requestJson(agentUrl + url, method, data, getHeaders())

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

export const cancelAction = draftId => request(`/agent/action-drafts/${draftId}/cancel`, 'POST')

export const streamMessage = (conversationId, content, onEvent) => {
	let task
	let receivedChunk = false
	const decoder = createNdjsonStreamDecoder(onEvent)
	const promise = new Promise((resolve, reject) => {
		const options = {
			url: `${agentUrl}/agent/conversations/${conversationId}/messages`,
			method: 'POST',
			data: { content },
			dataType: 'text',
			responseType: 'arraybuffer',
			header: getHeaders(true),
			enableChunked: true,
			success: response => {
				try {
					if (!receivedChunk) consumeFinalResponse(response.data, decoder, onEvent)
					else decoder.end()
					if (response.statusCode >= 200 && response.statusCode < 300) resolve()
					else reject(new Error('请求处理失败'))
				} catch (error) {
					reject(error)
				}
			},
			fail: error => reject(new Error(error.errMsg || '网络连接失败'))
		}

		// #ifdef MP-WEIXIN
		task = wx.request(options)
		if (task.onChunkReceived) {
			task.onChunkReceived(({ data }) => {
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
