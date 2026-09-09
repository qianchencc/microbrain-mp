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
							<view class="notice-more" @click="goPage('/pages/news/noticeList')">更多</view>
						</view>
						<view class="top-menu">
							<view v-for="menu in topMenuList" :key="menu.id" class="menu-item" @click="jumpUrl(menu)">
								<view class="text" v-html="menu.resourceTitle"></view>
								<image :src="getUrl(menu.icon)" mode="aspectFit"></image>
							</view>
						</view>
						<swiper class="menu-swiper" v-if="workMenuPages.length"
							:style="{ height: workMenuPages.length > 1 ? '300rpx' : '250rpx' }"
							:indicator-dots="workMenuPages.length > 1"
							indicator-color="rgba(54, 96, 146, 0.3)"
							indicator-active-color="#366092">
							<swiper-item v-for="(page, index) in workMenuPages" :key="index">
								<view class="menu-one">
									<view v-for="menu in page" :key="menu.id" class="menu-item" @click="jumpUrl(menu)">
										<image :src="getUrl(menu.icon)" mode="aspectFit"></image>
										<view class="text">{{ menu.resourceTitle }}</view>
									</view>
								</view>
							</swiper-item>
						</swiper>
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
	import {fetchNoticePage} from '@/apis/home'
	import {getUrl, goPage, jumpUrl} from '@/utils/tools'
	import { useBannerHook } from '../utils/banner.js'
	import {isDev} from "@/config/settings";
	import {useUserStoreHook} from "@/store/modules/user";
	
	const { bannerList, getBannerList } = useBannerHook()
	// 是否显示首页菜单
	const showIndex = computed(() => useUserStoreHook().getShowIndex)
	// 菜单列表
	const menuList = computed(() => usePermissionStoreHook().getMenuList)
	// 顶部菜单
	const topMenuList = computed(() => {
		const list = menuList.value.find(item => item.resourceName === 'topMenu')?.children || []
		return list.map(item => ({
			...item,
			resourceTitle: item.resourceTitle.slice(0, 2) + '<br/>' + item.resourceTitle.slice(2)
		}))
	})
	// 工作菜单
	const workMenuList = computed(() => {
		const list = menuList.value.find(item => item.resourceName === 'workSpace')?.children || [];
		const sortObj = useUserStoreHook().getDict['IndexMenuSort'] || {}
		const menuMap = new Map(list.map(item => [item.id, item]))
		// 按字典排序值升序排列的菜单id
		const sortedIds = Object.entries(sortObj)
			.sort((a, b) => parseInt(a[1]) - parseInt(b[1]))
			.map(([id]) => id)
			.filter(id => menuMap.has(id))
		return sortedIds.map(id => menuMap.get(id))
	})
	// 工作菜单分页，每页8个（4列x2行）
	const workMenuPages = computed(() => {
		const pages = []
		for (let i = 0; i < workMenuList.value.length; i += 8) {
			pages.push(workMenuList.value.slice(i, i + 8))
		}
		return pages
	})
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
		fetchNoticePage({
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
		getBannerList()
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
			.notice-more {
				flex-shrink: 0;
				margin-left: 15rpx;
				font-size: 22rpx;
				color: #6a6a6a;
				&:after {
					content: ">";
				}
			}
		}
		
		.top-menu {
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			grid-gap: 10rpx;
			padding: 20rpx 0;
			.menu-item {
				width: 100%;
				border-radius: 15rpx;
				padding: 10rpx;
				height: 120rpx;
				position: relative;
				.text {
					position: absolute;
					top: 10rpx;
					right: 10rpx;
					z-index: 5;
					text-align: right;
					font-size: 20rpx;
					line-height: 1.2;
				}
				image {
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
				}
			}
		}
		
		.menu-swiper {
			width: 100%;
		}

		.menu-one {
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			grid-gap: 20rpx 0;
			.menu-item {
				text-align: center;
				image {
					width: 80rpx;
					height: 80rpx;
				}
				.text {
					font-size: 20rpx;
					overflow: hidden;
					white-space: nowrap;
					text-overflow: ellipsis;
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
