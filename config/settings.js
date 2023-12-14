// api base url
export const BASE_URL = process.env.NODE_ENV === 'development' ? '/dev' : ''

// file server base url
export const FILE_URL = '/file'

// api mock
export const API_MOCK = false

// sidebar accordion mode
export const MENU_ACCORDION = true

// 是否生产发布
// #ifdef MP-WEIXIN
export const TO_TEST = __wxConfig.envVersion !== 'release'
// #endif
// #ifndef MP-WEIXIN
export const TO_TEST = true
// #endif

// menu mock
// #ifdef MP-WEIXIN
export const MENU_MOCK = TO_TEST
// #endif
// #ifndef MP-WEIXIN
export const MENU_MOCK = process.env.NODE_ENV === 'development'
// #endif

// https
export const SCHEME = TO_TEST ? 'http://' : 'https://'

// #ifdef MP-WEIXIN
// 生产环境主域名
export const COOKIE_DOMAIN = TO_TEST ? '172.16.255.32:28087' : 'fcsq.longwan.gov.cn'
// #endif
// #ifdef H5
// 生产环境主域名
export const COOKIE_DOMAIN = MENU_MOCK ? (TO_TEST ? '172.16.255.32:28087' : 'fcsq.longwan.gov.cn') : '172.16.255.32:28087'
// #endif

export const ImageUrl = TO_TEST ? 'https://filecommunity.wzscr.cn/future-community/' : 'https://fcsq.longwan.gov.cn/s3oss/t720y28035/'

// 项目基础名称
export const BASE_NAME = 'app'

// 浙住通服务
export const zztServer = TO_TEST ? 'http://223.4.78.245:8087/zztTest' : 'https://wlsq.zje.com/zzt'
export const zztCode = TO_TEST ? '3303000034' : '330300-0045'

// 下发请求地址
export const applyAddress = TO_TEST ? 'http://pc87ix.natappfree.cc' : 'https://wswlsq.wzscr.cn'