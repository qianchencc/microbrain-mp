<template>
	<view class="my-office">
		<view class="list">
			<view class="item" v-for="item in list" :key="item.id" @click="jumpUrl(item)">
				<view class="icon">
					<image :src="getUrl(item.icon)"></image>
				</view>
				<view class="name">{{ item.resourceTitle }}</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import {jumpUrl, getUrl} from "@/utils/tools";

const props = defineProps({
	list: Array
})
</script>

<style scoped lang="scss">
.my-office {
	.list {
		margin-top: 20rpx;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-gap: 20rpx;
		overflow: hidden;
		.item {
			width: 100%;
			padding: 20rpx;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			background-color: white;
			border-radius: 25rpx;
			.icon {
				width: 140rpx;
				height: 140rpx;
				display: flex;
				align-items: center;
				justify-content: center;
				background-color: #edf9fd;
				border-radius: 50%;
				margin-bottom: 15rpx;
				image {
					width: 100rpx;
					height: 100rpx;
				}
			}
			.name {
				font-size: 32rpx;
				font-weight: bolder;
			}
		}
	}
}
</style>
