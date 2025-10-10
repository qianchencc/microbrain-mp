import subscriptions from '@/config/subscriptionsSetting.js'

// 判断订阅消息状态
export const setSubscribeMessages = (menu, type) => {
	const name = menu.split('/')[0]
	let tmplIds = []
	try {
		tmplIds = subscriptions[name][type]
	} catch (e) {
		tmplIds = []
	}
	uni.requestSubscribeMessage({
		tmplIds: tmplIds, // 小程序订阅消息模板id
		success: () => {},
		fail: (e) => {}
	});
}
