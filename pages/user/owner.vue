<template>
	<view class="container">
		<uni-section title="基本信息" type="line">
			<view class="example">
				<uni-forms ref="valiForm" :modelValue="formDate" :rules="rules" label-position="top" label-width="90">
					<uni-forms-item label="所属单位" required name="branchId">
						<uni-data-select :clear="false" v-model="formDate.branchId" :localdata="branchList" @change="branchChange"></uni-data-select>
					</uni-forms-item>
					<uni-forms-item label="姓名" required name="personalName">
						<uni-easyinput :clearable="false" v-model="formDate.personalName" placeholder="请输入姓名" />
					</uni-forms-item>
					<uni-forms-item label="联系方式" required name="mobileNumber">
						<uni-easyinput :clearable="false" v-model="formDate.mobileNumber" placeholder="请输入联系方式" />
					</uni-forms-item>
					<uni-forms-item label="备注" name="remarks">
						<uni-easyinput :clearable="false" type="textarea" v-model="formDate.remarks" placeholder="请输入备注" />
					</uni-forms-item>
					<uni-forms-item v-if="formDate.checkRemarks" label="审核建议" name="checkRemarks">
						<uni-easyinput :clearable="false" type="textarea" v-model="formDate.checkRemarks" />
					</uni-forms-item>
				</uni-forms>
				<button v-if="formDate.status!=='ACCEPT'" type="primary" @click="submit">提交</button>
			</view>
		</uni-section>
	</view>
</template>

<script setup>
	import { ref, computed, onMounted } from 'vue'
	import globalConfig from '@/config'
	import { fecthAllBranch } from '@/apis/user/org'
	import { createConfirmation, fecthMyConfirmation } from '@/apis/user/confirmation'
	const valiForm = ref(null)
	const formDate = ref({
		"personalName": "",
		"branchId": "",
		"branchName": "",
		"mobileNumber": "",
		"remarks": "",
		"validateCode": "",
		"status": 'TO_BE',
		"socialsService": ""
	})

	// 校验规则
	const rules = {
		branchId: {
			rules: [{
				required: true,
				errorMessage: '姓名不能为空'
			}]
		},
		personalName: {
			rules: [{
				required: true,
				errorMessage: '姓名不能为空'
			}]
		},
		mobileNumber: {
			rules: [{
				required: true,
				errorMessage: '联系方式不能为空'
			}, {
				pattern: '^[1][23456789][0-9]{9}$',
				errorMessage: '请输入正确的电话号码'
			}]
		}
	}
	const status = {
		TO_BE: {
			text: '待审核',
			type: 'primary'
		},
		ACCEPT: {
			text: '已接受',
			type: 'primary'
		},
		REJECT: {
			text: '已拒绝',
			type: 'warn'
		}
	}
	const getConfirmation = async () => {
		const res = await fecthMyConfirmation()
		if (res.content) {
			formDate.value = res.content
		}
	}

	const branchList = ref([])

	const getBranchList = async () => {
		const res = await fecthAllBranch()
		const option = []
		res.content.forEach(element => {
			option.push({
				text: element.orgName,
				value: element.id
			})
		})
		branchList.value = option
	}

	const branchChange = (val) => {
		branchList.value.forEach(ele => {
			if (ele.value === val) {
				formDate.value.branchName = ele.text
			}
		})
	}

	const submit = async (ref) => {
		valiForm.value.validate().then(async data => {
			// #ifdef APP
			formDate.value.socialsService = ""
			// #endif
			// #ifdef MP-WEIXIN
			formDate.value.socialsService = "WECHATOPEN"
			// #endif
			const res = await createConfirmation(formDate.value)
			if (res.code !== 201) return
			uni.navigateBack()
		}).catch(err => {
			console.log('err', err)
		})
	}

	onMounted(() => {
		getConfirmation()
		getBranchList()
	})
</script>


<style lang="scss" scoped>
	.avatar {
		width: 120rpx;
		height: 120rpx;
		border: 1px solid lightgray;
		border-radius: 60rpx;
		margin: 10rpx;
		text-align: center;
		line-height: 120rpx;
	}

	.example {
		padding: 15px;
		background-color: #fff;
	}

	.segmented-control {
		margin-bottom: 15px;
	}

	.button-group {
		margin-top: 15px;
		display: flex;
		justify-content: space-around;
	}

	.form-item {
		display: flex;
		align-items: center;
	}

	.button {
		display: flex;
		align-items: center;
		height: 35px;
		margin-left: 10px;
	}
</style>