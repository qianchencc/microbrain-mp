import { getToken, isTokenExpired } from '@/utils/auth'
import { useUserStoreHook } from '@/store/modules/user'

const POLL_MS = 50
const DEFAULT_TIMEOUT_MS = 15000

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function readSnapshot() {
	const token = getToken()
	const district = useUserStoreHook().getDistrict
	return { token, district }
}

export function getAgentSession() {
	const { token, district } = readSnapshot()
	if (!token || isTokenExpired()) {
		const error = new Error('客户登录已失效，请重新登录')
		error.code = 'AGENT_SESSION_EXPIRED'
		throw error
	}
	if (!district?.id) {
		const error = new Error('客户园区信息尚未准备完成')
		error.code = 'AGENT_SESSION_NOT_READY'
		throw error
	}
	return { authorization: token, tenantCode: district.id }
}

export function getAgentHeaders(includeJson = false) {
	const session = getAgentSession()
	const headers = {
		Authorization: session.authorization,
		Tenantcode: session.tenantCode
	}
	if (includeJson) headers['content-type'] = 'application/json'
	return headers
}

export async function waitForAgentSession(timeout = DEFAULT_TIMEOUT_MS) {
	const deadline = Date.now() + timeout
	let lastError
	while (Date.now() < deadline) {
		try {
			return getAgentSession()
		} catch (error) {
			lastError = error
			if (error.code === 'AGENT_SESSION_EXPIRED') throw error
			await sleep(POLL_MS)
		}
	}
	throw lastError || new Error('客户会话初始化超时')
}
