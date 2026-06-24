<template>
	<view class="activity-con" v-if="activityList.length">
		<view class="image-title">
			<view class="title-left">
				<image src="/static/images/index/activity.png" mode="aspectFit"></image>
				<view>活动动态</view>
			</view>
			<view class="more" @click="webJump('activity')">更多</view>
		</view>
		<view class="activity-list">
			<template v-for="item in activityList" :key="item.id">
				<view class="activity-item" @click="webJump('activity', `/detail?activityId=${item.id}`)">
					<image class="cover" :src="getUrl(item.firstCover)"></image>
					<view class="detail">
						<view class="title">{{ item.name }}</view>
						<view class="time">{{ formatTime(item.startTime) }}</view>
					</view>
				</view>
			</template>
		</view>
	</view>
</template>

<script>
import {formatTime, getUrl, webJump} from "@/utils/tools";
import {fetchActivityPage} from "@/apis/home";

export default {
	name: "ActivityCon",
	data(){
		return {
			activityList: []
		}
	},
	mounted() {
		this.getActivityList()
	},
	methods: {
		getActivityList(){
			fetchActivityPage({
				size: 2,
				page: 0,
				showFirstCover: true,
				sort: 'createdAt,desc'
			}).then(res => {
				if (res) {
					this.activityList = res.content?.content || []
					if (this.activityList.length === 0) this.$emit('sendMsg', {auto: {type: 'AI_ANSWER', data: '暂未查找到任何活动'}})
					this.$emit('toBottom')
				}
			})
		},
		formatTime,
		getUrl,
		webJump
	}
}
</script>

<style scoped lang="scss">
.image-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	.title-left {
		display: flex;
		align-items: center;
		image {
			width: 40rpx;
			height: 40rpx;
			margin-right: 10rpx;
		}
		view {
			font-size: 30rpx;
			font-weight: bolder;
		}
	}
	.more {
		font-size: 22rpx;
		&:after {
			content: ">>";
		}
	}
}

.activity-con{
	padding: 20rpx;
	border-radius: 25rpx;
	margin-bottom: 20rpx;
	background-image: linear-gradient(to bottom right, #8ce0bd, #cbf3d1);
	.activity-list {
		margin-top: 20rpx;
		padding: 10rpx;
		border-radius: 15rpx;
		background-color: white;
		.activity-item {
			display: flex;
			.cover {
				flex-shrink: 0;
				width: 280rpx;
				height: 180rpx;
				margin-right: 15rpx;
				border-radius: 15rpx;
			}
			.detail {
				width: 0;
				flex-grow: 1;
				display: flex;
				flex-direction: column;
				justify-content: space-between;
				.title {
					display: -webkit-box;
					-webkit-box-orient: vertical;
					-webkit-line-clamp: 3; /* 显示的行数 */
					overflow: hidden;
					text-overflow: ellipsis;
					font-size: 28rpx;
					font-weight: bolder;
					line-height: 1.3;
				}
				.time {
					color: #6a6a6a;
					font-size: 24rpx;
					line-height: 1;
				}
			}
			&:not(:last-child) {
				margin-bottom: 25rpx;
			}
		}
	}
}
</style>
