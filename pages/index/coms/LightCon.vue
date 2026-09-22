<template>
	<view class="light-con">
		<!-- 提示语 + 查看全部 -->
		<view class="tip">
			<view class="tip-left">
				<view class="bar"></view>
				<text>请选择你要控制的灯光</text>
			</view>
			<view v-if="menu" class="more" hover-class="more-hover" @click="toAll">
				<text>查看全部</text>
				<view class="arrow"></view>
			</view>
		</view>

		<!-- 楼层地址 -->
		<scroll-view class="area-scroll" scroll-x enhanced :show-scrollbar="false">
			<view class="area-list">
				<view
					v-for="item in floorList"
					:key="item.id"
					class="area-item floor"
					:class="{ active: currentFloor === item.id }"
					hover-class="area-hover"
					@click="selectFloor(item)">
					{{ item.name }}
				</view>
				<view v-if="!floorList.length" class="area-empty">暂无楼层</view>
			</view>
		</scroll-view>

		<!-- 房间地址 -->
		<scroll-view v-if="roomList.length" class="area-scroll" scroll-x enhanced :show-scrollbar="false">
			<view class="area-list">
				<view
					v-for="item in roomList"
					:key="item.id"
					class="area-item room"
					:class="{ active: currentRoom === item.id }"
					hover-class="area-hover"
					@click="selectRoom(item)">
					{{ item.name }}
				</view>
			</view>
		</scroll-view>

		<!-- 设备列表 -->
		<view class="device-list">
			<view v-for="device in pageDevices" :key="device.id" class="device-item">
				<image class="icon" src="/static/light.png" mode="aspectFit"></image>
				<view class="name">{{ device.name }}</view>
				<view
					class="open-btn"
					:class="{ disabled: device.switchStatus }"
					hover-class="btn-hover"
					@click="switchDevice(device)">
					{{ device.switchStatus ? '关闭' : '开启' }}
				</view>
			</view>
			<m-empty v-if="!deviceList.length" description="暂无照明设备"></m-empty>
		</view>

		<!-- 分页器 -->
		<view v-if="pageCount > 1" class="pager">
			<view class="page-btn" :class="{ disabled: page === 1 }" hover-class="btn-hover" @click="changePage(page - 1)">上一页</view>
			<view class="page-num">{{ page }} / {{ pageCount }}</view>
			<view class="page-btn" :class="{ disabled: page === pageCount }" hover-class="btn-hover" @click="changePage(page + 1)">下一页</view>
		</view>
	</view>
</template>

<script>
import { fetchLightAreaList, fetchLightDeviceList, switchLightDevice } from "@/apis/office";
import { jumpUrl } from "@/utils/tools";

// 楼层查询的固定parentId
const ROOT_PARENT_ID = '9bb2912c59969ac5d8b03cdd59013588'

export default {
	name: "LightCon",
	props: {
		menu: Object
	},
	data() {
		return {
			floorList: [],
			roomList: [],
			deviceList: [],
			currentFloor: '',
			currentRoom: '',
			page: 1,
			pageSize: 6,
			switchingId: ''
		}
	},
	computed: {
		pageCount() {
			return Math.ceil(this.deviceList.length / this.pageSize) || 1
		},
		pageDevices() {
			const start = (this.page - 1) * this.pageSize
			return this.deviceList.slice(start, start + this.pageSize)
		}
	},
	mounted() {
		this.getFloorList()
	},
	methods: {
		// 楼层列表
		async getFloorList() {
			const res = await fetchLightAreaList(ROOT_PARENT_ID)
			this.floorList = res?.content || []
			if (this.floorList.length) this.selectFloor(this.floorList[0])
		},

		// 切换楼层 -> 查询房间
		async selectFloor(item) {
			if (this.currentFloor === item.id) return
			this.currentFloor = item.id
			this.roomList = []
			this.deviceList = []
			this.currentRoom = ''
			const res = await fetchLightAreaList(item.id)
			this.roomList = res?.content || []
			if (this.roomList.length) this.selectRoom(this.roomList[0])
		},

		// 切换房间 -> 查询设备
		selectRoom(item) {
			if (this.currentRoom === item.id) return
			this.currentRoom = item.id
			this.getDeviceList(item.fullCode)
		},

		// 设备列表
		async getDeviceList(areaFullCode) {
			this.page = 1
			const res = await fetchLightDeviceList(areaFullCode)
			const content = res?.content
			this.deviceList = Array.isArray(content) ? content : (content?.content || [])
			this.$emit('toBottom')
		},

		// 假分页：上一页/下一页
		changePage(page) {
			if (page < 1 || page > this.pageCount) return
			this.page = page
		},

		// 开关灯：开启状态发0关闭，关闭状态发1开启
		async switchDevice(device) {
			if (this.switchingId) return
			this.switchingId = device.id
			uni.showLoading({ title: '请稍候...', mask: true })
			const res = await switchLightDevice({ lightingAreaDeviceId: device.id, closeOrOpen: device.switchStatus ? 0 : 1 })
			uni.hideLoading()
			this.switchingId = ''
			if (res) {
				device.switchStatus = !device.switchStatus
				uni.showToast({ title: res.message || (device.switchStatus ? '已开启' : '已关闭'), icon: 'none' })
			}
		},

		// 查看全部：和首页菜单跳转一样
		toAll() {
			jumpUrl(this.menu)
		}
	}
}
</script>

