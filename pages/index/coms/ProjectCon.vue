<template>
	<view class="project-con">
		<view class="tip">
			<view class="bar"></view>
			<text>为您查到以下项目</text>
		</view>
		<view class="list">
			<view class="item" hover-class="item-hover" v-for="(item, index) in list" :key="index" @click="toDetail(item)">
				<image class="cover" src="/static/project.png" mode="aspectFit"></image>
				<view class="info">
					<view class="name">{{ item.projectName }}</view>
					<view class="code">项目编号：{{ item.projectNo }}</view>
				</view>
				<view class="arrow"></view>
			</view>
			<m-empty v-if="loaded && !list.length" description="暂无项目"></m-empty>
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
import {goPage} from "@/utils/tools";
import {fetchProjectPage} from "@/apis/common";

export default {
	name: "ProjectCon",
	props: {
		query: {
			type: Object,
			default: () => ({})
		}
	},
	data(){
		return {
			list: [],
			total: 0,
			page: 1,
			pageSize: 6,
			loaded: false
		}
	},
	computed: {
		pageCount() {
			return Math.ceil(this.total / this.pageSize) || 1
		}
	},
	mounted() {
		this.getList()
	},
	methods: {
		// 项目分页查询，query为外部传入的固定查询条件
		async getList() {
			let {projectName, projectYear, projectYearBeginTime, projectYearEndTime,projectType, projectManager} = this.query
			const res = await fetchProjectPage({
				page: this.page,
				size: this.pageSize,
				...(projectName ? {projectName} : {}),
				...(projectYear ? {projectYear} : {}),
				...(projectYearBeginTime ? {projectYearBeginTime} : {}),
				...(projectYearEndTime ? {projectYearEndTime} : {}),
				...(projectType ? {projectType} : {}),
				...(projectManager ? {projectManager} : {})
			})
			const content = res?.content
			this.list = content?.content || []
			this.total = content?.totalElements || 0
			this.loaded = true
			this.$emit('toBottom')
		},
		// 上一页/下一页
		changePage(page) {
			if (page < 1 || page > this.pageCount) return
			this.page = page
			this.getList()
		},
		toDetail(item) {
			goPage(`/pages/detail/project?code=${item.projectNo}`)
		}
	}
}
</script>


<style scoped lang="scss">
.project-con {
	width: 100%;
	box-sizing: border-box;
	background-color: #ffffff;
	border-radius: 24rpx;
	padding: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(57, 116, 246, 0.08);
	margin-bottom: 20rpx;

	.tip {
		display: flex;
		align-items: center;
		font-size: 28rpx;
		font-weight: 600;
		color: #333333;
		margin-bottom: 10rpx;

		.bar {
			width: 8rpx;
			height: 28rpx;
			border-radius: 4rpx;
			background: linear-gradient(to bottom, #3974F6, #6FA8FF);
			margin-right: 12rpx;
		}
	}

	.item {
		display: flex;
		align-items: center;
		padding: 20rpx 0;
		border-bottom: 2rpx solid #f2f2f2;

		&:last-child {
			border-bottom: none;
			padding-bottom: 4rpx;
		}

		&.item-hover {
			opacity: 0.7;
		}

		.cover {
			width: 88rpx;
			height: 88rpx;
			flex-shrink: 0;
			margin-right: 20rpx;
			border-radius: 16rpx;
			background-color: #f5f8ff;
		}

		.info {
			flex: 1;
			min-width: 0;

			.name {
				font-size: 26rpx;
				color: #333333;
				line-height: 1.4;
				overflow: hidden;
				text-overflow: ellipsis;
				display: -webkit-box;
				-webkit-box-orient: vertical;
				-webkit-line-clamp: 2;
			}

			.code {
				margin-top: 8rpx;
				font-size: 22rpx;
				color: #999999;
			}
		}

		.arrow {
			width: 14rpx;
			height: 14rpx;
			flex-shrink: 0;
			margin-left: 16rpx;
			border-top: 3rpx solid #cccccc;
			border-right: 3rpx solid #cccccc;
			transform: rotate(45deg);
		}
	}

	.pager {
		display: flex;
		align-items: center;
		justify-content: center;
		padding-top: 20rpx;
		border-top: 2rpx solid #f2f2f2;

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
