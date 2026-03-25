<template>
	<view class="content">
		<view class="header-view">
			<view class="header">
				<img v-if="userInfo.avatar" class="header-image" :src="globalConfig.ssoUrl+userInfo.avatar">
				<view v-else class="header-image title-avatar">
					<text>
						{{ userInfo.nickname ? userInfo.nickname.charAt(0) : userInfo.code.charAt(0) }}
					</text>
				</view>
				<view>
					<h3>
						{{ userInfo.nickname || userInfo.code }}
					</h3>
				</view>
				<view class="edit-con" @click="changeAvatar">
					<uni-icons type="compose" color="#3974F6" size="20"></uni-icons>
					<text style="font-size: 24rpx;">编辑</text>
				</view>
			</view>
		</view>
		<view class="list">
			<uni-list :border="false">
				<uni-list-item :border="false" title="组织确权" showArrow link="navigateTo" clickable @click="toOwner()">
					<template v-slot:footer>
						<view class="tag-view">
							<uni-tag :circle="true" :text="confirmationStatus[userInfo.confirmationStatus].text" :type="confirmationStatus[userInfo.confirmationStatus].type" />
						</view>
					</template>
				</uni-list-item>
			</uni-list>
		</view>
		<view class="list">
			<uni-list :border="false">
				<template v-for="item in pageMenu" :key="item.title">
					<uni-list-item v-if="item.name!=='incomplete'" :border="false" :title="item.title" showArrow clickable @click="toPage(item)" />
				</template>
			</uni-list>
		</view>
		<view class="list">
			<uni-list :border="false">
				<uni-list-item title="蓝牙广播">
					<template v-slot:footer>
						<switch ref="switchRef" :checked="bluetooth" style="transform:scale(0.7)" @change="switchOn" />
					</template>
				</uni-list-item>
			</uni-list>
		</view>
		<view class="list">
			<uni-list :border="false">
				<uni-list-item :border="false" title="关于我们" showArrow link="navigateTo" to="./about" />
				<uni-list-item :border="false" title="意见反馈" showArrow clickable @click="toOpinion()" />
			</uni-list>
		</view>
		
		<uni-popup ref="alertDialog" type="dialog">
			<uni-popup-dialog cancelText="关闭" confirmText="确认" title="手机蓝牙未打开!" content="使用蓝牙广播前请先打开手机蓝牙!" @confirm="dialogConfirm" @close="dialogClose"></uni-popup-dialog>
		</uni-popup>
	</view>
</template>

