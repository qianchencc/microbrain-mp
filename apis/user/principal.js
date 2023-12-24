import request from './api.js'
import globalConfig from '@/config'
import { applyAddress } from '../../config/settings'
// 登录
export const login = (data) => request.globalRequest(`/login/word/v2`, 'POST', data)

// 查询用户的所有信息
export const getPrincipalAllInfo = () => request.globalRequest('/account/me', 'GET')

// 组织用户查找关联区域
export const getPrincipalAllGeospatial = () => request.globalRequest('/identity/geospatial/principal/all', 'GET')

// 地域空间列表
export const getGeospatialList = (params) => request.globalRequest('/geospatial/all/list', 'GET', params)

// 微信根据code换手机号
export const getPhoneNumberByCode = (code, source) => request.globalRequest(`/setting/wx/miniProgram/codeToPhone/v2/wans/${code}/${source}`, 'GET')

// 提交人脸
export const uploadPrincipalFace = (data) => request.globalRequest('/identity/principal/face', 'PUT', data)

// 提交头像
export const uploadAvatar = (data) => request.globalRequest('/identity/principal/portrait', 'PUT', data)

// 修改个人信息
export const updatePrincipalInfo = (id, data) => request.globalRequest(`/account/${id}/base/v2`, 'PUT', data)

// 浙住通信息获取
export const getZztMsg = () => request.globalRequest('/futurecommunity/mini/zzt/sso', 'POST')

// 家头条信息获取
export const getJztMsg = () => request.globalRequest('/futurecommunity/mini/jtt/code', 'GET')

// 养老超市
export const getElderMall = () => request.globalRequest('/futurecommunity/mini/elderSupermarket/code', 'GET')

// 获取微信id
export const getWxOpenId = (code) => request.globalRequest(`/wx/miniProgram/codeToToken/${code}`, 'GET')

// 用户更新openid
export const userUpdateOpenId = openId => request.globalRequest(`/identity/principal/wxOpenId/${openId}`, 'GET', { noShow: true })

// 应用下发code获取
export const getApplyOnAuthCode = data => request.globalRequest(`${applyAddress}/thirdparty/app/service/info/apply/code`, 'POST', data)

// 更新clientID
export const changeClientId = clientId => request.globalRequest(`/account/socials/to/${clientId}`, 'GET')