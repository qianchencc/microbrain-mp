<template>
	<view class="index-page">
		<view class="header-con">
			<view class="address" @click="goPage('/pages/index/indexlist')">
				<text>{{geospatial}}</text>
			</view>
			<swiper class="page_swiper" autoplay indicator-dots circular>
				<template v-if="bannerList.length > 0">
					<swiper-item v-for="(img,key) in bannerList" :key="key">
						<image class="swiper-image" :src="img.url" mode="aspectFill" />
					</swiper-item>
				</template>
			</swiper>
		</view>
		
		<view class="content">
			<view class="top con">
				<view class="notice-con">
					<image src="/static/images/index/notice.png" mode="aspectFit"></image>
					<swiper class="notice-list" circular vertical>
						<swiper-item v-for="item in noticeList" :key="item.id">
							<view class="notice-item" @click="goPage(`/pages/index/news/detail?id=${item.id}`)">
								{{ item.infoSubject }}
							</view>
						</swiper-item>
					</swiper>
				</view>
				<template v-if="menuList.length">
					<view class="menu-con" v-for="module in menuList" :key="module.id">
						<view class="menu-title">{{ module.resourceTitle }}</view>
						<view class="menu-list">
							<view v-for="menu in module.children" :key="menu.id" class="menu-item" @click="jumpUrl(menu)">
								<image :src="getUrl(menu.icon)" mode="aspectFit"></image>
								<view class="text">{{ menu.resourceTitle }}</view>
							</view>
						</view>
					</view>
				</template>
				<view v-else class="empty" @click="goPage('/pages/user/index')">请前往个人中心确权！</view>
			</view>
			
			<view class="good-con" v-if="goodList.length">
				<view class="image-title">
					<view class="title-left">
						<image src="/static/images/index/good.png" mode="aspectFit"></image>
						<view>天天好礼</view>
					</view>
				</view>
				<view class="good-list con">
					<swiper class="good_swiper" autoplay indicator-dots>
						<template v-if="bannerList.length > 0">
							<swiper-item v-for="(img, key) in goodList" :key="key">
								<image class="good-item" :src="img.url" mode="aspectFill" @click="openGood(item)" />
							</swiper-item>
						</template>
					</swiper>
				</view>
			</view>
			
			<view class="msg-con">
				<view class="msg-item">
					<view class="temp-item">
						<image src="/static/images/index/sd.png" mode="aspectFit"></image>
						<view>{{ envData.temp || 0 }}℃</view>
					</view>
					<view class="temp-item">
						<image src="/static/images/index/wd.png" mode="aspectFit"></image>
						<view>{{ envData.humidity || 0 }}%</view>
					</view>
					<view class="icon">
						<image src="/static/images/index/weather.png" mode="aspectFit"></image>
					</view>
				</view>
				<view class="msg-item" @click="webJump('owner', '/#/pages/projectAi/index')">
					<view class="msg-title">AI问</view>
					<view class="icon">
						<image src="/static/images/index/ai.png" mode="aspectFit"></image>
					</view>
				</view>
			</view>
			
			<view class="activity-con" v-if="activityList.length">
				<view class="image-title">
					<view class="title-left">
						<image src="/static/images/index/activity.png" mode="aspectFit"></image>
						<view>活动动态</view>
					</view>
					<view class="more" @click="webJump('activity')">更多</view>
				</view>
				<view class="activity-list con">
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
			
			<view class="news-con" v-if="newsList.length">
				<view class="image-title">
					<view class="title-left">
						<image src="/static/images/index/news.png" mode="aspectFit"></image>
						<view>企业动态</view>
					</view>
					<view class="more" @click="goPage('/pages/index/news/newList')">更多</view>
				</view>
				<view class="news-list">
					<template v-for="item in newsList" :key="item.id">
						<view class="news-item" @click="goPage(`/pages/index/news/detail?id=${item.id}`)">
							<image class="cover" :src="getUrl(item.coverPicUrl)" mode="aspectFill"></image>
							<view class="detail">
								<view class="title">{{ item.infoSubject }}</view>
								<view class="time">{{ formatTime(item.createdAt) }}</view>
							</view>
						</view>
					</template>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { usePermissionStoreHook } from '@/store/modules/permission'
	import { storageGet, storageSet } from '@/utils/storage'
	import { useUserStoreHook } from '@/store/modules/user'
	import { computed, ref, watch } from 'vue'
	import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
	import {fetchActivityPage, fetchCurrentUsed, fetchEnvData, fetchNewsPage} from '@/apis/home'
	import { openBle } from '@/utils/blue.js'
	import {formatTime, getUrl, goPage, jumpUrl, webJump} from '@/utils/tools'
	import { useBannerHook } from './utils/banner.js'
	import { getUnreadNotifyCount } from '@/utils/message.js'
	const { bannerList } = useBannerHook()
	const bluetooth = ref(false)
	const ifChecked = ref(false)
	const menuList = computed(() => usePermissionStoreHook().getMenuList)
	const geospatial = computed(() => useUserStoreHook().getDistrict.name)
	const authorized = computed(() => useUserStoreHook().authorized)

	// region 蓝牙部分
	const initBlueTooth = () => {
		if (!storageGet('bluetoothstatus')) {
			storageSet('bluetoothstatus', false)
		}
		bluetooth.value = storageGet('bluetoothstatus')
		getSwitch()
	}
	const getSwitch = () => {
		wx.closeBluetoothAdapter({
			complete() {
				wx.openBluetoothAdapter({
					success: (res) => {
						wx.getBluetoothAdapterState({
							success: function(res) {
								ifChecked.value = true
								if (bluetooth.value === true) {
									blueToothBroadCast()
								}
							},
							fail: function(res) {
								console.log(res)
								ifChecked.value = false
							}
						})
					},
					fail: (res) => {
						console.log('openBluetoothAdapter failed', res);
					}
				});
			}
		})

	}
	const blueToothBroadCast = async () => {
		const res = await fetchCurrentUsed()
		if (!res.content) return
		let card = parseInt(res.content.cardNumber).toString(16).padStart(8, '0')
		let list = []
		list.push(parseInt(card.substring(0, 2), 16))
		list.push(parseInt(card.substring(2, 4), 16))
		list.push(parseInt(card.substring(4, 6), 16))
		list.push(parseInt(card.substring(6, 8), 16))
		openBle(list);
	}
	watch(
		() => [geospatial.value, authorized.value],
		() => {
			getUnreadNotifyCount()
		}
	)
	// endregion
	
	const goodList = ref([])
	const getGoodList = async () => {
	}
	const openGood = (item) => {
		uni.openEmbeddedMiniProgram({
			appId: item.appId,
			path: `${item.path}?id=${item.id}`,
			success: () => {
				console.log('成功打开小程序')
			},
			fail: (res) => {
				console.log('打开小程序失败', res)
			}
		})
	}
	
	const noticeList = ref([])
	const getNoticePage = () => {
		fetchNewsPage({
			size: 3,
			page: 0,
			contentType: 'ANNOUNCEMENT',
			historyType: 'WEB',
			sort: 'createdAt,desc'
		}).then(res => {
			if (res) noticeList.value = res.content?.content || []
		})
	}
	
	const envData = ref({})
	const getEnvData = () => {
		fetchEnvData().then(res => {
			if (res) envData.value = res.content
		})
	}
	
	const activityList = ref([])
	const getActivityList = () => {
		fetchActivityPage({
			size: 2,
			page: 0,
			showFirstCover: true,
			sort: 'createdAt,desc'
		}).then(res => {
			if (res) activityList.value = res.content?.content || []
		})
	}
	
	const newsList = ref([])
	const getNewsList = () => {
		fetchNewsPage({
			size: 4,
			page: 0,
			historyType: 'WEB',
			sort: 'createdAt,desc'
		}).then(res => {
			if (res) newsList.value = res.content?.content || []
		})
	}
	
	const initData = async () => {
		getNoticePage()
		getEnvData()
		getActivityList()
		getNewsList()
		getGoodList()
		getUnreadNotifyCount()
		initBlueTooth()
	}
	
	onShow(() => {
		initData()
	})

	onPullDownRefresh(() => {
		initData()
		uni.stopPullDownRefresh();
	})
