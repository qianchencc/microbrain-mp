import { defineStore } from 'pinia'
import { store } from '@/store'
import { MENU_MOCK, BASE_NAME, SCHEME, COOKIE_DOMAIN } from '@/config/settings'
import resource from '@/config/menu.json'
import { getAllDictMap } from '@/apis/user/dict'
import { getResourceTree } from '@/apis/user/menu'
import { storageSet, storageGet } from '@/utils/storage'
import { useUserStoreHook } from '@/store/modules/user'

// generate access btns
const generateBtns = (routes) => {
	const permissionBtns = []
	const c = (routes, cname = '') => {
		routes.forEach(route => {
			const {
				type,
				name,
				children
			} = route
			if (type === 'BUTTON') permissionBtns.push((cname + '-' + name).slice(1))
			if (children && children.length) c(children, cname + '-' + route.name)
		})
	}
	c(routes)
	return permissionBtns
}

// 菜单uri不改变
const noChangeUri = ['miniAppId', 'http', 'wxProgram'];

const defaultIndex = [
	'cb3hi2hwunjiel6hu3qeu5gnidic580l', // 1 党建引领
	'ebiu0rbag72oysevwitsjvuv8pjfqka4', // 2 智慧门禁
	'pfi0bimwq4cwlwb30fpmkcuaokcloeer', // 3 智慧停车
	'braam9wwxsy9vphu2omy7aevrfegvt3y', // 4 视频监控
	'yj7syptaz0vkpdfk3duqptti6nzzvd7l', // 5 智慧巡更
	'vhfvtycebjqorpijhcj7u8gqwpaeamj7', // 6 访客管理
	'pxstjr5bjr7eh3mf5ui4rofdbpfzf3je', // 7 空间预约
	'qb9vtuad3ruonmsmdi2rm9rqrsoej8b9', // 8 能耗管理
	'y0z8vu9wigh52gfehulmmdcfo7yn3xu5', // 9 事件协同
];

const all = {
	'id': 'slwy6vw13hyu1dd5l0p3kjo3zxxvl0rk',
	'resourceType': 'MODULE',
	'uri': '/all',
	'icon': 'icon_gd.png',
	'name': 'all',
	'title': '更多'
}

export const usePermissionStore = defineStore({
	id: 'ehe-permission',
	state: () => ({
		accessBtns: [],
		menuList: [],
		homeMenuIndex: storageGet('homeMenuIndex') || defaultIndex
	}),
	getters: {
		getAccessBtns() {
			return this.accessBtns || []
		},
		getMenuList() {
			return this.menuList || []
		},
		getHomeMenuIndex() {
			return this.homeMenuIndex || storageGet('homeMenuIndex')
		},
		getHomeMenu() {
			// 合并子模块菜单，整理出全部菜单
			const allMenu = this.getMenuList.reduce((a, b) => a.concat(b.children), [])
			// 过滤出首页应该显示菜
			const allHomeMenu = allMenu.filter((val) => defaultIndex.includes(val.id))
			// 菜单排序
			const homeMenu = allHomeMenu.sort((a, b) => defaultIndex.indexOf(a.id) - defaultIndex.indexOf(b.id))
			homeMenu.push(all)
			return homeMenu
		}
	},
	actions: {
		setHomeMenuIndex(homeMenuIndex) {
			this.homeMenuIndex = homeMenuIndex
			storageSet('homeMenuIndex', homeMenuIndex)
		},
		async setAuthority() {
			/* 注册路由 */
			let data = []
			if (true || MENU_MOCK) {

				data = resource.find((v) => v.name === BASE_NAME).children
			} else {
				const {
					content: resourceData
				} = await getResourceTree({
					resourceCode: BASE_NAME
				})
				data = resourceData[0].children
			}
			data.forEach(ele => {
				ele.children.forEach(val => {
					// 根据uri值，配置不同的跳转方式
					// 1.uri包含http,属于外部跳转
					// 2.uri不包含http,输入内部跳转，指定子页面
					// 3.uri包含miniAppId, 属于小程序跳转
					if (noChangeUri.every(item => !val.uri.includes(item))) {
						val.uri = SCHEME + COOKIE_DOMAIN + `/${val.name.toLocaleLowerCase()}` + (val.uri || '/')
					}
				})
			})
			this.menuList = data
			this.accessBtns = generateBtns(data)
			useUserStoreHook().setGeospatialInfo()
			useUserStoreHook().setUserInfo()
		}
	}
})

export function usePermissionStoreHook() {
	return usePermissionStore(store)
}