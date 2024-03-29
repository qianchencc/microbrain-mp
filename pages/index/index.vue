<template>
	<view class="page">
		<view style="background-color: #fff;margin-bottom: 20rpx">
			<view class="header-back"></view>
			<view class="header-bar">
				<view class="address" @click="open">
					<text class="address-text uni-ellipsis">{{geospatial}} </text>
					<uni-icons type="arrowdown" color="#fff" :size="null" />
				</view>
				<view class="input-view">
					<uni-icons class="input-uni-icon" type="search" :size="null" color="#999" />
					<text class="input-uni-text" @click="open">请输入关键字搜索</text>
					<uni-icons class="input-uni-icon" type="scan" :size="null" color="#999" @click="handleScan">
					</uni-icons>
				</view>
				<view class="header-handle">
					<!-- <image class="handle-image" src="../../static/images/icon-home_voice.png" mode=""></image>
					<image class="handle-image" src="../../static/images/icon-home_cut.png" mode=""></image> -->
				</view>
			</view>
			<swiper class="page_swiper" autoplay indicator-dots="true" circular>
				<template v-if="bannerList.length > 0">
					<swiper-item v-for="(img,key) in bannerList" :key="key" @click="gainBannerManagement(img.id)">
						<image class="swiper-image" :src="img.url" mode="aspectFill" />
					</swiper-item>
				</template>
			</swiper>
			
			<view class="menu-top-con">
				<!-- <view class="top-menu">
					<view class="menu-item" v-for="(item, index) in topMenu" :key="index" @tap="topJumpUrl(item)">
						<view>{{ item.title }}</view>
						<image :src="item.icon" mode="aspectFit"></image>
					</view>
				</view> -->
				<uni-grid style="width:100%;background-color: #fff;padding: 20rpx 0rpx;border-radius: 10rpx;" :column="5" :square="false" :showBorder="false" @change="change">
					<template v-for="(item, index) in menuList" :key="item.id">
						<uni-grid-item :index="index">
							<view class="grid-item-box">
								<view class="box-img_back">
									<image class="box-img" :src="item.icon.startsWith('http') ? item.icon : `/static/images/home/${item.icon}`" alt="" />
								</view>
								<!-- <uni-icons class="box-img_back icon" v-else type="star" :size="30" :color="'#777'" /> -->
								<text class="text">{{item.title}}</text>
							</view>
						</uni-grid-item>
					</template>
				</uni-grid>
			</view>
			<view class="notice_bg">
				<view class="tag-view">
					<span style="font-weight:bold;color:#ffffff;background-color:#1C77FF;padding-left:0.2rem;padding-right:0.25rem; border-radius: 5rem;">公告</span>
				</view>
				<!-- <uni-tag style="font-weight: bold;">公告</uni-tag> -->
				<view class="line"></view>
				<swiper autoplay="true" display-multiple-items="1" vertical="true" circular interval="2000"
					class="bar-swiper">
					<swiper-item v-for="(item, index) in noticeList" :key="index" class="swiper-item">
						<view class="circle"></view>
						<view class="item_box" @tap="click(item.id)">
							{{ item.infoSubject }}
						</view>
					</swiper-item>
				</swiper>
				<view class="card-title_tag_more">
					<text class="item_text" @click="handleRouteNoticeList()">
						更多>
					</text>
				</view>
			</view>
			<news />
		</view>
	</view>
</template>

