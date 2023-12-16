<script>
	import { useUserStoreHook } from '@/store/modules/user'
	import { usePermissionStoreHook } from '@/store/modules/permission'
	import { getToken } from '@/utils/auth'
	export default {
		onLaunch: function() {
			this.authLogin()
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		},
		methods: {
			authLogin() {
				if (getToken()) {
					usePermissionStoreHook().setAuthority()
				} else {
					// #ifdef MP-WEIXIN
					uni.login({
						provider: 'weixin', //使用微信登录
						success: function(loginRes) {
							useUserStoreHook().thirdLogin(loginRes.code)
						}
					})
					// #endif
					// #ifdef H5
					uni.navigateTo({
						url: '/pages/login/index'
					})
					// #endif
					// #ifdef APP-PLUS
					uni.getPushClientId({
						success(res) {
							console.log(res);
							let push_clientid = res.cid
							useUserStoreHook().thirdLogin(res.cid)
						}
					})
					// #endif
				}

			}
		}
	}
</script>

<style lang="scss">
	/*每个页面公共css */
	@import "common/css/uni.css";
	@import "common/css/common.css";
</style>