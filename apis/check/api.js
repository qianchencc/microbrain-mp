import createRequest from '../request.js'
import globalConfig from '@/config'
export default createRequest({
	baseUrl: globalConfig.baseUrl
})