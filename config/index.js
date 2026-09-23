/**
 * ip地址或域名
 */

import { DOMAIN, isDev } from './settings'

// #ifdef MP-WEIXIN
const ipAddress = DOMAIN //'https://ncim.577119.com' //
// #endif

// 文件访问地址
const fileAddress = '/file/'

/**
 * gateway前缀
 */
const gatewayApiPrefix = '/micro-api'

/**
 * sso前缀
 */
const ssoApiPrefix = '/sso-api'

/**
 * 针对不同平台的baseUrl
 */
const getGatewayBaseUrl = () => {
	return ipAddress + gatewayApiPrefix
}

/**
 * 针对不同平台的baseUrl
 */
const getSsoBaseUrl = () => {
	return ipAddress + ssoApiPrefix
}
/**
 * 文件服务器的baseUrl
 */
const getFileBaseUrl = () => {
	return ipAddress + fileAddress
}

const getAgentBaseUrl = () => {
	// 客户登录、园区和物联接口始终走客户公网；开发阶段仅把 Agent Runtime 留在本机。
	// 本机 3200 是唯一 Runtime 实例：直连真实客户网关的真实物联后端，不存在模拟数据源。
	return isDev ? 'http://127.0.0.1:3200/api' : getGatewayBaseUrl() + '/api/ai'
}

export default {
	/**
	 * 针对不同平台的baseUrl
	 */
	baseUrl: getGatewayBaseUrl(),
	ssoUrl: getSsoBaseUrl(),
	fileAddr: getFileBaseUrl(),
	agentUrl: getAgentBaseUrl()
}
