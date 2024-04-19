<template>
	<view class="container">
		<!-- <view class="header">
			功能开发中，敬请期待！最新完成：
			<text class="tui-current" @tap="currentStep">消息界面</text>
		</view> -->
		<view class="title">{{patrolPathName}}</view>
		<view class="field" v-for="(item,index) in VOList" :key="index">
			<uni-list class="list" :border="true">
				<view class="list-title"><span class="title-text">{{item.name}}</span></view>
				<view class="list-item">签到时间：{{item.patrolPointRecord?item.patrolPointRecord.signInTime:''}}
				</view>
				<view class="list-item">签到状态：{{item.patrolPointRecord?' 检查完毕 | 正常签到':''}}
				</view>
				<view class="list-item">签到位置：{{item.patrolPointRecord?item.patrolPointRecord.signLocation:''}}
				</view>
				<view v-if="!item.patrolPointRecord&&(patrolPointName===item.name)" class="login-btn"><button class="landing" :loading="loading" type="primary" @tap="sign">{{ "签到"}}</button>
				</view>
				
			</uni-list>
		</view>
		<!-- <view class="login-btn">
			<button class="landing" :loading="loading" type="primary" @tap="sign">{{ loading ? "签到中...":patrolPointName+" 签到"}}</button>
		</view> -->
		<!-- <view class="cu-timeline">
			<view class="cu-time text-blue">{{patrolPathName}}</view>
			<view  :class="{'text-blue':item.patrolPointRecord,'text-yellow':patrolPointId===item.patrolPointId}"
				v-for="(item,index) in VOList" :key="index">
						<uni-list>
							<uni-list :border="true">
								<view class="content">
									<view class="cu-capsule radius" v-if="item.patrolPointRecord">
										<view class="cu-tag bg-blue"></view>
										<view class="cu-tag line-blue">{{item.patrolPointRecord?item.patrolPointRecord.signInTime:'' }}</view>
									</view>
									<view class="cu-capsule radius" v-else>
										<view class="cu-tag">{{item.name?item.name:''}} </view>
									</view>
									<view  class="margin-left-sm">签到状态：{{item.patrolPointRecord?item.name+'| 检查完毕 | 正常签到':''}} 
									</view>
									<view  class="margin-left-sm">签到位置：{{item.patrolPointRecord?item.patrolPointRecord.signLocation:''}}
									</view>
								</view>
						
							</uni-list>
						</uni-list>		
			</view>
		</view>
		 -->

	</view>
</template>

