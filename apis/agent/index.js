import globalConfig from '@/config'
import { getAgentHeaders } from '@/utils/agent-session'
import { createIdleWatchdog } from './idle-watchdog.mjs'
import { createNdjsonStreamDecoder, parseBufferedJson } from './ndjson.mjs'
import { transportError, createTerminalTracker } from './stream-errors.mjs'
import { requestJson } from './request.mjs'
import { conversationSourceBody, withConversationSource } from './conversation-source.mjs'

const STREAM_IDLE_TIMEOUT_MS = 60000
const STREAM_REQUEST_TIMEOUT_MS = 300000
const CONFIRM_REQUEST_TIMEOUT_MS = 180000

const request = (url, method, data, timeout) => requestJson(globalConfig.agentUrl + url, method, data, getAgentHeaders(), timeout)

export const createConversation = (source = 'office') => request('/agent/conversations', 'POST', conversationSourceBody(source))
export const getCompanyDashboard = () => request('/agent/dashboard?source=company', 'GET')
export const listRegions = () => request('/agent/regions', 'GET')
export const markRegionSeen = regionId => request(`/agent/regions/${encodeURIComponent(regionId)}/seen`, 'POST')
export const listRegionDevices = regionId => request(`/agent/regions/${encodeURIComponent(regionId)}/devices`, 'GET')
export const listRegionDeviceStates = regionId => request(`/agent/regions/${encodeURIComponent(regionId)}/device-states`, 'GET')
export const listRegionTimeline = (regionId, date) => request(`/agent/regions/${encodeURIComponent(regionId)}/timeline?date=${encodeURIComponent(date)}`, 'GET')
export const listRegionCalendar = (regionId, from, to) => request(`/agent/regions/${encodeURIComponent(regionId)}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, 'GET')
export const getTaskDetail = taskId => request(`/agent/tasks/${encodeURIComponent(taskId)}`, 'GET')
export const getTaskLightingStates = taskId => request(`/agent/tasks/${encodeURIComponent(taskId)}/lighting-states`, 'GET')
export const cancelTask = (taskId, version) => request(`/agent/tasks/${encodeURIComponent(taskId)}/cancel`, 'POST', { version })
export const confirmTask = (taskId, version) => request(`/agent/tasks/${encodeURIComponent(taskId)}/confirm`, 'POST', { version })
export const discardTask = taskId => request(`/agent/tasks/${encodeURIComponent(taskId)}/discard`, 'POST')
export const confirmTaskCancellation = cancellationId => request(`/agent/task-cancellations/${encodeURIComponent(cancellationId)}/confirm`, 'POST')
export const discardTaskCancellation = cancellationId => request(`/agent/task-cancellations/${encodeURIComponent(cancellationId)}/discard`, 'POST')
export const listDeviceTimeline = (deviceId, date) => request(`/agent/devices/${encodeURIComponent(deviceId)}/timeline?date=${encodeURIComponent(date)}`, 'GET')
// 视频取流：返回短时效播放地址（wss），不缓存；页面与组件不接触凭据。
export const getVideoStream = deviceId => request(`/agent/devices/${encodeURIComponent(deviceId)}/video-stream`, 'GET')
export const listDeviceCalendar = (deviceId, from, to) => request(`/agent/devices/${encodeURIComponent(deviceId)}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, 'GET')
export const restoreConversation = (source = 'office') => request(withConversationSource('/agent/conversations/current', source), 'GET')
export const clearConversation = (id, source = 'office') => request(withConversationSource(`/agent/conversations/${id}`, source), 'DELETE')
export const discardTurn = (conversationId, turnId, source = 'office') => request(withConversationSource(`/agent/conversations/${conversationId}/turns/${turnId}`, source), 'DELETE')
export const confirmAction = (draftId, revision, source = 'office') => request(withConversationSource(`/agent/action-drafts/${draftId}/confirm`, source), 'POST', { revision }, CONFIRM_REQUEST_TIMEOUT_MS)
export const updateSelection = (draftId, revision, selectedActionIds, source = 'office') => request(withConversationSource(`/agent/action-drafts/${draftId}/selection`, source), 'PATCH', { revision, selectedActionIds })
export const retrySummary = (draftId, source = 'office') => request(withConversationSource(`/agent/action-drafts/${draftId}/summary`, source), 'POST')
export const readDeviceStates = (draftId, source = 'office') => request(withConversationSource(`/agent/action-drafts/${draftId}/device-states`, source), 'GET')
export const updateParameters = (draftId, revision, changes, source = 'office') => request(withConversationSource(`/agent/action-drafts/${draftId}/parameters`, source), 'PATCH', { revision, changes })
export const revalidateAction = (draftId, revision, source = 'office') => request(withConversationSource(`/agent/action-drafts/${draftId}/revalidate`, source), 'POST', { revision })
export const restoreAction = (draftId, revision, source = 'office') => request(withConversationSource(`/agent/action-drafts/${draftId}/restore`, source), 'POST', { revision })
export const cancelAction = (draftId, source = 'office') => request(withConversationSource(`/agent/action-drafts/${draftId}/cancel`, source), 'POST')
export const cancelRun = (conversationId, source = 'office') => request(withConversationSource(`/agent/conversations/${conversationId}/runs/cancel`, source), 'POST')

export const streamMessage = (conversationId, content, onEvent, focusRegionId, source = 'office', reference) => {
	let task, watchdog, receivedChunk = false
	const terminal = createTerminalTracker()
	const decoder = createNdjsonStreamDecoder(event => {
		terminal.track(event)
		if (event?.type !== 'heartbeat') onEvent(event)
	})
	const promise = new Promise((resolve, reject) => {
		const options = {
			url: `${globalConfig.agentUrl}${withConversationSource(`/agent/conversations/${conversationId}/messages`, source)}`,
			method: 'POST',
			data: { content, ...(focusRegionId ? { focusRegionId } : {}), ...(reference ? { reference } : {}) },
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
