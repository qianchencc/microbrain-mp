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
				<view
					class="confirm-btn"
					:class="{ confirmed }"
					hover-class="confirm-hover"
					@click="confirmReceive">
					{{ confirmed ? '已确认' : '确认收到' }}
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import { fetchNewsById, confirmPublishRecord } from '@/apis/home'
	import { DOMAIN } from '@/config/settings'
	import {getUrl} from "@/utils/tools";
	export default {
		data() {
			return {
				isLikes: false,
				detail: {},
				confirmed: false
			}
		},
		onLoad(e) {
			this.historyId = e.id
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
				this.confirmed = res.content.status === 1
			},

			// 确认收到：调用确认接口，成功后变淡不可点击
			async confirmReceive() {
				if (this.confirmed || this.confirming) return
				this.confirming = true
				const res = await confirmPublishRecord({ historyId: this.historyId })
				this.confirming = false
				if (!res) return
				this.confirmed = true
				uni.showToast({ title: '已确认收到', icon: 'none' })
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
			/* 底部留出固定操作栏的高度（栏高约 104upx + 安全区），防止内容被遮挡 */
			padding-bottom: calc(140upx + constant(safe-area-inset-bottom));
			padding-bottom: calc(140upx + env(safe-area-inset-bottom));
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
				position: fixed;
				left: 0;
				right: 0;
				bottom: 0;
				z-index: 10;
				display: flex;
				align-items: center;
				justify-content: space-between;
				box-sizing: border-box;
				padding: 0 25upx;
				padding-bottom: constant(safe-area-inset-bottom);
				padding-bottom: env(safe-area-inset-bottom);
				background-color: #fff;
				box-shadow: 0 -2upx 12upx rgba(0, 0, 0, 0.06);

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

					/* 去掉微信 button 默认伪元素：all:unset 使 button 失去 position:relative，
					   默认 ::after（200% 宽高的绝对定位层）会相对页面铺开盖住旁边的按钮，抢占点击 */
					&::after {
						display: none;
					}

					.uni-icons {
						font-size: 32upx;
						margin-right: 10upx;

						&.uniui-hand-up-filled {
							color: #1C77FF;
						}
					}
				}

				.confirm-btn {
					flex: 1;
					height: 64upx;
					margin: 20upx 0 20upx 20upx;
					position: relative;
					z-index: 1;
					display: flex;
					align-items: center;
					justify-content: center;
					border-radius: 32upx;
					font-size: 26upx;
					color: #ffffff;
					background-color: #1C77FF;

					&.confirm-hover {
						opacity: 0.8;
					}

					&.confirmed {
						opacity: 0.5;
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
