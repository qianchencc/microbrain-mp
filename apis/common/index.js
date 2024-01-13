import request from './api.js'

// 附件分页查询
export const fecthFilePage = data => request.globalRequest(`/api/setting/attachment/page`, 'GET', data)