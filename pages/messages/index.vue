<template>
	<view class="content">
		<z-paging ref="paging" v-model="dataList" default-page-no="0" @query="queryList">
			<view class="notify-con" v-for="item in dataList" :key="item.id" @tap="clicked(item)">
				<view class="img-con">
					<span v-if="item.count" class="img-badge">
						<text class="count">{{item.count}}</text>
					</span>
					<img v-if="item.appIconUrl" class="info-img" :src="globalConfig.ssoUrl+ item.appIconUrl" mode="aspectFit">
					<image v-else class="info-img" src="../../static/images/messages/notify.png" mode="aspectFit"></image>
				</view>
				<view class="notify-info">
					<view class="info-con">
						<view class="info-title">
							<text>{{item.appName || '其他消息'}}</text>
							<uni-dateformat style="font-size: 14px;color: #999;" :date="item.createdAt" format="MM-dd hh:mm" :threshold="[60000, 201600000]"></uni-dateformat>
						</view>
						<view class="info-note uni-ellipsis">
							{{item.messageSubject+'：'+item.notifyContent}}
						</view>
					</view>
				</view>
			</view>
		</z-paging>
	</view>
</template>

<script setup>
	import { ref } from 'vue'
	import globalConfig from '@/config'
	import { onShow } from '@dcloudio/uni-app'
	import { getMyMessage, fetchUnreadNotifyCount } from '@/apis/messages/recipient'
	import { messagesType } from './enums'
	import { getUnreadNotifyCount } from '@/utils/message.js'
	const paging = ref(null)
	const dataList = ref([])

	onShow(() => {
		getUnreadNotifyCount()
	})

	const queryList = async (pageNo, pageSize) => {
		const res = await getMyMessage()
		if (res.content) {
			paging.value.complete(res.content)
		} else {
			paging.value.complete(false)
		}
	}

	const clicked = (item) => {
		uni.navigateTo({
			url: `./detail?appId=${item.appId}&appName=${item.appName}`
		})
	}
</script>

<style lang="scss" scoped>
	.notify-con {
		// width: 600rpx;
		border-radius: 15rpx;
		padding: 30rpx;
		margin: 20rpx 25rpx;
		background-color: #fff;
		display: flex;
		flex-direction: row;
		align-items: center;

		.img-con {
			width: 80rpx;
			height: 80rpx;
			background: #F5F5F5;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			position: relative;

			.img-badge {
				position: absolute;
				bottom: 30px;
				left: 30px;
				height: 15px;
				width: 15px;
				border-radius: 50%;
				background-color: #EF9035;
				display: flex;
				align-items: center;
				justify-content: center;

				.count {
					color: white;
					font-size: 10px;
				}
			}

			.info-img {
				width: 46rpx;
				height: 46rpx;
			}
		}

		.uni-badge-left-margin {
			margin-left: 10px;
		}

		.notify-info {
			width: 550rpx;
			margin-left: 10rpx;

			.info-title {
				margin-left: 15rpx;
				font-size: 32rpx;
				font-weight: 400;
				color: #262626;

				display: flex;
				justify-content: space-between;
			}

			.info-note {
				margin-left: 15rpx;
				font-size: 28rpx;
				font-weight: 400;
				color: #8F969F;
				border-bottom: 2px #F4F4F4 solid;
			}

			.info-time {
				display: flex;
				align-items: center;
				margin-top: 16rpx;

				.time-img {
					margin: 8rpx;
					width: 32rpx;
					height: 32rpx;
				}

				margin-left: 15rpx;
			}
		}

	}
</style>