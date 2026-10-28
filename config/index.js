/**
 * ip地址或域名
 */

import { ENDPOINT, DOMAIN } from './settings'

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
	// 客户登录、园区和物联接口始终走客户公网；Agent 地址按环境取 ENDPOINTS。
	return ENDPOINT.agentBaseUrl
}

// 自建 H5 监控播放页部署位：客户确认后填入 ENDPOINTS.videoPlayerUrl。
// 为空时「查看画面」按钮置灰显示“播放页接入中”，不跳取流。
const getAgentVideoPlayerUrl = () => {
	return ENDPOINT.videoPlayerUrl
}

// 播放页内取流回连的 Runtime 基址：HTTPS 页面不能请求 HTTP Runtime（混合内容）。
const getAgentVideoApiUrl = () => {
	return ENDPOINT.videoApiBaseUrl
}

export default {
	/**
	 * 针对不同平台的baseUrl
	 */
	baseUrl: getGatewayBaseUrl(),
	ssoUrl: getSsoBaseUrl(),
	fileAddr: getFileBaseUrl(),
	agentUrl: getAgentBaseUrl(),
	videoPlayerUrl: getAgentVideoPlayerUrl(),
	videoPlayerApiUrl: getAgentVideoApiUrl()
}
