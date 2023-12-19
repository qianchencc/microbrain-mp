/**
 * ip地址或域名
 */

import { TO_TEST } from './settings'

const ipAddress = TO_TEST ? 'http://172.16.255.32:28087' : 'http://services.ehetech.net:32087'

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
	// #ifdef H5
	return gatewayApiPrefix
	// #endif
	// #ifndef H5
	return ipAddress + gatewayApiPrefix
	// #endif
}

/**
 * 针对不同平台的baseUrl
 */
const getSsoBaseUrl = () => {
	// #ifdef H5
	return ssoApiPrefix
	// #endif
	// #ifndef H5
	return ipAddress + ssoApiPrefix
	// #endif
}
/**
 * 文件服务器的baseUrl
 */
const getFileBaseUrl = () => {
	// #ifdef H5
	return fileAddress
	// #endif
	// #ifndef H5
	return ipAddress + fileAddress
	// #endif
}

export default {
	/**
	 * 针对不同平台的baseUrl
	 */
	baseUrl: getGatewayBaseUrl(),
	ssoUrl: getSsoBaseUrl(),
	fileAddr: getFileBaseUrl()
}