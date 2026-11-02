<script>
	import { useUserStoreHook } from '@/store/modules/user.js'
	import { getToken } from '@/utils/auth'
	import { initNfc } from '@/utils/NFC.js'
	import { usePermissionStoreHook } from '@/store/modules/permission'
	import { pickAgentLaunch, agentLaunchUrl, savePendingAgentLaunch, takePendingAgentLaunch, resolveLaunchAction, shouldHandleLaunch } from './utils/agent-launch-link.mjs'
	function currentRoute() {
		const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
		const last = pages[pages.length - 1]
		return last ? last.route : ''
	}
	export default {
		onLaunch: function() {
			initNfc()
		},
		onShow: async function(options) {
			// 卡片点击（冷启动与后台热启动）都在这里落地：先判定分支，再决定谁消费参数。
			// 只认 onShow 的 options；getEnterOptionsSync 每次回前台都会重复上报同一张卡片。
			const launch = pickAgentLaunch(options && options.path, options && options.query)
			const action = resolveLaunchAction({
				hasToken: Boolean(getToken()),
				currentPath: currentRoute(),
				launch: launch && shouldHandleLaunch(launch) ? launch : null
			})
			if (!getToken()) {
				if (action === 'login-restore') savePendingAgentLaunch(launch)
				wx.login({
					provider: 'weixin',
					success: async res => {
						await useUserStoreHook().thirdLogin(res.code, () => {
							const pending = takePendingAgentLaunch()
							return pending ? agentLaunchUrl(pending) : '/pages/index/index'
						})
					}
				});
				return
			}
			if (action === 'deliver') savePendingAgentLaunch(launch)
			else if (action === 'reopen') {
				// onShow 内同步 reLaunch 会被丢弃（实测页面栈不变），放到下一拍再跳。
				const url = agentLaunchUrl(launch)
				setTimeout(() => wx.reLaunch({ url }), 0)
			}
			if (getToken()) await usePermissionStoreHook().setAuthority()
		},
		onHide: function() {
			console.log('App Hide')
		},
		methods: {

		}
	}
</script>

<style lang="scss">
	/*每个页面公共css */
	@import "common/css/uni.css";
	@import "common/css/common.css";

	page {
		background-color: #F7F7F7;
	}
</style>
