<template>
	<view class="index">
		<scroll-view class="chat-con" scroll-y="true" scroll-with-animation="true" :scroll-into-view="inView">
			<index-con ref="indexCon" @sendMsg="sendMsg"></index-con>
			<view v-for="(chatItem, chatIndex) in chatList" :key="chatIndex">
				<view v-if="chatItem.type === 'me'" class="me-item con">
					<view class="me">{{ chatItem.data }}</view>
				</view>
				<view v-else class="ai-item con">
					<view v-if="['EXCEPTION', 'AI_ANSWER'].includes(chatItem.type)" class="ai">
						<zero-markdown-view :markdown="chatItem.data" @load="toBottom"/>
					</view>
					<ActivityCon v-else-if="chatItem.type === 'ACTIVITY'" @toBottom="toBottom"/>
					<NewsCon v-else-if="chatItem.type === 'NEWS'" @toBottom="toBottom"/>
					<MenuCon v-else-if="chatItem.type === 'BUSINESS_MODULE'" :name="chatItem.data"/>
				</view>
			</view>
			<loading ref="loading" v-if="loading" @toLoading="toBottom"></loading>
			<!--为了滚动到底做的view-->
			<view id="bottom"></view>
		</scroll-view>
		
		<input-com @sendMsg="sendMsg" @clearChat="clearChat"></input-com>
	</view>
</template>

<script>
	import {fetchCurrentUsed} from '@/apis/home'
	import { openBle } from '@/utils/blue.js'
	import { storageGet, storageSet } from '@/utils/storage'
	import IndexCon from "./coms/index-con.vue";
	import Loading from "@/pages/index/coms/loading.vue";
	import InputCom from "@/pages/index/coms/input-com.vue";
	import ActivityCon from "@/pages/index/coms/ActivityCon.vue";
	import NewsCon from "@/pages/index/coms/NewsCon.vue";
	import MenuCon from "@/pages/index/coms/MenuCon.vue";
	import {chatToAi} from "@/apis/common";
	
	export default {
		components: {
			MenuCon,
			NewsCon,
			ActivityCon,
			InputCom,
			Loading,
			IndexCon
		},
		data() {
			return {
				loading: false,
				inView: 'index',
				chatList: [],
				
				// 蓝牙部分
				bluetooth: false,
				ifChecked: false
			}
		},
		onShow() {
			this.init()
		},
		methods: {
			init() {
				this.initBlueTooth()
				this.$refs.indexCon.initData()
			},
			// 发送消息
			sendMsg(data) {
				if (this.loading) return
				if (data.type === 'me') {
					this.chatList.push(data)
					this.toBottom(0)
				}
				// auto: 自动发送，query：请求参数，params：非请求参数
				if (!data.auto) {
					this.loading = true;
					this.toBottom()
					if (data.query) {
						chatToAi(data.query).then(res => {
							console.log(res)
							this.$nextTick(() => {
								this.$refs.loading.toEnd()
								if (res) {
									let chat = res.content
									this.chatList.push({type: chat.scene, data: chat.message})
								}
								this.loading = false
								this.toBottom()
							})
						})
					} else if (data.params) {
						this.$nextTick(() => {
							this.$refs.loading.toEnd()
							// 内部模块，自定义参数，直接推入
							this.chatList.push(data.params)
							this.loading = false
							this.toBottom()
						})
					}
				} else {
					this.inView = 'bottom';
					this.chatList.push(data.auto)
					this.loading = false;
					this.toBottom()
				}
			},
			
			// 清空聊天记录
			clearChat() {
				this.chatList = []
			},
			// 工具
			toBottom (time = 1500) {
				console.log('---------------- toBottom ----------------')
				this.inView = ''
				this.$nextTick(() => {
					setTimeout(() => {
						this.inView = 'bottom'
					}, time)
				})
			},
			// 蓝牙部分
			initBlueTooth() {
				if (!storageGet('bluetoothstatus')) {
					storageSet('bluetoothstatus', false)
				}
				this.bluetooth = storageGet('bluetoothstatus')
				wx.closeBluetoothAdapter({
					complete() {
						wx.openBluetoothAdapter({
							success: (res) => {
								wx.getBluetoothAdapterState({
									success: async () => {
										this.ifChecked = true
										if (this.bluetooth === true) {
											const res = await fetchCurrentUsed()
											if (!res.content) return
											let card = parseInt(res.content.cardNumber).toString(16).padStart(8, '0')
											let list = []
											list.push(parseInt(card.substring(0, 2), 16))
											list.push(parseInt(card.substring(2, 4), 16))
											list.push(parseInt(card.substring(4, 6), 16))
											list.push(parseInt(card.substring(6, 8), 16))
											openBle(list);
										}
									},
									fail: function(res) {
										this.ifChecked = false
									}
								})
							},
							fail: (res) => {
								console.log('openBluetoothAdapter failed', res);
							}
						});
					}
				})
			}
		},
		onPullDownRefresh() {
			this.init()
			uni.stopPullDownRefresh();
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
}
</style>
