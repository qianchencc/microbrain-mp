<template>
	<view class="con">
		<scroll-view class="container" scroll-y="true">
			<view class="cu-form">
				<image class="cu-imgs" src="@/static/logo.png"></image>
				<view class="cu-title">{{appInfo.name||'智慧园区微脑控制系统V1.0'}}</view>
				<view class="cu-subtitle">Version {{appInfo.version||'1.0.0'}}</view>
			</view>
			<view class="info">
				<uni-list :border="false">
					<uni-list-item title="联系单位" rightText="新世纪智慧城市研究院"></uni-list-item>
					<uni-list-item title="联系电话" rightText="0577-88928119"></uni-list-item>
					<uni-list-item title="联系邮箱" rightText="admin@577119.com"></uni-list-item>
					<uni-list-item title="地址" note="浙江省温州市上江路新世纪商务大厦B幢6F"></uni-list-item>
					<!-- <uni-list-item title="服务协议" link to="/pages/user/treaty"></uni-list-item>
					<uni-list-item title="隐私政策" link to="/pages/user/policy"></uni-list-item> -->
				</uni-list>
			</view>
		</scroll-view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				appInfo: {
					version: '',
					name: ''
				}
			}
		},
		onLoad() {
			const accountInfo_uni = uni.getAccountInfoSync();
			console.log('uni.getAccountInfoSync', accountInfo_uni); // 小程序 appId
			const accountInfo_wx = wx.getAccountInfoSync();
			console.log('wx.getAccountInfoSync', accountInfo_wx); // 小程序 appId
			// #ifdef APP-PLUS
			plus.runtime.getProperty(plus.runtime.appid, (wgtinfo) => {
				this.appInfo.version = wgtinfo.version
				this.appInfo.name = wgtinfo.name
			})
			// #endif
			// #ifdef MP-WEIXIN
			const accountInfo = wx.getAccountInfoSync();
			this.appInfo.version = accountInfo.miniProgram.version
			// #endif
		},
		methods: {

		}
	}
</script>
<style lang="scss" scoped>
	.con {
		.container {
			position: relative;

			.cu-form {
				height: 580rpx;
				background-color: #FFFFFF;
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
	}

	.info {
		padding: 40rpx;
		background-color: #FFFFFF;
	}

	.m-button {
		margin-top: 20rpx;
		background-color: #FFFFFF;
		// color: #e43d33;
	}
</style>