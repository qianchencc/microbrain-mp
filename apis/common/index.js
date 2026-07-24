import request from './api.js'

// 附件分页查询
export const fecthFilePage = data => request.globalRequest(`/api/setting/attachment/page`, 'GET', data)

// ai查询
export const chatToAi = data => request.globalRequest(`/api/ai/business/coze/chat/chat`, 'POST', data)

// ai查询项目
export const chatToAiProject = data => request.globalRequest(`/api/ai/business/coze/chat/chat/project`, 'POST', data)
