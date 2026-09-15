import test from 'node:test'
import assert from 'node:assert/strict'
import { createTurn, applyEvent, restoreTurns, operationText, receiptText, canRecoverTurn, restartTurn } from '../pages/agent/conversation.mjs'

test('部分受理保留失败参数，门禁回执保留次数', () => {
	assert.equal(receiptText({ outcome: 'PARTIALLY_ACCEPTED', fields: [{ field: 'power', outcome: 'ACCEPTED' }, { field: 'temperature', outcome: 'REJECTED' }, { field: 'mode', outcome: 'REJECTED' }] }), '未受理：设定温度、模式')
	assert.equal(receiptText({ outcome: 'PARTIALLY_ACCEPTED', attempts: [{ outcome: 'ACCEPTED' }, { outcome: 'REJECTED' }] }), '1/2 次已受理')
	assert.equal(receiptText({ outcome: 'UNSELECTED', fields: [] }), '未选择')
})

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

test('候选检索的中间零命中不完成节点，后续命中复用同一节点', () => {
	const turn = createTurn('search', '打开26楼办公区空调')
	applyEvent(turn, { type: 'tool.started', tool: 'find_device_candidates', invocationId: 'find-1' })
	applyEvent(turn, { type: 'tool.completed', tool: 'find_device_candidates', invocationId: 'find-1', status: 'completed', details: { count: 0 }, summary: '找到 0 个设备候选' })
	assert.equal(turn.activities.length, 1)
	assert.equal(turn.activities[0].status, 'searching')
	assert.equal(turn.activities[0].summary, '正在调整检索范围…')

	applyEvent(turn, { type: 'tool.started', tool: 'find_device_candidates', invocationId: 'find-2' })
	assert.equal(turn.activities.length, 1)
	assert.equal(turn.activities[0].attempts, 2)

	applyEvent(turn, { type: 'tool.completed', tool: 'find_device_candidates', invocationId: 'find-2', status: 'completed', details: { count: 2 }, summary: '找到 2 个设备候选 · 2 次尝试' })
	assert.equal(turn.activities[0].status, 'completed')
	assert.equal(turn.activities[0].summary, '找到 2 个设备候选 · 2 次尝试')
})

test('失败或完成的纯问答回合可原位编辑或重试，带草案的回合只读', () => {
	const turn = createTurn('local', '打开26楼空调')
	applyEvent(turn, { type: 'run.started', turnId: 'server-turn' })
	applyEvent(turn, { type: 'message.delta', content: '处理中' })
	applyEvent(turn, { type: 'run.failed', message: '本次回答未完成' })
	assert.equal(turn.serverId, 'server-turn')
	assert.equal(canRecoverTurn(turn, true), true)

	const answered = createTurn('local-2', '123')
	applyEvent(answered, { type: 'run.started', turnId: 'server-turn-2' })
	applyEvent(answered, { type: 'message.completed' })
	applyEvent(answered, { type: 'run.completed' })
	assert.equal(canRecoverTurn(answered, true), true, '成功的纯问答轮也可重试')
	assert.equal(canRecoverTurn(answered, false), false, '仅最后一轮可改写')

	applyEvent(answered, { type: 'action.proposed', draftId: 'draft', actions: [] })
	assert.equal(canRecoverTurn(answered, true), false, '带草案的轮次不可改写')

	restartTurn(turn, '打开26楼会议室空调')
	assert.equal(turn.content, '打开26楼会议室空调')
	assert.equal(turn.text, '')
	assert.equal(turn.error, '')
	assert.equal(turn.running, true)
	assert.deepEqual(turn.activities, [])
	assert.equal(canRecoverTurn(turn, true), false)
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

test('恢复思考秒数使用服务端时间戳而不是当前时间', () => {
	const [turn] = restoreTurns([{id:'timed',content:'查询',startedAt:'2026-09-06T01:00:00.000Z',events:[{type:'run.completed',timestamp:'2026-09-06T01:00:16.000Z'}]}])
	assert.equal(turn.seconds,16)
	const [legacy] = restoreTurns([{id:'legacy',content:'查询',events:[{type:'run.completed'}]}])
	assert.equal(legacy.seconds,0)
})
