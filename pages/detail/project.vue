<template>
	<view class="project-detail">
		<!-- 顶部：项目名称、项目编号 -->
		<view class="header">
			<view class="circle circle-1"></view>
			<view class="circle circle-2"></view>
			<view class="name">{{ detail.projectName || '-' }}</view>
			<view class="code">
				<text class="code-label">项目编号</text>
				<text class="code-value">{{ detail.projectNo || '-' }}</text>
			</view>
		</view>

		<!-- nav模块：横向滚动切换 -->
		<scroll-view class="nav" scroll-x enhanced :show-scrollbar="false" scroll-with-animation :scroll-into-view="navIntoView">
			<view
				v-for="(item, index) in sections"
				:key="item.key"
				:id="'nav-' + index"
				class="nav-item"
				:class="{ active: currentNav === index }"
				hover-class="nav-hover"
				@click="switchNav(index)">
				{{ item.title }}
				<view class="underline" v-if="currentNav === index"></view>
			</view>
		</scroll-view>

		<!-- 信息模块：根据nav切换显示内容 -->
		<view class="content">
			<view class="card">
				<view class="card-title">
					<view class="bar"></view>
					<text>{{ currentSection.title }}</text>
				</view>
				<view class="kv-list">
					<view
						v-for="field in currentSection.fields"
						:key="field.prop"
						class="kv-item"
						:class="{ full: field.full }">
						<view class="label">{{ field.label }}</view>
						<!-- 项目进度：进度条展示 -->
						<view v-if="field.type === 'progress'" class="value progress-box">
							<view class="progress-track">
								<view class="progress-inner" :style="{ width: progressValue + '%' }"></view>
							</view>
							<text class="progress-num">{{ progressValue }}%</text>
						</view>
						<view v-else class="value" :class="{ money: field.type === 'money' }">{{ formatValue(field) }}</view>
					</view>
				</view>
			</view>

			<!-- 最新现场图片：仅最新进度模块显示 -->
			<view class="card site-image-card" v-if="currentSection.key === 'latestProgress'">
				<view class="card-title">
					<view class="bar"></view>
					<text>最新现场图片</text>
				</view>
				<view class="kv-item">
					<view class="label">最新提交时间</view>
					<view class="value">{{ siteImageSubmitTime || '-' }}</view>
				</view>
				<view class="image-list" v-if="siteImageList.length">
					<image
						v-for="(img, index) in siteImageList"
						:key="index"
						class="site-image"
						:src="img"
						mode="widthFix"
						@click="previewSiteImage(index)">
					</image>
				</view>
				<view class="empty" v-else>
					<uni-icons type="image" size="60" color="#C7D6F7"></uni-icons>
					<text class="empty-text">暂无现场图片</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import {fetchProjectDetail} from "@/apis/common";

