<template>
	<view class="composer">
		<textarea
			class="composer__input"
			:value="modelValue"
			:disabled="disabled"
			:auto-height="true"
			maxlength="200"
			placeholder="输入设备指令"
			placeholder-class="composer__placeholder"
			@input="$emit('update:modelValue', $event.detail.value)"
			@confirm="$emit('send')"
		/>
		<button v-if="running" class="composer__button composer__button--stop" aria-label="停止" @click="$emit('stop')">
			<uni-icons type="smallcircle-filled" size="20" color="#f4e9cf" />
		</button>
		<button v-else class="composer__button" :disabled="disabled || !modelValue.trim()" aria-label="发送" @click="$emit('send')">
			<uni-icons type="paperplane-filled" size="20" color="#4a3010" />
		</button>
	</view>
</template>

<script setup>
	defineProps({
		modelValue: {
			type: String,
			default: ''
		},
		disabled: Boolean,
		running: Boolean
	})
	defineEmits(['update:modelValue', 'send', 'stop'])
</script>

<style lang="scss" scoped>
.composer {
	display: flex;
	align-items: flex-end;
	gap: 16rpx;
	min-height: 104rpx;
	padding: 16rpx 18rpx;
	border: 1rpx solid #b9ac8c;
	border-radius: 22rpx;
	background: linear-gradient(180deg, #f8f4ea 0%, #efe9d9 100%);
	box-shadow: inset 0 6rpx 14rpx rgba(84, 68, 32, 0.13), inset 0 -2rpx 0 rgba(255, 255, 255, 0.7), 0 14rpx 28rpx rgba(4, 16, 11, 0.35);

	&__input {
		width: 0;
		min-height: 64rpx;
		max-height: 168rpx;
		flex: 1;
		padding: 13rpx 4rpx;
		font-size: 28rpx;
		line-height: 1.45;
		color: #22332a;
	}

	&__placeholder {
		color: #a9a08a;
	}

	&__button {
		width: 72rpx;
		height: 72rpx;
		flex: 0 0 72rpx;
		padding: 0;
		border-radius: 50%;
		line-height: 72rpx;
		background: radial-gradient(circle at 32% 28%, #ffefc2 0%, #d9ad63 55%, #a5793a 100%);
		border: 2rpx solid #8a6428;
		box-shadow: inset 0 2rpx 3rpx rgba(255, 255, 255, 0.5), inset 0 -4rpx 8rpx rgba(90, 60, 20, 0.4), 0 6rpx 14rpx rgba(4, 16, 11, 0.4);

		&::after {
			border: 0;
		}

		&[disabled] {
			background: radial-gradient(circle at 32% 28%, #e8e2d2 0%, #c2b89e 55%, #a49a80 100%);
			border-color: #978d73;
			box-shadow: inset 0 2rpx 3rpx rgba(255, 255, 255, 0.4), inset 0 -3rpx 6rpx rgba(90, 80, 50, 0.3);
		}

		&--stop {
			background: radial-gradient(circle at 32% 28%, #6a8578 0%, #35544a 55%, #22392f 100%);
			border-color: #16281f;
		}

		&:active {
			transform: translateY(2rpx);
			box-shadow: inset 0 4rpx 10rpx rgba(0, 0, 0, 0.35);
		}
	}
}
</style>
