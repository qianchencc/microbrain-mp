import test from 'node:test'
import assert from 'node:assert/strict'
import { environmentHistoryPrompt, environmentWindowReference } from '../pages/agent/environment-reference.mjs'
import { parseAgentContext } from '../pages/agent/context-link.mjs'

globalThis.uni = { showToast() {} }

const window = { from: '2026-10-27T00:00:00+08:00', to: '2026-10-27T23:59:59+08:00' }

test('环境历史引用固定服务端窗口并拒绝无法由 Runtime 读取的时间', () => {
	assert.deepEqual(environmentWindowReference(window), {
		type: 'environment_window',
		from: window.from,
		to: window.to,
		label: '2026-10-27 00:00 至 2026-10-27 23:59',
	})
	assert.equal(environmentWindowReference({ from: window.to, to: window.from }), null)
	assert.equal(environmentWindowReference({ from: '2026-10-27 00:00:00', to: window.to }), null)
	assert.equal(environmentHistoryPrompt({ from: '2026-10-27 00:00:00', to: window.to }), '')
})

test('环境历史深链同时带上结构化引用和预填问题', () => {
	const context = parseAgentContext({ environmentWindow: encodeURIComponent(JSON.stringify(window)) })
	assert.deepEqual(context.reference, environmentWindowReference(window))
	assert.equal(context.prompt, environmentHistoryPrompt(window))
	const invalid = parseAgentContext({ environmentWindow: encodeURIComponent(JSON.stringify({ from: window.from, to: '2026-10-27 23:59:59' })) })
	assert.equal(invalid.reference, null)
	assert.equal(invalid.prompt, '')
})
