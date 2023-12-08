<template>
	<view>
		<view style="padding: 15px; background:white">
			<view class="input-split-line">
				<uni-easyinput v-model="name" :inputBorder="false" :clearable="false" placeholder="请输入姓名"></uni-easyinput>
				<button style="padding: 0 15px;height: 30px;" size="mini" :type="name === userInfo.name?'default':'primary'" :disabled="name === userInfo.name" @click="save">保存</button>
			</view>
			<text style="color: #999;font-size: 12px;margin-left: 8px;">好的生活，从一个好的名字开始</text>
		</view>
	</view>
</template>
<script setup>
	import { ref, computed } from 'vue'
	import { useUserStoreHook } from '@/store/modules/user'
	import { updatePrincipalInfo } from '@/apis/user/principal.js'

	const userInfo = computed(() => useUserStoreHook().getUserInfo)

	const name = ref(userInfo.value.name)

	const save = async () => {
		const data = {
			nickname: name.value,
			version: userInfo.value.version
		}
		const res = await updatePrincipalInfo(userInfo.value.id, data)
		if (!res) return
		useUserStoreHook().setUserInfo()
		uni.navigateBack()
	}

	const clickLeft = () => {
		uni.navigateBack()
	}
</script>
<style lang="scss" scoped>
	.input-split-line {
		display: flex;
		border-bottom: 1px solid #18bc37;
	}
</style>