import { useUserStoreHook } from '@/store/modules/user'
import { MENU_MOCK, COOKIE_DOMAIN } from '@/config/settings'
import { storageGet, storageSet, storageRemove } from '@/utils/storage'
const TokenKey = 'authorized-token'
// 获取token
export function getToken() {
	return uni.getStorageSync(TokenKey)
}

// 设置token以及过期时间（cookies、sessionStorage各一份）
// 后端需要将用户信息和token以及过期时间都返回给前端，过期时间主要用于刷新token
export function setToken(data) {
	const {
		access_token,
		token_type,
		expires_in
	} = data
	const dataString = `${token_type} ${access_token}`
	useUserStoreHook().SET_TOKEN(dataString)
	storageSet(TokenKey, dataString)
	uni.setStorageSync('authorized-token', dataString)
}

export function getTokenId() {
	return uni.getStorageSync(TokenKey).split(' ')[1]
}

// 删除token
export function removeToken() {
	storageRemove(TokenKey)
}

export function checkToken() {
	useUserStoreHook().setUserInfo()
}

// 跳转登录页面
export function goLogin() {
	const mobile = useUserStoreHook().getUserInfo.mobile
	if (mobile === '11111112222') {
		uni.redirectTo({
			url: '/pages/login/index'
		})
	}
}