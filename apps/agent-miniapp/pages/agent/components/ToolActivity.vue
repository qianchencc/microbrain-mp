<template>
	<view v-if="items.length" class="activity" aria-label="Agent 处理进度">
		<view v-for="(item, index) in items" :key="item.id" class="activity__item">
			<view class="activity__rail">
				<view :class="['activity__dot', { 'activity__dot--done': item.status === 'completed' }]">
					<uni-icons v-if="item.status === 'completed'" type="checkmarkempty" size="14" color="#ffffff" />
				</view>
				<view v-if="index < items.length - 1" class="activity__line" />
			</view>
			<view class="activity__content">
				<view class="activity__title">{{ item.label || labels[item.tool] || '处理设备请求' }}</view>
				<view v-if="item.summary" class="activity__summary">{{ item.summary }}</view>
			</view>
		</view>
	</view>
</template>

<script setup>
	defineProps({
		items: {
			type: Array,
			default: () => []
		}
	})

	const labels = {
		find_device_candidates: '检索设备候选',
		inspect_device_capabilities: '核验设备能力',
		read_device_states: '查询设备状态',
		propose_action_draft: '生成操作草案'
	}
</script>

<style lang="scss" scoped>
.activity {
	margin: 28rpx 0 32rpx;

	&__label {
		margin-bottom: 18rpx;
		font-size: 24rpx;
		font-weight: 600;
		color: #69766f;
	}

	&__item {
		display: flex;
		min-height: 86rpx;
	}

	&__rail {
		position: relative;
		width: 42rpx;
		flex: 0 0 42rpx;
	}

	&__dot {
		position: relative;
		z-index: 1;
		width: 30rpx;
		height: 30rpx;
		border: 3rpx solid #91aa9d;
		border-radius: 50%;
		background: #f7f9f8;
		display: flex;
		align-items: center;
		justify-content: center;

		&--done {
			border-color: #176b54;
			background: #176b54;
		}
	}

	&__line {
		position: absolute;
		top: 30rpx;
		left: 14rpx;
		width: 2rpx;
		height: 56rpx;
		background: #bfd0c7;
	}

	&__content {
		padding: 0 0 20rpx 8rpx;
	}

	&__title {
		font-size: 28rpx;
		font-weight: 600;
		color: #1d2923;
	}

	&__summary {
		margin-top: 8rpx;
		font-size: 24rpx;
		color: #6b7771;
	}
}
</style>
