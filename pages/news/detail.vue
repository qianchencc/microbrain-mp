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
				<button open-type="share" class="footer-handle-item">
					<uni-icons type="redo" :size="null" :color="null"></uni-icons>
				</button>
			</view>
		</view>
	</view>
</template>

<script>
	import { fetchNewsById } from '@/apis/home'
	import { DOMAIN } from '@/config/settings'
	import {getUrl} from "@/utils/tools";
	export default {
		data() {
			return {
				isLikes: false,
				detail: {}
			}
		},
		onLoad(e) {
			this.gainNewsInfoDetail(e.id)
		},
		computed: {
			showNewsDetail() {
				return val => {
					return val && val.replace(/\<img/gi, '<img class="rich-img" ').replaceAll('../..', `${DOMAIN}`)
				}
			}
		},
		onShareAppMessage(e) {
			return {
				title: this.detail.infoSubject,
				path: `/pages/news/detail?id=${this.detail.id}`
			}
		},
		methods: {
			// 获取资讯详情
			async gainNewsInfoDetail(id) {
				const res = await fetchNewsById(id)
				if (!res) return
				this.detail = res.content
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
					all: unset;
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
