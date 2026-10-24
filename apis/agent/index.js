import globalConfig from '@/config'
import { getAgentHeaders, getAgentStorageScope } from '@/utils/agent-session'
import { createIdleWatchdog } from './idle-watchdog.mjs'
import { createNdjsonStreamDecoder, parseBufferedJson } from './ndjson.mjs'
import { transportError, createTerminalTracker } from './stream-errors.mjs'
import { requestJson, httpError } from './request.mjs'
import { downloadReportFile } from './report-download.mjs'
import { conversationSourceBody, withConversationSource } from './conversation-source.mjs'
import { createCompanyReadCache } from './company-read-cache.mjs'

const STREAM_IDLE_TIMEOUT_MS = 60000
const STREAM_REQUEST_TIMEOUT_MS = 300000
const CONFIRM_REQUEST_TIMEOUT_MS = 180000

export const companyOverviewCache = createCompanyReadCache(getAgentStorageScope)
const request = async (url, method, data, timeout) => {
 const scope = getAgentStorageScope(), headers = getAgentHeaders()
 const changesDevices = method !== 'GET' && /\/(action-drafts|tasks|task-plans|task-changes|task-cancellations)\/[^/?]+\/(confirm|cancel)(?:\?|$)/.test(url)
 if (changesDevices) companyOverviewCache.clear()
 try {
  const result = await requestJson(globalConfig.agentUrl + url, method, data, headers, timeout)
  return result
 } catch (error) {
  if ([401, 403].includes(error.status) || error.code === 'AGENT_SESSION_EXPIRED') companyOverviewCache.clear()
  // 仅重放服务端已有幂等保护的确认/管理操作，参数与身份保持原请求。
  const replayable = method === 'POST' && /\/(tasks|task-plans|task-changes|task-cancellations)\/[^/?]+\/(confirm|cancel|status)(?:\?|$)/.test(url)
  if (replayable && (error.transport || error.status >= 500) && scope === getAgentStorageScope()) {
   return requestJson(globalConfig.agentUrl + url, method, data, headers, timeout)
  }
  throw error
 } finally {
  if (changesDevices) companyOverviewCache.clear()
 }
}
const companyRead = (url, timeout, options = {}) => companyOverviewCache.read(globalConfig.agentUrl + url, () => request(url, 'GET', undefined, timeout), options.force === true)
const queryString = query => Object.entries(query).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')

