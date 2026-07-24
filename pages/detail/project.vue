<template>
	<view class="project-detail">
		<!-- 顶部：项目名称、项目编号 -->
		<view class="header">
			<view class="circle circle-1"></view>
			<view class="circle circle-2"></view>
			<view class="name">{{ detail.projectName || '-' }}</view>
			<view class="code">
				<text class="code-label">项目编号</text>
				<text class="code-value">{{ detail.projectCode || '-' }}</text>
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
		</view>
	</view>
</template>

<script>
// nav配置：key对应详情数据里的子对象
const SECTIONS = [
	{
		key: 'base',
		title: '项目基础信息',
		fields: [
			{ label: '业务员', prop: 'salesman' },
			{ label: '制单员', prop: 'preparedBy' },
			{ label: '项目类型', prop: 'projectType' },
			{ label: '所属机构', prop: 'belongOrg' },
			{ label: '承建机构', prop: 'buildOrg' },
			{ label: '是否公建', prop: 'publicBuild' },
			{ label: '质量标准', prop: 'qualityStandard' },
			{ label: '立项年份', prop: 'approvalYear' },
			{ label: '项目经理', prop: 'projectManager' },
			{ label: '项目地址', prop: 'address', full: true },
			{ label: '计划工期', prop: 'planDuration' },
			{ label: '实际工期', prop: 'actualDuration' },
			{ label: '建设单位', prop: 'buildUnit' },
			{ label: '项目所属', prop: 'projectBelong' },
			{ label: '承建分支机构', prop: 'buildBranch' },
			{ label: '项目是否分包', prop: 'subcontract' },
			{ label: '总包项目', prop: 'generalContractProject', full: true },
			{ label: '投标编号', prop: 'bidCode' },
			{ label: '投标项目名称', prop: 'bidProjectName', full: true },
			{ label: '投标项目经理', prop: 'bidManager' },
			{ label: '开标日期', prop: 'bidOpenDate' },
			{ label: '中标日期', prop: 'bidWinDate' }
		]
	},
	{
		key: 'progress',
		title: '最新进度',
		fields: [
			{ label: '所属阶段', prop: 'stage' },
			{ label: '项目进度', prop: 'progress', type: 'progress' },
			{ label: '进度详情', prop: 'detail', full: true },
			{ label: '提交人', prop: 'submitter' },
			{ label: '提交时间', prop: 'submitTime' }
		]
	},
	{
		key: 'income',
		title: '收入合同',
		fields: [
			{ label: '合同份数', prop: 'contractCount' },
			{ label: '合同变更数', prop: 'changeCount' },
			{ label: '初始化合同金额', prop: 'initAmount', type: 'money' },
			{ label: '变更后合同金额', prop: 'changedAmount', type: 'money' },
			{ label: '累计变更金额', prop: 'totalChangeAmount', type: 'money' },
			{ label: '累计收款金额', prop: 'totalReceivedAmount', type: 'money' },
			{ label: '更新日期', prop: 'updateDate' },
			{ label: '更新人', prop: 'updater' }
		]
	},
	{
		key: 'labor',
		title: '劳务分包合同',
		fields: [
			{ label: '合同份数', prop: 'contractCount' },
			{ label: '合同变更数', prop: 'changeCount' },
			{ label: '累计合同金额', prop: 'totalContractAmount', type: 'money' },
			{ label: '累计变更金额', prop: 'totalChangeAmount', type: 'money' },
			{ label: '累计支付金额', prop: 'totalPayAmount', type: 'money' }
		]
	},
	{
		key: 'purchase',
		title: '采购合同',
		fields: [
			{ label: '合同份数', prop: 'contractCount' },
			{ label: '合同变更数', prop: 'changeCount' },
			{ label: '累计合同金额', prop: 'totalContractAmount', type: 'money' },
			{ label: '累计变更金额', prop: 'totalChangeAmount', type: 'money' },
			{ label: '累计支付金额', prop: 'totalPayAmount', type: 'money' }
		]
	},
	{
		key: 'input',
		title: '进项汇总',
		fields: [
			{ label: '收票金额', prop: 'receiveAmount', type: 'money' },
			{ label: '合同支出', prop: 'contractExpense', type: 'money' },
			{ label: '其他支出', prop: 'otherExpense', type: 'money' },
			{ label: '进项税额', prop: 'inputTax', type: 'money' },
			{ label: '与销项差额度', prop: 'outputDiff', type: 'money' }
		]
	},
	{
		key: 'output',
		title: '销项汇总',
		fields: [
			{ label: '合同金额', prop: 'contractAmount', type: 'money' },
			{ label: '项目资金余额', prop: 'fundBalance', type: 'money' },
			{ label: '开票金额', prop: 'invoiceAmount', type: 'money' },
			{ label: '合同收入', prop: 'contractIncome', type: 'money' },
			{ label: '其他收入', prop: 'otherIncome', type: 'money' },
			{ label: '销项税额', prop: 'outputTax', type: 'money' }
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
			// 接口未接入前的假数据，接入后字段名按实际返回调整
			mockDetail: {
				projectName: '智慧园区综合管理平台建设项目',
				projectCode: 'XM-2026-0101',
				base: {
					salesman: '张三',
					preparedBy: '李四',
					projectType: '房屋建筑工程',
					belongOrg: '新世纪发展集团总部',
					buildOrg: '第一工程分公司',
					publicBuild: '是',
					qualityStandard: '合格（争创鲁班奖）',
					approvalYear: '2026年',
					projectManager: '王五',
					address: '浙江省杭州市滨江区智慧新天地园区',
					planDuration: '540天',
					actualDuration: '320天',
					buildUnit: '杭州智慧园区建设发展有限公司',
					projectBelong: '集团直营',
					buildBranch: '华东区域分公司',
					subcontract: '是',
					generalContractProject: '智慧园区综合管理平台总承包工程',
					bidCode: 'ZB-2025-1208',
					bidProjectName: '智慧园区综合管理平台建设项目施工总承包',
					bidManager: '赵六',
					bidOpenDate: '2025-12-18',
					bidWinDate: '2025-12-25'
				},
				progress: {
					stage: '主体施工',
					progress: 65,
					detail: '主体结构施工至18层，二次结构施工至12层，机电安装随主体结构同步预埋，整体进度符合计划要求。',
					submitter: '王五',
					submitTime: '2026-07-20 14:30'
				},
				income: {
					contractCount: 3,
					changeCount: 1,
					initAmount: 125000000,
					changedAmount: 128500000,
					totalChangeAmount: 3500000,
					totalReceivedAmount: 68500000,
					updateDate: '2026-07-15',
					updater: '陈七'
				},
				labor: {
					contractCount: 5,
					changeCount: 2,
					totalContractAmount: 18600000,
					totalChangeAmount: 850000,
					totalPayAmount: 12300000
				},
				purchase: {
					contractCount: 12,
					changeCount: 0,
					totalContractAmount: 32400000,
					totalChangeAmount: 0,
					totalPayAmount: 21800000
				},
				input: {
					receiveAmount: 28900000,
					contractExpense: 34100000,
					otherExpense: 1250000,
					inputTax: 3120000,
					outputDiff: 1980000
				},
				output: {
					contractAmount: 128500000,
					fundBalance: 15200000,
					invoiceAmount: 72300000,
					contractIncome: 68500000,
					otherIncome: 380000,
					outputTax: 5960000
				}
			}
		}
	},
	computed: {
		currentSection() {
			return this.sections[this.currentNav]
		},
		currentData() {
			return this.detail[this.currentSection.key] || {}
		},
		progressValue() {
			const num = parseFloat(this.currentData.progress)
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
		getDetail() {
			// TODO: 接入项目详情接口，如 getProjectDetail({ code: this.code }).then(res => this.detail = res.data)
			this.detail = this.mockDetail
		},

		// 切换nav
		switchNav(index) {
			this.currentNav = index
			// 让选中项滚动到可视区域（偏左一位，露出前一项）
			this.navIntoView = ''
			this.$nextTick(() => {
				this.navIntoView = 'nav-' + Math.max(0, index - 1)
			})
		},

		// 值格式化：空值显示-，金额千分位
		formatValue(field) {
			const val = this.currentData[field.prop]
			if (val === null || val === undefined || val === '') return '-'
			if (field.type === 'money') return this.formatMoney(val)
			return val
		},
		formatMoney(val) {
			const num = Number(val)
			if (isNaN(num)) return val
			const parts = String(num).split('.')
			parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
			return parts.join('.')
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
}
</style>
