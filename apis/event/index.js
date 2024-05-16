import request from './api.js'

// 列表查询
export const fetchEventTypeList = params => request.globalRequest(`/api/event/eventType/list`,'GET', params)

// 事件上报
export const eventReport = data => request.globalRequest(`/api/event/eventReport/`, 'POST', data)