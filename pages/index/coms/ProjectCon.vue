<template>
	<view class="project-con">
		<view class="tip">
			<view class="bar"></view>
			<text>为您查到以下项目</text>
		</view>
		<view class="list">
			<view class="item" hover-class="item-hover" v-for="(item, index) in list" :key="index" @click="toDetail(item)">
				<image class="cover" src="/static/project.png" mode="aspectFit"></image>
				<view class="info">
					<view class="name">{{ item.name }}</view>
					<view class="code">项目编号：{{ item.code }}</view>
				</view>
				<view class="arrow"></view>
			</view>
		</view>
	</view>
</template>

<script>
import {goPage} from "@/utils/tools";

export default {
	name: "ProjectCon",
	props: {
		list: {
			type: Array,
			default: () => []
		}
	},
	computed: {
	},
	methods: {
		toDetail(item) {
			goPage(`/pages/detail/project?code=${item.code}`)
		}
	}
}
</script>

<style scoped lang="scss">
.project-con {
	width: 100%;
	box-sizing: border-box;
	background-color: #ffffff;
	border-radius: 24rpx;
	padding: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(57, 116, 246, 0.08);

	.tip {
		display: flex;
		align-items: center;
		font-size: 28rpx;
		font-weight: 600;
		color: #333333;
		margin-bottom: 10rpx;

		.bar {
			width: 8rpx;
			height: 28rpx;
			border-radius: 4rpx;
			background: linear-gradient(to bottom, #3974F6, #6FA8FF);
			margin-right: 12rpx;
		}
	}

	.item {
		display: flex;
		align-items: center;
		padding: 20rpx 0;
		border-bottom: 2rpx solid #f2f2f2;

		&:last-child {
			border-bottom: none;
			padding-bottom: 4rpx;
		}

		&.item-hover {
			opacity: 0.7;
		}

		.cover {
			width: 88rpx;
			height: 88rpx;
			flex-shrink: 0;
			margin-right: 20rpx;
			border-radius: 16rpx;
			background-color: #f5f8ff;
		}

		.info {
			flex: 1;
			min-width: 0;

			.name {
				font-size: 26rpx;
				color: #333333;
				line-height: 1.4;
				overflow: hidden;
				text-overflow: ellipsis;
				display: -webkit-box;
				-webkit-box-orient: vertical;
				-webkit-line-clamp: 2;
			}

			.code {
				margin-top: 8rpx;
				font-size: 22rpx;
				color: #999999;
			}
		}

		.arrow {
			width: 14rpx;
			height: 14rpx;
			flex-shrink: 0;
			margin-left: 16rpx;
			border-top: 3rpx solid #cccccc;
			border-right: 3rpx solid #cccccc;
			transform: rotate(45deg);
		}
	}
}
</style>