export const createConversation = (source = 'office') => request('/agent/conversations', 'POST', conversationSourceBody(source))
export const getCompanyDashboard = (section, options) => companyRead('/agent/dashboard?source=company' + (section ? '&section=' + encodeURIComponent(section) : ''), undefined, options)
export const getSafetyEvent = reference => request(`/agent/safety-events/${encodeURIComponent(reference.eventId)}?source=company&ledger=${encodeURIComponent(reference.ledger)}&deviceId=${encodeURIComponent(reference.deviceId)}`, 'GET', undefined, 20000)
export const getSafetyEventCameras = reference => request(`/agent/safety-events/${encodeURIComponent(reference.eventId)}/cameras?source=company&ledger=${encodeURIComponent(reference.ledger)}&deviceId=${encodeURIComponent(reference.deviceId)}`, 'GET', undefined, 20000)
export const listRegions = section => request('/agent/regions' + (section ? '?section=' + encodeURIComponent(section) : ''), 'GET')
export const markRegionSeen = regionId => request(`/agent/regions/${encodeURIComponent(regionId)}/seen`, 'POST')
export const listRegionDevices = regionId => request(`/agent/regions/${encodeURIComponent(regionId)}/devices`, 'GET')
export const listRegionDeviceStates = regionId => request(`/agent/regions/${encodeURIComponent(regionId)}/device-states`, 'GET')
export const listRegionTimeline = (regionId, date) => request(`/agent/regions/${encodeURIComponent(regionId)}/timeline?date=${encodeURIComponent(date)}`, 'GET')
export const listRegionCalendar = (regionId, from, to) => request(`/agent/regions/${encodeURIComponent(regionId)}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, 'GET')
export const getTaskPlan = (planId, source = 'office') => request(withConversationSource(`/agent/task-plans/${encodeURIComponent(planId)}`, source), 'GET')
export const cancelTaskPlan = (planId, version, scope, date, source = 'office') => request(withConversationSource(`/agent/task-plans/${encodeURIComponent(planId)}/cancel`, source), 'POST', { version, scope, ...(date ? { date } : {}) })
export const setTaskPlanStatus = (planId, version, operation, source = 'office', confirmed = false) => request(withConversationSource(`/agent/task-plans/${encodeURIComponent(planId)}/status`, source), 'POST', { version, operation, ...(operation === 'resume' ? { confirmed } : {}) })
export const listTaskPlans = ({ source = 'office' } = {}) => request(`/agent/task-plans?source=${encodeURIComponent(source)}`, 'GET')
export const listAgentTasks = ({ source = 'office', from, to } = {}) => request(`/agent/tasks?source=${encodeURIComponent(source)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, 'GET')
export const getTaskDetail = (taskId, source = 'office') => request(withConversationSource(`/agent/tasks/${encodeURIComponent(taskId)}`, source), 'GET')
export const listNotifications = ({ source = 'office', limit = 30, before } = {}) => request(`/agent/notifications?source=${encodeURIComponent(source)}&limit=${encodeURIComponent(limit)}${before ? `&before=${encodeURIComponent(before)}` : ''}`, 'GET')
export const markNotificationSeen = (id, source = 'office') => request(withConversationSource(`/agent/notifications/${encodeURIComponent(id)}/seen`, source), 'POST')
export const markAllNotificationsSeen = (source = 'office') => request(withConversationSource('/agent/notifications/seen-all', source), 'POST')
export const getTaskLightingStates = taskId => request(`/agent/tasks/${encodeURIComponent(taskId)}/lighting-states`, 'GET')
export const cancelTask = (taskId, version, source = 'office') => request(withConversationSource(`/agent/tasks/${encodeURIComponent(taskId)}/cancel`, source), 'POST', { version })
export const confirmTask = (taskId, version, source = 'office') => request(withConversationSource(`/agent/tasks/${encodeURIComponent(taskId)}/confirm`, source), 'POST', { version })
export const discardTask = (taskId, source = 'office') => request(withConversationSource(`/agent/tasks/${encodeURIComponent(taskId)}/discard`, source), 'POST')
export const confirmTaskChange = (changeId, source = 'office') => request(withConversationSource(`/agent/task-changes/${encodeURIComponent(changeId)}/confirm`, source), 'POST')
export const discardTaskChange = (changeId, source = 'office') => request(withConversationSource(`/agent/task-changes/${encodeURIComponent(changeId)}/discard`, source), 'POST')
export const confirmTaskCancellation = (cancellationId, source = 'office') => request(withConversationSource(`/agent/task-cancellations/${encodeURIComponent(cancellationId)}/confirm`, source), 'POST')
export const discardTaskCancellation = (cancellationId, source = 'office') => request(withConversationSource(`/agent/task-cancellations/${encodeURIComponent(cancellationId)}/discard`, source), 'POST')
export const listDeviceTimeline = (deviceId, date) => request(`/agent/devices/${encodeURIComponent(deviceId)}/timeline?date=${encodeURIComponent(date)}`, 'GET')
// 视频取流：返回短时效播放地址（wss），不缓存；页面与组件不接触凭据。
// Company 监控走智慧页面取流出口，Office 视频走既有 view 动作——必须带 source 区分目录。
export const getVideoStream = (deviceId, source = 'office') => request(withConversationSource(`/agent/devices/${encodeURIComponent(deviceId)}/video-stream`, source), 'GET')
export const listSafetyHistory = (query = {}) => {
 const params = Object.entries(query).filter(([, value]) => value != null && value !== '').map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')
 return request(`/agent/safety-events?source=company&${params}`, 'GET')
}

export const getEnvironmentHistory = (query) => request('/agent/environment-history?source=company&' + Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&'), 'GET')
export const getEnergyHistory = (query = {}) => request('/agent/energy-history?source=company&' + Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&'), 'GET')
export const getCompanyDevices = (options) => companyRead('/agent/company-devices?source=company', undefined, options)
export const getCompanyEnergyDaily = (query = {}, options) => companyRead('/agent/company-energy-daily?source=company&' + queryString(query), 90000, options)
// 计量范围×时间统计（meter-report）：scopeLevel all|floor|location|nameMatch + floor/meterId/text，from/to 带时区，grain 可选。
export const getCompanyMeterReport = (query = {}, options) => companyRead('/agent/company-meter-report?source=company&' + queryString(query), 90000, options)
export const listDeviceCalendar = (deviceId, from, to) => request(`/agent/devices/${encodeURIComponent(deviceId)}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, 'GET')
export const getReportArtifact = (reportId, source = 'company') => request(`/agent/reports/${encodeURIComponent(reportId)}?source=${encodeURIComponent(source)}`, 'GET')
export function downloadReportArtifact(reportId, source = 'company', format = 'pdf', options = {}) {
 return downloadReportFile({ reportId, source, format }, {
  baseUrl: globalConfig.agentUrl,
  getHeaders: getAgentHeaders,
  getScope: getAgentStorageScope,
  downloadFile: typeof uni.downloadFile === 'function' ? options => uni.downloadFile(options) : undefined,
  openDocument: typeof uni.openDocument === 'function' ? options => uni.openDocument(options) : undefined,
  isActive: options.isActive,
 })
}
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
						const error = httpError(response.statusCode, body, '回答请求失败')
						if (body) error.data = body
						reject(error)
					}
				} catch (error) { reject(error) }
			},
			fail: error => {
				watchdog?.stop()
				console.warn('[agent-stream] 传输失败:', error?.errMsg)
				reject(transportError(error?.errMsg))
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
