import test from 'node:test'
import assert from 'node:assert/strict'
import { pickAgentLaunch, agentLaunchUrl, savePendingAgentLaunch, takePendingAgentLaunch, clearPendingAgentLaunch, resolveLaunchAction, shouldHandleLaunch } from '../utils/agent-launch-link.mjs'

const store = new Map()
globalThis.uni = {
	getStorageSync: key => (store.has(key) ? store.get(key) : ''),
	setStorageSync: (key, value) => store.set(key, value),
	removeStorageSync: key => store.delete(key),
}

const alert = '烟感 · 3 楼东侧机房 · 2026-10-28 09:41'
const question = '请帮我核实这条告警并给出处置建议'

test('消息卡片启动参数只保留公司 Agent 上下文键', () => {
	const launch = pickAgentLaunch('pages/agent/dashboard', {
		source: 'company', alertPrompt: alert, prompt: question, scene: '1011', referrerInfo: '{}',
	})
	assert.deepEqual(launch, { path: 'pages/agent/dashboard', query: { source: 'company', alertPrompt: alert, prompt: question } })
	assert.equal(launch.query.scene, undefined)
})

test('消息卡片启动参数忽略无关页面与空参数', () => {
	assert.equal(pickAgentLaunch('pages/index/index', { alertPrompt: alert }), null)
	assert.equal(pickAgentLaunch('pages/agent/dashboard', {}), null)
	assert.equal(pickAgentLaunch(undefined, undefined), null)
	assert.deepEqual(pickAgentLaunch(undefined, { prompt: question }), { path: 'pages/agent/dashboard', query: { prompt: question } })
})

test('启动 URL 只编码一次，解码后回到原文', () => {
	const launch = pickAgentLaunch('pages/agent/dashboard', { alertPrompt: alert, prompt: question })
	const url = agentLaunchUrl(launch)
	assert.match(url, /^pages\/agent\/dashboard\?/)
	const query = new URLSearchParams(url.slice('pages/agent/dashboard?'.length))
	assert.equal(query.get('alertPrompt'), alert)
	assert.equal(query.get('prompt'), question)
	assert.equal(decodeURIComponent(query.get('alertPrompt')), alert)
})

test('未登录时暂存的启动参数登录后取回并清除', () => {
	clearPendingAgentLaunch()
	const launch = pickAgentLaunch('pages/agent/dashboard', { alertPrompt: alert, prompt: question })
	assert.equal(savePendingAgentLaunch(launch, 1_000), true)
	assert.deepEqual(takePendingAgentLaunch(1_000 + 59_000), launch)
	assert.equal(takePendingAgentLaunch(1_001), null)
})

test('过期的启动参数不再恢复', () => {
	const launch = pickAgentLaunch('pages/agent/dashboard', { prompt: question })
	savePendingAgentLaunch(launch, 1_000)
	assert.equal(takePendingAgentLaunch(1_000 + 10 * 60 * 1000 + 1), null)
})

test('未保存或时钟倒退时返回空', () => {
	clearPendingAgentLaunch()
	assert.equal(takePendingAgentLaunch(5_000), null)
	savePendingAgentLaunch(pickAgentLaunch('pages/agent/dashboard', { prompt: question }), 10_000)
	assert.equal(takePendingAgentLaunch(9_000), null)
})

test('卡片启动参数按登录态与当前页决定消费分支', () => {
	const launch = pickAgentLaunch('pages/agent/dashboard', { alertPrompt: alert })
	assert.equal(resolveLaunchAction({ hasToken: true, currentPath: 'pages/agent/dashboard', launch: null }), 'ignore')
	assert.equal(resolveLaunchAction({ hasToken: false, currentPath: 'pages/index/index', launch }), 'login-restore')
	assert.equal(resolveLaunchAction({ hasToken: true, currentPath: 'pages/agent/dashboard', launch }), 'deliver')
	assert.equal(resolveLaunchAction({ hasToken: true, currentPath: '/pages/agent/dashboard', launch }), 'deliver')
	assert.equal(resolveLaunchAction({ hasToken: true, currentPath: 'pages/index/index', launch }), 'reopen')
	assert.equal(resolveLaunchAction({ hasToken: true, launch }), 'reopen')
})

test('同一张卡片在时间窗内不重复接管', () => {
	const entry = pickAgentLaunch('pages/agent/dashboard', { alertPrompt: alert, prompt: question })
	assert.equal(shouldHandleLaunch(entry, 1_000), true)
	assert.equal(shouldHandleLaunch(entry, 1_000 + 29_000), false)
	assert.equal(shouldHandleLaunch(entry, 1_000 + 31_000), true)
	const other = pickAgentLaunch('pages/agent/dashboard', { alertPrompt: alert + '（复燃）' })
	assert.equal(shouldHandleLaunch(other, 1_000 + 32_000), true)
})

test('卡片三元组参数保留在启动参数白名单里', () => {
	const launch = pickAgentLaunch('pages/agent/dashboard', {
		alertLedger: 'flooding', alertEventId: '1947', alertDeviceId: '3f8a', alertLabel: '水浸 · 一楼机房', scene: '1011',
	})
	assert.deepEqual(launch, { path: 'pages/agent/dashboard', query: { alertLedger: 'flooding', alertEventId: '1947', alertDeviceId: '3f8a', alertLabel: '水浸 · 一楼机房' } })
})
