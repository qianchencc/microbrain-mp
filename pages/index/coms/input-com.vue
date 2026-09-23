<template>
	<view class="input-voice">
		<view class="others-con">
			<view v-if="showCenter" class="item" @click="goPage('/pages/user/index')">
				<image src="/static/images/user.png" mode="aspectFit"></image>
				<text>个人中心</text>
			</view>
			<view class="item" @click="clearChat">
				<image src="/static/images/clear.png" mode="aspectFit"></image>
				<text>清空对话</text>
			</view>
		</view>
		<view class="input-con">
			<input v-if="!isVoice" type="text" v-model="value" confirm-type="send" :placeholder="placeholder" @confirm="inputConfirm">
			<view v-else class="voice-btn" @touchstart="startVoice" @touchend="endVoice">按住说话</view>
			<view class="voice-bg" @click.stop="isVoice = !isVoice">
				<image :src="`/static/${isVoice ? 'keybore' : 'voice'}.png`" mode="aspectFit"></image>
			</view>
		</view>
		<view class="tip">本服务为AI生成内容，结果仅供参考</view>
	</view>
</template>

<script>
import {goPage} from '@/utils/tools'

let manager

export default {
	name: "InputCom",
	props: {
		showCenter: {
			type: Boolean,
			default: true
		},
		placeholder: {
			type: String,
			default: '有什么可以帮到您的吗 ~'
		}
	},
	mounted() {
		try {
			const plugin = requirePlugin("WechatSI")
			manager = plugin.getRecordRecognitionManager()
			manager.onStart = this.voiceStart
			manager.onStop = this.voiceStop
			manager.onError = this.voiceError
		} catch {
			manager = null
		}
	},
	data(){
		return {
			value: '',
			isVoice: false
		}
	},
	methods: {
		goPage,
		clearChat(url) {
			this.$emit('clearChat')
		},
		// 输入发送
		inputConfirm(e){
			this.sendMsg({type: 'me', data: e.detail.value, query: {message: e.detail.value}})
			this.value = ''
		},
		// 语音发送
		startVoice() {
			if (!manager) {
				uni.showToast({ title: '当前版本暂未开通语音输入', icon: 'none' })
				return
			}
			manager.start();
			uni.showLoading({
				title: '正在录音'
			})
		},
		endVoice(res) {
			if (!manager) return
			manager.stop();
			uni.hideLoading()
		},
		voiceStart(res){
			console.log("成功开始录音识别", res)
		},
		voiceStop(res) {
			this.sendMsg({type: 'me', data: res.result, query: {message: res.result}})
		},
		voiceError(res) {
			console.error("error msg", res.msg)
			uni.showToast({
				title: `录音失败, ${res.msg}`,
				icon: 'none'
			})
			uni.hideLoading()
		},
		sendMsg(data) {
			this.$emit('sendMsg', data)
		}
	}
}
</script>

<style scoped lang="scss">
.input-voice {
	position: relative;
}

.others-con {
	position: absolute;
	left: 0;
	top: -80rpx;
	display: flex;
	align-items: center;
	z-index: 9;
	.item {
		display: flex;
		align-items: center;
		margin-right: 15rpx;
		padding: 10rpx;
		border-radius: 35rpx;
		background-color: white;
		
		image {
			width: 25rpx;
			height: 25rpx;
			margin-right: 15rpx;
			border-radius: 50%;
			border: 2rpx solid #3b82f6;
			padding: 8rpx;
		}
		text {
			font-size: 26rpx;
		}
	}
}

.input-con {
	height: 80rpx;
	flex-shrink: 0;
	background-color: white;
	border-radius: 40rpx;
	padding: 12rpx 24rpx;
	position: relative;
	input {
		height: 100%;
		font-size: 24rpx;
	}
	.voice-btn {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bolder;
	}
	.voice-bg {
		position: absolute;
		top: 50%;
		right: 24rpx;
		width: 60rpx;
		height: 60rpx;
		transform: translateY(-50%);
		z-index: 9;
		image {
			width: 100%;
			height: 100%;
		}
	}
}

.tip {
	font-size: 24rpx;
	text-align: center;
	margin-top: 10rpx;
	color: #6a737d;
}
</style>
