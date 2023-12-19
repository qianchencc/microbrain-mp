import { usePermissionStoreHook } from '@/store/modules/permission'
import { getToken } from '@/utils/auth'
import { wxLogin } from '@/utils/wxLogin.js'
import { appLogin } from '@/utils/appLogin'
export const authLogin = () => {
	if (getToken()) {
		usePermissionStoreHook().setAuthority()
	} else {
		// #ifdef MP-WEIXIN
		wxLogin()
		// #endif
		// #ifdef H5
		uni.navigateTo({
			url: '/pages/login/index'
		})
		// #endif
		// #ifdef APP-PLUS
		appLogin()
		// #endif
	}
}