import createRequest from '../request.js'
import globalConfig from '@/config'

// 告警订阅配置接口走网关（/api 前缀），与 user 模块其他 sso 接口分开
const request = createRequest({
	baseUrl: globalConfig.baseUrl
})

// 告警设备订阅配置分页列表
export const fetchDevicePage = (data) => request.globalRequest('/api/perception/fire/alarmSubConfig/page', 'GET', data)

// 获取设备订阅 snTicket（参数为记录id）
export const fetchDeviceSnTicket = (id) => request.globalRequest('/api/perception/fire/alarmSubConfig/getSnTicket', 'GET', { id })

// 订阅成功后记录用户订阅（参数为订阅配置记录id）
export const saveAlarmUserSub = (alarmSubConfigId) => request.globalRequest('/api/perception/alarmUserSub/', 'POST', { alarmSubConfigId })
