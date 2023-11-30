import request from '../request'

// 获取分类列表
export const fetchNewsInfoCategoryList = () => request.globalRequest('/futurecommunity/app/news_info/category/list', 'GET')

// 获取资讯详情
export const fetchNewsInfoDetail = (newsInfoId) => request.globalRequest(`/futurecommunity/app/news_info/detail/${newsInfoId}`, 'GET')

// 转发
export const fetchNewsInfoForward = (newsInfoId) => request.globalRequest(`/futurecommunity/app/news_info/forward/${newsInfoId}`, 'POST')

// 点赞
export const fetchNewsInfoLikes = (newsInfoId) => request.globalRequest(`/futurecommunity/app/news_info/likes/${newsInfoId}`, 'POST')

// 获取资讯列表
export const fetchNewsInfoPage = (data) => request.globalRequest(`/futurecommunity/app/news_info/page`, 'GET', data)

// 取消点赞
export const fetchNewsInfoUnlikes = (newsInfoId) => request.globalRequest(`/futurecommunity/app/news_info/unlikes/${newsInfoId}`, 'POST')

// 获取横幅列表
export const fetchBannerManagementList = (data) => request.globalRequest('/futurecommunity/backend/bannerManagement/list', 'GET', data)

// 获取横幅管理详细信息
export const fetchBannerManagement = id => request.globalRequest(`/futurecommunity/backend/bannerManagement/${id}`, 'GET')

// 获取用户积分账户信息
export const fetchIntegralAccount = accountType => request.globalRequest(`/integral/app/integral/user/${accountType}/account`, 'GET')