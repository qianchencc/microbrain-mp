<template>
	<view class="detail">
		<view class="content">
			<view class="title">
				{{ detail.infoSubject }}
			</view>
			<view class="publish_info">
				<view class="publish_user">
					<template v-if="detail.createdPrincipal">
						发布者：{{ detail.createdPrincipal }}
					</template>
				</view>
				<view class="publish_time">
					{{ detail.createdAt }}
				</view>
			</view>
			<view class="line" />
			<view class="detail-content" v-html="showNewsDetail(detail.historyContent)"></view>
			<view class="line" />
			<view class="line" />
			<view class="footer-handle">
				<view class="footer-handle-item">
					<uni-icons type="eye" :size="null" :color="null"></uni-icons>
					{{detail.viewCount}}
				</view>
				<view class="footer-handle-item" @click="updateLikes">
					<uni-icons :type="isLikes ? 'hand-up-filled' : 'hand-up'" :size="null" :color="null">
					</uni-icons>
					{{detail.likesCount}}
				</view>
				<view class="footer-handle-item" @click="handleForward">
					<uni-icons type="redo" :size="null" :color="null"></uni-icons>
					{{detail.shareCount}}
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import { fetchNewsById } from '@/apis/home'
	import { DOMAIN } from '@/config/settings'
	export default {
		data() {
			return {
				isLikes: false,
				detail: {}
			}
		},
		onLoad(e) {
			console.log('detail onLoad ----------', e)
			this.gainNewsInfoDetail(e.id)
			switch (e.type){
				case 'PARTY_BUILDING':
				uni.setNavigationBarTitle({
				  title: '党建活动详情'
				})
				break;
				case 'BUSINESS_ACTIVITIES':
				uni.setNavigationBarTitle({
				  title: '要闻详情'
				})
				break;
				case 'ANNOUNCEMENT':
				uni.setNavigationBarTitle({
				  title: '公告详情'
				})
				break;
				case 'ANNOUNCEMENT':
				uni.setNavigationBarTitle({
				  title: '资讯详情'
				})
				break;
				default:
					break;
			}
			
		},
		computed: {
			showNewsTime() {
				return val => {
					return val && val.replace(/T/g, " ")
				}
			},
			showNewsDetail() {
				return val => {
					return val && val.replace(/\<img/gi, '<img class="rich-img" ').replaceAll('../..', `${DOMAIN}`)
				}
			}
		},
		onShareAppMessage(e) {
			return {
				title: this.detail.title,
				path: `/pages/news/detail?id=${this.detail.id}`
			}
		},
		methods: {
			// 点赞
			async updateLikes() {
				const res = await (this.isLikes ? fetchNewsInfoUnlikes(this.detail.id) : fetchNewsInfoLikes(this.detail
					.id))
				if (!res) return
				if (this.isLikes) {
					this.isLikes = false
					this.detail.likesCount--
				} else {
					this.isLikes = true
					this.detail.likesCount++
				}
				// this.gainNewsInfoDetail(this.detail.id)
			},
			handleForward() {
				uni.showToast({
					title: '点击右上角转发',
					icon: 'none'
				})
			},
			// 转发
			async updateForward() {
				const res = await fetchNewsInfoForward(this.detail.id)
				if (!res) return
				this.gainNewsInfoDetail(this.detail.id)
			},
			// 获取资讯详情
			async gainNewsInfoDetail(id) {
				const res = await fetchNewsById(id)
				if (!res) return
				this.detail = res.content
				this.isLikes = !!this.detail.likesTime
				console.log('gain news info detail -------', res, this.isLikes)
			}
		}
	}
</script>

<style lang="scss" scoped>
	.detail {
		padding: 25upx;
		background-color: #F7F7F7;

		.content {
			width: 100%;
			// height: 2000upx;
			padding: 25upx;
			border-radius: 15upx;
			background-color: #fff;
			box-sizing: border-box;

			.title {
				font-size: 36upx;
				color: #3E444E;
				font-weight: bold;
				text-align: center;
				line-height: 3;
			}

			.publish_info {
				display: flex;
				align-items: center;
				justify-content: space-between;

				.publish_user {
					font-size: 24upx;
					color: #4E5257;
				}

				.publish_time {
					font-size: 24upx;
					color: #B6B7BA;
				}
			}

			:deep(.detail-content) {
				margin-top: 40upx;

				.lazy,
				.rich-img,
				.content-picture {
					width: 100% !important;
				}
			}

			.QR-code {
				display: flex;
				align-items: center;
				justify-content: center;

				.QR-code-item {
					margin: 50upx;

					.QR-code-name {
						font-size: 24upx;
						color: #4E5257;
						text-align: center;
					}

					.QR-code-box {
						width: 176upx;
						height: 176upx;
						position: relative;

						.vercode_code {
							position: absolute;
							top: 18upx;
							left: 18upx;
							width: 140upx;
							height: 140upx;
						}
					}
				}
			}

			.footer-handle {
				display: flex;
				align-items: center;
				justify-content: space-between;

				.footer-handle-item {
					flex: 1;
					height: 40upx;
					margin: 20upx 0;
					display: flex;
					align-items: center;
					justify-content: center;
					text-align: center;
					border-right: 2upx solid #3E444E;
					font-size: 26upx;
					color: #666666;

					&:last-of-type {
						border-right: none;
					}

					.uni-icons {
						font-size: 32upx;
						margin-right: 10upx;

						&.uniui-hand-up-filled {
							color: #1C77FF;
						}
					}
				}
			}

			.line {
				width: 100%;
				height: 2upx;
				background-color: #f1f1f1;
				margin: 10upx 0;
			}
		}
	}
</style>