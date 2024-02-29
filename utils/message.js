import { fetchUnreadNotifyCount } from '@/apis/messages/recipient'

export const getUnreadNotifyCount = async () => {
	const res = await fetchUnreadNotifyCount()
	if (!res) return
	if (res.content !== 0) {
		uni.setTabBarBadge({
			index: 1,
			text: res.content + ''
		})
	} else {
		uni.removeTabBarBadge({
			index: 1
		})
	}
}