import { getToken } from '@/utils/auth'
import globalConfig from '@/config'
import { useUserStoreHook } from "../store/modules/user";
import { menuFuc } from "./application";
import { ImageUrl } from '../config/settings';

export const getStaticFile = url => {
	return new URL(`../static/images/${url}`, import.meta.url).href
}

export const chooseImg = (count = 9, success) => {
	uni.chooseImage({
		count: count, // 默认9
		success: function(res) {
			uni.showLoading({
				title: '上传中...',
				icon: 'loading',
				mask: true
			})
			const token = getToken()
			const tempFilePaths = res.tempFilePaths
			tempFilePaths.forEach(element => {
				uni.uploadFile({
					url: `${globalConfig.ssoUrl}/file/upload`,
					header: {
						authorization: token
					},
					filePath: element,
					name: 'file',
					formData: {
						path: 'mp'
					},
					success: success,
					fail: (e) => {
						uni.showToast({
							title: '文件上传失败'
						})
					},
					complete() {
						uni.hideLoading()
					}
				})
			})
		}
	})
}

// 查看腾讯视频
export const gainTencentVideo = (vid) => {
	return new Promise((resolve, reject) => {
		uni.request({
			url: `https://vv.video.qq.com/getinfo?vids=${vid}&platform=101001&charge=0&otype=json`,
			header: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			success(e) {
				let t = (e.data.replace(/QZOutputJson=/, "") + "qwe").replace(/;qwe/, "")
				let a = JSON.parse(t)
				// console.log('gain temcent video aaaaaaaaaaaaaaaa-------', a)
				let _ = a.vl.vi[0].ul.ui[0].url.replace(/http/, "https") + a.vl.vi[0].fn +
					"?vkey=" + a.vl.vi[0].fvkey
				console.log('gain tencent video -----------', _);
				resolve(_)
			}
		})
	})
}

// 菜单跳转
export const jumpUrl = async menu => {
	// #ifdef MP-WEIXIN
	console.log('jumpUrl menu ===>', menu)
	// if (menu.code) {
	// 	const data = {
	// 		appCode: menu.code
	// 	}
	// 	const res = await createAppDailyActivity(data)
	// 	if (!res) return
	// 	console.log('createAppDailyActivity ===>', res)
	// }
	if (menu.uri.startsWith('miniAppId=')) {
		uni.navigateToMiniProgram({
			appId: menu.uri.split('=')[1],
			fail: res => {
				uni.showToast({
					title: '打开小程序失败',
					icon: 'none'
				})
			}
		})
	} else {
		if (menuFuc[menu.name]) {
			menuFuc[menu.name](menu)
		} else {
			uni.navigateTo({
				url: '/pages/webView/index?path=' + menu.uri
			})
		}
	}
	// #endif
	// #ifdef H5
	if (menu.uri.startsWith('miniAppId=')) {
		uni.showToast({
			title: '小程序只能在微信里打开',
			icon: 'none'
		})
	} else {
		location.href = menu.uri + (menu.uri.includes('?') ? '&token=' : '?token=') + getToken() +
			'&tenantCode=' + useUserStoreHook().getDistrict.id
	}
	// #endif
	// #ifdef APP-PLUS
	if (menuFuc[menu.name]) {
		menuFuc[menu.name](menu)
	} else {
		uni.navigateTo({
			url: '/pages/webView/index?path=' + menu.uri
		})
	}
	// #endif
}

// str:变量；frontNum:前面显示位数；afterNum:后面显示位数
export function handleStr(str, frontNum, afterNum) {
	let len = str.length - frontNum - afterNum;
	if (len <= 0) {
		len = 1
		afterNum = 0
	}
	let hide = '';
	for (let i = 0; i < len; i++) {
		hide += '*';
	}
	return str.substring(0, frontNum) + hide + str.substring(str.length - afterNum);
}

export function getUrl(val) {
	let base = ''
	if (val && !val.startsWith('http')) {
		base = ImageUrl
	}
	return base + val
}