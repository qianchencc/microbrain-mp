import request from './api.js'

// 附件分页查询
export const fecthFilePage = data => request.globalRequest(`/api/setting/attachment/page`, 'GET', data)

// ai查询
export const chatToAi = data => request.globalRequest(`/api/ai/business/coze/chat/chat`, 'POST', data)

// 项目查询
export const chatToAiProject = userInput => request.globalRequest(`/api/ai/app/projectBaseInfo/page/ai`, 'GET', { userInput })

// 根据项目编号查询项目详情
export const fetchProjectDetail = data => request.globalRequest(`/api/ai/app/${data.type}/projectNo/${data.code}`, 'GET')