<script>
	import {
		signIn,
		fatchPointCheckItem,
		getPatrolInfoByCode
	} from '@/apis/check/index.js'
	// import $weatherApi from '@/apis/weather.js'
	import QQMapwx from './detail/qqmap-wx-jssdk.js'

	export default {
		filters: {
			//    formatDate(value) {
			//        if (!value) return ''
			//        var date = new Date(value)
			//        var month = date.getMonth() + 1
			//        var hours = date.getHours()
			//        if (hours < 10) {
			//            hours = '0' + hours
			//        }
			//        var minutes = date.getMinutes()
			//        if (minutes < 10) {
			//            minutes = '0' + minutes
			//        }
			//        var time = date.getFullYear() + '-' + month + '-' + date.getDate() +
			// ' ' + hours + ':' + minutes
			//        return time
			//    },
			formatDate(val) {
				if (val) { return new Date(val.replace(/-/g, '/')).format('yyyy-MM-dd hh:mm') }

			},
			statusFilter(status) {
				const statusList = {
					'1': '正常',
					'2': '异常'
				}
				return statusList[status]
			}
		},
		data() {
			return {
				signEnable: false,
				patrolPointCode: '',
				patrolPointId: '',
				patrolRecordId: '',
				latitude: '',
				longitude: '',
				location: '',
				loading: false,
				patrolPathId: '',
				VOList: [],
				patrolPathName: '',
				patrolPointName: '',
				checkItems: [],
				address: ''
			}
		},
		onLoad(option) {
			this.patrolPointCode = option.code
			this.getPatrolInfo(option.code)
			this.getLocation()
		},
		onShow(option) {
			this.getPatrolInfo(this.patrolPointCode)
		},
		methods: {
			// 根据扫码巡更点id查询路线和巡更记录
			async getPatrolInfo(code) {
				const res = await getPatrolInfoByCode(code)
				if (!res.content.patrolPathNodeDetailsVOList) {
					this.signEnable = !res.content.patrolPathNodeDetailsVOList
					uni.showToast({
						title: '没有巡更任务',
						icon: 'none'
					})
				} else {
					const data = res.content
					console.log('data: ', data)
					this.patrolPointId = data.patrolPoint.id
					this.patrolPointName = data.patrolPoint.name
					this.patrolPathName = data.patrolPath.name
					this.VOList = data.patrolPathNodeDetailsVOList
					this.patrolRecordId = data.patrolRecord.id
					this.getPointCheckItem()
				}
			},
			// 根据巡更点id获取有没有检查项
			async getPointCheckItem() {
				const res = await fatchPointCheckItem(this.patrolPointId)
				this.checkItems = res.content.checkItems
			},
			getLocation() {
				const that = this
				uni.getLocation({
					// #ifdef MP-WEIXIN
					type: 'wgs84',
					// #endif
					success: res => {
						console.log(1, res)
						// 腾讯位置服务
						const qqmapsdk = new QQMapwx({
							key: 'PNZBZ-ILCKZ-CUSX6-ZKKBF-QA3IH-6RFTO'
						});
						console.log(2, qqmapsdk)
						try {
							qqmapsdk.reverseGeocoder({
								// 通过纬度 经度来查询地址
								location: {
									latitude: res.latitude,
									longitude: res.longitude
								},
								success: (re) => {
									console.log(3, re) // 城市信息
									that.address = re.result.formatted_addresses.standard_address
								},
								fail: function(error) {
									console.error(error);
								},
								complete: function(res) {
									console.log(res);
								}
							})
						} catch (e) {
							console.log(3, e)
							//TODO handle the exception
						}

					},
					fail() {
						uni.showModal({
							content: '检测到您没打开定位权限，是否去设置打开？',
							confirmText: '确认',
							cancelText: '取消',
							success: function(res) {
								if (res.confirm) {
									// #ifdef MP-WEIXIN
									wx.openSetting({
										success: res => {}
									})
									// #endif
									// #ifdef MP-ALIPAY
									my.openSetting({
										success: res => {}
									})
									// #endif
								}
							}
						})
					}
				})
			},
			// 签到
			async sign() {
				// uni.navigateTo({
				//     url: '/pages/check/detail/index?patrolPointId=' + this.patrolPointId ,
				//     animationType: 'pop-in'
				// })
				if (this.signEnable) {
					uni.showToast({
						title: '没有巡更任务',
						icon: 'none'
					})
				} else {
					console.log('signadd', this.address)
					const data = {
						qrCode: this.patrolPointId,
						patrolRecordId: this.patrolRecordId,
						signLocation: this.address
					}
					const res = await signIn(data)
					console.log('签到成功返回', res)
					if (res) {
						if (this.checkItems.length !== 0) {
							const patrolPointRecordId = res.content.id
							//const patrolPointRecordId = this.patrolRecordId
							console.log('签到历史patrolPointRecordId', patrolPointRecordId)
							uni.navigateTo({
								url: '/pages/check/detail/index?patrolPointId=' + this.patrolPointId +
									'&patrolPointRecordId=' + patrolPointRecordId,
								animationType: 'pop-in'
							})
						}
					}
					
					
				}

			}
		}
	}
</script>
<style lang="scss">
	.chat-custom-right {
		flex: 1;
		/* #ifndef APP-NVUE */
		display: flex;
		/* #endif */
		flex-direction: column;
		justify-content: space-between;
		align-items: flex-end;
	}

	.uni-list {
		border-radius: 15rpx;
	}

	.title {
		text-align: center;
		font-size: 48rpx;
		color: #000;
		font-weight: bold;
		padding: 32rpx;
	}

	.field {
		display: flex;
		flex-direction: row;
		justify-content: flex-start;
		padding: 20rpx;
	}

	.list-title {
		color: rgb(155 157 175);
		background-color: rgb(239 246 255);
		font-weight: bold;
		font-size: 32rpx;

		.title-text {
			margin-left: 40rpx;
		}
	}

	.list-item {
		margin-left: 20upx;
		margin-top: 10upx;
		padding: 10upx;
	}

	.list {
		width: 100%;
	}

	.container {
		padding: 0 20rpx;
		height: 100%;
		overflow: hidden;
		min-height: 1300rpx;
	}

	.code-view {
		margin: 40rpx auto;
		height: 100rpx;
		line-height: 100rpx;
		width: 300rpx;
		text-align: center;
		background-color: lightblue;
	}

	.cu-time {
		width: 100%;
		color: #0081ff;
		text-align: left;
		font-size: 30rpx;
		font-weight: bold;
		padding: 10rpx 0 10rpx 25rpx;
	}

	.cu-tag {
		height: 50rpx !important;
		top: 0 !important;
	}

	.header {
		width: 100%;
		padding: 0 30rpx;
		box-sizing: border-box;
		font-size: 24rpx;
		color: #999;
		height: 54rpx;
		line-height: 54rpx;
		background: #fff8d5;
		display: flex;
		align-items: center;
		position: fixed;
		top: 0;
		/* #ifdef H5 */
		top: 44px;
		/* #endif */
		z-index: 998;
	}

	.login-btn {
		margin-top: 20rpx;
		margin-bottom: 20rpx;
		// margin-top: 10rpx;
		.landing {
			width: 70%;
			height: 84rpx;
			line-height: 84rpx;
			border-radius: 44rpx;
			font-size: 32rpx;
			background: linear-gradient(to left, #86B5F4, #4790EF);
		}
	}
</style>