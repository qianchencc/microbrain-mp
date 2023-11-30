import globalConfig from '@/config'
import { HTTP_CODE, SERVER_CODE } from './codeMap'
import { storageGet } from '@/utils/storage.js'
import { getToken } from '@/utils/auth'
import { useUserStoreHook } from '@/store/modules/user'

const request = {}
const headers = {}

// 第三方请求成功code
const successCode = [0]

request.globalRequest = (url, method, data, isForm) => {
	const token = 'bearer 6504306b-46e1-4709-ad0e-1634743e1c5f' // getToken()
	const district = useUserStoreHook().getDistrict.id
	headers['Authorization'] = token
	headers['tenantCode'] = district
	delete headers['content-type']
	if (isForm) headers['content-type'] = 'application/x-www-form-urlencoded'
	return uni.request({
		url: url.startsWith('http') ? url : globalConfig.ssoUrl + url,
		method,
		data: data,
		dataType: 'json',
		header: headers
	}).then(res => {
		if (url.startsWith('http')) {
			// 这是第三方请求
			let { code, data, content } = res.data
			console.log(res.data, data, content)
			if (successCode.indexOf(code) > -1) {
				return Promise.resolve(data ? data : content)
			} else {
				uni.showToast({
					title: res.data.msg,
					icon: 'none'
				})
				return Promise.resolve(null)
			}
		} else {
			if (res.data.code) {
				const {
					code,
					content
				} = res.data
				return code && code >= 0 ? SERVER_CODE.get(code)(res.data, data) : Promise.resolve(null)
			} else if (res.statusCode === 401) {
				SERVER_CODE.get(res.statusCode)(res)
			} else {
				throw res.data
			}
		}
	}).catch(parmas => {
		try {
			HTTP_CODE.get(parmas.status)()
			return Promise.resolve(null)
		} catch (error) {

			return Promise.resolve(null)
		}
	})
}
export default request