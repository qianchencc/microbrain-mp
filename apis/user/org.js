import request from '../request'

// 公司列表
export const fecthAllBranch = (data) => request.globalRequest('/org/all/branch', 'GET')