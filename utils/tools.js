import { getToken, getTokenId } from '@/utils/auth'
import globalConfig from '@/config'
import { useUserStoreHook } from "../store/modules/user";
import { menuFuc } from "./application";
import { ImageUrl } from '../config/settings';
import { usePermissionStore } from '../store/modules/permission';

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

// getway提交
export const chooseImg2 = (count = 9, success) => {
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
					url: `${globalConfig.baseUrl}/api/setting/file/upload`,
					header: {
						authorization: token
					},
					filePath: element,
					name: 'file',
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

// 菜单跳转
export const jumpUrl = async menu => {
	// 判断用户权限
	const permissionIds = usePermissionStore().permissionIds
	if (!permissionIds.includes(menu.id)) {
		uni.showModal({
			title: '提示',
			content: '没有权限，请联系管理员',
			showCancel: false
		});
		return
	}
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
		if (menuFuc[menu.resourceName]) {
			menuFuc[menu.resourceName](menu)
		} else {
			uni.navigateTo({
				url: '/pages/webView/index?path=' + menu.uri.replaceAll('?', '&')
			})
		}
	}
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
