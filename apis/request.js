import globalConfig from '@/config'
import { HTTP_CODE, SERVER_CODE } from './codeMap'
import { getToken } from '@/utils/auth'
import { useUserStoreHook } from '@/store/modules/user'

const createRequest = (options = {}) => {
  const request = {}
  request.globalRequest = (url, method, data) => {
    const token = getToken()
    const district = useUserStoreHook().getDistrict?.id
    const headers = {}
    if (token) headers.Authorization = token
    if (district) headers.tenantCode = district
    return uni.request({
			url: options.baseUrl ? options.baseUrl + url : globalConfig.baseUrl + url,
			method,
			data: data,
			dataType: 'json',
			header: headers
		}).then(res => {
			if (res.data.code) {
				const {
					code,
					content
				} = res.data
				return code && code >= 0 ? SERVER_CODE.get(code)(res.data, data) : Promise.resolve(null)
			} else if (res.statusCode === 401) {
				SERVER_CODE.get(res.statusCode)(res)
			} else {
				return res.data
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
	return request
}

export default createRequest
