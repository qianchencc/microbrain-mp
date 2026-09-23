// 项目基础名称
export const BASE_NAME = 'mirco-mp'

export const EvnIP = {
	release: 'https://ncim.577119.com', //（正式版）
	trial: 'https://ncim.577119.com', //（体验版）
	develop: 'https://ncim.577119.com', //（开发版）
}

export const envVersion = __wxConfig.envVersion || 'develop'
export const DOMAIN = EvnIP[envVersion]
export const isDev = envVersion === 'develop'
export const isTrial = envVersion === 'trial'
