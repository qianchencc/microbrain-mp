<template>
	<view class="second-page">
		<my-office v-if="comName === 'MyOffice'" :list="list"></my-office>
		<menu-com v-else-if="menuPage.includes(comName)" :list="list"></menu-com>
		<list-com v-else-if="listPage.includes(comName)" :list="list"></list-com>
	</view>
</template>

<script>
import {usePermissionStoreHook} from "@/store/modules/permission";
// 特殊二级页
import MyOffice from "./second/MyOffice.vue";
// 通用二级页，菜单型，列表型
import MenuCom from "./second/MenuCom.vue";
import ListCom from "./second/ListCom.vue";

export default {
	components: {ListCom, MenuCom, MyOffice},
	data() {
		return {
			id: null,
			
			menuPage: ['MyApply'],
			listPage: ['Property', 'CompanyManage']
		};
	},
	onLoad(options) {
		this.id = options.id;
	},
	computed: {
		comObj(){
			return this.findName(usePermissionStoreHook().getMenuList, this.id) || {}
		},
		comName(){
			return this.comObj.resourceName
		},
		list(){
			return this.comObj.children
		}
	},
	watch: {
		comName(){
			uni.setNavigationBarTitle({
				title: this.comObj.resourceTitle
			})
		}
	},
	methods: {
		findName(list, id) {
			for (let item of list) {
				if (item.id == id) {
					return item;
				}
				if (item.children) {
					const result = this.findName(item.children, id);
					if (result) return result;
				}
			}
			return null
		}
	}
}
</script>

<style lang="scss" scoped>
.second-page {
	padding: 25rpx;
}
</style>
