<script>
	import { usePermissionStoreHook } from '@/store/modules/permission'
	export default {
		onLaunch: function() {
			console.log('App Launch')
			usePermissionStoreHook().setAuthority()
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		}
	}
</script>

<style lang="scss">
	/*每个页面公共css */
	@import "common/css/uni.css";
	@import "common/css/common.css";
</style>