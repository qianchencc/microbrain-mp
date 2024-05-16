<template>
	<view class="container">
		<uni-section title="意见反馈" type="line">
			<view class="example">
				<uni-forms ref="valiForm" :modelValue="formDate" validateTrigger="blur" :rules="rules" label-position="top" label-width="90">
					
					<uni-forms-item  name="remarks">
						<view class="uni-flex uni-row " style="justify-content: space-around; text-align: center;line-height: 30px;margin-top: -30px;" >
									 <button  :class="active == '1' ? 'active':'inActive'"   type="default"  @click="method1()">产品建议</button>
									  <button  :class="active == '2' ? 'active':'inActive'"   type="default"  @click="method12()">功能故障</button>
									  <button  :class="active == '3' ? 'active':'inActive'"   type="default"  @click="method123()">其他问题</button>
								</view>
						<uni-easyinput  :clearable="false" type="textarea" v-model="describe" placeholder="请输入6个字以上的问题描述" />
					</uni-forms-item>
					<uni-forms-item label="联系方式" required name="mobileNumber">
						<template >
							<uni-easyinput :clearable="false" v-model="mobileNumber" placeholder="请输入手机号便于联系(非必填)" />
						</template>
					</uni-forms-item>

				</uni-forms>
				<button  :loading="loading" type="primary" @click="submit">提交</button>
			</view>
		</uni-section>
	</view>
</template>

<script setup>
	import { ref, computed, onMounted } from 'vue'
	import globalConfig from '@/config'
	import { chooseImg2 } from '@/utils/tools.js'
	import { fecthAllBranch } from '@/apis/user/org'
	import { fetchEventTypeList,eventReport } from '@/apis/event/index'
	import { useVerifyCode } from '@/utils/verifyCode.js'
	import { useUserStoreHook } from '@/store/modules/user'
	const userInfo = computed(() => useUserStoreHook().getUserInfo)
	const valiForm = ref(null)
	const loading = ref(false)
	const active=ref('1')
	const describe=ref('')
	const mobileNumber=ref(null)
	const currentFieldList=ref([])
	const formDate = ref({
		"eventTypeId": "",
		"eventTypeName": "",
		"eventTypeLevel": "低",
		"reportName": "",
		"reportPhone": "",
		"id": "",
		"customFieldValueList": []
	})
	const currentField=ref(null)
	const method1=()=>{
		formDate.value.customFieldValueList=[]
		 
		active.value='1'
		let customFieldId=''
		currentFieldList.value.forEach(_=>{
			if(_.name==='产品建议'){
				customFieldId=_.id
			}
		})
		currentField.value={customFieldId:customFieldId,name:'产品建议',value:''}
		}
		
	const method12=()=>{
		formDate.value.customFieldValueList=[]
		 
		let customFieldId=''
		active.value='2'
		currentFieldList.value.forEach(_=>{
			if(_.name==='功能故障'){
				customFieldId=_.id
			}
		})
		currentField.value={customFieldId:customFieldId,name:'功能故障',value:''}
	}
	const method123=()=>{
		formDate.value.customFieldValueList=[]
		 
		let customFieldId=''
		active.value='3'
		currentFieldList.value.forEach(_=>{
			if(_.name==='其他问题'){
				customFieldId=_.id
			}
		})
		currentField.value={customFieldId:customFieldId,name:'其他问题',value:''}
	}
	const getEventType=async()=>{
		const res=await fetchEventTypeList({name:'意见反馈'})
		if(!res.content)return
		let list=res.content[0].customFieldList.map(_=>{
			return{name:_.name,id:_.id}
		})
		formDate.value.eventTypeId=res.content[0].id
		formDate.value.eventTypeName='意见反馈'
		formDate.value.eventTypeLevel='低'
		formDate.value.reportName=userInfo.value.name
		formDate.value.reportPhone=userInfo.value.mobileNumber
		currentFieldList.value=list
		method1()
	}
	const submit = async (ref) => {
			loading.value = true
			currentField.value.value=describe.value
			let customFieldId=''
			currentFieldList.value.forEach(_=>{
				if(_.name==='联系方式'){
					customFieldId=_.id
				}
			})
			formDate.value.customFieldValueList.push(currentField.value)
			formDate.value.customFieldValueList.push({customFieldId:customFieldId,name:'联系方式',value:mobileNumber.value})
			loading.value = false
			console.log('formDate',formDate.value)
			const res = await eventReport(formDate.value)
			loading.value = false
			if (!res.content) return
			uni.navigateBack()

	}

	onMounted(() => {
		getEventType()
	})
</script>


<style lang="scss" scoped>
	.example {
		padding:0  15px ;
		background-color: #fff;
	}

	.suffix {
		position: absolute;
		z-index: 9999;
		top: 20%;
		right: 10px;
		color: #2979ff;
	}

	.icon-con {
		background-color: #e9e9eb;
		width: 150rpx;
		height: 150rpx;
		line-height: 150rpx;
		border-radius: 15rpx;
		text-align: center;
	}
	.inActive{
	         background-color: #f8f8f8;
	             border-radius: 5px;
	             box-sizing: border-box;
	             color: #000;
	             cursor: pointer;
	             display: block;
				 line-height: 70upx;
	             font-size: 38upx;
	             margin-left: auto;
	             margin-right: auto;
	             overflow: hidden;
				 margin-bottom: 10px;
	             padding-left: 14px;
	             padding-right: 14px;
	             position: relative;
	             text-align: center;
	             text-decoration: none;
	         
	     }
	 .active {
	      
	     background-color: #1286ff;
	         border-radius: 5px;
			 line-height: 70upx;
	         box-sizing: border-box;
	         color: #fff;
	         cursor: pointer;
	         display: block;
	         font-size: 38upx;
	         margin-left: auto;
	         margin-right: auto;
			  margin-bottom: 10px;
	         overflow: hidden;
	         padding-left: 14px;
	         padding-right: 14px;
	         position: relative;
	         text-align: center;
	         text-decoration: none;
	}
</style>