const SECTIONS = [
	{
		key: 'projectBaseInfo',
		title: '项目基础信息',
		fields: [
			{ label: '业务员', prop: 'salesman' },
			{ label: '制单员', prop: 'documentCreator' },
			{ label: '项目类型', prop: 'projectType' },
			{ label: '所属机构', prop: 'owningOrg' },
			{ label: '承建机构', prop: 'constructionOrg' },
			{ label: '是否公建', prop: 'publicBuilding', type: 'boolean' },
			{ label: '质量标准', prop: 'qualityStandard' },
			{ label: '立项年份', prop: 'projectYear' },
			{ label: '项目经理', prop: 'projectManager' },
			{ label: '项目地址', prop: 'projectAddress', full: true },
			{ label: '计划工期', prop: 'plannedDuration' },
			{ label: '实际工期', prop: 'actualDuration' },
			{ label: '建设单位', prop: 'constructionUnit' },
			{ label: '项目所属', prop: 'projectOwnership' },
			{ label: '承建分支机构', prop: 'constructionBranch' },
			{ label: '项目是否分包', prop: 'subcontracted', type: 'boolean' },
			{ label: '总包项目', prop: 'generalContractProject', full: true },
			{ label: '投标编号', prop: 'bidNo' },
			{ label: '投标项目名称', prop: 'bidProjectName', full: true },
			{ label: '投标项目经理', prop: 'bidProjectManager' },
			{ label: '开标日期', prop: 'bidOpeningDate' },
			{ label: '中标日期', prop: 'bidWinningDate' }
		]
	},
	{
		key: 'latestProgress',
		title: '最新进度',
		fields: [
			{ label: '所属阶段', prop: 'currentStage' },
			{ label: '进度比例', prop: 'progressRatio', type: 'progress' },
			{ label: '进度详情', prop: 'progressDetail', full: true },
			{ label: '提交人', prop: 'submitter' },
			{ label: '提交时间', prop: 'submitTime' }
		]
	},
	{
		key: 'incomeContract',
		title: '收入合同',
		fields: [
			{ label: '合同份数', prop: 'contractCount' },
			{ label: '合同变更数', prop: 'contractChangeCount' },
			{ label: '初始化合同金额', prop: 'initialContractAmount', type: 'money' },
			{ label: '变更后合同金额', prop: 'modifiedContractAmount', type: 'money' },
			{ label: '累计变更金额', prop: 'totalChangeAmount', type: 'money' },
			{ label: '累计收款金额', prop: 'totalReceiptAmount', type: 'money' },
			{ label: '更新日期', prop: 'updateDate' },
			{ label: '更新人', prop: 'updater' }
		]
	},
	{
		key: 'laborSubcontract',
		title: '劳务分包合同',
		fields: [
			{ label: '合同份数', prop: 'contractCount' },
			{ label: '合同变更数', prop: 'contractChangeCount' },
			{ label: '累计合同金额', prop: 'totalContractAmount', type: 'money' },
			{ label: '累计变更金额', prop: 'totalChangeAmount', type: 'money' },
			{ label: '累计支付金额', prop: 'totalPaymentAmount', type: 'money' }
		]
	},
	{
		key: 'purchaseContract',
		title: '采购合同',
		fields: [
			{ label: '合同份数', prop: 'contractCount' },
			{ label: '合同变更数', prop: 'contractChangeCount' },
			{ label: '累计合同金额', prop: 'totalContractAmount', type: 'money' },
			{ label: '累计变更金额', prop: 'totalChangeAmount', type: 'money' },
			{ label: '累计支付金额', prop: 'totalPaymentAmount', type: 'money' }
		]
	},
	{
		key: 'inputInvoiceSummary',
		title: '进项汇总',
		fields: [
			{ label: '收票金额', prop: 'invoiceReceivedAmount', type: 'money' },
			{ label: '合同支出', prop: 'contractExpenditure', type: 'money' },
			{ label: '其他支出', prop: 'otherExpenditure', type: 'money' },
			{ label: '进项税额', prop: 'inputTaxAmount', type: 'money' },
			{ label: '与销项差额度', prop: 'outputTaxCheckAmount', type: 'money' }
		]
	},
	{
		key: 'outputInvoiceSummary',
		title: '销项汇总',
		fields: [
			{ label: '合同金额', prop: 'contractAmount', type: 'money' },
			{ label: '项目资金余额', prop: 'projectFundBalance', type: 'money' },
			{ label: '开票金额', prop: 'invoicedAmount', type: 'money' },
			{ label: '合同收入', prop: 'contractIncome', type: 'money' },
			{ label: '其他收入', prop: 'otherIncome', type: 'money' },
			{ label: '销项税额', prop: 'outputTaxAmount', type: 'money' }
		]
	}
]

export default {
	data() {
		return {
			code: '',
			currentNav: 0,
			navIntoView: '',
			sections: SECTIONS,
			detail: {},
			siteImageList: [],
			siteImageSubmitTime: ''
		}
	},
	computed: {
		currentSection() {
			return this.sections[this.currentNav]
		},
		progressValue() {
			const num = parseFloat(this.detail.progressRatio) * 100
			if (isNaN(num)) return 0
			return Math.min(100, Math.max(0, num))
		}
	},
	onLoad(options) {
		this.code = options.code || ''
		this.getDetail()
	},
	methods: {
		// 获取项目详情（接口未接入，暂时使用假数据）
		async getDetail() {
			let res = await fetchProjectDetail({type: this.currentSection.key, code: this.code})
			if (!res) return
			this.detail = res.content
		},
		// 获取最新现场图片（单独接口）
		async getSiteImages() {
			this.siteImageList = []
			this.siteImageSubmitTime = ''
			let res = await fetchProjectDetail({type: 'latestProgressPicture', code: this.code})
			if (!res) return
			const content = res.content
			this.siteImageList = content.pictureList || []
			this.siteImageSubmitTime = content.submitTime || ''
		},
		// 切换nav
		switchNav(index) {
			this.currentNav = index
			this.getDetail()
			if (this.currentSection.key === 'latestProgress') this.getSiteImages()
			this.navIntoView = ''
			this.$nextTick(() => {
				this.navIntoView = 'nav-' + Math.max(0, index - 1)
			})
		},

		// 预览现场图片
		previewSiteImage(index) {
			uni.previewImage({
				urls: this.siteImageList,
				current: index
			})
		},

		// 值格式化：空值显示-，金额千分位
		formatValue(field) {
			const val = this.detail[field.prop]
			if (val === null || val === undefined || val === '') return '-'
			if (field.type === 'money') return this.formatMoney(val)
			if (field.type === 'boolean') return val ? '是' : '否'
			return val
		},
		formatMoney(val) {
			const num = Number(val)
			if (isNaN(num)) return val
			const parts = String(num).split('.')
			parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
			return `¥${parts.join('.')}`
		}
	}
}
</script>

