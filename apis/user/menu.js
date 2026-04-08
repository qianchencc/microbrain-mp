import request from './api.js'

// 获取全部资源树
export const getMenuTree = () => request.globalRequest('/menu/tree', 'GET')

// 根据module获取当前用户资源树
export const getUserMenuTree = (module) => request.globalRequest(`/identity/resource/tree/${module}/module/grant`, 'GET')

// 获取资源树
export const getResourceTree = params => request.globalRequest('/resource/current/user/resource/v2', 'GET', params)

// 新增应用点击
export const createAppDailyActivity = data => request.globalRequest('/futurecommunity/appDailyActivity', 'POST', data)

// 获取三方ticket
export const getOtherTicket = () => request.globalRequest('/to/account/third/ticket', 'POST')
