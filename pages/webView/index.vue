<template>
	<view>
		<web-view :src="url" @message="getMessage"></web-view>
	</view>
</template>

<script>
	import { getTokenId, checkToken } from '@/utils/auth'
	import { useUserStoreHook } from '@/store/modules/user'
	import { getAgentSession, getAgentStorageScope } from '@/utils/agent-session'
	import { videoPageUrl } from './video-query.mjs'
	// import { joinGroup } from '@/apis/group/index.js'
	import { DOMAIN } from '@/config/settings'

	function obj2Query(obj) {
		const keys = []
		for (const key in obj) {
			if (key !== 'path' && key !== 'noToken' && key !== 'assistantVideo') {
				keys.push(`${key}=${obj[key]}`)
			}
		}
		return keys.length ? keys.join('&') : ''
	}

	export default {
		data() {
			return {
				url: '',
				assistantVideo: false,
				videoScope: '',
				eventChannel: null
			}
		},
		onLoad: async function(option) {
			this.assistantVideo = option.assistantVideo === '1'
			if (this.assistantVideo) {
				uni.setNavigationBarTitle({ title: option.mode === 'playback' ? '录像回放' : '实时画面' })
				uni.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
			}
			await checkToken()
			if (this.assistantVideo) this.videoScope = getAgentStorageScope()
			if (!option.noToken) {
				// 视频与 Agent 使用同一凭据串，不因重建 Bearer 前缀触发另一份身份核验缓存。
				const videoSession = this.assistantVideo ? getAgentSession() : null
				option.token = videoSession ? videoSession.authorization : getTokenId()
				option.tenantCode = videoSession ? videoSession.tenantCode : useUserStoreHook().getDistrict.id
				option.timestamp = new Date().getTime()
			}
			// 额外参数, 请encodeURIComponent
			this.url = this.assistantVideo ? videoPageUrl(option) : option.path + '?' + obj2Query(option)
			if (!this.assistantVideo) console.log('webView url ------------------->', this.url)
			// #ifdef APP-NVUE
			this.eventChannel = this.$scope.eventChannel // 兼容APP-NVUE
			// #endif
			// #ifndef APP-NVUE
			this.eventChannel = this.getOpenerEventChannel()
			// #endif
		},
		onShow() {
			if (this.assistantVideo && this.videoScope && this.videoScope !== getAgentStorageScope()) {
				this.url = ''
				uni.showToast({ title: '会话已改变，请重新进入播放页', icon: 'none' })
			}
		},
		methods: {
			async getMessage(e) {
				if (!this.assistantVideo) console.log('webView Data ------------------->', e)
				const target = e.detail.data[0]
				if (target.action) {
					if (target.action === 'scan') {
						// 扫码后携带结果参数跳转
						uni.scanCode({
							success: async res => {
								// 有href,进行跳转,扫码结果作JSON解析成参数, 在跳进webView参数encodeURIComponent
								const data = JSON.parse(res.result)
								if (target.href) {
									uni.navigateTo({
										url: `/pages/webView/index?path=${target.href}&${target.query}`
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
							url: `/pages/webView/index?path=${DOMAIN}/${target.module}/#${target.path}`
						})
					} else if (target.action === 'shareMiLogo') {
						// #ifdef MP-WEIXIN
						// 分享访客微信小程序
						if (target.logoUrl) { // 网络地址
							wx.downloadFile({
								url: DOMAIN + target.logoUrl,
								success: (res) => {
									wx.showShareImageMenu({
										path: res.tempFilePath,
										complete: () => {
											uni.navigateTo({
												url: `/pages/webView/index?path=${DOMAIN}/${target.module}/`
											})
										}
									})
								}
							})
						}

						// #endif

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
					path: `/pages/webView/index?path=${location.href}&id=${location.id}&isShare=true`
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
					path: `/pages/webView/index?path=${location.href}${str}`
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
					path: `/pages/webView/index?path=${location.href}&id=${location.id}&isShare=true`
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
					path: `/pages/webView/index?path=${location.href}${str}`
				}
			}
		}
	}
</script>

<style>

</style>
