import { useUserStoreHook } from '@/store/modules/user.js'

function getCode() {
	return new Promise((resolve, reject) => {
		uni.login({
			provider: "weixin",
			success: (e) => {
				resolve(e)
			},
			fail: (err) => {
				reject(new Error("获取code失败"))
			}
		})
	})
}

function getOpenID(code) {
	return uniCloud.callFunction({
		name: "wxLogin",
		data: {
			code
		}
	})
}

function getUserProfile() {
	return new Promise((resolve, reject) => {
		uni.getUserProfile({
			desc: "获取你的昵称、头像、地区及性别",
			success: (e) => {
				useUserStoreHook().SET_USER_INFO(e.userInfo)
				resolve(e)
			},
			fail: (err) => {
				reject(new Error("getUserProfile失败"))

			}
		})
	})
}

async function wxLogin() {
	getCode().then(e => {
		return getOpenID(e.code)
	}).then(e => {
		const { openid, token, tokenExpired } = e.result;
		uni.setStorageSync('uni_id_token_expired', tokenExpired)
		uni.setStorageSync('openid', openid)
		uni.setStorageSync('token', token)
		uni.login({
			provider: 'weixin', //使用微信登录
			success: function(loginRes) {
				useUserStoreHook().thirdLogin(loginRes.code)
			}
		})
	}).catch(err => console.log(err))

}

export {
	wxLogin,
	getUserProfile
}