<script setup>
	import { usePermissionStoreHook } from '@/store/modules/permission'
	import { fetchNewsPage } from "@/apis/home"
	import { storageGet, storageSet, storageRemove } from '@/utils/storage'
	import { useUserStoreHook } from '@/store/modules/user'
	import { onMounted,computed, reactive, ref, watch } from 'vue'
	import { onShow } from '@dcloudio/uni-app'
	import { fetchCurrentUsed } from '@/apis/home'
	import { openBle } from '@/utils/blue.js'
	import { wxLogin } from '@/utils/wxLogin.js'
	import { jumpUrl } from '@/utils/tools'
	import { useBannerHook } from './utils/banner.js'
	import { handleScan } from './utils/scan.js'
	import { setSubscribeMessages } from '@/utils/subscribeMessage.js'
	import news from './news.vue'
	const { bannerList } = useBannerHook()
	const noticeList=ref([])
	const bluetooth=ref(false)
	const ifChecked=ref(false)
	const menuList = computed(() => usePermissionStoreHook().getHomeMenu)
	const geospatial = computed(() => useUserStoreHook().getDistrict.name)
	const topMenu = [{
			title: '人才公寓',
			icon: '/static/images/index/people.png'
		},
		{
			title: '任务中心',
			icon: '/static/images/index/mission.png'
		},
		{
			title: '积分商城',
			icon: '/static/images/index/shop.png'
		}
	]
	// const bannerList = [{ pic: '/static/images/index/map.png' }, { pic: '/static/images/index/banner01.png' }]
	const open = () => {
		uni.navigateTo({
			url: './indexlist'
		})
	}
	const handleRouteNoticeList = () => {
		uni.navigateTo({
			url: `/pages/index/news/noticeList`
		})
	}
	const initBlueTooth=()=>{
		if(!storageGet('bluetoothstatus')){
			storageSet('bluetoothstatus',false)
		}
		bluetooth.value=storageGet('bluetoothstatus')
		getSwitch()
	}
	const getSwitch=()=>{
		
		wx.closeBluetoothAdapter({
			complete() {
				wx.openBluetoothAdapter({
					success: (res) => {
						console.info('Get Bluetooth ');
						wx.getBluetoothAdapterState({
						  success: function (res) {
							ifChecked.value=true
							if(bluetooth.value===true){
								blueToothBroadCast()
							}
						  },
						  fail: function (res) {
							  console.log(res)
							ifChecked.value=false
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
	const blueToothBroadCast=async()=>{
		const res=await fetchCurrentUsed()
		if(!res.content)return
		let card=parseInt(res.content.cardNumber).toString(16).padStart(8,'0')
		console.log('cardNumber',card)
		let list=[]
		list.push(parseInt(card.substring(0,2),16))
		list.push(parseInt(card.substring(2,4),16))
		list.push(parseInt(card.substring(4,6),16))
		list.push(parseInt(card.substring(6,8),16))
		// for (var i = 0; i < 4; i++) {
		
		// 	list.push(Number(card.substring((2*i,2),16)))
		// }
			openBle(list);



	}
	watch(() => geospatial.value, () => {
		gainNewsInfoPage()
	})
	const init=()=>{
		
		
	}
	onMounted(() => {
		gainNewsInfoPage()
		initBlueTooth()
		console.log('----->')
	})
	onShow(()=>{
		initBlueTooth()
		console.log('show',ifChecked.value,bluetooth.value)
	})
	const gainNewsInfoPage = async () => {
		var data = {
			size: 3,
			page: 0,
			contentType: 'ANNOUNCEMENT',
			historyType: 'WEB',
			sort: 'createdAt,desc'
		}
		const res = await fetchNewsPage(data)
		if (!res) return
		noticeList.value = res.content ? res.content.content : []
		
	}
	const change = async (e) => {
		const { index } = e.detail
		const menu = menuList.value[index]
		if (menu.name.includes('incomplete')) {
			uni.showToast({
				title: `敬请期待`,
				icon: 'none'
			})
		} else if (menu.name === 'all') {
			uni.navigateTo({
				url: './all'
			})
		} else {
			// #ifdef MP-WEIXIN
			// 订阅消息
			setSubscribeMessages(menu.name, 'home')
			// #endif
			jumpUrl(menu)
		}
	}
</script>

<style lang="scss" scoped>
	.header-back {
		position: absolute;
		left: 0;
		background-color: #3974F6;
		border-bottom-left-radius:150rpx 50rpx;
		border-bottom-right-radius:150rpx 50rpx;
		height: 280rpx;
		width: 750rpx;
		
		// 记得加背景图片
	}

	.header-bar {
		position: relative;
		z-index: 9;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 25upx;
		/* #ifdef APP-PLUS */
		padding-top: 40px;
		/* #endif */

		.input-view {
			display: flex;
			align-items: center;
			justify-content: space-between;
			width: 406upx;
			flex: none;
			background-color: #e7e7e7;
			height: 66upx;
			border-radius: 10upx;
			padding: 0 15upx;
			flex-wrap: nowrap;
			margin: 15upx 10rpx;
			line-height: 66upx;
			background: #f5f5f5;

			.input-uni-icon {
				width: 40upx;
				height: 40upx;
				font-size: 40upx;
				line-height: 1;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.input-uni-text {
				flex: 1;
				margin-left: 14upx;
				color: #959595;
			}
		}

		.header-handle {
			width: 100%;
			display: flex;
			align-items: center;
			justify-content: flex-end;

			image {
				width: 40upx;
				height: 40upx;
				margin-left: 20upx;

				&:first-of-type {
					margin-left: 0;
				}
			}
		}
	}

	.menu-top-con {
		margin-top: 20rpx;

		width: 95%;
		margin-left:33rpx;
		background-color: white;
		position: relative;

		.top-menu {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 30rpx 25rpx;

			.menu-item {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 180rpx;
				height: 90rpx;
				background-color: #4DABF2;
				border-radius: 15rpx;

				view {
					font-size: 28rpx;
					color: #fff;
				}

				image {
					width: 42rpx;
					height: 42rpx;
					margin-left: 22rpx;
				}

				&:first-child {
					background-color: #63DB93;
				}

				&:last-child {
					background-color: #FBB54A;
				}
			}
		}

		uni-grid {
			padding: 0 25rpx;
		}
	}

	.address {
		display: flex;
		align-items: center;
		color: #fff;
		width: 150upx;
		flex: none;

		.address-text {
			overflow: hidden;
			font-size: 30upx;
			flex: 1;
		}

		.uniui-arrowdown {
			font-size: 28upx;
			line-height: 1;
			margin-left: 10upx;
			flex: none;
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

	.grid-item-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		margin: 20rpx 0;

		.text {
			font-size: 26upx;
		}

		.icon {
			height: 50rpx;
			line-height: 40rpx;
			margin: 20rpx 0;
		}

		.box-img_back {
			width: 80upx;
			height: 80upx;
			background-color: #F5F5F5;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			margin: 0;
		}

		.box-img {
			width: 46rpx;
			height: 46rpx;
			margin: 0;

			&.incomplete {
				filter: grayscale(100%);
			}
		}

		.grid-icon {
			width: 80upx;
			height: 80upx;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			// margin-bottom: 10upx;
			background-color: #F5F5F5;
		}
	}

	.notice_bg {
		height: 70upx;
		margin: 20upx 35upx;
		background: rgba(57,125,246,0.05);
		border-radius: 15upx;
		padding: 0 16upx;
		display: flex;
		align-items: center;
	
		.icon {
			width: 94upx;
			flex: none;
			height: 30upx;
		}
	
		.line {
			width: 2upx;
			flex: none;
			height: 40upx;
			margin: 0 20upx;
			background-color: rgba(57, 125, 246, .1);
		}
	
		.bar-swiper {
			font-size: 24rpx;
			font-family: PingFangSC-Regular, PingFang SC;
			font-weight: 400;
			color: rgba(34, 34, 34, 0.5);
			height: 40rpx;
			display: flex;
			align-items: center;
			flex: 1;
			margin-left: 12rpx;
		}
	
		.swiper-item {
			display: flex;
			align-items: center;
			overflow: hidden;
		}
	
		.circle {
			min-width: 10rpx;
			width: 10rpx;
			height: 10rpx;
			border-radius: 50%;
			background-color: rgba(34, 34, 34, 0.5);
			margin-right: 10rpx;
		}
	
		.item_box {
			word-break: break-all;
			/* break-all(允许在单词内换行。) */
			text-overflow: ellipsis;
			/* 超出部分省略号 */
			display: -webkit-box;
			/** 对象作为伸缩盒子模型显示 **/
			-webkit-box-orient: vertical;
			/** 设置或检索伸缩盒对象的子元素的排列方式 **/
			-webkit-line-clamp: 1;
			/** 显示的行数 **/
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
</style>