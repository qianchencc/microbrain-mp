<template>
	<view>
		<view class="login-bg">
			<view class="login-card">
				<view class="login-head">{{pointName}}检查</view>
				<view v-for="(item, index) in checkItemList" :key="item.id">
					
					<view class="cu-form-group" v-if="item.displayType==='1'">
						<view>{{item.label}}检查:</view>
						<!-- <evan-radio-group @change="onGroupChange" v-model="paramList[index].status" class="radio-group">
							<view class="evan-radio-show__group-item" v-for="item in statusList" :key="item.value">
								<evan-radio class='blue margin-left-sm' :label="item.value">{{item.label}}</evan-radio>
							</view>
						</evan-radio-group> -->
						<view class="uni-list" @click="change(index)">
									<radio-group @change="radioChange">
										<label  v-for="(item, index) in statusList" :key="item.checked">
											<view>
												<radio :value="item.value" :checked="index === current" >{{item.label}}</radio>
												
											</view>
											
										</label>
									</radio-group>
								</view>
					</view>
					<view class="login-input" v-else>
						<view class="group-lable">{{item.label}}检查：</view>
						<textarea class="group-input" name="item.remarks" v-model="paramList[index].remarks" placeholder='请输入检查说明'></textarea>
					</view>
				</view>
				<view  class="form">
				<uni-forms ref="valiForm" :modelValue="formDate" validateTrigger="blur" label-position="top" label-width="90">
					<uni-forms-item label="上报事件"  name="eventEnable">
						<switch style="transform:scale(0.7)" @change="switchOn"/>
					</uni-forms-item>
					<uni-forms-item v-if="reportEvent" label="事件类型"  name="eventTypeId">
						<uni-data-select  :clear="false" v-model="eventTypeId" :localdata="eventTypeList" @change="typeChange"></uni-data-select>
					</uni-forms-item>
					<uni-forms-item v-if="eventTypeId&&reportEvent" label="事件级别"  name="eventTypeLevel">
						<uni-data-select  :clear="false" v-model="eventTypeLevel" :localdata="levelList" ></uni-data-select>
					</uni-forms-item>
					<uni-forms-item v-if="reportEvent" label="描述" name="remark">
						<uni-easyinput :clearable="false" type="textarea" v-model="remark" />
					</uni-forms-item>
				</uni-forms>
				</view>
				<view class="cu-bar bg-white" v-if="photoable">
					<view class="action" style="margin-left: 20rpx;">
						图片上传
					</view>
					<view class="action">
						{{imgList.length}}/9
					</view>
				</view>
				<view class="cu-form-group" v-if="photoable">
					<view class="grid col-4 grid-square flex-sub">
						<view class="bg-img" v-for="(item,index) in imgList" :key="index" @tap="ViewImage" :data-url="imgList[index]">
						 <image :src="item" mode="aspectFill"></image>
							<view class="cu-tag bg-red" @tap.stop="DelImg" :data-index="index">
								<text class='cuIcon-close'></text>
							</view>
						</view>
						<view class="solids" v-if="imgList.length<9">
							<!-- <text class='cuIcon-cameraadd'></text> -->
							<image class="cuIcon-img" :src="avatar ? avatar : '../../../static/upimg.png'" @tap="ChooseImage"/>
						</view>
					</view>
				</view>
			</view>
		<view class="login-btn">
			<button class="landing" form-type="submit" :loading="loading" type="primary" @click="submit">{{ loading ? "提交中...":"提 交"}}</button>
			<!-- <button class="cancel" type="default" form-type="reset" @click="reset">{{ "重 置"}}</button> -->
		</view>
		</view>
	</view>
