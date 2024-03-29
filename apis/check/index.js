import request from './api.js'

//巡更记录信息
export const fetchPatrolRecordInfo = params => request.globalRequest('/api/patrol/patrolRecord/page', 'GET', params)

//id查询记录详情
export const patrolRecordDetail = id => request.globalRequest(`/api/patrol/patrolRecord/detail/${id}`, 'GET')

// 关闭任务
export const closePatrolRecord = id => request.globalRequest(`/api/patrol/patrolRecord/finish/${id}`, 'POST')

//获取记录任务列表
export const fetchPatrolRecordList = params => request.globalRequest('/api/patrol/patrolRecord/list', 'GET', params)

//id查询巡更点记录
export const getSignById = id => request.globalRequest(`/api/patrol/patrolPointRecord/${id}`, 'GET')

// 签到
export const signIn = data => request.globalRequest(`/api/patrol/patrolPointRecord/signIn`, 'POST', data)

// 上传文件
export const uploadFile = data => request.globalRequest(`/api/setting/file/upload`, 'POST', data)

// 下载文件
export const downloadFile = data => request.globalRequest(`/api/setting/file/download`, 'POST', data)

// 提交检查结果
export const postCheckResult = data => request.globalRequest(`/api/patrol/patrolPointRecord/postCheckResult`, 'POST', data)

//我的任务统计
export const fetchMyTask = params => request.globalRequest('/api/patrol/patrolRecord/myTask', 'GET', params)

//我的任务统计
export const fetchMyEqpTask = params => request.globalRequest('/api/patrol/patrolRecord/myTask/inspection', 'GET', params)

//获取巡更路线下的巡更点
export const fetchPathNodeList = params => request.globalRequest('/api/patrol/patrolPathNode/list', 'GET', params)

//id查询记录详情
export const patrolPathName = id => request.globalRequest(`/api/patrol/patrolPath/${id}`, 'GET')

//id查询对应巡更路线
export const fatchPatrolPath = id => request.globalRequest(`/api/patrol/patrolPoint/statistics/${id}`, 'GET')

//根据巡更点id查询检查项
export const fatchPointCheckItem = id => request.globalRequest(`/api/patrol/patrolPointCheckItem/${id}`, 'GET')

//根据巡更点id查询巡更点详情，显示巡更点名称
export const fatchPointInfo = id => request.globalRequest(`/api/patrol/patrolPoint/${id}`, 'GET')

// 根据巡更ID查询巡更详情
export const getPatrolInfo = id => request.globalRequest(`/api/patrol/patrolPoint/record/${id}`, 'GET')

// 根据巡更ID查询巡更详情
export const getPatrolInfoByCode = eqpNumber => request.globalRequest(`/api/patrol/patrolPoint/record/by/enumber/${eqpNumber}`, 'GET')

// 获取巡更记录分页
export const fetchPatrolRecordPage = data =>request.globalRequest('/api/patrol/patrolRecord/page', 'GET', data)

// 巡更点照片记录列表查询
export const fetchPatrolPointPicRecord = (patrolPointRecordId) => request.globalRequest(`/api/patrol/patrolPointPicRecord/list/${patrolPointRecordId}`)

// 列表查询
export const fetchEventTypeList = params => request.globalRequest(`/api/event/eventType/list`,'GET', params)
