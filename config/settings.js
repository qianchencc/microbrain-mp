// api base url
export const BASE_URL = process.env.NODE_ENV === 'development' ? '/dev' : ''

// file server base url
export const FILE_URL = '/file'

// api mock
export const API_MOCK = false

// sidebar accordion mode
export const MENU_ACCORDION = true

export const TO_TEST = true

// menu mock
export const MENU_MOCK = TO_TEST

// https
export const SCHEME = TO_TEST ? 'http://' : 'http://'

// 生产环境主域名
export const COOKIE_DOMAIN = TO_TEST ? '118.89.77.114:8080' : 'services.ehetech.net:32087'

export const ImageUrl = TO_TEST ? 'https://filecommunity.wzscr.cn/future-community/' : 'https://fcsq.longwan.gov.cn/s3oss/t720y28035/'

// 项目基础名称
export const BASE_NAME = 'mirco-mp'

// 浙住通服务
export const zztServer = TO_TEST ? 'http://223.4.78.245:8087/zztTest' : 'https://wlsq.zje.com/zzt'
export const zztCode = TO_TEST ? '3303000034' : '330300-0045'

// 下发请求地址
export const applyAddress = TO_TEST ? 'http://pc87ix.natappfree.cc' : 'https://wswlsq.wzscr.cn'