</template>
<script>
// var api = require('@/common/api.js')
import Vue from 'vue'
import globalConfig from '@/config'
import evanRadio from '@/components/evan-radio/evan-radio.vue'
import evanRadioGroup from '@/components/evan-radio-group/evan-radio-group.vue'
// import uniIcons from "@/components/uni-icons/uni-icons.vue"
import { uploadFile, postCheckResult, fatchPointCheckItem, fatchPointInfo ,fetchEventTypeList} from '@/apis/check/index.js'
export default {
    components: {
        evanRadio,
        evanRadioGroup
        // uniIcons
    },
    filters: {
		formatDate(val) {
		if(val){return new Date(val.replace(/-/g, '/')).format('yyyy-MM-dd hh:mm')}
		
		},
        statusFilter(status) {
            const statusList = {
                '1': '单选',
                '2': '文本输入'
            }
            return statusList[status]
        }
    },
    data() {
        return {
			eventTypeList:[],
			current: 0,
			currentStatus:'',
			currentIndex:0,
			reportEvent:false,
			levelList:[],
			eventTypeId:'',
			eventTypeLevel:'',
			remark:'',
            photoable: '', // 是否拍照
            pointName: '', // 巡更点名称
            patrolPointId: '',
            patrolPointRecordId: '',
            checkItemId: '',
            checkItemList: [],
            imgList: [],
            status: '1',
            radio: 'A',
            title: 'scanCode',
            result: '',
            loading: false,
            dessid: '',
            deshow: '',
            user: '',
            avatar: '',
            paramList: [],
            statusList: [
                {
                    value: '1',
                    label: '正常',
                    checked: 'true'
                },
                {
                    value: '2',
                    label: '异常'
                }
            ]
        }
    },
    onLoad(option) {
        console.log('跳转记录patrolPointId', option.patrolPointId)
        console.log('跳转记录patrolPointRecordId', option.patrolPointRecordId)
        this.patrolPointId = option.patrolPointId
        this.patrolPointRecordId = option.patrolPointRecordId
        uni.getStorageSync('user')
        this.getPointCheckItem()
        this.getPointInfo()
		this.getTypeList()
        // this.getPointName()
    },
    methods: {
        // 根据巡更点id获取巡更检查项
        async getPointCheckItem() {
            const res = await fatchPointCheckItem(this.patrolPointId)
            const options = []
            res.content.checkItems.forEach(element => {
                const item = {
                    label: element.name,
                    value: element.id,
                    displayType: element.displayType
                }
                const param = {
                    // remarks: '',
					type:element.displayType,
                    checkItemId: element.id
                    // status: element.displayType
                }
                this.paramList.push(param)
                options.push(item)
            })
            this.checkItemList = options
            console.log('巡更点中的checkItem', this.checkItemList)
        },
		radioChange: function(evt) {
			console.log('evt',evt)
				for (let i = 0; i < this.statusList.length; i++) {
					console.log(this.statusList[i].value,evt.detail.value)
					if (this.statusList[i].value === evt.detail.value) {
						console.log('this.currentIndex',this.currentIndex)
						this.currentStatus=evt.detail.value
						this.current = i;
						break;
					}
				}
				
			
		},
		change(index){
			console.log('index',index)
			this.paramList[index].status=this.currentStatus
		},
		async getTypeList (){
			const res = await fetchEventTypeList()
			const option = []
			res.content.forEach(element => {
				option.push({
					text: element.name,
					value: element.id,
					level:	element.level
				})
			})
			this.eventTypeList = option
			console.log(111,this.eventTypeList)
		},
		typeChange (id){
			this.eventTypeList.forEach(item=>{
				if(item.value===id){
					let temp=[]
					item.level.forEach(_=>{
						temp.push({text:_,value:_})
					})
					this.levelList=temp
				}
			})
			console.log(222,id)
		},
        // 根据巡更点id查询巡更点详细信息=获取是否拍照photoable和巡更点名字
        async getPointInfo() {
            const res = await fatchPointInfo(this.patrolPointId)
            this.photoable = res.content.photoable
            this.pointName = res.content.name
        },
		switchOn(val){
			console.log('val',val)
			this.reportEvent=val.target.value
		},
        // 检查状态选择
        onGroupChange(e) {
            console.log('状态值', e)
        },
        // 提交
        async submit() {
            this.loading = true
			this.paramList.forEach(element=>{
				if(element.type==='1'&&!element.status){
					element.status='1'
				}
			})
            const data = {
                checkItemRecordAddList: this.paramList,
                patrolPointRecordId: this.patrolPointRecordId,
                picUrlList: this.imgList,
				reportEvent:this.reportEvent===true?1:0,
				eventTypeId:this.eventTypeId,
				eventTypeLevel:this.eventTypeLevel,
				remark:this.remark
            }
			console.log('data',data)
            const res = await postCheckResult(data)
			console.log('log',res,data)
            this.loading = false
            if(!res) return
            uni.navigateBack({
                delta: 1
            })
        },
        // 重置
        reset() {
            this.paramList = []
            this.imgList = []
        },
        // 检查项状态
        statusChange(val) {
            this.statusIndex = val.detail.value
            this.status = this.statusList[this.statusIndex].key
            this.getStatusList()
        },
        // 获取数据字典
        getStatusList() {
            const dict = uni.getStorageSync('dict')
            console.log('数据字典', dict)
            this.statusList = JSON.parse(uni.getStorageSync('dict'))['PatrolRecordStatus']
            console.log('数据字典', this.statusList)
        },
        // 预览图片
        ViewImage(e) {
            uni.previewImage({
                urls: this.imgList,
                current: e.currentTarget.dataset.url
            })
        },
        // 选择照片
        ChooseImage() {
            uni.chooseImage({
                count: 9, // 默认9
                sizeType: ['original', 'compressed'], // 可以指定是原图还是压缩图，默认二者都有
                sourceType: ['album', 'camera'], // 从相册和摄像头选择
                success: (res) => {
                    console.log(res)
                    const token = uni.getStorageSync('token')
                    const tempFilePaths = res.tempFilePaths
                    // this.imgList = this.imgList.concat(tempFilePaths)
                    // this.imgList = this.imgList.concat(tempFilePaths)
                    console.log('上传图片', this.imgList)
                    this.changeImg = true
                    tempFilePaths.forEach(element => {
                        uni.uploadFile({
                            url: `${globalConfig.baseUrl}api/common/file/upload`,
                            header: { authorization: token },
                            filePath: element,
                            name: 'file',
                            success: (uploadFileRes) => {
                                console.log(2222222, uploadFileRes)
                                if (uploadFileRes) {
                                    const res = JSON.parse(uploadFileRes.data)
                                    this.imgList.push(globalConfig.fileAddr + res.content)
                                    console.log('图片数组', res)
                                }
                            },
                            fail: (e) => {
                                uni.showToast({
                                    title: '文件上传失败'
                                })
                            }
                        })
                    })
                }
            })
        },
        // 删除照片
        DelImg(e) {
            uni.showModal({
                title: '删除照片',
                content: '确定要删除这张照片吗？',
                cancelText: '取消',
                confirmText: '确认',
                success: res => {
                    console.info(res)
                    if (res.confirm) {
                        this.imgList.splice(e.currentTarget.dataset.index, 1)
                    }
                }
            })
        }
    }
}
</script>

