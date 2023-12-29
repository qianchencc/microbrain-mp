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
					<img v-else class="slot-image"
						src="https://gimg2.baidu.com/image_search/src=http%3A%2F%2Fpic2.zhimg.com%2F50%2Fv2-95baf91ff4a81c3504eb61d4eaa64f68_hd.jpg&refer=http%3A%2F%2Fpic2.zhimg.com&app=2002&size=f9999,10000&q=a80&n=0&g=0n&fmt=auto?sec=1663753670&t=43b26098480afb171efe4449c254a2bb">
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

	const faceAuthStatus = {
		'TO_BE_AUTH': {
			text: '待认证',
			type: 'warning'
		},
		'TO_BE_CHECK': {
			text: '待审核',
			type: 'warning'
		},
		'CHECK_REJECT': {
			text: '审核失败',
			type: 'error'
		},
		'CHECK_SUCCESS': {
			text: '已认证',
			type: 'success'
		}
	}

	const userInfo = computed(() => useUserStoreHook().getUserInfo)

	const avatar = computed(() => userInfo.value.avatar ? globalConfig.ssoUrl + userInfo.value.avatar : null)
	const face = computed(() => globalConfig.ssoUrl + userInfo.value.faceUrl)
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
		// #ifdef MP-WEIXIN

		// #endif
		uni.navigateTo({
			url: './face',
			success: res => {},
			fail: () => {},
			complete: () => {}
		})
	}
	onMounted(checkToken)
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