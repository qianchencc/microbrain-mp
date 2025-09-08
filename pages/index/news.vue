<template>
	<view class="card-box">
		<view class="card-title_tag">
			<template v-for="item in newTagList">
				<view class="card-title_tag_item is_active">
					<text class="item_text">
						{{item.name}}
					</text>
				</view>
			</template>
			<view class="card-title_tag_more">
				<text class="item_text" @click="handleRouteNewsList">
					更多
				</text>
			</view>
		</view>
		<view style="height: 550rpx;overflow: scroll;">
			<view v-if="messageList.length > 0">
				<view class="message-item" v-for="(item,index) in messageList" :key="index" @click="handleRouteNewsDetail(item.id)">
					<image class="message-item_image" :src="getUrl(item.coverPicUrl)" mode="aspectFill"></image>
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
			</view>
			<m-empty v-else></m-empty>
		</view>
	</view>
</template>

<script setup>
	import { onMounted, ref, computed, watch } from 'vue'
	import { fetchNewsPage } from "@/apis/home"
	import { useUserStoreHook } from '@/store/modules/user'
	import {getUrl} from "@/utils/tools";
	const geospatial = computed(() => useUserStoreHook().getDistrict.name)
	const authorized = computed(() => useUserStoreHook().authorized)
	const newTagList = ref([
		{
			name: '最新公告',
			id: ''
		}
	])
	const messageList = ref([])
	// 获取新闻列表
	const gainCategoryList = async () => {
		gainNewsInfoPage()
	}

	watch(() => [geospatial.value, authorized.value], () => {
		gainCategoryList()
	})

	const gainNewsInfoPage = async () => {
		let data = {
			size: 3,
			page: 0,
			contentType: '',
			historyType: 'WEB',
			pageFlag: 1,
			sort: 'createdAt,desc'
		}
		const res = await fetchNewsPage(data)
		if (!res) return
		messageList.value = res.content ? res.content.content : []
	}

	const handleRouteNewsList = () => {
		uni.navigateTo({
			url: `/pages/index/news/newList`
		})
	}

	const handleRouteNewsDetail = async (id) => {
		if (!id) return
		uni.navigateTo({
			url: `/pages/index/news/detail?id=${id}`
		})
	}

	defineExpose({
		gainCategoryList
	})

	onMounted(() => {
		gainCategoryList()
	})
</script>

<style lang="scss" scoped>
	.card-box {
		// width: 700upx;
		min-height: 200upx;
		margin: 0 25upx;
		background-color: #fff;
		border-radius: 15upx;
		margin-bottom: 20upx;
		padding: 10upx 25upx;

		.card-title_tag {
			display: flex;
			align-items: center;
			justify-content: space-between;
			border-bottom: 1upx solid #E1E1E1;

			.card-title_tag_item {
				flex: 1;
				text-align: left;
				line-height: 80upx;

				.item_text {
					position: relative;
					font-size: 30upx;
					color: #8F969F;

					.new {
						position: absolute;
						font-size: 20upx;
						color: #FAA736;
						margin-left: 9upx;
					}
				}

				&.is_active {
					&::after {
						display: block;
						content: '';
						width: 40upx;
						height: 4upx;
						background-color: #1C77FF;
						border-radius: 2upx;
						position: relative;
						bottom: 14upx;
					}

					.item_text {
						font-size: 30upx;
						color: #000000;
						font-weight: bold;
					}
				}
			}

			.card-title_tag_more {
				flex: none;
				margin-left: 15upx;

				.item_text {
					font-size: 24upx;
					color: #B6B7BA;
					&:after {
						content: '>';
					}
				}
			}
		}

		.message-item {
			display: flex;
			align-items: center;
			padding: 20upx 0;

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
					display: -webkit-box;
					-webkit-box-orient: vertical;
					-webkit-line-clamp: 2;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				.detail_footer {
					display: flex;
					flex-direction: row;
					justify-content: flex-start;

					.detail_footer_label {
						line-height: 22upx;
						font-size: 22upx;
						color: #B6B7BA;
					}

					.detail_footer_label_2 {
						margin-left: 20upx;
						line-height: 22upx;
						font-size: 22upx;
						color: #B6B7BA;
					}
				}
			}
		}
	}
</style>
