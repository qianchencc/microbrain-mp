<template>
	<view class="page">
		<view style="background-color: #fff;margin-bottom: 20rpx">
			<view class="header-back"></view>
			<view class="header-bar">
				<view class="address" @click="open">
					<text class="address-text uni-ellipsis">{{geospatial}}</text>
				</view>
			</view>
			
			<swiper class="page_swiper" autoplay indicator-dots circular>
				<template v-if="bannerList.length > 0">
					<swiper-item v-for="(img,key) in bannerList" :key="key">
						<image class="swiper-image" :src="img.url" mode="aspectFill" />
					</swiper-item>
				</template>
			</swiper>
			
			<swiper class="menu_swiper" circular @change="swiperChange">
				<swiper-item class="menu_swiper_item" v-for="module in menuList" :key="module.id">
					<view class="menu-top-con">
						<template v-for="menu in module.children" :key="menu.id">
							<view class="menu-item" @click="goMenu(menu)">
								<view class="img-con">
									<image v-if="menu.icon.startsWith('http')" :src="getUrl(menu.icon)" mode="contain"></image>
									<image v-else :src="`/static/images/home/${menu.icon}`" mode="contain"></image>
								</view>
								<view class="text">{{menu.resourceTitle}}</view>
							</view>
						</template>
					</view>
				</swiper-item>
			</swiper>
			
			<news ref="newsRef" />
		</view>
	</view>
</template>

<script setup>
	import { usePermissionStoreHook } from '@/store/modules/permission'
	import { storageGet, storageSet } from '@/utils/storage'
	import { useUserStoreHook } from '@/store/modules/user'
	import { computed, ref, watch, onMounted, getCurrentInstance } from 'vue'
	import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
	import { fetchCurrentUsed } from '@/apis/home'
	import { openBle } from '@/utils/blue.js'
	import {getUrl, jumpUrl} from '@/utils/tools'
	import { useBannerHook } from './utils/banner.js'
	import { setSubscribeMessages } from '@/utils/subscribeMessage.js'
	import { getUnreadNotifyCount } from '@/utils/message.js'
	import news from './news.vue'
	const { bannerList } = useBannerHook()
	const bluetooth = ref(false)
	const ifChecked = ref(false)
	const newsRef = ref(null)
	const menuList = computed(() => usePermissionStoreHook().getMenuList)
	const geospatial = computed(() => useUserStoreHook().getDistrict.name)
	const authorized = computed(() => useUserStoreHook().authorized)
	const open = () => {
		uni.navigateTo({
			url: './indexlist'
		})
	}
	const initBlueTooth = () => {
		// #ifdef MP-WEIXIN
		if (!storageGet('bluetoothstatus')) {
			storageSet('bluetoothstatus', false)
		}
		bluetooth.value = storageGet('bluetoothstatus')
		getSwitch()
		// #endif
	}
	const getSwitch = () => {
		wx.closeBluetoothAdapter({
			complete() {
				wx.openBluetoothAdapter({
					success: (res) => {
						console.info('Get Bluetooth ');
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
						console.log('openBluetoothAdapter failed');

						console.warn(res);
					},
					complete: (res) => {
						console.debug('openBluetoothAdapter completed');
					},
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
	watch(() => [geospatial.value, authorized.value], () => {
		getUnreadNotifyCount()
	})
	
	onShow(() => {
		initBlueTooth()
	})

	onPullDownRefresh(() => {
		getUnreadNotifyCount()
		initBlueTooth()
		newsRef.value.gainCategoryList()
		uni.stopPullDownRefresh();
	})
	
	const goMenu = item => {
		if (item.name.includes('incomplete')) {
			uni.showToast({
				title: `敬请期待`,
				icon: 'none'
			})
		} else {
			setSubscribeMessages(item.resourceName, 'home')
			jumpUrl(item)
		}
	}
	
	const swiperHeightList = ref([]);
	const swiperIndex = ref(0);
	const swiperHeight = computed(() => swiperHeightList.value.length ? swiperHeightList.value[swiperIndex.value] : '360rpx')
	const swiperChange = ({ detail }) => {
		swiperIndex.value = detail.current
	}
	onMounted(() => {
		const query = uni.createSelectorQuery();
		query.selectAll('.menu-top-con').boundingClientRect(res => {
			swiperHeightList.value = res.map(item => `${item.height}px`)
			console.log(swiperHeightList.value)
		}).exec()
	})
</script>

<style lang="scss" scoped>
	.header-back {
		position: absolute;
		left: 0;
		background-color: #3974F6;
		border-bottom-left-radius: 150rpx 50rpx;
		border-bottom-right-radius: 150rpx 50rpx;
		height: 280rpx;
		width: 750rpx;

		// 记得加背景图片
	}

	.header-bar {
		position: relative;
		z-index: 9;
		display: flex;
		align-items: center;
		padding: 0 25upx;
		margin-bottom: 15rpx;
		
		.address {
			display: flex;
			align-items: center;
			color: #fff;
			
			.address-text {
				overflow: hidden;
				font-size: 30upx;
				display: flex;
				align-items: center;
				
				&::after {
					content: '▼';
					font-size: 25rpx;
					margin-left: 10rpx;
				}
			}
			
			.uniui-arrowdown {
				font-size: 28upx;
				line-height: 1;
				margin-left: 10upx;
				flex: none;
			}
		}
	}

	:deep(.uni-navbar--border) {
		border-bottom: none;
	}

	.page_swiper {
		box-sizing: border-box;
		margin-bottom: 25upx;
		height: 215upx;

		.swiper-image {
			width: 700upx;
			margin: 0 25upx;
			height: 215upx;
			border-radius: 15upx;
		}
	}
	
	.menu_swiper{
		height: v-bind(swiperHeight);
	}
	
	.menu-top-con {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		grid-gap: 20rpx;
		padding: 25rpx;
		.menu-item {
			text-align: center;
			.img-con {
				width: 100upx;
				height: 100upx;
				background-color: #F5F5F5;
				margin: 0 auto;
				display: flex;
				align-items: center;
				justify-content: center;
				border-radius: 50%;
				image {
					width: 55rpx;
					height: 55rpx;
				}
			}
		}
	}
</style>
