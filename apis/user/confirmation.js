import request from '../request'

// 新增确权
export const createConfirmation = (data) => request.globalRequest('/confirmation/account/', 'POST', data)

// 我的确权信息
export const fecthMyConfirmation = () => request.globalRequest('/confirmation/account/my')