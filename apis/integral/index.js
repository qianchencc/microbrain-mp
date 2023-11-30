import request from '../request'

// 获取用户积分流水日志  fetchIntegral
export const fetchIntegralLogs = (data) => request.globalRequest('/integral/app/integral/user/account/logs', 'GET', data)

// 获取指定积分的排行信息
export const fetchIntegralRank = data => request.globalRequest('/integral/app/integral/user/account/rank', 'GET', data)

// 获取积分排行信息
export const fetchIntegralRankList = data => request.globalRequest('/integral/app/integral/user/account/rank/list', 'GET', data)

// 获取指定积分的收支统计
export const fetchIntegralStatistics = (accountNo, data) => request.globalRequest(`/integral/app/integral/user/account/${accountNo}/statistics`, 'GET', data)

// 获取用户积分账户信息
export const fetchIntegralaAccount = accountType => request.globalRequest(`/integral/app/integral/user/${accountType}/account`, 'GET')

// 积分账户类型 - 列表查询
export const fetchAccountTypeList = data => request.globalRequest('/integral/integral/account/type/list', 'GET', data)