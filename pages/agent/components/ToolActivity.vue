<template>
	<view v-if="items.length" class="activity" aria-label="Agent 处理进度">
		<view v-for="(item, index) in items" :key="item.id" class="activity__item">
			<view class="activity__rail">
				<view :class="['activity__dot', `activity__dot--${item.status}`]">
					<uni-icons v-if="item.status === 'completed'" type="checkmarkempty" size="13" color="#ffffff" />
					<uni-icons v-else-if="item.status === 'failed' || item.status === 'skipped'" type="info" size="13" color="#7a5a17" />
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
	margin: 20rpx 0 26rpx;
	padding: 18rpx 20rpx;
	border-radius: 14rpx;
	background: rgba(23, 107, 84, 0.05);
	border: 1rpx solid rgba(23, 107, 84, 0.12);
	box-shadow: inset 0 2rpx 6rpx rgba(84, 68, 32, 0.07);

	&__item {
		display: flex;
		min-height: 84rpx;
	}

	&__rail {
		position: relative;
		width: 44rpx;
		flex: 0 0 44rpx;
	}

	&__dot {
		position: relative;
		z-index: 1;
		width: 30rpx;
		height: 30rpx;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: radial-gradient(circle at 34% 30%, #fffdf4, #d8ccab 70%, #b3a582);
		border: 2rpx solid #a4966f;
		box-shadow: inset 0 -2rpx 4rpx rgba(90, 70, 30, 0.28), 0 2rpx 4rpx rgba(84, 68, 32, 0.22);

		&--completed {
			background: radial-gradient(circle at 34% 30%, #9fe0be, #2f8f6b 60%, #17513c);
			border-color: #124634;
			box-shadow: inset 0 2rpx 2rpx rgba(255, 255, 255, 0.35), inset 0 -3rpx 5rpx rgba(0, 0, 0, 0.25), 0 3rpx 6rpx rgba(15, 63, 45, 0.35);
			animation: dot-pop 200ms ease-out;
		}

		&--running {
			background: radial-gradient(circle at 34% 30%, #fff3d6, #e3b96a 55%, #a8792f);
			border-color: #8a6428;
			box-shadow: inset 0 -2rpx 4rpx rgba(90, 60, 20, 0.4), 0 0 10rpx rgba(227, 185, 106, 0.5);
			animation: dot-pulse 1.4s ease-in-out infinite;
		}
	}

	&__line {
		position: absolute;
		top: 32rpx;
		left: 20rpx;
		width: 0;
		height: 52rpx;
		border-left: 2rpx dashed rgba(23, 107, 84, 0.28);
	}

	&__content {
		flex: 1;
		min-width: 0;
		padding: 0 0 20rpx 10rpx;
	}

	&__title {
		font-size: 26rpx;
		font-weight: 600;
		color: #2a3f33;
	}

	&__summary {
		margin-top: 8rpx;
		font-size: 23rpx;
		color: #6d7d71;
	}
}

@keyframes dot-pop {
	from { transform: scale(0.7); }
	to { transform: scale(1); }
}

@keyframes dot-pulse {
	0%, 100% { transform: scale(1); }
	50% { transform: scale(0.82); }
}

@media (prefers-reduced-motion: reduce) {
	.activity__dot { animation: none; }
}
</style>
