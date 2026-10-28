// 项目基础名称
export const BASE_NAME = 'mirco-mp'

// 端点配置：地址只在这里维护，页面与请求层不得再写死域名。
// envVersion 由微信运行时给出：develop=开发版/开发者工具，trial=体验版，release=正式版。
// 待替换（P1/P2）：develop.agentBaseUrl 指向客户测试 Runtime；videoPlayerUrl 填客户 H5 播放页。
export const ENDPOINTS = {
	release: {
		gatewayOrigin: 'https://ncim.577119.com',
		agentBaseUrl: 'https://ncim.577119.com/micro-api/api/ai',
		videoPlayerUrl: '',
		videoApiBaseUrl: 'https://ncim.577119.com/micro-api/api/ai'
	},
	trial: {
		gatewayOrigin: 'https://ncim.577119.com',
		agentBaseUrl: 'https://ncim.577119.com/micro-api/api/ai',
		videoPlayerUrl: '',
		videoApiBaseUrl: 'https://ncim.577119.com/micro-api/api/ai'
	},
	develop: {
		gatewayOrigin: 'https://ncim.577119.com',
		agentBaseUrl: 'https://mp-agent.qianc.ltd/api',
		videoPlayerUrl: 'https://mp-video.qianc.ltd/player.html',
		videoApiBaseUrl: 'https://mp-video.qianc.ltd/api'
	}
}

export const envVersion = __wxConfig.envVersion || 'develop'
export const ENDPOINT = ENDPOINTS[envVersion] || ENDPOINTS.develop
export const DOMAIN = ENDPOINT.gatewayOrigin
export const isDev = envVersion === 'develop'
export const isTrial = envVersion === 'trial'
