import { useUserStoreHook } from '@/store/modules/user.js'
import { changeClientId } from '@/apis/user/principal.js'
export const appLogin = () => {
	uni.getPushClientId({
		success(res) {
			let push_clientid = res.cid
			changeClientId(push_clientid)
		}
	})

	uni.onPushMessage((res) => {
		uni.showModal({
			title: res.data.title,
			content: res.data.content
		});
	})

}