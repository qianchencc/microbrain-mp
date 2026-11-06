import globalConfig from '@/config';
import { getAgentHeaders, getAgentStorageScope } from '@/utils/agent-session';
import { createIdleWatchdog } from './idle-watchdog.mjs';
import { createNdjsonStreamDecoder, parseBufferedJson } from './ndjson.mjs';
import { transportError, createTerminalTracker } from './stream-errors.mjs';
import { requestJson, httpError, recoverDraftRequest } from './request.mjs';
import { downloadReportFile } from './report-download.mjs';
import { conversationSourceBody, withConversationSource } from './conversation-source.mjs';
import { createAgentReadCache } from './agent-read-cache.mjs';
import { createPreparedReader, captureActivityToken } from './read-preparation.mjs';

const STREAM_IDLE_TIMEOUT_MS = 60000;
const STREAM_REQUEST_TIMEOUT_MS = 300000;
const CONFIRM_REQUEST_TIMEOUT_MS = 180000;

const agentReadCache = createAgentReadCache(getAgentStorageScope);
const preparedRead = createPreparedReader(getAgentStorageScope);
export const clearCompanyReadCache = () => agentReadCache.clear();
export const readCompanyDashboardCache = () => agentReadCache.peek('dashboard-snapshot');
export const writeCompanyDashboardCache = (value) =>
  agentReadCache.put('dashboard-snapshot', value);
export const readCompanyMonthlyCache = (key) => agentReadCache.peek(key);
export const writeCompanyMonthlyCache = (key, value) => agentReadCache.put(key, value);
const isPlansRead = (key) => key.includes('/agent/task-plans?');
const isNotificationsRead = (key) => key.includes('/agent/notifications?');
const request = async (url, method, data, timeout, options = {}) => {
  const scope = getAgentStorageScope(),
    headers = getAgentHeaders();
  const sameScope = () => {
    try {
      return scope === getAgentStorageScope();
    } catch {
      return false;
    }
  };
  const changesDevices =
    method !== 'GET' &&
    /\/(action-drafts|tasks|task-plans|task-changes|task-cancellations)\/[^/?]+\/(confirm|cancel)(?:\?|$)/.test(
      url
    );
  // 周期启停与已读只作废各自列表快照：不清空无关概览/统计，也不等待下一次读才发现新状态。
  const changesPlans = method !== 'GET' && /\/task-plans\/[^/?]+\/status(?:\?|$)/.test(url);
  const changesNotifications =
    method !== 'GET' && /\/notifications\/(?:seen-all|[^/?]+\/seen)(?:\?|$)/.test(url);
  if (changesDevices) agentReadCache.clear();
  try {
    const result = await preparedRead(
      () => requestJson(globalConfig.agentUrl + url, method, data, headers, timeout),
      { ...options, snapshot: options.snapshot === true }
    );
    if (changesPlans) agentReadCache.drop(isPlansRead);
    if (changesNotifications) agentReadCache.drop(isNotificationsRead);
    return result;
  } catch (error) {
    if (
      sameScope() &&
      ([401, 403].includes(error.status) || error.code === 'AGENT_SESSION_EXPIRED')
    )
      agentReadCache.clear();
    if (
      method !== 'GET' &&
      /\/action-drafts\/[^/?]+\/(confirm|selection|parameters|restore|revalidate|cancel)(?:\?|$)/.test(
        url
      ) &&
      error.data?.code !== 'ACCOUNT_IDENTITY_PREPARING' &&
      (error.transport || error.status >= 500) &&
      sameScope()
    ) {
      return recoverDraftRequest(
        globalConfig.agentUrl + url,
        method,
        data,
        headers,
        timeout,
        sameScope
      );
    }
    // 仅重放服务端已有幂等保护的确认/管理操作，参数与身份保持原请求。
    const replayable =
      method === 'POST' &&
      /\/(tasks|task-plans|task-changes|task-cancellations)\/[^/?]+\/(confirm|cancel|status)(?:\?|$)/.test(
        url
      );
    if (
      replayable &&
      error.data?.code !== 'ACCOUNT_IDENTITY_PREPARING' &&
      error.data?.recovery?.kind !== 'confirmation_blocked' &&
      (error.transport || error.status >= 500) &&
      sameScope()
    ) {
      return requestJson(globalConfig.agentUrl + url, method, data, headers, timeout);
    }
    throw error;
  } finally {
    if (changesDevices && sameScope()) agentReadCache.clear();
  }
};
const ordinaryRead = (url, timeout, options = {}) =>
  request(url, 'GET', undefined, timeout, { ...options, snapshot: true });
