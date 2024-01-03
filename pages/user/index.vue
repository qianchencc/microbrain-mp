<template>
	<view class="content">
		<view class="header-view">
			<view class="header">
				<img v-if="userInfo.avatar" class="header-image" :src="globalConfig.ssoUrl+userInfo.avatar">
				<view v-else class="header-image title-avatar">
					<text>
						{{userInfo.nickname?userInfo.nickname.charAt(0):userInfo.code.charAt(0)}}
					</text>
				</view>
				<view>
					<h3>
						{{userInfo.nickname||userInfo.code}}
					</h3>
					<!-- <view>{{userInfo.code}}</view> -->
					<uni-tag :mark="true" :text="faceAuthStatus[userInfo.faceAuthStatus].text" :type="faceAuthStatus[userInfo.faceAuthStatus].type" size="mini" />
				</view>
				<view class="edit-con" @click="changeAvatar">
					<uni-icons type="compose" color="#3974F6" size="20"></uni-icons>
					<text style="font-size: 24rpx;">编辑</text>
				</view>
			</view>
			<view class="integral_list">
				<template v-for="(item,index) in integralList" :key="item.id">
					<view class="integral_item" @click="toWebView('ranking', item.url)">
						<image class="integral_icon" :src="item.icon" />
						<view class="integral_content">
							<view class="integral_number">
								{{item.value}}
							</view>
							<view class="integral_type">
								{{item.label}}
							</view>
						</view>
					</view>
					<view class="line" v-if="index < integralList.length - 1" />
				</template>
			</view>
		</view>
		<!-- <view class="list">
			<uni-list :border="false">
				<uni-list-item :border="false" title="我的物资" showArrow clickable @click="toWebView('epidemic')" />
			</uni-list>
		</view> -->
		<view class="list">
			<uni-list :border="false">
				<uni-list-item :border="false" title="组织确权" rightText="右侧文字" showArrow link="navigateTo" to="./owner">
					<template v-slot:footer>
						<view class="tag-view">
							<uni-tag :circle="true" :text="confirmationStatus[userInfo.confirmationStatus].text" :type="confirmationStatus[userInfo.confirmationStatus].type" />
						</view>
					</template>
				</uni-list-item>
			</uni-list>
		</view>
		<!-- <view class="list">
			<uni-list :border="false">
				<uni-list-item v-for="item in workOrderMenu" :key="item.title" :border="false" :title="item.title" showArrow clickable @click="toWorkOrder(item)" />
			</uni-list>
		</view> -->
		<view class="list">
			<uni-list :border="false">
				<uni-list-item :border="false" title="关于我们" showArrow link="navigateTo" to="./about" />
			</uni-list>
		</view>

		<!-- <view class="list">
			<uni-list :border="false">
				<uni-list-item :border="false" title="推送测试" showArrow clickable @click="pushTest" />
			</uni-list>
		</view> -->

	</view>
</template>

