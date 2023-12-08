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
	'lyqqsb0f1lroirbvmn5uq2cigalmlcc9', // 6 访客管理
	'mnehxitknpynyf7ymvbqrvepxxuv19gz', // 幸福学堂
	'cb3hi2hwunjiel6hu3qeu5gnidic580l', // 1 党建引领
	'fecxcinhfzvmwoyfwkgcbykq8cx027d5', // 2 睦邻在线
	'rhxsblfjlhtlatvr6yuwtqxx01ahctvo', // 3 跳蚤市场
	'tptinhmrfh4qqdj68e7lo2lfj61aenpp', // 4 我要求助
	'mdeeggfbwdvp0vjfeikes1pvwb22gumd', // 5 便民热线
	'stmskymriwljg2yq3xkj6xl0fsvug0ko', // 7 活动中心
	'xf0jjulbifuwreacps3spurpe0t1yhdw', // 8 投票中心
	'ik3mp1vh2gvxrmnaoztr2omtlpgbhrri', // 9 幸运转盘
	'ackjlekm3dx1l9u7zczatliccrjzmulc', // 10 调查问卷
	'yvtw53zzy2qtjm7y0pewqrk4xp4cdod3', // 11 知识题
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
		menuList: []
	}),
	getters: {
		getAccessBtns() {
			return this.accessBtns || []
		},
		getMenuList() {
			return this.menuList || []
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
		async setAuthority() {
			/* 注册路由 */
			let data = []
			if (MENU_MOCK) {

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