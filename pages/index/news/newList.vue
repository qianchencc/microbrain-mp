<template>
	<view class="content">
		<z-paging ref="paging" v-model="dataList" default-page-no="0" @query="queryList">
			<view class="message-item" v-for="(item,index) in dataList" :key="index" @click="handleRouteNewsDetail(item.id)">
				<image class="message-item_image" :src="`${DOMAIN}/file/${item.coverPicUrl}`" mode="aspectFill">
				</image>
				<view class="message-item_detail">
					<view class="detail_title text-wrap">
						{{item.infoSubject}}
					</view>
					<view class="detail_footer">
						<view class=" detail_footer_label">
							{{item.createdAt.substring(0,11)}}
						</view>
						
					</view>
				</view>
			</view>
		</z-paging>
	</view>
</template>

<script setup>
	import { ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { fetchNewsPage } from "@/apis/home"
	import { DOMAIN } from '@/config/settings'
	const paging = ref(null)
	const dataList = ref([])

	const queryList = async (pageNo, pageSize) => {
		const res = await fetchNewsPage({pageFlag:1})
		if (res.content) {
			paging.value.complete(res.content.content)
		} else {
			paging.value.complete(false)
		}
	}

	const handleRouteNewsDetail = async (id) => {
		if (!id) return
		uni.navigateTo({
			url: `/pages/index/news/detail?id=${id}`
		})
	}
</script>

<style lang="scss" scoped>
	.content {
		padding: 30rpx;
	}

	.message-item {
		display: flex;
		align-items: center;
		padding: 30rpx;

		.message-item_image {
			flex: none;
			width: 180upx;
			height: 140upx;
			margin: 0;
			margin-right: 27upx;
			border-radius: 12upx;
		}

		.message-item_detail {
			height: 140upx;
			display: flex;
			flex-direction: column;
			justify-content: space-between;
			flex: 1;
			width: 1%;

			.detail_title {
				color: #303030;
				font-size: 30upx;
				line-height: 1.5;
			}
			.detail_footer_label {
				line-height: 22upx;
				font-size: 22upx;
				color: #B6B7BA;
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