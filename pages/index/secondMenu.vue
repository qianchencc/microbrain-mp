<template>
	<view class="second-page">
		<my-office v-if="comName === 'MyOffice'" :list="list"></my-office>
		<my-apply v-else-if="comName === 'MyApply'" :list="list"></my-apply>
		<property v-else-if="comName === 'Property'" :list="list"></property>
	</view>
</template>

<script>
import {usePermissionStoreHook} from "@/store/modules/permission";
import MyOffice from "./second/MyOffice.vue";
import MyApply from "./second/MyApply.vue";
import Property from "./second/Property.vue";

export default {
	components: {Property, MyApply, MyOffice},
	data() {
		return {
			id: null
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
