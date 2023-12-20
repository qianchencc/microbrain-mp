import { useUserStoreHook } from '@/store/modules/user'
export const SERVER_CODE = new Map([
	[
		200,
		res => {
			return Promise.resolve(res)
		}
	],
	[
		201,
		res => {
			uni.showToast({
				title: res.message,
				icon: 'none'
			})
			return Promise.resolve(res)
		}
	],
	[
		204,
		res => {
			return Promise.resolve(res)
		}
	],
	[
		205,
		res => {
			return Promise.resolve(res)
		}
	],
	[
		207,
		res => {
			uni.showToast({
				title: res.message,
				icon: 'none'
			})
			return Promise.resolve(null)
		}
	],
	[
		208,
		(res, data) => {
			if (!data.noShow) {
				uni.showToast({
					title: res.message,
					icon: 'none'
				})
			}
			return Promise.resolve(res)
		}
	],
	[
		209,
		res => {
			uni.showToast({
				title: res.message,
				icon: 'none'
			})
			return Promise.resolve(null)
		}
	],
	[
		210,
		res => {
			uni.showToast({
				title: res.message,
				icon: 'none'
			})
			return Promise.resolve(res)
		}
	],
	[
		211,
		res => {
			uni.showToast({
				title: res.message,
				icon: 'none'
			})
			return Promise.resolve(null)
		}
	],
	[
		212,
		res => {
			uni.showToast({
				title: res.message,
				icon: 'none'
			})
			return Promise.resolve(null)
		}
	],
	[
		400,
		() => {
			uni.showToast({
				title: '400，参数错误!',
				icon: 'none'
			})
		}
	],
	[
		401,
		() => {
			// uni.showToast({
			// 	title: '授权失败，请重新登录!',
			// 	icon: 'none'
			// })
			useUserStoreHook().logOut()
		}
	],
	[
		403,
		() => {
			uni.showToast({
				title: '拒绝访问',
				icon: 'none'
			})
		}
	],
	[
		404,
		e => {
			uni.showToast({
				title: `接口地址错误，不存在接口：${e.data.path}`,
				icon: 'none'
			})
		}
	],
	[
		500,
		res => {
			uni.showToast({
				title: res.message,
				icon: 'none'
			})
			return Promise.resolve(null)
		}
	],
	[
		506,
		res => {
			uni.showToast({
				title: res.message,
				icon: 'none'
			})
			return Promise.resolve(null)
		}
	]
])

export const HTTP_CODE = new Map([
	[
		400,
		() => {
			uni.showToast({
				title: '400，参数错误!',
				icon: 'none'
			})
		}
	],
	[
		401,
		() => {
			uni.showToast({
				title: '授权失败，请重新登录!',
				icon: 'none'
			})
			useUserStoreHook().logOut()
		}
	],
	[
		403,
		() => {
			uni.showToast({
				title: '拒绝访问',
				icon: 'none'
			})
		}
	],
	[
		404,
		e => {
			uni.showToast({
				title: `接口地址错误，不存在接口：${e.data.path}`,
				icon: 'none'
			})
		}
	],
	[
		500,
		() => {
			uni.showToast({
				title: '服务器发生错误，请联系管理员!',
				icon: 'none'
			})
		}
	],
	[
		503,
		() => {
			uni.showToast({
				title: 'Service Unavailable!',
				icon: 'none'
			})
		}
	],
	[
		504,
		() => {
			uni.showToast({
				title: '接口发布中，请稍后再试...',
				icon: 'none'
			})
		}
	]
])