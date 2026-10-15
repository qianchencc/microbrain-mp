<template>
	<view class="content">
		<z-paging ref="paging" v-model="dataList" default-page-no="0" @query="queryList">
			<view class="tip-sticky">
				<view class="tip">若想开启<text class="strong">强提醒状态响铃+振动</text>，订阅时请勾选添加提醒</view>
			</view>
			<view class="list">
				<view class="device-item" v-for="item in dataList" :key="item.id">
					<view class="info">
						<view class="name">{{ item.deviceName }}</view>
						<view class="time">设备SN：{{ item.deviceSn }}</view>
					</view>
					<button class="subscribe-btn" :loading="item.loading" :disabled="item.loading"
						@click="subscribe(item)">{{ item.loading ? '订阅中' : '订阅' }}</button>
				</view>
			</view>
		</z-paging>
	</view>
</template>

<script setup>
	import { ref } from 'vue'
	import {fetchDevicePage, fetchDeviceSnTicket, saveAlarmUserSub} from "@/apis/user/device";

	const dataList = ref([])
	const paging = ref(null)

	const queryList = async (pageNo, pageSize) => {
		const res = await fetchDevicePage({ size: pageSize, page: pageNo })
		if (res && res.content) {
			paging.value.complete(res.content.content)
		} else {
			paging.value.complete(false)
		}
	}

	// 点击订阅：获取 snTicket -> 调微信设备订阅接口
	const subscribe = async (item) => {
		if (item.loading) return
		item.loading = true
		try {
			const res = await fetchDeviceSnTicket(item.id)
			if (!res || !res.content) return
			const snTicket = res.content
			// #ifdef MP-WEIXIN
			await new Promise((resolve) => {
				wx.requestSubscribeDeviceMessage({
					sn: item.deviceSn,
					snTicket: snTicket,
					modelId: item.modelId,
					tmplIds: [item.templateId],
					success: async (res) => {
						console.log('requestSubscribeDeviceMessage success', res)
						// 记录订阅配置ID到服务端
						await saveAlarmUserSub(item.id)
						uni.showToast({ title: '订阅成功', icon: 'success' })
						resolve()
					},
					fail: (err) => {
						console.error('requestSubscribeDeviceMessage fail', err)
						uni.showToast({ title: err.errMsg || '订阅失败', icon: 'none' })
						resolve()
					},
					complete: resolve
				})
			})
			// #endif
		} finally {
			item.loading = false
		}
	}
</script>

<style scoped lang="scss">
	// 滚动时吸附在顶部，背景与页面一致避免列表从留白处透出
	.tip-sticky {
		position: sticky;
		top: 0;
		z-index: 10;
		padding: 25rpx 25rpx 0;
		background-color: #f7f7f7;
	}

	.tip {
		padding: 20rpx 25rpx;
		font-size: 24rpx;
		color: #ed6a0c;
		background-color: #fff7e8;
		border-radius: 25rpx;

		.strong {
			font-weight: bold;
		}
	}

	.list {
		padding: 25rpx;
	}

	.device-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 25rpx;
		padding: 25rpx;
		background-color: white;
		border-radius: 25rpx;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);

		.name {
			font-size: 30rpx;
			font-weight: bolder;
			margin-bottom: 10rpx;
		}

		.time {
			color: #6a6a6a;
			font-size: 24rpx;
		}

		.subscribe-btn {
			flex: none;
			margin: 0 0 0 20rpx;
			height: 60rpx;
			line-height: 60rpx;
			padding: 0 30rpx;
			font-size: 26rpx;
			color: #fff;
			background: linear-gradient(to left, #86B5F4, #4790EF);
			border-radius: 30rpx;

			&::after {
				border: none;
			}

			// 覆盖微信默认禁用置灰样式，加载中仅降低透明度
			&[disabled]:not([type]) {
				color: #fff;
				background: linear-gradient(to left, #86B5F4, #4790EF);
				opacity: 0.6;
			}
		}
	}
</style>