<script setup>
	import { computed, reactive } from 'vue'
	import { onShow } from '@dcloudio/uni-app'
	import globalConfig from '@/config'
	import { COOKIE_DOMAIN, SCHEME, zztServer } from '@/config/settings'
	import { useUserStoreHook } from '@/store/modules/user'
	import { faceAuthStatus, confirmationStatus } from './utils/enums.js'
	const userInfo = computed(() => useUserStoreHook().getUserInfo)

	const changeAvatar = () => {
		uni.navigateTo({
			url: './principal'
		})
	}

	const workOrderMenu = [{
			title: '我的任务',
			url: '/pages/myTask/index?accept=true'
		},
		{
			title: '投诉中心',
			url: '/pages/complaint/index'
		},
		{
			title: '报修中心',
			url: '/pages/repairs/index'
		},
		{
			title: '矛调中心',
			url: '/pages/contradict/index'
		}
	]

	function toWorkOrder(item) {
		// #ifdef MP-WEIXIN
		uni.navigateTo({
			url: '/pages/webView/index?path=' + SCHEME + COOKIE_DOMAIN + '/workorder' + '/#' + item.url
		})
		// #endif
		// #ifdef H5
		location.href = SCHEME + COOKIE_DOMAIN + '/workorder' + '/#' +
			`/pages/user/workorder/list?title=${item.title}&detailTitle=${item.detailTitle}&type=${item.type}`
		// #endif
	}

	function toWebView(domain, url) {
		uni.navigateTo({
			url: `/pages/webView/index?path=${SCHEME}${COOKIE_DOMAIN}/${domain}/#/${url || ''}`
		})
	}
	const integralList = reactive([{
			label: '信用积分',
			value: 0,
			icon: '/static/images/user/icon_xyjf.png'
		},
		{
			label: '富春积分',
			value: 0,
			icon: '/static/images/user/icon_wsjf.png',
			url: 'pages/index/index'
		}
	])
	const goToPath = (val) => {
		if (!val) return
		uni.navigateTo({
			url: val
		})
	}
	const pushTest = () => {
		// const data = { "push_clientid": "a8a9bad564747be64d026a6aa0c4e553", "title": "消息提醒", "content": "工作提醒：您对苏州新捷正科技有限公司吴昌英发出的邀约已被接受", "payload": "877" }
		// const json = JSON.stringify(data)
		// console.log(json);
		// uni.request({
		// 	method: 'POST',
		// 	header: {
		// 		"content-type": 'application/json'
		// 	},
		// 	url: 'https://fc-mp-5f22d5b4-17e7-4822-ac80-68d07c2a2201.next.bspapp.com/push',
		// 	data,
		// 	success(res) {
		// 		console.log(res);
		// 	}
		// })
		// #ifdef MP-WEIXIN

		// #endif
		const data = {
			touser: "oiSqO602XfqfqhclCy_aIqLNF7wQ",
			template_id: "w_uQuByW3kkgiCxminzynXIO1NOYtixfR1JTe0BTEis",
			page: "pages/messages/index", // 小程序页面地址
			miniprogram_state: "developer", // 跳转小程序类型：developer为开发版；trial为体验版；formal为正式版；默认为正式版
			lang: "zh_CN",
			data: {
				name5: {
					value: "张三"
				},
				phone_number19: {
					value: "15695128837"
				},
				date7: {
					value: "2015年01月05日"
				},
				thing1: {
					value: '来看你了'
				}
			}
		}
		uni.request({
			method: 'POST',
			url: 'https://fc-mp-5f22d5b4-17e7-4822-ac80-68d07c2a2201.next.bspapp.com/weixinMpPush',
			data,
			success(res) {
				console.log(res);
			}
		})
		// uni.request({
		// 	url: 'https://api.weixin.qq.com/cgi-bin/user/tag/get?access_token=75_WN7228Vo62CFHXNzbUvq6w1trKsnPnA3UkE0Oqurf8ySmCcp65gJIH_nSe27Kmm8pEK-Kb6v7Dj_nne7Hrro1vKMlkTGkgtqZ6nscd5HQ7Jbj-O0mqoI9Gap8RMFRDiAEASEQ',
		// 	method: 'POST',
		// 	data: {
		// 		tagid: 102,
		// 		next_openid: ''
		// 	},
		// 	success(res) {
		// 		console.log(res);
		// 	}

		// })
		// uniCloud.callFunction({
		// 	name: 'weixin-mp-push',
		// 	data,
		// 	success(res) {
		// 		console.log(res);
		// 	},
		// })
	}
</script>

<style lang="scss" scoped>
	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;

		.header-view {
			width: 100%;
			background-color: #3974F6;
			background-position: center;
			background-repeat: no-repeat;
			background-size: cover;
		}

		.integral_list {
			width: 700upx;
			height: 140upx;
			background: #FFFFFF;
			border-radius: 15upx 15upx 0px 0px;
			margin: 0 auto;
			display: flex;
			align-items: center;
			justify-content: space-between;

			.integral_item {
				flex: 1;
				display: flex;
				align-items: center;
				justify-content: center;

				.integral_icon {
					width: 58upx;
					height: 58upx;
					margin-right: 22upx;
				}

				.integral_number {
					line-height: 1;
					font-size: 36upx;
					color: #262626;
				}

				.integral_type {
					line-height: 1;
					font-size: 26upx;
					color: #666666;
				}
			}

			.line {
				flex: none;
				width: 2upx;
				height: 80upx;
				background: #EDEDED;
			}
		}

		.header {
			width: 100%;
			display: flex;
			align-items: center;
			padding: 10rpx 0;
			color: #fff;
			margin-bottom: 10rpx;

			.header-image {
				width: 116rpx;
				height: 116rpx;
				border-radius: 50%;
				margin: 30rpx;
				border: 12upx solid rgba(255, 255, 255, .2);
			}

			.title-avatar {
				font-size: 80rpx;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.edit-con {
				width: 115rpx;
				height: 60rpx;
				padding: 10rpx;
				background: #FFFFFF;
				border-radius: 35rpx 0px 0px 35rpx;
				color: #3974F6;
				position: absolute;
				right: 0;
				display: flex;
				align-items: center;
				justify-content: space-around;
			}
		}

		.list {
			width: 700rpx;
			margin: 10rpx 0;
			background-color: #fff;
			border-radius: 15rpx;
			padding: 10rpx 0;
		}
	}
</style>