import { defineStore } from 'pinia'
import { store } from '@/store'
import {BASE_NAME, DOMAIN, isDev} from '@/config/settings'
import resource from '@/config/menu.json'
import { getResourceTree } from '@/apis/user/menu'
import { storageSet, storageGet } from '@/utils/storage'
import { useUserStoreHook } from '@/store/modules/user'
import { appPush } from '@/utils/appPush.js'
// generate access btns
const generateBtns = (routes) => {
	const permissionBtns = []
	const permissionIds = []
	const c = (routes, cname = '') => {
		routes.forEach(route => {
			const {
				type,
				name,
				children
			} = route
			permissionIds.push(route.id)
			if (type === 'BUTTON') permissionBtns.push((cname + '-' + name).slice(1))
			if (children && children.length) c(children, cname + '-' + route.name)
		})
	}
	c(routes)
	return {
		permissionBtns,
		permissionIds
	}
}

// 菜单uri不改变
const noChangeUri = ['miniAppId', 'http', 'wxProgram', 'toOtherApp'];

const dealResource = list => {
	list.forEach(item => {
		item.appId = item.id
		item.resourceName = item.name
		item.resourceTitle = item.title
		item.resourceType = item.type
		if (item.children && item.children.length) {
			dealResource(item.children)
		}
	})
}

const dealToMenu = list => {
	list.forEach(item => {
		if (item.resourceType === 'MENU') {
			// 根据uri值，配置不同的跳转方式
			// 1.uri包含http,属于外部跳转
			// 2.uri不包含http,输入内部跳转，指定子页面
			// 3.uri包含miniAppId, 属于小程序跳转
			if (noChangeUri.every(e => !item.uri?.includes(e))) {
				item.uri = DOMAIN + `/${item.resourceName.toLocaleLowerCase()}` + (item.uri || '/')
			}
		} else if (item.resourceType === 'MODULE') {
			item.uri = ''
		}
		if (item.children && item.children.length) dealToMenu(item.children)
	})
}

export const usePermissionStore = defineStore({
	id: 'ehe-permission',
	state: () => ({
		accessBtns: [],
		menuList: [],
		permissionIds: []
	}),
	getters: {
		getMenuList() {
			return this.menuList || []
		},
		getAllMenu() {
			let list = []
			this.menuList.forEach(item => {
				list.push(item)
				if (item.children && item.children.length) {
					list.push(...item.children)
				}
			})
			return list
		}
	},
	actions: {
		async setAuthority() {
			let data = [];
			if(isDev){
				dealResource(resource)
				data = resource[0].children;
			} else {
				const { content: resourceData } = await getResourceTree({ resourceCode: BASE_NAME })
				data = resourceData?.children || []
			}
			dealToMenu(data)
			this.menuList = data;
			const { permissionBtns, permissionIds } = generateBtns(data)
			this.accessBtns = permissionBtns
			this.permissionIds = permissionIds
			useUserStoreHook().setGeospatialInfo()
			useUserStoreHook().setUserInfo()
			useUserStoreHook().setDict()
			// #ifdef APP-PLUS
			appPush()
			// #endif
		}
	}
})

export function usePermissionStoreHook() {
	return usePermissionStore(store)
}
