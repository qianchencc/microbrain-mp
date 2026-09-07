<template>
	<view class="content">
		<z-paging ref="paging" v-model="dataList" default-page-no="0" @query="queryList">
			<view class="list">
				<view class="news-item" v-for="(item,index) in dataList" :key="index" @click="handleRouteNewsDetail(item.url)">
					<image class="cover" :src="getUrl(item.cover)" mode="aspectFill"></image>
					<view class="detail">
						<view class="title">{{item.title}}</view>
						<view class="time">{{formatTime(item.publishTime)}}</view>
					</view>
				</view>
			</view>
		</z-paging>
	</view>
</template>

<script setup>
	import { ref } from 'vue'
	import { fetchNewsPage } from "@/apis/home"
	import {getUrl, formatTime, goPage} from "@/utils/tools";
	const dataList = ref([])
	const paging = ref(null)

	const queryList = async (pageNo, pageSize) => {
		const res = await fetchNewsPage({ pageSize: pageSize, pageNum: pageNo, sort: 'createdAt,desc' })
		if (res.content) {
			paging.value.complete(res.content.records)
		} else {
			paging.value.complete(false)
		}
	}

	const handleRouteNewsDetail = (url) => {
		if (!url) return
		goPage(`/pages/news/web?url=${encodeURIComponent(url)}`)
	}
</script>

<style lang="scss" scoped>
	.list {
		padding: 25rpx;
	}

	.news-item {
		margin-bottom: 25rpx;
		padding: 25rpx;
		background-color: white;
		border-radius: 25rpx;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);

		.cover {
			width: 100%;
			height: 350rpx;
			border-radius: 15rpx;
		}

		.detail {
			padding: 20rpx 10rpx 5rpx;

			.title {
				font-size: 30rpx;
				line-height: 40rpx;
				font-weight: bolder;
				display: -webkit-box;
				-webkit-box-orient: vertical;
				-webkit-line-clamp: 2;
				overflow: hidden;
				text-overflow: ellipsis;
				margin-bottom: 15rpx;
			}

			.time {
				color: #6a6a6a;
				font-size: 24rpx;
			}
		}
	}
</style>
