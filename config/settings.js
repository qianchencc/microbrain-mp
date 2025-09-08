export const TO_TEST = false

// 项目基础名称
export const BASE_NAME = 'mirco-mp'

// 浙住通服务
export const zztServer = TO_TEST ? 'http://223.4.78.245:8087/zztTest' : 'https://wlsq.zje.com/zzt'
export const zztCode = TO_TEST ? '3303000034' : '330300-0045'

// 下发请求地址
export const applyAddress = TO_TEST ? 'http://pc87ix.natappfree.cc' : 'https://wswlsq.wzscr.cn'

export const EvnIP = {
	release: 'https://ncim.577119.com', //（正式版）
	trial: 'https://ncim.577119.com', //（体验版）
	develop: 'https://ncim.577119.com', //（开发版）
}

export const DOMAIN = EvnIP[__wxConfig.envVersion]
export const isDev = __wxConfig.envVersion === 'develop'
