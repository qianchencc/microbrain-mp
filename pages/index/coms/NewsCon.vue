<template>
	<view class="news-con" v-if="newsList.length">
		<view class="image-title">
			<view class="title-left">
				<image src="/static/images/index/news.png" mode="aspectFit"></image>
				<view>企业动态</view>
			</view>
			<view class="more" @click="goPage('/pages/news/newList')">更多</view>
		</view>
		<view class="news-list">
			<template v-for="item in newsList" :key="item.id">
				<view class="news-item" @click="handleRouteNewsDetail(item.url)">
					<image class="cover" :src="getUrl(item.cover)" mode="aspectFill"></image>
					<view class="detail">
						<view class="title">{{ item.title }}</view>
						<view class="time">{{ formatTime(item.publishTime) }}</view>
					</view>
				</view>
			</template>
		</view>
	</view>
</template>

<script>
import {formatTime, getUrl, goPage} from "@/utils/tools";
import {fetchNewsPage} from "@/apis/home";

export default {
	name: "NewsCon",
	data() {
		return {
			newsList: []
		}
	},
	mounted() {
		this.getNewsList()
	},
	methods: {
		getNewsList(){
			fetchNewsPage({
				pageSize: 4,
				pageNum: 0,
				pageFlag: 1,
				historyType: 'WEB',
				sort: 'createdAt,desc'
			}).then(res => {
				if (res) {
					this.newsList = res.content?.records || []
					if (this.newsList.length === 0) this.$emit('sendMsg', {auto: {type: 'AI_ANSWER', data: '暂未查找到任何新闻'}})
					this.$emit('toBottom')
				}
			})
		},
		formatTime,
		getUrl,
		goPage,
		handleRouteNewsDetail(url) {
			goPage(`/pages/news/web?url=${encodeURIComponent(url)}`)
		}
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

.news-con {
	padding: 20rpx;
	border-radius: 25rpx;
	margin-bottom: 20rpx;
	background-image: linear-gradient(to bottom right, #8ce0bd, #cbf3d1);
	.news-list {
		margin-top: 20rpx;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		grid-gap: 20rpx;
		.news-item {
			background-color: white;
			border-radius: 25rpx;
			overflow: hidden;
			.cover {
				width: 100%;
				height: 300rpx;
			}
			.detail {
				padding: 10rpx;
				.title {
					$height: 36rpx;
					font-size: 28rpx;
					display: -webkit-box;
					-webkit-box-orient: vertical;
					-webkit-line-clamp: 3; /* 显示的行数 */
					overflow: hidden;
					text-overflow: ellipsis;
					font-weight: bolder;
					line-height: $height;
					height: calc(3 * $height);
					margin-bottom: 15rpx;
				}
				.time {
					color: #6a6a6a;
					font-size: 24rpx;
				}
			}
		}
	}
}
</style>
