import request from './api.js'

// 公司列表
export const fecthAllBranch = (data) => request.globalRequest('/org/all/branch', 'GET')