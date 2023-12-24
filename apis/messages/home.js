import request from './api.js'

// 首页banner
export const fetchBanner = () => request.globalRequest('/api/message/home/banner/count', 'GET')