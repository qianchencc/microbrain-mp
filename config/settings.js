// 项目基础名称
export const BASE_NAME = 'mirco-mp'

// 端点配置：地址只在这里维护，页面与请求层不得再写死域名。
// envVersion 由微信运行时给出：develop=开发版/开发者工具，trial=体验版，release=正式版。
// 本worktree的develop Agent请求指向独立business后端；trial/release保持客户网关。
export const USE_LOCAL_DEVELOP_AGENT = true
// 关闭后 develop 恢复公网 Agent；不影响 trial/release。
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
	},
	// Develop-only local Java profile. Login and SSO keep their customer gateway;
	// Agent and video requests use the integrated local backend.
	'develop.local': {
		gatewayOrigin: 'https://ncim.577119.com',
		agentBaseUrl: 'http://127.0.0.1:3381/api',
		videoPlayerUrl: 'http://127.0.0.1:9419/owner/h5player/index.html',
		videoApiBaseUrl: 'http://127.0.0.1:3381/api'
	}
}

export const envVersion = __wxConfig.envVersion || 'develop'
const endpointProfile = envVersion === 'develop' && USE_LOCAL_DEVELOP_AGENT
	? 'develop.local'
	: envVersion
export const ENDPOINT = ENDPOINTS[endpointProfile] || ENDPOINTS.develop
export const DOMAIN = ENDPOINT.gatewayOrigin
export const isDev = envVersion === 'develop'
export const isTrial = envVersion === 'trial'
