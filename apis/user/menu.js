import request from '../request'

// 获取全部资源树
export const getMenuTree = () => request.globalRequest('menu/tree', 'GET')

// 根据module获取当前用户资源树
export const getUserMenuTree = (module) => request.globalRequest(`/identity/resource/tree/${module}/module/grant`, 'GET')

// 获取资源树
export const getResourceTree = params => request.globalRequest('/identity/resource/current/tree/', 'GET', params)

// 新增应用点击
export const createAppDailyActivity = data => request.globalRequest('/futurecommunity/appDailyActivity', 'POST', data)
