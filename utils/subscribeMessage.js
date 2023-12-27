import subscriptions from '@/config/subscriptionsSetting.js'

// 判断订阅消息状态
export const setSubscribeMessages = (menu, type) => {
	let tmplIds = []
	try {
		tmplIds = subscriptions[menu][type]
	} catch (e) {
		tmplIds = []
	}
	uni.requestSubscribeMessage({
		tmplIds: tmplIds, // 小程序订阅消息模板id
		success: () => {},
		fail: (e) => {}
	});
}