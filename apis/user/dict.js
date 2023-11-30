import request from '../request'

// 新增
export const createSysDict = (data) => request.globalRequest('/setting/normalDict/save/', 'POST', data)
// 删除
export const removeSysDict = (id) => request.globalRequest(`/setting/normalDict/${id}`, 'DELETE')
// 更新
export const updateSysDict = (data) => request.globalRequest('/setting/normalDict/update', 'PUT', data)
// 查询
export const getSysDict = (id) => request.globalRequest(`/setting/normalDict/${id}`, 'GET')
// 列表查询
export const fetchSysDictList = (data) => request.globalRequest('/setting/normalDict/list', 'POST', data)
// 分页查询
export const fetchSysDictPage = (data) => request.globalRequest('/setting/normalDict/page', 'POST', data)
// 获取所有字典Map格式
export const getAllDictMap = () => request.globalRequest('/setting/normalDict/allMap', 'GET')