<style scoped lang="scss">
.light-con {
	width: 100%;
	box-sizing: border-box;
	background-color: #ffffff;
	border-radius: 24rpx;
	padding: 24rpx;
	margin-bottom: 20rpx;
	box-shadow: 0 8rpx 24rpx rgba(57, 116, 246, 0.08);

	.tip {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20rpx;

		.tip-left {
			display: flex;
			align-items: center;
			font-size: 28rpx;
			font-weight: 600;
			color: #333333;

			.bar {
				width: 8rpx;
				height: 28rpx;
				border-radius: 4rpx;
				background: linear-gradient(to bottom, #3974F6, #6FA8FF);
				margin-right: 12rpx;
			}
		}

		.more {
			display: flex;
			align-items: center;
			flex-shrink: 0;
			font-size: 24rpx;
			color: #3974F6;

			&.more-hover {
				opacity: 0.7;
			}

			.arrow {
				width: 12rpx;
				height: 12rpx;
				margin-left: 6rpx;
				border-top: 3rpx solid #3974F6;
				border-right: 3rpx solid #3974F6;
				transform: rotate(45deg);
			}
		}
	}

	.area-scroll {
		width: 100%;
		white-space: nowrap;

		& + .area-scroll {
			margin-top: 16rpx;
		}

		.area-list {
			display: inline-flex;
			padding: 4rpx 0;
		}

		.area-item {
			flex-shrink: 0;
			padding: 12rpx 28rpx;
			margin-right: 16rpx;
			border-radius: 30rpx;
			font-size: 24rpx;

			&.area-hover {
				opacity: 0.7;
			}

			&:last-child {
				margin-right: 0;
			}
		}

		/* 楼层：选中为实心渐变 */
		.floor {
			color: #666666;
			background-color: #F5F5F5;

			&.active {
				color: #ffffff;
				font-weight: 600;
				background: linear-gradient(to right, #3974F6, #6FA8FF);
				box-shadow: 0 4rpx 12rpx rgba(57, 116, 246, 0.3);
			}
		}

		/* 房间：选中为浅蓝描边 */
		.room {
			color: #666666;
			background-color: #ffffff;
			border: 2rpx solid #E5E5E5;

			&.active {
				color: #3974F6;
				font-weight: 600;
				background-color: #ECF3FE;
				border-color: #3974F6;
			}
		}

		.area-empty {
			font-size: 24rpx;
			color: #999999;
			padding: 12rpx 0;
		}
	}

	.device-list {
		margin-top: 10rpx;

		.device-item {
			display: flex;
			align-items: center;
			padding: 20rpx 0;
			border-bottom: 2rpx solid #F5F5F5;

			&:last-child {
				border-bottom: none;
			}

			.icon {
				width: 76rpx;
				height: 76rpx;
				flex-shrink: 0;
				margin-right: 20rpx;
				border-radius: 14rpx;
				background-color: #F5F8FF;
			}

			.name {
				flex: 1;
				min-width: 0;
				font-size: 26rpx;
				color: #333333;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.open-btn {
				flex-shrink: 0;
				margin-left: 20rpx;
				padding: 12rpx 36rpx;
				border-radius: 32rpx;
				font-size: 24rpx;
				color: #ffffff;
				background: linear-gradient(to right, #3974F6, #6FA8FF);
				box-shadow: 0 4rpx 12rpx rgba(57, 116, 246, 0.3);

				&.btn-hover {
					opacity: 0.8;
				}

				&.disabled {
					opacity: 0.5;
				}
			}
		}
	}

	.pager {
		display: flex;
		align-items: center;
		justify-content: center;
		padding-top: 20rpx;
		border-top: 2rpx solid #F5F5F5;

		.page-btn {
			padding: 10rpx 28rpx;
			border-radius: 28rpx;
			border: 2rpx solid #3974F6;
			font-size: 24rpx;
			color: #3974F6;

			&.btn-hover {
				opacity: 0.7;
			}

			&.disabled {
				border-color: #DDDDDD;
				color: #CCCCCC;
			}
		}

		.page-num {
			margin: 0 30rpx;
			font-size: 24rpx;
			color: #666666;
		}
	}
}
</style>
