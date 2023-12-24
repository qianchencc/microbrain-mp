<template>
	<view class="container">
		<uni-section title="基本信息" type="line">
			<view class="example">
				<uni-forms ref="valiForm" :modelValue="formDate" validateTrigger="blur" :rules="rules" label-position="top" label-width="90">
					<uni-forms-item label="所属单位" required name="branchId">
						<uni-data-select :clear="false" v-model="formDate.branchId" :localdata="branchList" @change="branchChange"></uni-data-select>
					</uni-forms-item>
					<uni-forms-item label="姓名" required name="personalName">
						<uni-easyinput :clearable="false" v-model="formDate.personalName" placeholder="请输入姓名" />
					</uni-forms-item>
					<uni-forms-item label="联系方式" required name="mobileNumber">
						<uni-easyinput :clearable="false" v-model="formDate.mobileNumber" placeholder="请输入联系方式" />
						<view class="suffix" @click="suffixClicked(formDate.mobileNumber,fetchValidateCode)">
							{{text}}
						</view>
					</uni-forms-item>
					<uni-forms-item label="验证码" required name="validateCode">
						<uni-easyinput :clearable="false" type="number" v-model="formDate.validateCode" maxlength="6" placeholder="请输入验证码" />
					</uni-forms-item>
					<uni-forms-item label="备注" name="remarks">
						<uni-easyinput :clearable="false" type="textarea" v-model="formDate.remarks" placeholder="请输入备注" />
					</uni-forms-item>
					<uni-forms-item v-if="formDate.checkRemarks" label="审核建议" name="checkRemarks">
						<uni-easyinput :clearable="false" type="textarea" v-model="formDate.checkRemarks" />
					</uni-forms-item>
				</uni-forms>
				<button v-if="formDate.status!=='ACCEPT'" :loading="loading" type="primary" @click="submit">提交</button>
			</view>
		</uni-section>
	</view>
</template>

<script setup>
	import { ref, computed, onMounted } from 'vue'
	import globalConfig from '@/config'
	import { fecthAllBranch } from '@/apis/user/org'
	import { createConfirmation, fecthMyConfirmation, fetchValidateCode } from '@/apis/user/confirmation'
	import { useVerifyCode } from '@/utils/verifyCode.js'
	const valiForm = ref(null)
	const loading = ref(false)
	const suffixText = ref('验证码')
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
	const { text, isDisabled } = useVerifyCode()
	async function suffixClicked(phone, fetchCode) {
		const isPhone = /^[1][23456789][0-9]{9}$/.test(phone)
		console.log(/^[1][23456789][0-9]{9}$/.test(phone));
		if (!isPhone) return
		useVerifyCode().start(phone, fetchCode)
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
			loading.value = true
			// #ifdef MP-WEIXIN
			formDate.value.socialsService = "WX_MP"
			// #endif
			const res = await createConfirmation(formDate.value)
			loading.value = false
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
	.example {
		padding: 15px;
		background-color: #fff;
	}

	.suffix {
		position: absolute;
		top: 20%;
		right: 10px;
		color: #2979ff;
	}
</style>