<style lang="scss" scoped>
	.login-input{
		.group-lable{}
		.group-input{
			width: 90%;
			background: #F2F5F6;
			font-size: 15px;
			padding: 5px 13px;
			border-radius: 4px;
		}
	}
	.cu-form-group{
		padding: 0 22rpx;
	}
	.form{
		width:95%;
		margin-left:15rpx;
	}
	.solids{
		border-radius: 20rpx;
		.cuIcon-img{
			padding-left: 10rpx;
			width: 130rpx;
			height: 150rpx;
		}
	}
	.radio-group{
		width: 65%;
		display: flex;
		justify-content: flex-start;
		.uni-radio{
			display: flex;
			justify-content: center;
			.radio{}
			.label{}
		}
	}
	uni-radio::before {
		right: 77rpx !important;
	}
	:deep(.uni-radio-input){
		margin-right: 20rpx;
		width: 18px !important;
		height: 18px !important;
	}
	.scan-result {
		min-height: 50upx;
		line-height: 50upx;
	}
	.logbt {
		background: none;
		border: none !important;
		position: fixed;
		display: inline;
		margin-left: -76upx
	}
	.logbt:after {
		border: none !important;
	}
	image {
		width: 100upx;
		height: 100upx;
	}
	.landing {
		height: 84upx;
		line-height: 84upx;
		border-radius: 44upx;
		font-size: 32upx;
		background: linear-gradient(to left, #86B5F4, #4790EF);
	}
	.cancel{
		margin-top: 20rpx;
		height: 84rpx;
		line-height: 84rpx;
		border-radius: 44rpx;
		font-size: 32rpx;
		background-color: #ffffff;
		/* background: linear-gradient(left, #86B5F4, #4790EF); */
	}
	.login-btn {
		padding: 10upx 20upx;
		margin-top: 10upx;
	}
	.login-function {
		overflow: auto;
		padding: 20upx 20upx 30upx 20upx;
	}
	.login-forget {
		float: left;
		font-size: 26upx;
		color: #999;
	}
	.login-register {
		color: #666;
		float: right;
		font-size: 26upx;

	}
	.login-input input {
		background: #F2F5F6;
		font-size: 28upx;
		padding: 10upx 25upx;
		height: 62upx;
		line-height: 62upx;
		border-radius: 8upx;
	}
	.login-margin-b {
		margin-bottom: 25upx;
	}
	.login-input {
		padding: 10upx 20upx;
	}
	.login-head {
		font-size: 34upx;
		text-align: center;
		padding: 10rpx 0 20rpx 0;
	}
	.login-card {
		background: #fff;
		border-radius: 12upx;
		padding: 10upx 25upx;
		box-shadow: 0 6upx 18upx rgba(0, 0, 0, 0.12);
		position: relative;
		margin-top: 120upx;
	}
	.login-bg {
		height: 260upx;
		padding: 25upx;
		background-color: #4364FE;
		/* background: linear-gradient(#86B5F4, #4790EF); */
	}
	.upload_img_item{
	position: relative;
}
.upload_img_close{
	position: absolute;
	z-index: 999;
	right: 0;
	color:#fff;
	background: #DD524D;
}
.upload_img{
	width: 90px;
	height: 90px;
	display: block;
}
</style>
