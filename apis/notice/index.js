import request from '../request'

// 用户消息分页查询
export const fetchNoticePage = (params) => request.globalRequest('/publish/publishInfo/page', 'GET', params)

// 统计未读
export const fetchNoticeList = () => request.globalRequest('/publish/publishInfo/list', 'GET')

//查询系统消息
export const getNotice = (id) => request.globalRequest(`/publish/publishInfo/${id}`, 'GET')