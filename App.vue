<script>
	import { useUserStoreHook } from '@/store/modules/user.js'
	import { getToken } from '@/utils/auth'
	import { wxLogin } from '@/utils/wxLogin.js'
	import { appPush } from '@/utils/appPush.js'
	import { initNfc } from '@/utils/NFC.js'
	import { openBle } from '@/utils/blue.js'
	import { getUnreadNotifyCount } from '@/utils/message.js'
	import { usePermissionStoreHook } from '@/store/modules/permission'
	export default {
		onLaunch: function() {
			// #ifdef MP-WEIXIN
			initNfc()

			// #endif
		},
		onShow: function() {
			// 获取未读消息数量
			getUnreadNotifyCount()
			// #ifdef MP-WEIXIN
			// uni.openBluetoothAdapter({
			// 	success: e => {
			// 		console.log('初始化蓝牙成功:' + e.errMsg);
			// 		openBle();
			// 	},
			// 	fail: e => {
			// 		console.log('初始化蓝牙失败，错误码：' + (e.errCode || e.errMsg));
			// 	}
			// });
			// #endif

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

	page {
		background-color: #F7F7F7;
	}
</style>