import test from 'node:test'
import assert from 'node:assert/strict'
import { createTurn, applyEvent, restoreTurns, operationText, receiptText, friendlyError } from '../pages/agent/conversation.mjs'

test('重复工具调用分别完成，回答追加在同一轮并收起记录', () => {
	const turn = createTurn('turn', '查询设备')
	for (let i = 0; i < 2; i++) {
		applyEvent(turn, { type: 'tool.started', tool: 'find_device_candidates' })
		applyEvent(turn, { type: 'tool.completed', tool: 'find_device_candidates', status: 'completed', summary: `结果${i}` })
	}
	applyEvent(turn, { type: 'message.delta', content: '已找到' })
	applyEvent(turn, { type: 'message.delta', content: '设备。' })
	assert.equal(turn.text, '已找到设备。')
	assert.equal(turn.traceOpen, false)
	assert.deepEqual(turn.activities.map(item => item.summary), ['结果0', '结果1'])
})

test('恢复以持久化草案和收尾为准，同一草案修订只出现一次', () => {
	const draft = { draftId: 'draft', revision: 3, status: 'ACCEPTED', selectedActionIds: ['b'] }
	const result = { summary: { status: 'completed', text: '请求已受理。' } }
	const turns = restoreTurns([{ id: 'a', content: '草案', events: [], draft }, { id: 'b', content: '修订', events: [], draft, result }])
	assert.equal(turns[0].draft, null)
	assert.deepEqual(turns[1].draft.selectedActionIds, ['b'])
	assert.equal(turns[1].result.summary.text, '请求已受理。')
})

test('操作文案按真实命令展示，不固定为打开照明', () => {
	assert.equal(operationText({ kind: 'lighting', command: { closeOrOpen: 0 } }), '关闭')
	assert.equal(operationText({ kind: 'access', command: { controlType: 2, count: 3 } }), '开门 3 次')
	assert.equal(operationText({ kind: 'ac', command: { temperature: 25 } }), '25°C')
	assert.equal(receiptText({ outcome: 'ACCEPTED' }), '指令已受理')
})

test('message.completed 以终稿覆盖流式文本，工具评注在工具开始时收起', () => {
	const turn = createTurn('turn', '查询设备')
	applyEvent(turn, { type: 'tool.started', tool: 'find_device_candidates' })
	applyEvent(turn, { type: 'message.delta', content: '让我先查一下' })
	assert.equal(turn.streaming, true)
	applyEvent(turn, { type: 'tool.started', tool: 'inspect_device_capabilities' })
	assert.equal(turn.text, '')
	assert.equal(turn.streaming, false)
	applyEvent(turn, { type: 'message.delta', content: '共3台，' })
	applyEvent(turn, { type: 'message.delta', content: '其中1台已关。' })
	applyEvent(turn, { type: 'message.completed', content: '共3台照明，其中1台已关。' })
	assert.equal(turn.text, '共3台照明，其中1台已关。')
	assert.equal(turn.streaming, false)
})

test('tool.progress 原位更新运行中步骤的过渡摘要', () => {
	const turn = createTurn('turn', '开灯')
	applyEvent(turn, { type: 'tool.started', tool: 'find_device_candidates' })
	applyEvent(turn, { type: 'tool.progress', tool: 'find_device_candidates', summary: '正在修正检索范围…' })
	assert.equal(turn.activities[0].status, 'running')
	assert.equal(turn.activities[0].summary, '正在修正检索范围…')
	applyEvent(turn, { type: 'tool.completed', tool: 'find_device_candidates', status: 'completed', summary: '找到 5 个设备候选 · 2 次尝试' })
	assert.equal(turn.activities[0].summary, '找到 5 个设备候选 · 2 次尝试')
})

test('run 收尾同时清除流式标记，恢复重放后不残留光标', () => {
	const turn = createTurn('turn', '查询设备')
	applyEvent(turn, { type: 'message.delta', content: '部分正文' })
	applyEvent(turn, { type: 'run.completed', outcome: 'message' })
	assert.equal(turn.running, false)
	assert.equal(turn.streaming, false)
	const [restored] = restoreTurns([{ id: 'turn', content: '查询设备', events: [
		{ type: 'message.delta', content: '部分正文' },
		{ type: 'run.completed', outcome: 'message' }
	] }])
	assert.equal(restored.text, '部分正文')
	assert.equal(restored.streaming, false)
	assert.equal(restored.running, false)
})

test('friendlyError 将底层错误映射为一句人话', () => {
	assert.equal(friendlyError('request:fail TypeError: network error'), '网络连接中断，本次回答未完成')
	assert.equal(friendlyError('请求处理失败'), '服务暂时不可用，本次回答未完成')
	assert.equal(friendlyError('会话已过期或不可用'), '会话已过期，请清除后重新开始')
	assert.equal(friendlyError(''), '本次回答未完成')
})
