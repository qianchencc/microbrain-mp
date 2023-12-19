<script>
	import { authLogin } from '@/utils/authLogin.js'
	import { useUserStoreHook } from '@/store/modules/user.js'
	import { getToken } from '@/utils/auth'
	import { usePermissionStoreHook } from '@/store/modules/permission'
	export default {
		onLaunch: function() {
			authLogin()
		},
		onShow: function() {
			console.log('App Show', getToken())
			if (getToken()) {
				usePermissionStoreHook().setAuthority()
			} else {
				// #ifdef MP-WEIXIN
				wxLogin()
				// #endif
				// #ifdef H5
				uni.navigateTo({
					url: '/pages/login/index'
				})
				// #endif
				// #ifdef APP-PLUS
				uni.getProvider({
					service: 'oauth',
					success: function(data) {
						if (data.provider.includes('univerify')) {
							uni.login({
								provider: 'univerify',
								univerifyStyle: {},
								success(res) { // 登录成功
									console.log(res.authResult); // {openid:'登录授权唯一标识',access_token:'接口返回的 token'}
									// 在得到access_token后，通过callfunction调用云函数
									uniCloud.callFunction({
										name: 'univerify-login', // 你的云函数名称
										data: res.authResult
									}).then(loginData => {
										console.log(loginData.result.data);
										useUserStoreHook().thirdLogin(loginData.result.data)
										// uni.closeAuthView()
									}).catch(err => {
										// 处理错误
									})
								},
								fail(res) { // 登录失败
									console.log(res)
									console.log(res.errMsg)
									// uni.closeAuthView()
								}
							})
						}
					}
				});
				// #endif
			}

		},
		onHide: function() {
			console.log('App Hide')
		}

	}
</script>

<style lang="scss">
	/*每个页面公共css */
	@import "common/css/uni.css";
	@import "common/css/common.css";
</style>