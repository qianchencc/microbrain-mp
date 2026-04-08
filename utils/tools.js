import { getToken, getTokenId } from '@/utils/auth'
import globalConfig from '@/config'
import { useUserStoreHook } from "../store/modules/user";
import { menuFuc } from "./application";
import {DOMAIN} from '../config/settings';
import { usePermissionStore } from '../store/modules/permission';
import {setSubscribeMessages} from "@/utils/subscribeMessage";
import {parseTime} from "@/utils/datetime";

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
// 有专属二级页面的菜单
const secondMenu = ['Property', 'MyOffice', 'MyApply', 'CompanyManage']
export const jumpUrl = async menu => {
	if (menu.resourceName.includes('incomplete')) {
		uni.showToast({
			title: `敬请期待`,
			icon: 'none'
		})
	} else {
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
		setSubscribeMessages(menu.resourceName, 'home')
		if (menu.uri.startsWith('miniAppId=')) {
			let [type, appId, path] = menu.uri.split('=');
			uni.navigateToMiniProgram({
				appId: appId,
				path: path ? decodeURIComponent(path) : null,
				fail: res => {
					uni.showToast({
						title: '打开小程序失败',
						icon: 'none'
					})
				}
			})
		} else if (menu.uri.includes(':=:')) {
			// 处理第三方
			let [fucName, url] = menu.uri.split(':=:')
			menuFuc(fucName, menu)
		} else if (secondMenu.some(item => item === menu.resourceName)) {
			// 处理二级页面
			goPage(`/pages/index/secondMenu?id=${menu.id}`)
		} else {
			// 网页跳转
			webJump(menu.uri)
		}
	}
}

// 网页跳转, 允许完整的uri, 内部模块
export const webJump = (uri, page) => {
	if (!uri.startsWith('http')) {
		uri = DOMAIN + `/${uri.toLocaleLowerCase()}` + (page || '/')
	}
	uni.navigateTo({
		url: '/pages/webView/index?path=' + uri.replaceAll('?', '&')
	})
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
		base = `${DOMAIN}/file/`
	}
	return base + val
}

export const goPage = url => {
	uni.navigateTo({
		url: url
	})
}

export const formatTime = (val, format = '{y}-{m}-{d} {h}:{i}') => {
	return val ? parseTime(val, format) : ''
}
