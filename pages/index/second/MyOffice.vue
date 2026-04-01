<template>
	<view class="my-office">
		<view class="mine" @click="jumpUrl(officeItem)">我的办公室</view>
		<view class="list">
			<view class="item" v-for="item in listData" :key="item.id" @click="jumpUrl(item)">
				<image :src="getUrl(item.icon)"></image>
				<view class="name">{{ item.resourceTitle }}</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import {computed} from 'vue'
import {jumpUrl, getUrl} from "@/utils/tools";

const props = defineProps({
	list: Array
})

const listData = computed(() => props.list.filter(item => item.icon))
const officeItem = computed(() => props.list.find(item => !item.icon))
</script>

<style scoped lang="scss">
.my-office {
	.mine {
		height: 90rpx;
		width: 100%;
		background-image: linear-gradient(to left, #83c4ff, #ffffff);
		border-radius: 15rpx;
		line-height: 90rpx;
		font-size: 32rpx;
		font-weight: bolder;
		text-align: right;
		padding-right: 30rpx;
		&:after {
			content: '》'
		}
	}
	
	.list {
		margin-top: 20rpx;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		grid-gap: 20rpx;
		.item {
			width: 100%;
			height: 450rpx;
			position: relative;
			border-radius: 25rpx;
			overflow: hidden;
			image {
				width: 100%;
				height: 100%;
			}
			.name {
				font-size: 32rpx;
				font-weight: bolder;
				position: absolute;
				top: 30rpx;
				left: 50%;
				transform: translateX(-50%);
			}
		}
	}
}
</style>
