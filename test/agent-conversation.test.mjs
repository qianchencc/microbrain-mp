import test from 'node:test'
import assert from 'node:assert/strict'
import { createTurn, applyEvent, restoreTurns } from '../pages/agent/conversation.mjs'

test('恢复以持久化草案和收尾为准，同一草案修订只出现一次', () => {
	const draft = { draftId: 'draft', revision: 3, status: 'ACCEPTED', selectedActionIds: ['b'] }
	const result = { summary: { status: 'completed', text: '请求已受理。' } }
	const focusRegion = { id: 'office-a', name: '会议室' }
	const turns = restoreTurns([{ id: 'a', content: '草案', events: [], draft }, { id: 'b', content: '修订', events: [{ type: 'run.started', focusRegion }], draft, result }])
	assert.equal(turns[0].draft, null)
	assert.deepEqual(turns[1].draft.selectedActionIds, ['b'])
	assert.equal(turns[1].result.summary.text, '请求已受理。')
	assert.deepEqual(turns[1].focusRegion, focusRegion)
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
