// 消息卡片/深链启动参数：冷启动未登录时先暂存，登录成功后回到原目标页。
// 只认公司 Agent 的上下文键，避免把 scene 等启动参数带进业务页。
const STORAGE_KEY = 'agent.pending-launch'
const TTL_MS = 10 * 60 * 1000
const LAUNCH_KEYS = ['source', 'alertPrompt', 'prompt', 'taskReference', 'safetyReference', 'environmentWindow', 'energyWindow', 'alertLedger', 'alertEventId', 'alertDeviceId', 'alertLabel']

export const AGENT_LAUNCH_PAGE = 'pages/agent/dashboard'

// 卡片点击的 App 层决策：忽略 / 登录后恢复 / 重开仪表盘 / 交给当前页消费。
// currentPath 取 getCurrentPages() 最后一页的 route，可能带前导斜杠。
export function resolveLaunchAction({ hasToken, currentPath, launch }) {
	if (!launch) return 'ignore'
	if (!hasToken) return 'login-restore'
	const target = typeof currentPath === 'string' ? currentPath.replace(/^\/+/, '') : ''
	return target === AGENT_LAUNCH_PAGE ? 'deliver' : 'reopen'
}

// 微信在每次回到前台时都会把当前进入参数交给 onShow，同一个卡片会被重复上报。
// 用内容键 + 时间窗挡住这类重放，避免已消费的卡片把用户从别的页面拽回仪表盘。
const REPLAY_WINDOW_MS = 30 * 1000
let lastLaunch = { key: '', at: 0 }

export function launchKey(entry) {
	const query = entry && entry.query ? entry.query : {}
	return LAUNCH_KEYS.filter(key => query[key] !== undefined).map(key => `${key}=${query[key]}`).join('&')
}

export function shouldHandleLaunch(entry, now = Date.now()) {
	const key = launchKey(entry)
	if (!key) return false
	if (key === lastLaunch.key && now - lastLaunch.at < REPLAY_WINDOW_MS) return false
	lastLaunch = { key, at: now }
	return true
}

export function pickAgentLaunch(path, query) {
	const target = typeof path === 'string' ? path.replace(/^\/+/, '') : ''
	const raw = query && typeof query === 'object' ? query : {}
	const context = {}
	for (const key of LAUNCH_KEYS) {
		if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') context[key] = raw[key]
	}
	if (!Object.keys(context).length) return null
	if (target && target !== AGENT_LAUNCH_PAGE) return null
	return { path: AGENT_LAUNCH_PAGE, query: context }
}

// 启动参数交给页面时仍是原文；与 pages/agent/index.vue 的重定向一致，统一再 encode 一次。
export function agentLaunchUrl(entry) {
	const query = entry && entry.query ? entry.query : {}
	const pairs = Object.keys(query).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(query[key]))}`)
	return AGENT_LAUNCH_PAGE + (pairs.length ? `?${pairs.join('&')}` : '')
}

export function savePendingAgentLaunch(entry, now = Date.now()) {
	if (!entry) return false
	try {
		uni.setStorageSync(STORAGE_KEY, { path: AGENT_LAUNCH_PAGE, query: entry.query || {}, savedAt: now })
		return true
	} catch { return false }
}

export function takePendingAgentLaunch(now = Date.now()) {
	try {
		const value = uni.getStorageSync(STORAGE_KEY)
		if (!value || typeof value !== 'object') return null
		uni.removeStorageSync(STORAGE_KEY)
		if (!Number.isFinite(value.savedAt) || now - value.savedAt > TTL_MS || now < value.savedAt) return null
		return { path: AGENT_LAUNCH_PAGE, query: value.query && typeof value.query === 'object' ? value.query : {} }
	} catch { return null }
}

export function clearPendingAgentLaunch() {
	try { uni.removeStorageSync(STORAGE_KEY) } catch { /* 存储不可用时无需清理 */ }
}