const readSnapshot = (url, timeout, options = {}) =>
  agentReadCache.read(
    options.key || globalConfig.agentUrl + url,
    (activity) => ordinaryRead(url, timeout, { ...options, ...activity }),
    { ...options, activity: captureActivityToken() }
  );
const queryString = (query) =>
  Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

export const createConversation = (source = 'office') =>
  request('/agent/conversations', 'POST', conversationSourceBody(source));
export const getCompanyDashboard = (section, options) =>
  readSnapshot(
    '/agent/dashboard?source=company' + (section ? '&section=' + encodeURIComponent(section) : ''),
    undefined,
    options
  );
export const getSafetyEvent = (reference, options) =>
  ordinaryRead(
    `/agent/safety-events/${encodeURIComponent(reference.eventId)}?source=company&ledger=${encodeURIComponent(reference.ledger)}&deviceId=${encodeURIComponent(reference.deviceId)}`,
    20000,
    options
  );
export const getSafetyEventCameras = (reference, options) =>
  ordinaryRead(
    `/agent/safety-events/${encodeURIComponent(reference.eventId)}/cameras?source=company&ledger=${encodeURIComponent(reference.ledger)}&deviceId=${encodeURIComponent(reference.deviceId)}`,
    20000,
    options
  );
export const listRegions = (section, options) =>
  ordinaryRead(
    '/agent/regions' + (section ? '?section=' + encodeURIComponent(section) : ''),
    undefined,
    options
  );
export const markRegionSeen = (regionId) =>
  request(`/agent/regions/${encodeURIComponent(regionId)}/seen`, 'POST');
export const listRegionDevices = (regionId, options) =>
  ordinaryRead(`/agent/regions/${encodeURIComponent(regionId)}/devices`, undefined, options);
export const listRegionDeviceStates = (regionId, options) =>
  ordinaryRead(`/agent/regions/${encodeURIComponent(regionId)}/device-states`, undefined, options);
export const listRegionTimeline = (regionId, date) =>
  request(
    `/agent/regions/${encodeURIComponent(regionId)}/timeline?date=${encodeURIComponent(date)}`,
    'GET'
  );
