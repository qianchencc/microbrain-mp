<template>
	<view class="list">
		<uni-list :border="false">
			<uni-list-item link @click="changeAvatar()">
				<template v-slot:header>
					<view class="slot-box">
						头像
					</view>
				</template>
				<template v-slot:footer>
					<img v-if="avatar" class="slot-image" :src="avatar">
					<text v-else class="slot-image">无</text>
				</template>
			</uni-list-item>
			<uni-list-item :border="false" title="昵称" :rightText="userInfo.nickname" showArrow link="navigateTo" to="./info/name" />
			<!-- <uni-list-item :border="false" title="电话" :rightText="userInfo.mobileNumber" showArrow link="navigateTo" to="./info/mobile" /> -->
			<uni-list-item :border="false" link @click="changeFace()">
				<template v-slot:header>
					<view class="slot-box">
						人脸信息
						<uni-tag v-if="userInfo.faceAuthStatus" :mark="true" :text="faceAuthStatus[userInfo.faceAuthStatus].text" :type="faceAuthStatus[userInfo.faceAuthStatus].type" size="mini" />
					</view>
				</template>
				<template v-slot:footer>
					<image v-if="face" class="slot-image" :src="face"></image>
				</template>
			</uni-list-item>
		</uni-list>
	</view>
</template>

<script setup>
	import { ref, computed, onMounted } from 'vue'
	import globalConfig from '@/config'
	import { useUserStoreHook } from '@/store/modules/user'
	import { chooseImg } from '@/utils/tools.js'
	import { updatePrincipalInfo } from '@/apis/user/principal.js'
	import { checkToken } from '/utils/auth.js'
	import { faceAuthStatus } from './utils/enums.js'

	const principalInfo = ref()
	const userInfo = computed(() => useUserStoreHook().getUserInfo)

	const avatar = computed(() => userInfo.value.avatar ? globalConfig.ssoUrl + userInfo.value.avatar : null)
	const face = computed(() => userInfo.value.faceUrl ? globalConfig.fileAddr + userInfo.value.faceUrl : null)
	const changeAvatar = () => {
		chooseImg(1, async (uploadFileRes) => {
			const res = JSON.parse(uploadFileRes.data)
			console.log(res);
			const uploadRes = await updatePrincipalInfo(userInfo.value.id, {
				...userInfo.value,
				avatar: res.content,
			})
			if (!uploadRes) return
			avatar.value = globalConfig.fileAddr + res.content
			useUserStoreHook().setUserInfo()
		})
	}

	function changeFace() {
		if (userInfo.value.confirmationStatus !== 'ACCEPT') {
			uni.showModal({
				title: '提示',
				content: '请组织确权后重试',
				showCancel: false
			});
			return
		}
		// #ifdef MP-WEIXIN
		uni.navigateTo({
			url: './face'
		})
		// #endif

	}
	onMounted(() => {
		checkToken()
	})
</script>

<style lang="scss">
	.slot-box {
		line-height: 3;
	}

	.slot-image {
		width: 80rpx;
		height: 80rpx;
		line-height: 80rpx;
		border-radius: 10rpx;
	}
</style>