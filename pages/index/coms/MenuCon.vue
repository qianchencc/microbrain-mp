<template>
	<view class="con">
		<view class="tip">为您找到以下服务:</view>
		<view class="menu-list">
			<view v-for="menu in showMenu" :key="menu.id" class="menu-item" @click="jumpUrl(menu)">
				<image :src="getUrl(menu.icon)" mode="aspectFit"></image>
				<view class="text">{{ menu.resourceTitle }}</view>
			</view>
		</view>
	</view>
</template>

<script>
import {usePermissionStoreHook} from "@/store/modules/permission";
import {getUrl, jumpUrl} from "@/utils/tools";

export default {
	props: {
		name: String
	},
	methods:{getUrl, jumpUrl},
	computed: {
		showMenu(){
			const menuList = usePermissionStoreHook().getAllMenu
			return menuList.filter(item => this.name.split(',').includes(item.resourceTitle))
		}
	}
}
</script>

<style scoped lang="scss">
.con {
	padding: 20rpx;
	border-radius: 15rpx;
	background-color: white;
	margin-bottom: 20rpx;
	.tip {
		font-size: 30rpx;
		margin-bottom: 15rpx;
	}
	.menu-list {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		grid-gap: 20rpx 0;
		.menu-item {
			text-align: center;
			image {
				width: 90rpx;
				height: 90rpx;
			}
			.text {
				font-size: 24rpx;
			}
		}
	}
}
</style>
