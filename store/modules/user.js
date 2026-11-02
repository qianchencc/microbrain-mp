import { defineStore } from 'pinia'
import { store } from '@/store'
import { wxLogin } from '@/utils/wxLogin.js'
import { storageGet, storageSet, storageRemove } from '@/utils/storage'
import { login, getPrincipalAllInfo, getGeospatialList, getWxOpenId, userUpdateOpenId } from '@/apis/user/principal'
import { fetchCardPrincipalInfo } from '@/apis/home'
import { usePermissionStoreHook } from './permission'
import { setToken, getToken, removeToken } from '@/utils/auth'
import { aesEncrypt } from '@/utils/cryptojs'
import globalConfig from '@/config'
import {getAllDictMap} from "@/apis/user/principal";

const token = storageGet('authorized-token')

export const useUserStore = defineStore({
	id: 'ehe-user',
	state: () => ({
		authorized: false,
		dict: null,
		// 用户信息
		userInfo: storageGet('userInfo'),
		//组织信息
		geospatialInfo: storageGet('geospatialInfo'),
		// 登录用户组织code
		district: storageGet('district'),
	}),
	getters: {
		getDistrict() {
			return this.district || storageGet('district')
		},
		getUserInfo() {
			return this.userInfo || storageGet('userInfo')
		},
		getGeospatialInfo() {
			return this.geospatialInfo || storageGet('geospatialInfo')
		},
		getDict() {
			return this.dict || storageGet('dict') || {}
		},
		getShowIndex(){
			return !!Object.keys(this.getDict['ShowMiniAI'])?.length
		}
	},
	actions: {
		SET_TOKEN(token) {
			this.token = token
		},
		SET_NAME(name) {
			this.name = name
		},
		SET_DISTRICT(district) {
			this.district = district
			storageSet('district', district)
		},
		async loginByUsername(model) {
			const password = aesEncrypt(model.password)
			const data = {
				username: aesEncrypt(model.username),
				password,
				client_id: '2460feb0ab054e1e',
				client_secret: 'smaEMjAyMzAzMTExNTI5MzgGQd'
			}
			const res = await login(data)
			if (!res?.content?.access_token || !res.content.token_type) {
				throw new Error('客户登录失败')
			}
			setToken(res.content)
			this.authorized = true
			await usePermissionStoreHook().setAuthority()
			uni.reLaunch({
				url: '/pages/index/index'
			})
			return res
		},
		async thirdLogin(code, redirect = '/pages/index/index') {
			if (!code) return
			// #ifdef MP-WEIXIN
			const { content } = await getWxOpenId(code)
			let openid = content.openid
			const captcha = encodeURIComponent(aesEncrypt(new Date().getTime() + '@WX_MP'))
			const url = `${globalConfig.ssoUrl}/oauth/token?grant_type=thirdParty&openid=${openid}&captcha=${captcha}&scope=all&client_id=2460feb0ab054e1e&client_secret=smaEMjAyMzAzMTExNTI5MzgGQd`
			// #endif
			// #ifdef APP-PLUS
			openid = code
			const captcha = encodeURIComponent(aesEncrypt(new Date().getTime()))
			const url = `${globalConfig.ssoUrl}/oauth/token?grant_type=sms&mobile=${openid}&captcha=${captcha}&scope=all&client_id=2460feb0ab054e1e&client_secret=smaEMjAyMzAzMTExNTI5MzgGQd`
			// #endif
			uni.showLoading({
				title: '加载中...',
				mask: false
			});
			const response = await uni.request({
				url: url,
				method: 'POST'
			})
			if (response.statusCode !== 200) throw new Error('客户登录失败')
			setToken(response.data)
			this.authorized = true
			await usePermissionStoreHook().setAuthority()
			const target = typeof redirect === 'function' ? redirect() : redirect
			uni.reLaunch({ url: target || '/pages/index/index' })
		},
		async setDict() {
			const res = await getAllDictMap()
			if (res) {
				this.dict = res.content
				storageSet('dict', res.content)
			}
		},
		async setUserInfo() {
			const { content: userInfo } = await getPrincipalAllInfo()
			const { content: cardInfo } = await fetchCardPrincipalInfo(userInfo.id)
			this.userInfo = { ...userInfo, ...cardInfo }
			storageSet('userInfo', this.userInfo)
		},
		async setGeospatialInfo() {
			const { content: geospatialInfo } = await getGeospatialList({ type: 6 })
			const currentDistrict = this.district || storageGet('district') || {}
			const options = []
			geospatialInfo.forEach((element, index) => {
				const item = {
					name: element.name,
					id: element.code,
					choose: !currentDistrict.id ? index === 0 : currentDistrict.id === element.code
				}
				options.push(item)
			})
			this.geospatialInfo = options
			if (!currentDistrict.id && this.geospatialInfo.length) {
				this.SET_DISTRICT(this.geospatialInfo[0])
			}
			storageSet('geospatialInfo', this.geospatialInfo)
		},
		// 登出 清空缓存
		logOut() {
			removeToken()
			uni.clearStorageSync();
			this.authorized = false
			// #ifdef MP-WEIXIN
			// #endif
			// #ifdef APP-PLUS
			uni.reLaunch({
				url: '/pages/index/index'
			})
			// #endif
		}
		// 刷新token
		// async refreshToken(data) {
		//     return refreshToken(data).then((data) => {
		//         if (data) {
		//             setToken(data)
		//             return data
		//         }
		//     })
		// }
	}
})

export function useUserStoreHook() {
	return useUserStore(store)
}
