<template>
	<view class="content">
		<view class="header-view">
			<view class="header">
				<img v-if="userInfo.avatar" class="header-image" :src="globalConfig.fileAddr+userInfo.avatar">
				<view v-else class="header-image title-avatar">
					<text>
						{{userInfo.nickname?userInfo.nickname.charAt(0):userInfo.code.charAt(0)}}
					</text>
				</view>
				<view>
					<h3>
						{{userInfo.nickname}}
					</h3>
					<view>{{userInfo.code}}</view>
					<uni-tag v-if="userInfo.faceAuthStatus" :mark="true" :text="faceAuthStatus[userInfo.faceAuthStatus].text" :type="faceAuthStatus[userInfo.faceAuthStatus].type" size="mini" />
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
				<!--<uni-list-item :border="false" title="我是达人" showArrow clickable @click="toWebView('master')" />-->
				<uni-list-item :border="false" title="我是业主" showArrow link="navigateTo" to="./owner" />
				<uni-list-item :border="false" title="我是租户" showArrow link="navigateTo" to="./tenant" />
			</uni-list>
		</view>
		<view class="list">
			<uni-list :border="false">
				<uni-list-item v-for="item in workOrderMenu" :key="item.title" :border="false" :title="item.title" showArrow clickable @click="toWorkOrder(item)" />
			</uni-list>
		</view>
		<view class="list">
			<uni-list :border="false">
				<uni-list-item :border="false" title="关于我们" showArrow link="navigateTo" to="./about" />
			</uni-list>
		</view>

	</view>
</template>

<script setup>
	import { computed, reactive } from 'vue'
	import { onShow } from '@dcloudio/uni-app'
	import globalConfig from '@/config'
	import { COOKIE_DOMAIN, SCHEME, zztServer } from '@/config/settings'
	import { useUserStoreHook } from '@/store/modules/user'
	import { fetchIntegralAccount } from '@/apis/news_info/index'
	import { fetchOwnerAllInfo, fetchOwnerCheck } from "@/apis/village/owner.js"

	const userInfo = computed(() => useUserStoreHook().getUserInfo)

	const faceAuthStatus = {
		'TO_BE_AUTH': {
			text: '待认证',
			type: 'warning'
		},
		'TO_BE_CHECK': {
			text: '待审核',
			type: 'warning'
		},
		'CHECK_REJECT': {
			text: '审核失败',
			type: 'error'
		},
		'CHECK_SUCCESS': {
			text: '已认证',
			type: 'success'
		}
	}

	const changeAvatar = () => {
		uni.navigateTo({
			url: './principal'
		})
	}

	// 工单类型
	const WorkOrderType = {
		REPAIR: 'REPAIR',
		DEFECT: 'DEFECT',
		COMPLAIN: 'COMPLAIN',
		CONTRADICTION: 'CONTRADICTION'
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
</script>

<style lang="scss" scoped>
	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;

		.header-view {
			width: 100%;
			background-color: #09C888;
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
			padding: 10rpx;
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