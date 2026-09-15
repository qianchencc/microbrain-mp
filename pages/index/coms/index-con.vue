<template>
	<view class="index-page">
		<swiper class="header-con" autoplay circular>
			<template v-if="bannerList.length > 0">
				<swiper-item v-for="(img,key) in bannerList" :key="key">
					<image class="swiper-image" :src="img.url" mode="aspectFill" />
				</swiper-item>
			</template>
		</swiper>
		<template v-if="showIndex">
			<view class="line"></view>
			<view class="top">
				<template v-if="menuList.length">
					<view class="menu-con">
						<view class="notice-con">
							<image src="/static/images/index/notice.png" mode="aspectFit"></image>
							<swiper class="notice-list" circular vertical>
								<swiper-item v-for="item in noticeList" :key="item.id">
									<view class="notice-item" @click="goPage(`/pages/news/detail?id=${item.id}`)">
										{{ item.infoSubject }}
									</view>
								</swiper-item>
							</swiper>
						</view>
						<view class="top-menu">
							<view v-for="menu in topMenuList" :key="menu.id" class="menu-item" @click="jumpUrl(menu)">
								<view class="text" v-html="menu.resourceTitle"></view>
								<image :src="getUrl(menu.icon)" mode="aspectFit"></image>
							</view>
						</view>
						<scroll-view class="scroll-menu" scroll-x="true">
							<view class="menu-one">
								<view class="menu-item" @click="goPage('/pages/agent/index')">
									<view class="agent-entry-icon">
										<uni-icons type="chatboxes-filled" size="28" color="#176b54" />
									</view>
									<view class="text">物联助手</view>
								</view>
								<view v-for="menu in workMenuList" :key="menu.id" class="menu-item" @click="jumpUrl(menu)">
									<image :src="getUrl(menu.icon)" mode="aspectFit"></image>
									<view class="text">{{ menu.resourceTitle }}</view>
								</view>
							</view>
						</scroll-view>
					</view>
					<view class="line"></view>
					<view class="menu-con" v-if="serviceMenuList.length">
						<view class="menu-two">
							<view v-for="menu in serviceMenuList" :key="menu.id" class="menu-item" @click="jumpUrl(menu)">
								<image :src="getUrl(menu.icon)" mode="aspectFit"></image>
								<view class="text">{{ menu.resourceTitle }}</view>
							</view>
						</view>
					</view>
				</template>
				<view v-else class="empty" @click="goPage('/pages/user/index')">请前往个人中心确权！</view>
			</view>
		</template>
		<view class="line"></view>
		<view class="good-con" v-if="goodList.length">
			<view class="image-title">
				<view class="title-left">
					<image src="/static/images/index/good.png" mode="aspectFit"></image>
					<view>天天福利</view>
				</view>
			</view>
			<view class="good-list con">
				<swiper class="good_swiper" autoplay circular>
					<swiper-item v-for="item in goodList" :key="item.id">
						<image class="good-item" :src="item.goodsImage" mode="aspectFill" @click="openGood(item)" />
					</swiper-item>
				</swiper>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { usePermissionStoreHook } from '@/store/modules/permission'
	import { computed, ref } from 'vue'
	import {fetchNewsPage} from '@/apis/home'
	import {getUrl, goPage, jumpUrl} from '@/utils/tools'
	import { useBannerHook } from '../utils/banner.js'
	import {isDev} from "@/config/settings";
	import {useUserStoreHook} from "@/store/modules/user";
	
	const { bannerList } = useBannerHook()
	// 是否显示首页菜单
	const showIndex = computed(() => useUserStoreHook().getShowIndex)
	// 菜单列表
	const menuList = computed(() => usePermissionStoreHook().getMenuList)
	// 顶部菜单配置（key: 菜单名称，value: 菜单图标）
	const topObj = computed(() => useUserStoreHook().getDict['MiniTopMenu'] || {})
	const topMenu = computed(() => Object.values(topObj.value))
	const workMenu = computed(() => menuList.value.find(item => item.resourceName === 'workSpace')?.children || [])
	const topMenuList = computed(() => {
		let obj = {};
		Object.entries(topObj.value).forEach(([k, v]) => obj[v] = k)
		return workMenu.value.filter(item => topMenu.value.includes(item.resourceTitle)).map(item => ({
			...item,
			icon: obj[item.resourceTitle],
			resourceTitle: item.resourceTitle.slice(0, 2) + '<br/>' + item.resourceTitle.slice(2)
		}))
	})
	// 工作菜单
	const workMenuList = computed(() => workMenu.value.filter(item => !topMenu.value.includes(item.resourceTitle)))
	// 服务菜单
	const serviceMenuList = computed(() => menuList.value.find(item => item.resourceName === 'serviceSpace')?.children || [])
	
	const reqUrl = isDev ? 'https://nltest.nongchanlian.com' : 'https://nlw.nongchanlian.com'
	const goodList = ref([])
	const getGoodList = async () => {
		uni.request({
			url: `${reqUrl}/nl/dailywelfare/getValidList`,
			method: 'get',
			dataType: 'json',
			success: (res) => {
				if (res.statusCode === 200 && res.data.code === 0) {
					goodList.value = res.data.data
				} else {
					uni.showToast({
						title: '第三方接口异常',
						icon: 'none'
					})
				}
			}
		})
	}
	const openGood = (item) => {
		let url = `${item.jumpPath}?id=${item.goodsCommonId}&storeId=${item.storeId}&isExternal=1`
		if (item.distId) {
			url += `&distId=${item.distId}`
		}
		uni.openEmbeddedMiniProgram({
			appId: item.jumpId,
			path: url,
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
	
	const initData = async () => {
		getNoticePage()
		getGoodList()
	}

	defineExpose({
		initData
	})
</script>

<style lang="scss" scoped>
.index-page {
	margin-bottom: 20rpx;
	
	.line {
		width: 100%;
		height: 20rpx;
		position: relative;
		$height: 40rpx;
		$width: 10rpx;
		$per: 25%;
		&::after, &::before {
			content: '';
			display: block;
			width: $width;
			position: absolute;
			top: calc(10rpx - $height / 2);
			height: $height;
			background-color: #366092;
			border-radius: 10rpx;
			z-index: 7;
		}
		&::after {
			right: $per;
		}
		&::before {
			left: $per;
		}
	}
	
	.header-con {
		$height: 350rpx;
		width: 100%;
		height: $height;
		border-radius: 25rpx;
		overflow: hidden;
		
		.swiper-image {
			width: 100%;
			height: $height;
		}
	}
	
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
		.menu-con {
			padding: 20rpx;
			border-radius: 25rpx;
			background-color: white;
		}
		
		.notice-con {
			display: flex;
			align-items: center;
			padding: 10rpx 20rpx;
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
		
		.top-menu {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			grid-gap: 20rpx;
			padding: 20rpx 0;
			.menu-item {
				width: 100%;
				background-color: #ecf3fe;
				border-radius: 15rpx;
				padding: 10rpx;
				height: 140rpx;
				position: relative;
				.text {
					position: absolute;
					top: 10rpx;
					right: 10rpx;
					z-index: 5;
					text-align: right;
					font-size: 26rpx;
					line-height: 1.2;
				}
				image {
					position: absolute;
					bottom: 10rpx;
					left: 10rpx;
					width: 90rpx;
					height: 90rpx;
				}
			}
		}
		
		.menu-one {
			display: grid;
			grid-template-columns: repeat(7, 165rpx);
			grid-gap: 20rpx 0;
			.menu-item {
				text-align: center;
				.agent-entry-icon {
					width: 80rpx;
					height: 80rpx;
					margin: 0 auto;
					border-radius: 16rpx;
					background: #dcebe4;
					display: flex;
					align-items: center;
					justify-content: center;
				}
				image {
					width: 80rpx;
					height: 80rpx;
				}
				.text {
					font-size: 24rpx;
				}
			}
		}
		
		.menu-two {
			@extend .menu-one;
			grid-template-columns: repeat(4, 1fr);
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
		padding: 10rpx;
		border-radius: 15rpx;
		background-color: white;
		margin-bottom: 20rpx;
		.good-list {
			margin-top: 10rpx;
			$height: 300rpx;
			.good_swiper {
				width: 100%;
				height: $height;
				.good-item {
					width: 680rpx;
					height: $height;
					border-radius: 15rpx;
				}
			}
		}
	}
}
</style>
