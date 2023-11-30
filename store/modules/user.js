import { defineStore } from 'pinia'
import { store } from '@/store'
import { storageGet, storageSet, storageRemove } from '@/utils/storage'
import { login, getPrincipalAllInfo, getGeospatialList, getWxOpenId, userUpdateOpenId } from '@/apis/user/principal'
import { COOKIE_DOMAIN } from '@/config/settings'
import { usePermissionStoreHook } from './permission'
import { setToken, setDistrict, removeToken } from '@/utils/auth'

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
		// 小程序场景值
		scene: 1001
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
			setDistrict(district.id)
			storageSet('district', district)
		},
		SET_SCENE(value) {
			this.scene = value
		},
		async thirdLogin(data) {
			const res = await login(data)
			if (res.statusCode === 200) {
				const {
					access_token,
					token_type,
					expires_in
				} = res.data
				storageSet('authorized-token', `${token_type} ${access_token}`)
				uni.setStorageSync()
				setToken(res.data)
				usePermissionStoreHook().setAuthority()
				if (data.username !== '11111112222') {
					wx.login({
						success: res => {
							if (res.code) {
								getWxOpenId(res.code).then(codeRes => {
									if (codeRes && codeRes.content) {
										userUpdateOpenId(codeRes.content.openid)
									}
								})
							} else {
								uni.showToast({
									title: '登录失败！' + res.errMsg,
									icon: 'none'
								})
							}
						}
					})
				}
				uni.redirectTo({
					url: '/pages/index/index'
				})
			}
		},
		async setDict() {
			const { content } = await getAllDictMap()
			this.dict = content
			storageSet('dict', content)
		},
		async setUserInfo() {
			const { content: userInfo } = await getPrincipalAllInfo()
			this.userInfo = userInfo
			storageSet('userInfo', userInfo)
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
			// #ifdef MP-WEIXIN
			// console.log('logOUt --------', token)
			// uni.redirectTo({
			// 	url: '/pages/login/index'
			// })
			// #endif
			removeToken()
			uni.clearStorageSync();
			// const data = {
			// 	username: '11111112222',
			// 	word: aesEncrypt('bff3b97e0e57a9e130c9e71128e41f26'),
			// 	type: 'third_party'
			// }
			useUserStoreHook().thirdLogin(data)
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