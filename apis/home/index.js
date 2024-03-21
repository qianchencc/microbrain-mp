import request from './api.js'

// 首页banner
export const fetchBanner = () => request.globalRequest('/api/publish/banner/current', 'GET')

// 新闻发布记录
export const fetchNewsPage = (data) => request.globalRequest('/api/publish/history/page', 'GET', data)

// 新闻详情
export const fetchNewsById = (id) => request.globalRequest(`/api/publish/history/${id}`, 'GET')

// 消息提醒
export const fetchRemindPage = (type, data) => request.globalRequest(`/api/${type}/remind/setting/page`, 'GET', data)

// 提交人脸
export const uploadPrincipalFace = (id, data) => request.globalRequest(`/api/card/account/${id}/face`, 'PUT', data)

// 一卡通个人账号查询
export const fetchCardPrincipalInfo = (id) => request.globalRequest(`/api/card/account/${id}`)

// 查询当前卡号
export const fetchCurrentUsed = () => request.globalRequest('/api/card/account/card/current/used', 'GET')