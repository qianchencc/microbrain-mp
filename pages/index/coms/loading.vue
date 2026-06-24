<template>
	<view v-if="active !== null" class="loading">
		<template v-for="(item, index) in tips" :key="index">
			<view class="item" v-if="active >= index">
				<view class="image-con">
					<image v-if="active === index" src="/static/loading.png" mode="aspectFit"></image>
					<view class="done" v-else>{{ index + 1 }}️</view>
				</view>
				<view>{{ active > index ? item.done : item.wait }}</view>
			</view>
		</template>
	</view>
</template>

<script>
import {usePermissionStore} from "@/store/modules/permission";

export default {
	name: "Loading",
	data(){
		return {
			active: null,
			interval: null,
			tips: [
				{
					wait: '正在理解您的需求...',
					done: '已理解用户意图 '
				},
				{
					wait: '正在查找相关信息...',
					done: '已完成信息查询 '
				},
				{
					wait: '正在整理回复内容...',
					done: '已生成回复，即将输出 '
				}
			]
		}
	},
	mounted() {
		this.toStep(0)
	},
	computed: {
		waitTime() {
			return parseInt(usePermissionStore().getHelpBase?.waitTime) || 5000
		},
	},
	methods: {
		activeChange(num){
			this.active = num
			this.$emit('toLoading')
		},
		toStep(num){
			this.activeChange(num)
			if (this.active === this.tips.length - 1) return
			this.interval = setTimeout(() => {
				this.toStep(this.active + 1)
			}, this.waitTime)
		},
		toEnd(){
			clearTimeout(this.interval)
			this.interval = null
			this.activeChange(this.tips.length)
		}
	}
}
</script>

<style scoped lang="scss">
.loading {
	width: fit-content;
	padding: 15rpx 20rpx;
	background-color: white;
	border-radius: 15rpx;
	
	@keyframes loading {
		to {
			transform: rotate(360deg);
		}
	}
	
	.item {
		display: flex;
		align-items: center;
		padding: 10rpx 0;
		.image-con {
			$w: 30rpx;
			display: flex;
			align-items: center;
			justify-content: center;
			margin-right: 15rpx;
			image {
				width: $w;
				height: $w;
				animation: loading 1s linear infinite;
			}
			view {
				width: $w;
				height: $w;
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				background-color: #4cd964;
				color: white;
				font-size: 24rpx;
			}
		}
		view {
			font-size: 28rpx;
		}
	}
}
</style>
