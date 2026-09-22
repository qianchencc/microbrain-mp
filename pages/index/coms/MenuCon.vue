<template>
	<view>
		<access-con v-if="name === '智慧门禁'" :menu="menu" @toBottom="toBottom"></access-con>
		<light-con v-else-if="name === '智慧照明'" :menu="menu" @toBottom="toBottom"></light-con>
		<ac-con v-else-if="name === '智慧空调'" :menu="menu" @toBottom="toBottom"></ac-con>
		<view v-else class="con">
			<view class="tip">为您找到以下服务:</view>
			<view class="menu-list">
				<view class="menu-item" @click="jumpUrl(menu)">
					<image :src="getUrl(menu.icon)" mode="aspectFit"></image>
					<view class="text">{{ menu.resourceTitle }}</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import {usePermissionStoreHook} from "@/store/modules/permission";
import {getUrl, jumpUrl} from "@/utils/tools";
import AccessCon from "@/pages/index/coms/AccessCon.vue";
import LightCon from "@/pages/index/coms/LightCon.vue";
import AcCon from "@/pages/index/coms/AcCon.vue";

export default {
	components: {AccessCon, LightCon, AcCon},
	props: {
		name: String
	},
	computed: {
		menu(){
			const menuList = usePermissionStoreHook().getAllMenu
			return menuList.find(item => this.name === item.resourceTitle)
		}
	},
	methods: {
		getUrl,
		jumpUrl,
		toBottom(){
			this.$emit('toBottom')
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
	width: fit-content;
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
