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

const token = storageGet('authorized-token')

export const useUserStore = defineStore({
	id: 'ehe-user',
	state: () => ({
		authorized: false,
		dict: {},
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
			login(data).then(async res => {
					if (res) {
						const { token_type, access_token, expires_in } = res.content
						const token = `${token_type} ${access_token}`
						const expires = Math.ceil(expires_in / 60 / 60 / 24)
						setToken(res.content)
						this.authorized = true
						usePermissionStoreHook().setAuthority()
						uni.reLaunch({
							url: '/pages/index/index'
						})
					}
				})
				.catch(error => {
					reject(error)
				})
		},
		async thirdLogin(code) {
			if (!code) return
			// #ifdef MP-WEIXIN
			const { content } = await getWxOpenId(code)
			const openid = content.openid
			const captcha = encodeURIComponent(aesEncrypt(new Date().getTime() + '@WX_MP'))
			const url = `${globalConfig.ssoUrl}/oauth/token?grant_type=thirdParty&openid=${openid}&captcha=${captcha}&scope=all&client_id=2460feb0ab054e1e&client_secret=smaEMjAyMzAzMTExNTI5MzgGQd`
			// #endif
			// #ifdef APP-PLUS
			const openid = code
			const captcha = encodeURIComponent(aesEncrypt(new Date().getTime()))
			const url = `${globalConfig.ssoUrl}/oauth/token?grant_type=sms&mobile=${openid}&captcha=${captcha}&scope=all&client_id=2460feb0ab054e1e&client_secret=smaEMjAyMzAzMTExNTI5MzgGQd`
			// #endif
			uni.showLoading({
				title: '加载中...',
				mask: false
			});
			uni.request({
				url: url,
				method: 'POST',
				success: (res) => {
					if (res.statusCode === 200) {
						const {
							access_token,
							token_type,
							expires_in
						} = res.data
						setToken(res.data)
						this.authorized = true
						usePermissionStoreHook().setAuthority()
						// uni.closeAuthView()
						uni.reLaunch({
							url: '/pages/index/index'
						})
					}
				},
				fail(e) {
					console.log(e);
				}
			})
		},
		async setDict() {
			const { content } = await getAllDictMap()
			this.dict = content
			storageSet('dict', content)
		},
		async setUserInfo() {
			const { content: userInfo } = await getPrincipalAllInfo()
			const { content: cardInfo } = await fetchCardPrincipalInfo(userInfo.id)
			this.userInfo = { ...userInfo, ...cardInfo }
			storageSet('userInfo', this.userInfo)
		},
		async setGeospatialInfo() {
			const { content: geospatialInfo } = await getGeospatialList({ type: 6 })
			const options = []
			geospatialInfo.forEach((element, index) => {
				const item = {
					name: element.name,
					id: element.code,
					choose: !this.district.id ? index === 0 : this.district.id === element.code
				}
				options.push(item)
			})
			this.geospatialInfo = options
			if (!this.district.id && this.geospatialInfo.length) {
				this.SET_DISTRICT(this.geospatialInfo[0])
			}
			storageSet('geospatialInfo', this.geospatialInfo)
		},
		// 登出 清空缓存
		logOut() {
			if (this.authorized || getToken()) {
				wxLogin()
			}
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
