<template>
	<view class="login-box">
		<uni-forms ref="formRef" :modelValue="formData" :rules="rules">
			<uni-forms-item label="姓名" name="username">
				<uni-easyinput type="text" v-model="formData.username" :clearable="false" placeholder="请输入姓名" />
			</uni-forms-item>
			<uni-forms-item label="密码" name="password">
				<uni-easyinput type="password" v-model="formData.password" :clearable="false" placeholder="请输入密码" />
			</uni-forms-item>
		</uni-forms>
		<button type="primary" :loading="loading" @click="submit">登录</button>
	</view>
</template>

<script setup>
	import { ref } from 'vue';
	import { useUserStoreHook } from '@/store/modules/user'
	const formRef = ref(null)
	const loading = ref(false)
	const formData = ref({
		username: '',
		password: ''
	})
	const rules = {
		username: {
			rules: [{
				required: true,
				errorMessage: '请输入姓名',
			}, ]
		},
		password: {
			rules: [{
				required: true,
				errorMessage: '请输入密码',
			}]
		}
	}

	function submit() {
		formRef.value.validate().then(res => {
			console.log('表单数据信息：', res);
			useUserStoreHook().loginByUsername(res)
		}).catch(err => {
			console.log('表单错误信息：', err);
		})
	}
</script>
<style lang="scss" scoped>
	.login-box {
		height: 450rpx;
		padding: 60rpx;
		background-color: $uni-bg-color;
		// padding-top: 400rpx;
	}
</style>