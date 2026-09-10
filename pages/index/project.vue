<template>
	<view class="index">
		<scroll-view class="chat-con" scroll-y="true" scroll-with-animation="true" :scroll-into-view="inView" @scroll="scrollTop">
			<!--为了滚动到顶做的view-->
			<view id="top"></view>
			<template v-if="chatList.length">
				<view v-for="(chatItem, chatIndex) in chatList" :key="chatIndex">
					<view v-if="chatItem.type === 'me'" class="me-item con">
						<view class="me">{{ chatItem.data }}</view>
					</view>
					<view v-else class="ai-item con">
						<view v-if="chatItem.type === 'AI_ANSWER'" class="ai">
							<zero-markdown-view :markdown="chatItem.data" @load="toBottom"/>
						</view>
						<project-con v-else :list="chatItem.data"></project-con>
					</view>
				</view>
			</template>
			<m-empty v-else description="暂无查询记录"></m-empty>
			<loading ref="loading" v-if="loading" @toLoading="toBottom"></loading>
			<!--为了滚动到底做的view-->
			<view id="bottom"></view>
		</scroll-view>
		
		<input-com :showCenter="false" placeholder= "请输入您要查询的项目内容"  @sendMsg="sendMsg" @clearChat="clearChat"></input-com>
		
		<image v-if="showTop > 0" class="top" src="/static/top.png" mode="aspectFit" @click="toTop"></image>
	</view>
</template>

<script>
import Loading from "@/pages/index/coms/loading.vue";
import InputCom from "@/pages/index/coms/input-com.vue";
import ProjectCon from "@/pages/index/coms/ProjectCon.vue";
import {chatToAiProject} from "@/apis/common";

export default {
	components: {
		ProjectCon,
		InputCom,
		Loading
	},
	data() {
		return {
			loading: false,
			inView: 'index',
			chatList: [],
			showTop: 0
		}
	},
	methods: {
		// 发送消息
		sendMsg(data) {
			if (this.loading) return
			if (data.type === 'me') {
				this.chatList.push(data)
				this.toBottom(0)
			}
			this.loading = true
			chatToAiProject(data.data).then(res => {
				this.loading = false
				if (res) {
					let haveData = res.content && res.content.content && res.content.content.length
					this.chatList.push({
						type: haveData ? 'PRROJECT' : 'AI_ANSWER',
						data: haveData ? res.content.content : '未查询到任何项目,请重新描述'
					})
					this.toBottom()
				}
			})
		},
		
		// 清空聊天记录
		clearChat() {
			this.chatList = []
		},
		// 工具
		toBottom (time = 500) {
			console.log('---------------- toBottom ----------------')
			this.inView = ''
			this.$nextTick(() => {
				setTimeout(() => {
					this.inView = 'bottom'
				}, time)
			})
		},
		toTop(){
			this.inView = '';
			this.$nextTick(() => {
				this.inView = 'top'
			})
		},
		scrollTop(e){
			this.showTop = e.detail.scrollTop - 200
		}
	}
}
</script>

<style lang="scss" scoped>
.index {
	width: 100vw;
	height: 100vh;
	padding: 25rpx 25rpx env(safe-area-inset-bottom);
	display: flex;
	flex-direction: column;
	background: linear-gradient(to bottom, #3974F6 0%, #F7F7F7 100%);
	.chat-con {
		height: 0;
		flex-grow: 1;
		padding-bottom: 90rpx;
		$fz: 25rpx;
		.chat-style {
			font-size: $fz;
			width: fit-content;
			max-width: 100%;
			margin-bottom: 20rpx;
		}
		.me-item {
			max-width: 700rpx;
			display: flex;
			justify-content: flex-end;
			.me {
				background: #ffffff;
				border-radius: 35rpx 35rpx 0 35rpx;
				padding: 20rpx 25rpx;
				@extend .chat-style;
			}
		}
		.ai-item {
			max-width: 700rpx;
			.ai {
				background-color: #E6F3D0;
				border-radius: 35rpx 35rpx 35rpx 0;
				@extend .chat-style;
			}
		}
	}
	
	.top {
		width: 70rpx;
		height: 70rpx;
		position: fixed;
		bottom: calc(160rpx + env(safe-area-inset-bottom));
		right: 20rpx;
		z-index: 99;
	}
}
</style>
