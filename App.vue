<script>
	import { useUserStoreHook } from '@/store/modules/user.js'
	import { getToken } from '@/utils/auth'
	import { initNfc } from '@/utils/NFC.js'
	import { usePermissionStoreHook } from '@/store/modules/permission'
	export default {
		onLaunch: function() {
			initNfc()
		},
		onShow: function() {
			if (getToken()) {
				usePermissionStoreHook().setAuthority()
				uni.reLaunch({
					url: '/pages/index/index'
				})
			} else {
				wx.login({
					provider: 'weixin',
					success: res => {
						useUserStoreHook().thirdLogin(res.code)
					}
				});
			}
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
