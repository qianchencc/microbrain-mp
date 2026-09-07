<template>
	<view class="content">
		<z-paging ref="paging" v-model="dataList" default-page-no="0" @query="queryList">
			<view class="list">
				<view class="notice-item" v-for="(item,index) in dataList" :key="index" @click="handleRouteDetail(item.id)">
					<view class="notice-item_detail">
						<view class="detail_title">
							{{item.infoSubject}}
						</view>
						<view class="detail_footer">
							<view class="detail_footer_label">
								{{item.createdAt.substring(0,11)}}
							</view>
						</view>
					</view>
				</view>
			</view>
		</z-paging>
	</view>
</template>

<script setup>
	import { ref } from 'vue'
	import {fetchNoticePage} from "@/apis/home"
	const dataList = ref([])
	const paging = ref(null)

	const queryList = async (pageNo, pageSize) => {
		const res = await fetchNoticePage({
			size: pageSize,
			page: pageNo,
			contentType: 'ANNOUNCEMENT',
			historyType: 'WEB',
			sort: 'createdAt,desc'
		})
		if (res.content) {
			paging.value.complete(res.content.content)
		} else {
			paging.value.complete(false)
		}
	}

	const handleRouteDetail = async (id) => {
		if (!id) return
		uni.navigateTo({
			url: `/pages/news/detail?id=${id}`
		})
	}
</script>

<style lang="scss" scoped>
	.list {
		padding: 25rpx;
	}

	.notice-item {
		padding: 30rpx;
		margin-bottom: 25rpx;
		background-color: white;
		border-radius: 15rpx;

		.notice-item_detail {
			display: flex;
			flex-direction: column;
			justify-content: space-between;

			.detail_title {
				color: #303030;
				font-size: 30upx;
				line-height: 1.5;
				display: -webkit-box;
				-webkit-box-orient: vertical;
				-webkit-line-clamp: 2;
				overflow: hidden;
				text-overflow: ellipsis;
				margin-bottom: 15rpx;
			}

			.detail_footer {
				display: flex;
				align-items: center;
				justify-content: space-between;

				.detail_footer_label {
					line-height: 22upx;
					font-size: 22upx;
					color: #B6B7BA;
				}
			}
		}
	}
</style>
