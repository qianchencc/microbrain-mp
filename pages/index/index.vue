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
					<text class="input-uni-text">请输入关键字搜索</text>
					<uni-icons class="input-uni-icon" type="scan" :size="null" color="#999" @click="handleScan">
					</uni-icons>
				</view>
				<view class="header-handle">
					<image class="handle-image" src="../../static/images/icon-home_voice.png" mode=""></image>
					<image class="handle-image" src="../../static/images/icon-home_cut.png" mode=""></image>
				</view>
			</view>
			<swiper class="page_swiper" autoplay indicator-dots="true" circular>
				<template v-if="bannerList.length > 0">
					<swiper-item v-for="(img,key) in bannerList" :key="key" @click="gainBannerManagement(img.id)">
						<image class="swiper-image" :src="img.pic" mode="aspectFill" />
					</swiper-item>
				</template>
			</swiper>
			<view class="menu-top-con">
				<view class="top-menu">
					<view class="menu-item" v-for="(item, index) in topMenu" :key="index" @tap="topJumpUrl(item)">
						<view>{{ item.title }}</view>
						<image :src="item.icon" mode="aspectFit"></image>
					</view>
				</view>
				<uni-grid style="background-color: #fff;padding: 20rpx 0;border-radius: 10rpx;" :column="4" :square="false" :showBorder="false" @change="change">
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
		</view>
	</view>
</template>

<script setup>
	import { usePermissionStoreHook } from '@/store/modules/permission'
	import { useUserStoreHook } from '@/store/modules/user'
	import { computed, reactive, ref, watch } from 'vue'
	import { jumpUrl } from '@/utils/tools'
	import { COOKIE_DOMAIN, SCHEME } from '@/config/settings'
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
	const bannerList = [{ pic: '/static/images/index/map.png' }]

	const open = () => {
		uni.navigateTo({
			url: './indexlist'
		})
	}
	const handleScan = () => {
		// #ifdef MP
		uni.scanCode({
			success: function(res) {
				try {
					const data = JSON.parse(res.result) || ''
					console.log(data);
					if (data.type === 'visitor') {
						if (false && new Date().getTime() - data.time > 60 * 1000) {
							uni.showToast({
								title: '刷新二维码重试',
								icon: 'none'
							});
						} else {
							uni.navigateTo({
								url: `/pages/webView/index?path=${SCHEME}${COOKIE_DOMAIN}${data.path}&id=${data.id}`,
								animationType: 'pop-in'
							})
						}
					}
				} catch (e) {
					//TODO handle the exception
					console.log(e)
				}
			}

		})
		// #endif
		// #ifdef H5
		uni.scanCode({
			success(res) {
				console.log(res);
			}
		})
		// #endif
	}
	const change = (e) => {
		console.log(e)
		const {
			index
		} = e.detail
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
			jumpUrl(menu)
		}
	}
</script>

<style lang="scss" scoped>
	.header-back {
		position: absolute;
		left: 0;
		background-color: #3974F6;
		height: 450rpx;
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
		width: 100%;
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
				width: 220rpx;
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
		height: 90upx;
		padding: 0 36upx;
		display: flex;
		align-items: center;

		.icon {
			width: 44upx;
			flex: none;
			height: 46upx;
		}

		.line {
			width: 2upx;
			flex: none;
			height: 40upx;
			margin: 0 24upx;
			background-color: #E1E1E1;
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
			font-size: 28rpx;
			color: #303030;
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