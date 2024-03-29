<template>
</template>

<script>
</script>

<style>
</style>
<!-- <template>
	<view class="view-con" style="text-align: center;">
		<camera device-position="front" flash="off" @error="error" style="width: 100%; height: 500px;"></camera>
		<cover-image class="controls-play img" @click="play" src="../../static//images/user/face/rllr_bg.png">
		</cover-image>
		<cover-view class="cover-view" @click="takePhoto">开始录入</cover-view>
		<cover-view class="cover-info">{{message}}</cover-view>
	</view>
</template>

<script>
	import { uploadPrincipalFace } from '@/apis/home'
	import { useUserStoreHook } from '@/store/modules/user'
	export default {
		data() {
			return {
				client_id: 'LUB52vGUV0GkdCWDGUKsjipz', // 百度智能云clint_id
				client_secret: 'sHd5TDO4ppUoiYwGiv6jIb33Kj33KR9K', // 百度智能云client_secret
				access_token: '', // 百度接口token,每次进入更新一次
				message: '',
				faceBase64: '',
				checkedEye: false,
				checkedLeft: false
			}
		},
		methods: {
			async getAccessToken() {
				// 每次更新access_token
				wx.request({
					url: `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.client_id}&client_secret=${this.client_secret}`,
					method: 'POST',
					dataType: 'json',
					header: {
						'content-type': 'application/json'
					},
					success: (res) => {
						this.access_token = res.data.access_token
					}
				})
			},

			takePhoto() {
				const ctx = uni.createCameraContext()
				ctx.takePhoto({
					quality: 'low',
					success: (res) => {
						wx.getFileSystemManager().readFile({
							filePath: res.tempImagePath, // 选择图片返回的相对路径
							encoding: 'base64', // 编码格式
							success: res => { // 成功的回调
								this.faceDetect(res.data)
							}
						})
					}
				})
			},
			// 百度头像检测
			faceDetect(faceBase64) {
				wx.request({
					url: 'https://aip.baidubce.com/rest/2.0/face/v3/detect?access_token=' +
						this.access_token,
					data: {
						image: faceBase64,
						image_type: 'BASE64',
						max_face_num: 1,
						face_type: 'LIVE',
						quality_control: 'LOW',
						liveness_control: 'NORMAL',
						face_field: 'expression,eye_status'
					},
					method: 'POST',
					dataType: 'json',
					header: {
						'content-type': 'application/json'
					},
					success: (res) => {
						if (res.data.error_code === 0 && res.data.result.face_list[0].face_probability === 1) {
							const face = res.data.result.face_list[0]
							if (!this.checkedEye) this.message = '请眨眼'
							// 眨眼校验
							const eyeStatus = !this.checkedEye && face.eye_status.left_eye < 0.4 && face.eye_status.right_eye < 0.4
							if (eyeStatus) {
								this.checkedEye = true
								this.message = '请向右转头'
							}
							// 转向校验
							if (!this.checkedLeft && face.angle.yaw < -40) {
								this.checkedLeft = true
								this.message = '录入完成'
								this.changeFace()
							}
							// 留存清晰正脸照片
							if (face.eye_status.left_eye > 0.4 && face.eye_status.right_eye > 0.4 && Math.abs(face.angle.yaw) < 50) {
								this.faceBase64 = faceBase64
							}
						}
						if (!this.checkedEye || !this.checkedLeft) {
							setTimeout(() => {
								this.takePhoto()
							}, 300)
						}
					}
				})
			},
			error(e) {
				console.log(e.detail)
			},
			async changeFace() {
				const id = useUserStoreHook().getUserInfo.id
				const uploadRes = await uploadPrincipalFace(id, {
					faceBase64: this.faceBase64
				})
				if (!uploadRes) return
				useUserStoreHook().setUserInfo()
				uni.navigateBack()
			}
		},
		onLoad() {
			this.getAccessToken()
		}
	}
</script>

<style lang="scss" scoped>
	.view-con {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.controls-play {
		position: absolute;
		top: 0;
		height: 1000rpx;
	}

	.cover-view {
		margin-top: 80px;
		height: 50px;
		line-height: 50px;
		border-radius: 25px;
		width: 600rpx;
		color: #fff;
		font-size: 22px;
		background-color: #3974F6;
	}

	.cover-info {
		color: #fff;
		position: relative;
		bottom: 200px;
		font-size: 18px;
	}
</style> -->