<style scoped lang="scss">
.project-detail {
	min-height: 100vh;
	background-color: #F7F7F7;
	padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
}

/* 顶部 */
.header {
	position: relative;
	overflow: hidden;
	padding: 40rpx 30rpx 70rpx;
	background: linear-gradient(135deg, #3974F6 0%, #6FA8FF 100%);

	.circle {
		position: absolute;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
	}
	.circle-1 {
		width: 240rpx;
		height: 240rpx;
		top: -100rpx;
		right: -60rpx;
	}
	.circle-2 {
		width: 140rpx;
		height: 140rpx;
		bottom: -40rpx;
		right: 120rpx;
	}

	.name {
		position: relative;
		z-index: 1;
		font-size: 36rpx;
		font-weight: 600;
		color: #ffffff;
		line-height: 1.5;
	}

	.code {
		position: relative;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		margin-top: 24rpx;
		padding: 10rpx 26rpx;
		border-radius: 32rpx;
		background: rgba(255, 255, 255, 0.18);

		.code-label {
			font-size: 22rpx;
			color: rgba(255, 255, 255, 0.85);
			margin-right: 14rpx;
		}
		.code-value {
			font-size: 24rpx;
			font-weight: 500;
			color: #ffffff;
			letter-spacing: 1rpx;
		}
	}
}

/* nav模块 */
.nav {
	position: sticky;
	top: 0;
	z-index: 10;
	box-sizing: border-box;
	width: calc(100% - 48rpx);
	margin: -34rpx 24rpx 0;
	white-space: nowrap;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 8rpx 24rpx rgba(57, 116, 246, 0.08);
	padding: 0 20rpx;

	.nav-item {
		position: relative;
		display: inline-block;
		padding: 28rpx 32rpx;
		font-size: 26rpx;
		color: #666666;

		&.nav-hover {
			opacity: 0.7;
		}

		&.active {
			font-size: 28rpx;
			font-weight: 600;
			color: #3974F6;
		}

		.underline {
			position: absolute;
			left: 50%;
			bottom: 12rpx;
			transform: translateX(-50%);
			width: 40rpx;
			height: 6rpx;
			border-radius: 3rpx;
			background: linear-gradient(to right, #3974F6, #6FA8FF);
		}
	}
}

/* 信息模块 */
.content {
	padding: 24rpx;

	.card {
		background-color: #ffffff;
		border-radius: 24rpx;
		padding: 30rpx 24rpx 10rpx;
		box-shadow: 0 8rpx 24rpx rgba(57, 116, 246, 0.08);
	}

	.card-title {
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

	.kv-item {
		display: flex;
		align-items: flex-start;
		padding: 24rpx 0;
		border-bottom: 2rpx solid #F5F5F5;

		&:last-child {
			border-bottom: none;
		}

		.label {
			width: 196rpx;
			flex-shrink: 0;
			font-size: 26rpx;
			color: #999999;
			line-height: 1.5;
		}

		.value {
			flex: 1;
			min-width: 0;
			font-size: 26rpx;
			color: #333333;
			line-height: 1.5;
			text-align: right;
			word-break: break-all;

			&.money {
				font-weight: 500;
			}
		}

		/* 长文本独占一行 */
		&.full {
			flex-direction: column;

			.label {
				width: auto;
				margin-bottom: 12rpx;
			}
			.value {
				text-align: left;
			}
		}
	}

	/* 进度条 */
	.progress-box {
		display: flex;
		align-items: center;

		.progress-track {
			flex: 1;
			height: 16rpx;
			border-radius: 8rpx;
			background-color: #EEF2FB;
			overflow: hidden;

			.progress-inner {
				height: 100%;
				border-radius: 8rpx;
				background: linear-gradient(to right, #3974F6, #6FA8FF);
				transition: width 0.4s ease;
			}
		}

		.progress-num {
			flex-shrink: 0;
			margin-left: 18rpx;
			font-size: 26rpx;
			font-weight: 600;
			color: #3974F6;
		}
	}

	/* 最新现场图片 */
	.site-image-card {
		margin-top: 24rpx;

		.image-list {
			padding: 24rpx 0 20rpx;

			.site-image {
				display: block;
				width: 100%;
				border-radius: 16rpx;
				background-color: #F5F5F5;
				margin-bottom: 20rpx;

				&:last-child {
					margin-bottom: 0;
				}
			}
		}

		.empty {
			margin: 24rpx 0 20rpx;
			padding: 60rpx 0;
			display: flex;
			flex-direction: column;
			align-items: center;
			background-color: #F7F9FE;
			border-radius: 16rpx;

			.empty-text {
				margin-top: 16rpx;
				font-size: 24rpx;
				color: #A0A8B8;
			}
		}
	}
}
</style>