export const listRegionCalendar = (regionId, from, to) =>
  request(
    `/agent/regions/${encodeURIComponent(regionId)}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    'GET'
  );
export const getTaskPlan = (planId, source = 'office') =>
  request(withConversationSource(`/agent/task-plans/${encodeURIComponent(planId)}`, source), 'GET');
export const cancelTaskPlan = (planId, version, scope, date, source = 'office') =>
  request(
    withConversationSource(`/agent/task-plans/${encodeURIComponent(planId)}/cancel`, source),
    'POST',
    { version, scope, ...(date ? { date } : {}) }
  );
export const setTaskPlanStatus = (
  planId,
  version,
  operation,
  source = 'office',
  confirmed = false
) =>
  request(
    withConversationSource(`/agent/task-plans/${encodeURIComponent(planId)}/status`, source),
    'POST',
    { version, operation, ...(operation === 'resume' ? { confirmed } : {}) }
  );
export const listAgentTasks = ({ source = 'office', from, to } = {}) =>
  request(
    `/agent/tasks?source=${encodeURIComponent(source)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    'GET'
  );
// 两端任务、周期安排与通知列表共用同身份读取快照：先落位再对齐，60 秒内复用，
// 过期占位最多保留 5 分钟；写操作由 request 定点作废，不替代 fresh 写入核验。
const agentTasksUrl = ({ source = 'company', from, to }) =>
  '/agent/tasks?' + queryString({ source, from, to });
const agentPlansUrl = ({ source = 'company' }) => '/agent/task-plans?' + queryString({ source });
const agentNotificationsUrl = ({ source = 'company', limit = 30, before }) =>
  '/agent/notifications?' + queryString({ source, limit, before });
const peekSnapshot = (url) => {
  try {
    return agentReadCache.peek(globalConfig.agentUrl + url)?.value ?? null;
  } catch {
    return null;
  }
};
export const readAgentTasks = ({ source = 'company', from, to, force = false } = {}) =>
  readSnapshot(agentTasksUrl({ source, from, to }), undefined, { force });
export const peekAgentTasks = ({ source = 'company', from, to } = {}) =>
  peekSnapshot(agentTasksUrl({ source, from, to }));
// 日历月窗口另立快照键：整格按默认 60 秒新鲜度对齐。历史月不再视为不可变——
// 跨月未完任务的结果会随窗口读取推进（历史月不新增任务，但结果可以迟到）；
// 实时推进仍只走当日 #calendar-day。
const calendarUrl = ({ source = 'company', from, to }, suffix = '#calendar') =>
  globalConfig.agentUrl + agentTasksUrl({ source, from, to }) + suffix;
export const readAgentCalendar = ({ source = 'company', from, to, force = false } = {}) =>
  readSnapshot(agentTasksUrl({ source, from, to }), undefined, {
    key: calendarUrl({ source, from, to }),
    force,
  });
export const peekAgentCalendar = ({ source = 'company', from, to } = {}) => {
  try {
    return agentReadCache.peek(calendarUrl({ source, from, to }))?.value ?? null;
  } catch {
    return null;
  }
};
export const readAgentCalendarDay = ({ source = 'company', from, to, force = false } = {}) =>
  readSnapshot(agentTasksUrl({ source, from, to }), undefined, {
    key: calendarUrl({ source, from, to }, '#calendar-day'),
    force,
  });
export const readAgentPlans = ({ source = 'company', force = false } = {}) =>
  readSnapshot(agentPlansUrl({ source }), undefined, { force });
export const peekAgentPlans = ({ source = 'company' } = {}) =>
  peekSnapshot(agentPlansUrl({ source }));
export const AGENT_NOTIFICATION_PAGE = 30;
export const readAgentNotifications = ({
  source = 'company',
  limit = AGENT_NOTIFICATION_PAGE,
  before,
  force = false,
} = {}) => readSnapshot(agentNotificationsUrl({ source, limit, before }), undefined, { force });
export const peekAgentNotifications = ({
  source = 'company',
  limit = AGENT_NOTIFICATION_PAGE,
  before,
} = {}) => peekSnapshot(agentNotificationsUrl({ source, limit, before }));
export const getTaskDetail = (taskId, source = 'office') =>
  request(withConversationSource(`/agent/tasks/${encodeURIComponent(taskId)}`, source), 'GET');
export const markNotificationSeen = (id, source = 'office') =>
  request(
    withConversationSource(`/agent/notifications/${encodeURIComponent(id)}/seen`, source),
    'POST'
  );
export const markAllNotificationsSeen = (source = 'office') =>
  request(withConversationSource('/agent/notifications/seen-all', source), 'POST');
export const getTaskLightingStates = (taskId, source = 'office', options) =>
  ordinaryRead(
    withConversationSource(`/agent/tasks/${encodeURIComponent(taskId)}/lighting-states`, source),
    undefined,
    options
  );
export const cancelTask = (taskId, version, source = 'office') =>
  request(
    withConversationSource(`/agent/tasks/${encodeURIComponent(taskId)}/cancel`, source),
    'POST',
    { version }
  );
export const confirmTask = (taskId, version, source = 'office') =>
  request(
    withConversationSource(`/agent/tasks/${encodeURIComponent(taskId)}/confirm`, source),
    'POST',
    { version }
  );
export const discardTask = (taskId, source = 'office') =>
  request(
    withConversationSource(`/agent/tasks/${encodeURIComponent(taskId)}/discard`, source),
    'POST'
  );
export const confirmTaskChange = (changeId, version, source = 'office') =>
  request(
    withConversationSource(`/agent/task-changes/${encodeURIComponent(changeId)}/confirm`, source),
    'POST',
    { version }
  );
export const discardTaskChange = (changeId, version, source = 'office') =>
  request(
    withConversationSource(`/agent/task-changes/${encodeURIComponent(changeId)}/discard`, source),
    'POST',
    { version }
  );
export const confirmTaskCancellation = (cancellationId, version, source = 'office') =>
  request(
    withConversationSource(
      `/agent/task-cancellations/${encodeURIComponent(cancellationId)}/confirm`,
      source
    ),
    'POST',
    { version }
  );
export const discardTaskCancellation = (cancellationId, version, source = 'office') =>
  request(
    withConversationSource(
      `/agent/task-cancellations/${encodeURIComponent(cancellationId)}/discard`,
      source
    ),
    'POST',
    { version }
  );
export const listDeviceTimeline = (deviceId, date) =>
  request(
    `/agent/devices/${encodeURIComponent(deviceId)}/timeline?date=${encodeURIComponent(date)}`,
    'GET'
  );
// 视频取流：返回短时效播放地址（wss），不缓存；页面与组件不接触凭据。
// Company 监控走智慧页面取流出口，Office 视频走既有 view 动作——必须带 source 区分目录。
export const getVideoStream = (deviceId, source = 'office') =>
  request(
    withConversationSource(`/agent/devices/${encodeURIComponent(deviceId)}/video-stream`, source),
    'GET'
  );
export const listSafetyHistory = (query = {}, options) => {
  const params = queryString(
    Object.fromEntries(Object.entries(query).filter(([, value]) => value != null && value !== ''))
  );
  return readSnapshot(`/agent/safety-events?source=company&${params}`, undefined, options);
};

export const getLatestSafetyEvent = ({ type, deviceId, to = new Date().toISOString() }, options) =>
  ordinaryRead(
    '/agent/safety-events/latest?' + queryString({ source: 'company', type, deviceId, to }),
    undefined,
    options
  );

export const getEnvironmentHistory = (query, options) =>
  ordinaryRead(
    '/agent/environment-history?source=company&' + queryString(query),
    undefined,
    options
  );
export const getEnergyHistory = (query = {}, options) =>
  ordinaryRead('/agent/energy-history?source=company&' + queryString(query), undefined, options);
export const getCompanyDevices = (options) =>
  readSnapshot('/agent/company-devices?source=company', undefined, options);
export const getCompanyEnergyDaily = (query = {}, options) =>
  readSnapshot('/agent/company-energy-daily?source=company&' + queryString(query), 90000, options);
// 计量范围×时间统计（meter-report）：scopeLevel all|floor|location|nameMatch + floor/meterId/text，from/to 带时区，grain 可选。
export const getCompanyMeterReport = (query = {}, options) =>
  readSnapshot('/agent/company-meter-report?source=company&' + queryString(query), 90000, options);
export const listDeviceCalendar = (deviceId, from, to) =>
  request(
    `/agent/devices/${encodeURIComponent(deviceId)}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    'GET'
  );
export const getReportArtifact = (reportId, source = 'company') =>
  request(
    `/agent/reports/${encodeURIComponent(reportId)}?source=${encodeURIComponent(source)}`,
    'GET'
  );
export function downloadReportArtifact(reportId, source = 'company', format = 'pdf', options = {}) {
  return downloadReportFile(
    { reportId, source, format },
    {
      baseUrl: globalConfig.agentUrl,
      getHeaders: getAgentHeaders,
      getScope: getAgentStorageScope,
      downloadFile:
        typeof uni.downloadFile === 'function' ? (options) => uni.downloadFile(options) : undefined,
      openDocument:
        typeof uni.openDocument === 'function' ? (options) => uni.openDocument(options) : undefined,
      isActive: options.isActive,
    }
  );
}
export const restoreConversation = (source = 'office') =>
  request(withConversationSource('/agent/conversations/current', source), 'GET');
export const clearConversation = (id, source = 'office') =>
  request(withConversationSource(`/agent/conversations/${id}`, source), 'DELETE');
export const discardTurn = (conversationId, turnId, source = 'office') =>
  request(
    withConversationSource(`/agent/conversations/${conversationId}/turns/${turnId}`, source),
    'DELETE'
  );
export const confirmAction = (draftId, revision, source = 'office') =>
  request(
    withConversationSource(`/agent/action-drafts/${draftId}/confirm`, source),
    'POST',
    { revision },
    CONFIRM_REQUEST_TIMEOUT_MS
  );
export const updateSelection = (draftId, revision, selectedActionIds, source = 'office') =>
  request(withConversationSource(`/agent/action-drafts/${draftId}/selection`, source), 'PATCH', {
    revision,
    selectedActionIds,
  });
export const retrySummary = (draftId, source = 'office') =>
  request(withConversationSource(`/agent/action-drafts/${draftId}/summary`, source), 'POST');
export const readDeviceStates = (draftId, source = 'office', options) =>
  ordinaryRead(
    withConversationSource(`/agent/action-drafts/${draftId}/device-states`, source),
    undefined,
    options
  );
export const updateParameters = (draftId, revision, changes, source = 'office') =>
  request(withConversationSource(`/agent/action-drafts/${draftId}/parameters`, source), 'PATCH', {
    revision,
    changes,
  });
export const revalidateAction = (draftId, revision, source = 'office') =>
  request(withConversationSource(`/agent/action-drafts/${draftId}/revalidate`, source), 'POST', {
    revision,
  });
export const restoreAction = (draftId, revision, source = 'office') =>
  request(withConversationSource(`/agent/action-drafts/${draftId}/restore`, source), 'POST', {
    revision,
  });
export const cancelAction = (draftId, source = 'office') =>
  request(withConversationSource(`/agent/action-drafts/${draftId}/cancel`, source), 'POST');
export const cancelRun = (conversationId, source = 'office') =>
  request(
    withConversationSource(`/agent/conversations/${conversationId}/runs/cancel`, source),
    'POST'
  );

export const streamMessage = (
  conversationId,
  content,
  onEvent,
  focusRegionId,
  source = 'office',
  reference
) => {
  let task,
    watchdog,
    receivedChunk = false;
  const terminal = createTerminalTracker();
  const publish = (event) => {
    terminal.track(event);
    if (typeof event?.type === 'string' && event.type !== 'heartbeat') onEvent(event);
  };
  const decoder = createNdjsonStreamDecoder(publish);
  const promise = new Promise((resolve, reject) => {
    const options = {
      url: `${globalConfig.agentUrl}${withConversationSource(`/agent/conversations/${conversationId}/messages`, source)}`,
      method: 'POST',
      data: {
        content,
        ...(focusRegionId ? { focusRegionId } : {}),
        ...(reference ? { reference } : {}),
      },
      dataType: 'text',
      responseType: 'arraybuffer',
      header: getAgentHeaders(true),
      enableChunked: true,
      timeout: STREAM_REQUEST_TIMEOUT_MS,
      success: (response) => {
        watchdog?.stop();
        try {
          if (!receivedChunk) consumeFinalResponse(response.data, decoder, publish);
          else decoder.end();
          if (response.statusCode >= 200 && response.statusCode < 300) {
            if (terminal.seen) resolve();
            else reject(transportError());
          } else {
            const body = parseErrorBody(response.data) || terminal.errorBody;
            const error = httpError(response.statusCode, body, '回答请求失败');
            if (body) error.data = body;
            reject(error);
          }
        } catch (error) {
          reject(error);
        }
      },
      fail: (error) => {
        watchdog?.stop();
        console.warn('[agent-stream] 传输失败:', error?.errMsg);
        reject(transportError(error?.errMsg));
      },
    };

    // #ifdef MP-WEIXIN
    task = wx.request(options);
    if (task.onChunkReceived) {
      watchdog = createIdleWatchdog(STREAM_IDLE_TIMEOUT_MS, () => {
        reject(new Error('回答流超时，请重试'));
        task.abort();
      });
      task.onChunkReceived(({ data }) => {
        watchdog.kick();
        try {
          receivedChunk = true;
          decoder.push(data);
        } catch (error) {
          task.abort();
          reject(error);
        }
      });
    }
    // #endif

    // #ifndef MP-WEIXIN
    task = uni.request(options);
    // #endif
  });

  return { promise, abort: () => task?.abort?.() };
};

const parseErrorBody = (data) => {
  if (!data) return null;
  if (typeof data === 'object' && !(data instanceof ArrayBuffer)) return data;
  try {
    return parseBufferedJson(data);
  } catch {
    return null;
  }
};

const consumeFinalResponse = (data, decoder, onEvent) => {
  if (data instanceof ArrayBuffer) {
    decoder.end(data);
    return;
  }
  String(data || '')
    .split('\n')
    .forEach((line) => {
      const value = line.trim();
      if (value) onEvent(JSON.parse(value));
    });
};
