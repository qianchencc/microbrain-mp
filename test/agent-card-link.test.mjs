import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAgentContext } from '../pages/agent/context-link.mjs'

const toasts = []
globalThis.uni = { showToast: options => toasts.push(options.title) }

const enc = value => encodeURIComponent(value)

test('消息卡片：alertPrompt 生成客户告警引用，prompt 预填问题', () => {
	const alert = '烟感 · 3 楼东侧机房 · 2026-10-28 09:41'
	const question = '请帮我核实这条告警并给出处置建议'
	const context = parseAgentContext({ source: 'company', alertPrompt: enc(alert), prompt: enc(question) })
	assert.deepEqual(context.reference, { type: 'customer_alert', content: alert })
	assert.equal(context.prompt, question)
})

test('消息卡片：静态路径只带 prompt 也返回预填问题且无引用', () => {
	const question = '请列出最近 24 小时的烟感、燃气、水浸告警，并告诉我需要怎么处理。'
	const context = parseAgentContext({ source: 'company', prompt: enc(question) })
	assert.equal(context.reference, null)
	assert.equal(context.prompt, question)
})

test('消息卡片：预填问题去空白并拒绝超长或控制字符', () => {
	assert.equal(parseAgentContext({ prompt: enc('  查询告警  ') }).prompt, '查询告警')
	assert.equal(parseAgentContext({ prompt: enc('x'.repeat(201)) }).prompt, '')
	assert.equal(parseAgentContext({ prompt: enc('第一行\n第二行') }).prompt, '')
	assert.ok(toasts.includes('预置问题无效或超过200字'))
})

test('消息卡片：参数未被编码时按原文保留，而不是丢掉引用', () => {
	const alert = '燃气 · 一层厨房 · 2026-10-28 10:02'
	const context = parseAgentContext({ alertPrompt: alert, prompt: '请核实' })
	assert.deepEqual(context.reference, { type: 'customer_alert', content: alert })
	assert.equal(context.prompt, '请核实')
})

test('消息卡片：办公室直达链不消费公司 prompt', () => {
	const context = parseAgentContext({ prompt: enc('查询告警') }, { company: false })
	assert.equal(context.prompt, '')
})

test('消息卡片：超长告警引用被拒收', () => {
	const context = parseAgentContext({ alertPrompt: enc('警'.repeat(2001)) })
	assert.equal(context.reference, null)
	assert.ok(toasts.includes('告警引用无效或超过2000字'))
})