</script>

<style lang="scss" scoped>
.index-page {
	padding-bottom: 30rpx;
	.header-con {
		$height: 400rpx;
		width: 100%;
		height: $height;
		position: relative;
		
		.address {
			position: absolute;
			top: 10rpx;
			left: 10rpx;
			z-index: 9;
			color: white;
			&:after {
				content: '▼';
				margin-left: 5rpx;
			}
		}
		
		.page_swiper {
			width: 100%;
			height: $height;
			.swiper-image {
				width: 100%;
				height: $height;
			}
		}
	}
	
	.con {
		padding: 10rpx;
		border-radius: 15rpx;
		background-color: white;
		margin-bottom: 20rpx;
	}
	
	.content {
		width: 700rpx;
		margin: -35rpx auto 0;
		position: relative;
		z-index: 9;
		
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
		
		.top {
			padding: 20rpx;
			.notice-con {
				display: flex;
				align-items: center;
				padding: 10rpx 20rpx;
				margin-bottom: 10rpx;
				background-color: #edf0f4;
				border-radius: 15rpx;
				image {
					width: 50rpx;
					height: 50rpx;
					flex-shrink: 0;
					margin-right: 5rpx;
				}
				$height: 50rpx;
				.notice-list {
					width: 0;
					flex-grow: 1;
					height: $height;
				}
				.notice-item {
					height: $height;
					line-height: $height;
					text-overflow: ellipsis;
					overflow: hidden;
					white-space: nowrap;
					font-size: 30rpx;
				}
			}
			
			.menu-con {
				.menu-title {
					font-size: 28rpx;
					font-weight: bolder;
					padding: 15rpx 0;
				}
				.menu-list {
					display: flex;
					.menu-item {
						flex: 1;
						display: flex;
						flex-direction: column;
						align-items: center;
						justify-content: center;
						image {
							width: 80rpx;
							height: 80rpx;
							margin-bottom: 10rpx;
						}
						.text {
							font-size: 24rpx;
						}
					}
				}
			}
			
			.empty {
				width: 100%;
				height: 100rpx;
				font-size: 30rpx;
				font-weight: bold;
				display: flex;
				align-items: center;
				justify-content: center;
				border-radius: 10rpx;
				box-shadow: 0 0 5rpx rgba(0, 0, 0, 0.4);
			}
		}
		
		.good-con {
			.good-list {
				margin-top: 10rpx;
				$height: 300rpx;
				.good_swiper {
					width: 100%;
					height: $height;
					.good-item {
						width: 100%;
						height: $height;
						border-radius: 15rpx;
					}
				}
			}
		}
		
		.msg-con {
			margin-bottom: 20rpx;
			border-radius: 25rpx;
			display: flex;
			.msg-item {
				border-radius: 20rpx;
				padding: 20rpx 15rpx;
				flex: 1;
				background-image: linear-gradient(to right, #8ce0bd, #cbf3d1);
				display: flex;
				align-items: center;
				justify-content: space-between;
				&:first-child {
					margin-right: 15rpx;
					background-image: linear-gradient(to left, #ffd8b2, #fff3e8);
				}
				
				.temp-item {
					display: flex;
					align-items: center;
					image {
						width: 30rpx;
						height: 30rpx;
						margin-right: 3rpx;
					}
					view {
						font-size: 24rpx;
					}
				}
				
				.msg-title {
					font-size: 32rpx;
					font-weight: bolder;
				}
				
				.icon {
					width: 80rpx;
					height: 80rpx;
					background-color: #fff4ea;
					border-radius: 15rpx;
					display: flex;
					align-items: center;
					justify-content: center;
					image {
						width: 50rpx;
						height: 50rpx;
					}
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
				margin-bottom: 0;
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
		
		.news-con {
			.news-list {
				margin-top: 20rpx;
				display: grid;
				grid-template-columns: repeat(2, 1fr);
				grid-gap: 20rpx;
				.news-item {
					background-color: white;
					border-radius: 25rpx;
					.cover {
						width: 100%;
						height: 400rpx;
						border-radius: 25rpx;
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
	}
}
</style>
