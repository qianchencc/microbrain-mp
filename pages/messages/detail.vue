<template>
	<view class="content">
		<z-paging ref="paging" v-model="dataList" default-page-no="0" @query="queryList">
			<view class="notify-con" v-for="item in dataList" :key="item.id">
				<view class="img-con">
					<span v-if="item.count" class="img-badge">
						<text class="count">{{item.count}}</text>
					</span>
					<image class="info-img" :src="messagesType[item.notifyType].src" mode="aspectFit"></image>
				</view>
				<view class="notify-info">
					<view class="info-con">
						<view class="info-title">
							<text> 邀约接受 </text>
							<uni-dateformat style="font-size: 14px;color: #999;" :date="item.createdAt" format="MM-dd hh:mm" :threshold="[60000, 201600000]"></uni-dateformat>
						</view>
						<view class="info-note">
							{{item.notifyContent}}
						</view>
					</view>
				</view>
			</view>
		</z-paging>
	</view>
</template>

<script setup>
	import { ref, computed } from 'vue'
	import { onLoad, onReady } from '@dcloudio/uni-app'
	import { useUserStoreHook } from '@/store/modules/user'
	import { fetchNotifyPage, changeMesState } from '@/apis/messages/recipient'
	import { messagesType } from './enums'
	import { COOKIE_DOMAIN, SCHEME } from '@/config/settings'
	import { getToken } from '@/utils/auth'
	const notifyId = ref('')
	const paging = ref(null)
	const dataList = ref([])
	const userInfo = computed(() => useUserStoreHook().getUserInfo)

	const queryList = async (pageNo, pageSize) => {
		const params = {
			page: pageNo,
			size: pageSize,
			recipientId: userInfo.value.id,
			notifyId: notifyId.value,
			sort: 'createdAt,desc'
		}
		const res = await fetchNotifyPage(params)
		if (res.content.content) {
			paging.value.complete(res.content.content)
		} else {
			paging.value.complete(false)
		}
	}

	const clicked = (item) => {
		const msgType = messagesType[notifyId.value]
		const options = msgType.options || []
		const navigatePage = msgType.page ? msgType.target : '/pages/webView/index?'

		const path = SCHEME + COOKIE_DOMAIN + `/${msgType.key.toLocaleLowerCase()}` + '/#' + msgType.target
		options.push(`id=${item.targetId}`) // 信息详情记录ID
		// #ifdef MP-WEIXIN
		options.push(`path=${path}`)
		uni.navigateTo({
			url: navigatePage + arr2String(msgType.options),
			success: () => {
				// 修改已读未读状态
				changeMesState(item.recipientId, item.notifyId)
			}

		})
		// #endif
		// #ifdef H5
		if (msgType.page) { // 内部页面跳转
			uni.navigateTo({
				url: msgType.target,
				success: () => {
					// 修改已读未读状态
					changeMesState(item.recipientId, item.notifyId)
				}

			})
		} else {
			options.push(`token=${getToken()}`)
			options.push(`district=${useUserStoreHook().getDistrict.id}`)
			location.href = path + '?' + arr2String(msgType.options)
		}
		// #endif
	}

	function arr2String(arr) {
		return arr && arr.length ? arr.join('&') : ''
	}

	onLoad((option) => {
		notifyId.value = option.notifyId
		uni.setNavigationBarTitle({
			title: messagesType[notifyId.value].name || '其他消息'
		})
	})
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
		// align-items: center;

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
			width: 560rpx;

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
				overflow: hidden;
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