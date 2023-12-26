<template>
	<view class="card-box">
		<view class="card-title_tag">
			<template v-for="(item, tagIndex) in newTagList">
				<view class="card-title_tag_item" :class="{is_active: item.id === newTagValue}" v-if="tagIndex < 4">
					<text class="item_text" @click="newTagValue = item.id">
						{{item.name}}
						<text class="new" v-if="item.new">NEW</text>
					</text>
				</view>
			</template>
			<view class="card-title_tag_more">
				<text class="item_text" @click="handleRouteNewsList">
					更多>
				</text>
			</view>
		</view>
		<view style="height: 500rpx;overflow: scroll;">
			<view v-if="messageList.length > 0">
				<view class="message-item" v-for="(item,index) in messageList" :key="index" @click="handleRouteNewsDetail(item.id)">
					<image class="message-item_image" :src="`${SCHEME}${COOKIE_DOMAIN}/file/${item.coverPicUrl}`" mode="aspectFill">
					</image>
					<view class="message-item_detail">
						<view class="detail_title uni-ellipsis">
							{{item.infoSubject}}
						</view>
						<view class="detail_footer">
							<view class="detail_footer_label">
								{{item.createdAt}}
							</view>
							<view class="detail_footer_label">
								<uni-icons type="eye" :size="null" :color="null"></uni-icons>
								{{item.infoSubject}}
							</view>
							<view class="detail_footer_label">
								<uni-icons type="hand-up" :size="null" :color="null"></uni-icons>
								{{item.likesCount}}
							</view>
						</view>
					</view>
				</view>
			</view>
			<template v-else>
				<view class="not-main">
					暂无内容
				</view>
			</template>
		</view>

	</view>
</template>

<script setup>
	import { onMounted, ref, watch } from 'vue'
	import { fetchNewsPage } from "@/apis/home"
	import globalConfig from '@/config'
	import { COOKIE_DOMAIN, SCHEME } from '@/config/settings'
	const newTagList = ref([])
	const newTagValue = ref('')
	const messageList = ref([])
	// 获取新闻列表
	const gainCategoryList = async () => {
		newTagList.value = [{
				name: '热点',
				id: ''
			},
			{
				name: '党建活动',
				id: 'PARTY_BUILDING'
			},
			{
				name: '公告信息',
				id: 'ANNOUNCEMENT'
			},
			{
				name: '企业活动',
				id: 'BUSINESS_ACTIVITIES'
			},
			{
				name: '公共资讯',
				id: 'COMMON_NEWS'
			}
		]
		// const res = await fetchNewsInfoCategoryList()
		// if (!res) return
		// newTagList.value = newTagList.value.concat(res.content)
		gainNewsInfoPage()
	}

	watch(
		() => newTagValue.value,
		() => {
			gainNewsInfoPage()
		}
	)

	const gainNewsInfoPage = async () => {
		var data = {
			size: 5,
			page: 0,
			contentType: newTagValue.value,
			historyType: 'WEB',
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
		// const active = await createAppDailyActivity({ appCode: 'app-news' })
		uni.navigateTo({
			url: `/pages/index/news/detail?id=${id}`
			// url: `/pages/webView/index?path=${SCHEME}${COOKIE_DOMAIN}/newsdetail/#/&otherQuery=${encodeURI(`&id=${id}`)}`
		})
	}

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
				text-align: center;
				line-height: 80upx;

				.item_text {
					position: relative;
					font-size: 26upx;
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
						margin: 0 auto;
						position: relative;
						bottom: 14upx;
					}

					.item_text {
						font-size: 30upx;
						color: #000000;
					}
				}
			}

			.card-title_tag_more {
				flex: none;
				margin-left: 15upx;

				.item_text {
					font-size: 24upx;
					color: #B6B7BA;
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
	}
</style>