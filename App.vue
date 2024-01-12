<script>
	import { useUserStoreHook } from '@/store/modules/user.js'
	import { getToken } from '@/utils/auth'
	import { wxLogin } from '@/utils/wxLogin.js'
	import { appPush } from '@/utils/appPush.js'
	import { initNfc } from '@/utils/NFC.js'
	import { usePermissionStoreHook } from '@/store/modules/permission'
	export default {
		onLaunch: function() {
			// #ifdef MP-WEIXIN
			initNfc()

			// #endif
		},
		onShow: function() {

			if (getToken()) {
				usePermissionStoreHook().setAuthority()
			} else {
				// #ifdef MP-WEIXIN
				// wxLogin()
				uni.login({
					provider: 'weixin',
					success: res => {
						console.log(res);
						useUserStoreHook().thirdLogin(res.code)
					},
					fail: () => {},
					complete: () => {}
				});
				// #endif
				// #ifdef H5
				uni.navigateTo({
					url: '/pages/login/index'
				})
				// #endif
				// #ifdef APP-PLUS
				uni.navigateTo({
					url: '/pages/login/index'
				})

				// #endif
			}
		},
		onHide: function() {
			console.log('App Hide')
		},
		methods: {
			univerifyLogin() {
				console.log(useUserStoreHook().univerify);
				if (useUserStoreHook().univerify) {

				}
			}
		}

	}
</script>

<style lang="scss">
	/*每个页面公共css */
	@import "common/css/uni.css";
	@import "common/css/common.css";

	uni-page-wrapper {
		background-color: #F7F7F7;
	}
</style>