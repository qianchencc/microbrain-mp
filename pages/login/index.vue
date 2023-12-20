<template>
	<view class="con">
		<view class="cu-form">
			<image class="cu-imgs" src="/static/logo.png"></image>
			<view class="cu-title">{{'智慧园区微脑控制系统'}}</view>
		</view>
		<!-- <button class="m-button" type="warn" open-type="getPhoneNumber" @getphonenumber="getPhoneNumber">
			微信一键登录
		</button> -->
		<button class="m-button" type="primary" :disabled="univerify" @click="getPhoneNumber">
			手机号快捷登录
		</button>
		<button class="m-button" type="default" @click="popupRef.open()">
			账号密码登录
		</button>
		<uni-popup ref="popupRef" type="bottom">
			<usernameLogin />
		</uni-popup>
	</view>
</template>

<script setup>
	import { useUserStoreHook } from '@/store/modules/user.js'
	import { ref } from 'vue';
	import usernameLogin from './usernameLogin.vue'
	const univerify = ref(true)
	const popupRef = ref(null)

	function init() {
		uni.preLogin({
			provider: 'univerify',
			success: () => { //预登录成功
				// 显示一键登录选项
				console.log('预登录成功');
				univerify.value = false
			},
			fail: (res) => { // 预登录失败
				// 不显示一键登录选项（或置灰）
				// 根据错误信息判断失败原因，如有需要可将错误提交给统计服务器
				console.log(res.errCode)
				console.log(res.errMsg)
				univerify.value = true
				// uni.navigateTo({
				// 	url: '/pages/login/index'
				// })
			}
		})
	}
	init()

	function getPhoneNumber(e) {
		uni.getProvider({
			service: 'oauth',
			success: function(data) {
				if (data.provider.includes('univerify')) {
					uni.login({
						provider: 'univerify',
						univerifyStyle: {},
						success(res) { // 登录成功
							uniCloud.callFunction({
								name: 'univerify-login', // 你的云函数名称
								data: res.authResult
							}).then(loginData => {
								if (loginData.result.success) {
									useUserStoreHook().thirdLogin(loginData.result.phoneNumber)
								}
							}).catch(err => {
								// 处理错误
							})
						},
						fail(res) { // 登录失败
							console.log(res)
							console.log(res.errMsg)
							uni.closeAuthView()

						}
					})
				}
			}
		});
	}

	function handledUsernameLogin() {

	}
</script>
<style lang="scss" scoped>
	.con {
		background-color: white;
		height: 100vh;

		.cu-form {
			height: 580rpx;
			// background-color: #FFFFFF;
			// background-image: url('@/static/img/user/user_about us_bg.png');
			background-size: 100% 250rpx;
			background-repeat: no-repeat;
			align-items: center;
			display: flex;
			flex-direction: column;
			justify-content: center;
			left: 270rpx;
			top: 150rpx;

			.cu-imgs {
				width: 184rpx;
				height: 184rpx;
			}

			.cu-title {
				color: #262626;
				font-size: 40rpx;
				font-weight: SourceHanSansCN-Normal;
				margin: 20rpx 0;
			}

			.cu-subtitle {
				color: #B6B7BA;
				font-size: 30rpx;
				font-weight: SourceHanSansCN-Normal;
			}
		}
	}

	.m-button {
		width: 70%;
		height: 88rpx;
		margin-top: 20rpx;
		border-radius: 44rpx;
		border: 1px solid #B6B7BA;

		.weixin-img {
			width: 30rpx;
			height: 30rpx;
		}
	}

	.button-cover {
		background-color: transparent;
		position: relative;
		top: -88rpx;
		height: 88rpx;
	}

	.isTrue {
		pointer-events: none;
	}

	.policy-box {
		margin: 20rpx 0;
		padding: 0 60rpx;
		display: flex;
		justify-content: center;
	}
</style>