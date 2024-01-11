<template>
	<view>
		<web-view :src="url" @message="getMessage"></web-view>
	</view>
</template>

<script>
	import { getTokenId, checkToken } from '@/utils/auth'
	import { useUserStoreHook } from '@/store/modules/user'
	// import { joinGroup } from '@/apis/group/index.js'
	import { COOKIE_DOMAIN, SCHEME } from '@/config/settings'

	function obj2Query(obj) {
		const keys = []
		for (const key in obj) {
			if (key !== 'path' && key !== 'otherQuery' && key !== 'noToken') {
				keys.push(`${key}=${obj[key]}`)
			}
		}
		return keys.length ? keys.join('&') : ''
	}

	export default {
		data() {
			return {
				url: '',
				eventChannel: null
			}
		},
		onLoad: async function(option) {
			await checkToken()
			if (!option.noToken) {
				option.token = getTokenId()
				option.tenantCode = useUserStoreHook().getDistrict.id
				option.timestamp = new Date().getTime()
			}
			// 额外参数, 请encodeURIComponent
			console.log(333333, option.path);
			this.url = option.path + '?' + obj2Query(option) + (option.otherQuery ? decodeURIComponent(option.otherQuery) : '')
			console.log(this.url)
			// #ifdef APP-NVUE
			this.eventChannel = this.$scope.eventChannel // 兼容APP-NVUE
			// #endif
			// #ifndef APP-NVUE
			this.eventChannel = this.getOpenerEventChannel()
			// #endif
		},
		methods: {
			async getMessage(e) {
				console.log('webView Data ------------------->', e)
				const target = e.detail.data[0]
				if (target.action) {
					if (target.action === 'scan') {
						// 扫码后携带结果参数跳转
						uni.scanCode({
							success: async res => {
								// 有href,进行跳转,扫码结果作JSON解析成参数, 在跳进webView参数encodeURIComponent
								const data = JSON.parse(res.result)
								if (target.href) {
									let otherQuery = ''
									Object.entries(data).map(([k, v]) => {
										otherQuery += `&${k}=${v}`
									})

									uni.navigateTo({
										url: `/pages/webView/index?path=${target.href}&otherQuery=${encodeURIComponent(otherQuery)}`
									})
								} else if (target.type === 'joinGroup') {
									let res = await joinGroup(data.groupNumber)
									if (res) {
										uni.showToast({
											title: '申请成功'
										})
									}
								}
							}
						})
					} else if (target.action === 'makePhoneCall') {
						uni.makePhoneCall({
							phoneNumber: target.phone,
							success: () => {
								console.log('拨打电话 -----', target)
							}
						})
					} else if (target.action === 'detail') {
						uni.navigateTo({
							url: `/pages/detail/index?id=${target.id}&type=${target.type}`
						})
					} else if (target.action === 'pay') {
						let { pay, href } = target;
						// #ifdef MP-WEIXIN
						uni.requestPayment({
							provider: 'wxpay',
							appId: pay.appId,
							timeStamp: pay.timeStamp,
							nonceStr: pay.nonceStr,
							package: pay.packageValue,
							signType: 'RSA',
							paySign: pay.paySign,
							success: res => {
								uni.redirectTo({
									url: `/pages/webView/index?path=${href}`
								})
							},
							fail: err => {
								console.log('pay err ----->', err)
							}
						})
						// #endif
						// #ifndef MP-WEIXIN
						uni.showToast({
							title: '请在微信中打开',
							icon: 'none'
						})
						// #endif
					} else if (target.action === 'redirect') {
						console.log('web view =====>', target)
						uni.navigateTo({
							url: `/pages/webView/index?path=${SCHEME}${COOKIE_DOMAIN}/${target.module}/#${target.path}`
						})
					}
				} else if (target.photo) {
					this.eventChannel.emit('acceptImageData', target.photo)
					uni.navigateBack()
				}
			},
			getUrlOption(url) {
				const str = url.split('?')[1].split('&')
				const obj = {}
				obj['href'] = url.split('?')[0]
				str.forEach(e => {
					const list = e.split('=')
					obj[list[0]] = list[1]
				})
				return obj
			}
		},
		onShareAppMessage(e) {
			console.log('onShareAppMessage:e >>>', e)
			// 活动助力分享
			const location = this.getUrlOption(e.webViewUrl)
			if (e.webViewUrl.indexOf('/pages/push/activityShareDetail') > -1) {
				return {
					title: '活动助力分享',
					path: `/pages/webView/index?path=${location.href}&otherQuery=${encodeURIComponent(`&id=${location.id}&isShare=true`)}`
				}
			} else {
				let str = ''
				Object.entries(location).map(([k, v]) => {
					if (['token', 'district', 'href'].indexOf(k) === -1) {
						str += `&${k}=${v}`
					}
				})
				return {
					title: '分享',
					path: `/pages/webView/index?path=${location.href}&otherQuery=${encodeURIComponent(str)}`
				}
			}
		},
		onShareTimeline(e) {
			console.log('onShareTimeline:e >>>', e)
			// 活动助力分享
			const location = this.getUrlOption(e.webViewUrl)
			if (e.webViewUrl.indexOf('/pages/push/activityShareDetail') > -1) {
				return {
					title: '活动助力分享',
					path: `/pages/webView/index?path=${location.href}&otherQuery=${encodeURIComponent(`&id=${location.id}&isShare=true`)}`
				}
			} else {
				let str = ''
				Object.entries(location).map(([k, v]) => {
					if (['token', 'district', 'href'].indexOf(k) === -1) {
						str += `&${k}=${v}`
					}
				})
				return {
					title: '分享',
					path: `/pages/webView/index?path=${location.href}&otherQuery=${encodeURIComponent(str)}`
				}
			}
		}
	}
</script>

<style>

</style>