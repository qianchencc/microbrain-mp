import request from './api.js'

// 新增确权
export const createConfirmation = (data) => request.globalRequest('/confirmation/account/', 'POST', data)

// 我的确权信息
export const fecthMyConfirmation = () => request.globalRequest('/confirmation/account/my')

// 获取验证码
export const fetchValidateCode = (mobile) => request.globalRequest(`/confirmation/account/captcha/sms/${mobile}`)