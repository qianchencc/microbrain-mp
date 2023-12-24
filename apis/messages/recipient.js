import request from './api.js'

// 用户消息分页查询
export const fetchNotifyPage = (params) => request.globalRequest('/api/message/recipient/notify/page', 'GET', params)

// 统计未读
export const fetchUnreadNotifyCount = () => request.globalRequest('/api/message/recipient/notify/count/unread', 'GET', null)

// 更新已读
export const changeMesState = (recipientId, targetType) => request.globalRequest(`/message/recipient/notify/${recipientId}/read/${targetType}`, 'GET')

//查询系统消息
export const getMyMessage = () => request.globalRequest(`/api/message/recipient/notify/my/all`, 'GET', null)

// 我的动态 - 分页查询
export const fetchMyNewsPage = (params) => request.globalRequest('/futurecommunity/mini/myNews/page', 'GET', params)

// 社区动态 - 分页查询
export const fetchCommunityNewsPage = (params) => request.globalRequest('/futurecommunity/mini/communityNews/page', 'GET', params)