<script setup>
	import { computed, ref, onMounted } from 'vue'
	import { onShow } from '@dcloudio/uni-app'
	import { storageGet, storageSet, storageRemove } from '@/utils/storage'
	import globalConfig from '@/config'
	import { fetchCurrentUsed } from '@/apis/home'
	import { openBle } from '@/utils/blue.js'
	import { DOMAIN } from '@/config/settings'
	import { useUserStoreHook } from '@/store/modules/user'
	import { pageMenu, confirmationStatus } from './utils/enums.js'
	import { jumpUrl } from '@/utils/tools'
	import { setSubscribeMessages } from '@/utils/subscribeMessage.js'

	const userInfo = computed(() => useUserStoreHook().getUserInfo)
	const changeAvatar = () => {
		uni.navigateTo({
			url: './principal'
		})
	}
	const switchRef = ref(null)
	const alertDialog = ref(null)
	const bluetooth = ref(false)
	const ifChecked = ref(false)

	function toPage(item) {
		if (item.name === 'incomplete') return
		jumpUrl({
			...item,
			uri: DOMAIN + `/${item.name.toLocaleLowerCase()}` + (item.uri || '/')
		})
	}

	function dialogConfirm() {
		bluetooth.value = false

	}

	function dialogClose() {
		bluetooth.value = false
	}
	
	onMounted(() => {
		initBlueTooth()
	})
	onShow(() => {
		console.log('show', ifChecked.value, bluetooth.value)
		initBlueTooth()
	})
	const initBlueTooth = () => {
		if (!storageGet('bluetoothstatus')) {
			storageSet('bluetoothstatus', false)
		}

		getSwitch()
		bluetooth.value = storageGet('bluetoothstatus')
	}
	const getSwitch = () => {
		wx.closeBluetoothAdapter({
			complete() {
				wx.openBluetoothAdapter({
					success: (res) => {
						console.info('Get Bluetooth ');
						wx.getBluetoothAdapterState({
							success: function(res) {
								ifChecked.value = true
								if (bluetooth.value === true) {
									blueToothBroadCast()
								}
							},
							fail: function(res) {
								console.log(res)
								ifChecked.value = false
								if (bluetooth.value === true) {
									alertDialog.value.open()
								}
							}
						})
					},
					fail: (res) => {
						console.log('openBluetoothAdapter failed');

						console.warn(res);
					},
					complete: (res) => {
						console.debug('openBluetoothAdapter completed');
					},
				});
			}
		})

	}
	const blueToothBroadCast = async () => {
		const res = await fetchCurrentUsed()
		if (!res.content) {
			uni.showToast({
				title: '当前用户无卡号！请联系管理员下发卡号！',
				icon: 'none'
			})
		} else {
			let card = parseInt(res.content.cardNumber).toString(16).padStart(8, '0')
			console.log('cardNumber', card)
			let list = []
			list.push(parseInt(card.substring(0, 2), 16))
			list.push(parseInt(card.substring(2, 4), 16))
			list.push(parseInt(card.substring(4, 6), 16))
			list.push(parseInt(card.substring(6, 8), 16))
			if (bluetooth.value === true) {
				openBle(list);
			} else {
				console.log('close')
			}
		}

	}

	// 去授权
	function toOwner() {
		setSubscribeMessages('card', 'user')
		uni.navigateTo({
			url: './owner',
			success: res => {
				setSubscribeMessages('card', 'user')
			}
		});
	}
	const switchOn = async (val) => {
		bluetooth.value = val.target.value
		if (bluetooth.value === false) {
			wx.closeBluetoothAdapter({
				complete: function(res) {
					console.log('bluetooth close', res)
				}
			})
		} else {
			getSwitch()
		}

		storageSet('bluetoothstatus', val.target.value)
		console.log('switch2', val)
	}
	const toOpinion=()=>{
		uni.navigateTo({
			url: '/pages/user/opinion',
			animationType: 'pop-in'
		})
	}
</script>

<style lang="scss" scoped>
	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;

		.header-view {
			width: 100%;
			background-color: #3974F6;
			background-position: center;
			background-repeat: no-repeat;
			background-size: cover;
			margin-bottom: 10rpx;
		}

		.integral_list {
			width: 700upx;
			height: 140upx;
			background: #FFFFFF;
			border-radius: 15upx 15upx 0px 0px;
			margin: 0 auto;
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: -2rpx;

			.integral_item {
				flex: 1;
				display: flex;
				align-items: center;
				justify-content: center;

				.integral_icon {
					width: 58upx;
					height: 58upx;
					margin-right: 22upx;
				}

				.integral_number {
					line-height: 1;
					font-size: 36upx;
					color: #262626;
				}

				.integral_type {
					line-height: 1;
					font-size: 26upx;
					color: #666666;
				}
			}

			.line {
				flex: none;
				width: 2upx;
				height: 80upx;
				background: #EDEDED;
			}
		}

		.header {
			width: 100%;
			display: flex;
			align-items: center;
			padding: 10rpx 0;
			color: #fff;
			margin-bottom: 10rpx;

			.header-image {
				width: 116rpx;
				height: 116rpx;
				border-radius: 50%;
				margin: 30rpx;
				border: 12upx solid rgba(255, 255, 255, .2);
			}

			.title-avatar {
				font-size: 80rpx;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.edit-con {
				width: 115rpx;
				height: 60rpx;
				padding: 10rpx;
				background: #FFFFFF;
				border-radius: 35rpx 0px 0px 35rpx;
				color: #3974F6;
				position: absolute;
				right: 0;
				display: flex;
				align-items: center;
				justify-content: space-around;
			}
		}

		.list {
			width: 700rpx;
			margin: 10rpx 0;
			background-color: #fff;
			border-radius: 15rpx;
			padding: 10rpx 0;
		}

		.bluetooth {}

	}
</style>
