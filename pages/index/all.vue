<template>
	<view class="page" style="padding: 30rpx;">
		<view class="my-menu" style="">
			<view class="menu-header">
				<text>我的应用</text>
				<button type="primary" plain="true" size="mini" @click="isEdit = !isEdit">{{isEdit?'完成':'编辑'}}</button>
			</view>
			<uni-grid style="background-color: #fff;padding: 20rpx 0;border-radius: 10rpx;" :column="4" :square="false" :showBorder="false">
				<template v-for="(item, index) in homeMenuList" :key="item.id">
					<uni-grid-item @tap="change(item)">
						<view class="grid-item-box">
							<img v-if="isEdit" class="icon-add" src="/static/images/home/icon_delete.png" @click="editMenu(item.id)">
							<view class="box-img_back">
								<image class="box-img" :src="item.icon.startsWith('http') ? item.icon : `/static/images/home/${item.icon}`" alt="" />
							</view>
							<text class="text">{{item.title}}</text>
						</view>
					</uni-grid-item>
				</template>
			</uni-grid>
		</view>
		<template v-for="menu in menuList" :key="menu.id">
			<view v-if="hasRouter(menu)" class="my-menu" style="margin-top: 10px;">
				<view class="menu-header">
					<text>{{menu.title}}</text>
				</view>
				<uni-grid :column="4" :square="false" :showBorder="false">
					<template v-for="(item) in menu.children" :key="item.id">
						<uni-grid-item v-if="item.enable !== 0" style="width: 25%;" @tap="change(item)">
							<view class="grid-item-box">
								<img v-if="isEdit&&!homeMenuIndex.includes(item.id)" class="icon-add" src="/static/images/home/icon_add.png" @tap="editMenu(item.id,'add')">
								<!-- <view class="box-img_back" v-if="!item.uri.includes('incomplete')"> -->
								<view class="box-img_back">
									<template v-if="item.externalResource === 1">
										<image class="box-img" :src="showNewsImage(item.icon)" alt="" />
									</template>
									<template v-else>
										<image class="box-img" :src="item.icon.startsWith('http') ? item.icon : `/static/images/home/${item.icon}`" alt="" />
									</template>
								</view>
								<!-- <uni-icons class="icon" v-else type="star" :size="30" :color="'#777'" /> -->
								<text class="text">{{item.title}}</text>
							</view>
						</uni-grid-item>
					</template>
				</uni-grid>
			</view>
		</template>
	</view>
</template>

<script setup>
	import { usePermissionStoreHook } from '@/store/modules/permission'
	import { useUserStoreHook } from '@/store/modules/user'
	import { getToken } from '@/utils/auth'
	import { getZztMsg, getApplyOnAuthCode } from '@/apis/user/principal'
	import { zztServer } from '@/config/settings.js'
	import { ref, watch, computed } from 'vue'
	import { jumpUrl } from '../../utils/tools'
	import globalConfig from '@/config'
	const isEdit = ref(false)
	const noticeRef = ref(null)

	function hasRouter(data) {
		return data.children.map(v => v.name).some(v => !v.includes('incomplete'))
	}

	// 显示资讯图片
	const showNewsImage = computed(() => {
		return val => {
			let base = ''
			if (val && !val.startsWith('http')) {
				base = globalConfig.fileAddr
			}
			return base + val
		}
	})

	const menuList = computed(() => usePermissionStoreHook().getMenuList)
	const homeMenuIndex = computed(() => usePermissionStoreHook().getHomeMenuIndex)

	const homeMenuList = ref([])
	watch(() => homeMenuIndex.value, () => {
		const data = [...usePermissionStoreHook().getHomeMenu]
		data.pop()
		homeMenuList.value = data
	}, {
		deep: true,
		immediate: true
	})

	const editMenu = (id, type) => {
		if (type) {
			homeMenuIndex.value.push(id)
		} else {
			const index = homeMenuIndex.value.indexOf(id)
			homeMenuIndex.value.splice(index, 1)
		}
		console.log('homeMenuIndex.value: ', homeMenuIndex.value.length);
		usePermissionStoreHook().setHomeMenuIndex(homeMenuIndex.value)
	}

	const userInfo = computed(() => useUserStoreHook().getUserInfo)
	const change = async (menu) => {
		if (isEdit.value) return
		if (menu.uri.includes('incomplete')) {
			uni.showToast({
				title: `敬请期待`,
				icon: 'none'
			})
			// } else if (userInfo.value.mobile !== '11111112222' && ((menu.resourceTag === 'OWNER' && userInfo.value.tag !== 'OWNER') || (menu.resourceTag === 'REALNAME' && userInfo.value.tag === 'TOURIST'))) { // 判断用户是否需要确认消息
			// 	noticeRef.value.openDialog()
		} else {
			jumpUrl(menu)
		}
	}
</script>

<style lang="scss" scoped>
	.my-menu {
		background-color: #fff;
		padding: 20rpx;
		border-radius: 30rpx;

		.menu-header {
			font-size: 30rpx;
			font-family: Source Han Sans CN;
			font-weight: 500;
			color: #303030;
			width: 100%;
			margin-bottom: 10rpx;

			display: flex;
			justify-content: space-between;
			align-items: center;

			button {
				width: 70px;
				// height: 30px;
				// line-height: 30px;
				// border-radius: 15px;
				margin: 0;
				color: #3984F6;
				border-color: #3984F6;
			}
		}

		.grid-item-box {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			margin: 20rpx 0;
			position: relative;

			.icon-add {
				width: 30rpx;
				height: 30rpx;
				position: absolute;
				right: 10%;
				top: -10%;
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
			}

			.box-img {
				width: 46rpx;
				height: 46rpx;
				// margin: 20rpx 0;
			}

			.text {
				font-size: 26rpx;
				font-family: Source Han Sans CN;
				font-weight: 400;
				color: #333333;
				line-height: 18px;
			}
		}
	}
</style>