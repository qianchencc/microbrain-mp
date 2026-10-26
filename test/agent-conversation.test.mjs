import test from 'node:test'
import assert from 'node:assert/strict'
import { createTurn, applyEvent, restoreTurns, restartTurn, mergeTaskDetail } from '../pages/agent/conversation.mjs'

test('告警引用固定在原轮，恢复和编辑重试不替换成后来的引用', () => {
	for (const reference of [{ type: 'customer_alert', content: '客户告警A：展示厅水浸' }, { type: 'safety_event', ledger: 'gas', eventId: 'event-a', deviceId: 'device-a', label: '燃气记录' }]) {
	const turn = restoreTurns([{ id: 'turn-a', content: '如何处理？', events: [
		{ type: 'run.started', reference }, { type: 'run.completed' },
	] }])[0]
	assert.deepEqual(turn.reference, reference)
	restartTurn(turn, '现场确认前怎么处理？')
	assert.deepEqual(turn.reference, reference)
	assert.equal(turn.content, '现场确认前怎么处理？')
	}
})

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

test('草稿正文实时公开，工具调用到来时重分类折叠为思路行而不删除', () => {
	const turn = createTurn('turn', '查 26 楼用电')
	applyEvent(turn, { type: 'message.delta', content: '我先查一下', phase: 'draft' })
	applyEvent(turn, { type: 'message.delta', content: '电表读数。', phase: 'draft' })
	assert.equal(turn.items.at(-1).kind, 'draftText')
	assert.equal(turn.items.at(-1).text, '我先查一下电表读数。')
	applyEvent(turn, { type: 'message.reclassified', to: 'process', content: '我先查一下电表读数。' })
	assert.equal(turn.streaming, false)
	assert.equal(turn.items.length, 0, '草稿不在正文流重复出现')
	const idea = turn.activities.at(-1)
	assert.equal(idea.kind, 'idea')
	assert.equal(idea.summary, '我先查一下电表读数。')
	applyEvent(turn, { type: 'tool.started', tool: 'read_device_states' })
	assert.equal(turn.activities.at(-1).tool, 'read_device_states')
})

test('无工具轮草稿在原地沉淀为终稿，不移动不重复', () => {
	const turn = createTurn('turn', '你好')
	applyEvent(turn, { type: 'message.delta', content: '你好，', phase: 'draft' })
	applyEvent(turn, { type: 'message.delta', content: '我是物联助手。', phase: 'draft' })
	applyEvent(turn, { type: 'message.completed', content: '你好，我是物联助手。' })
	applyEvent(turn, { type: 'run.completed', outcome: 'message' })
	assert.deepEqual(turn.items.map(item => item.kind), ['draftText'])
	assert.equal(turn.items[0].settled, true, '草稿原地沉淀，不换条目')
	assert.equal(turn.text, '你好，我是物联助手。')
	assert.equal(turn.activities.length, 0, '普通答复不产生处理记录')
})

test('观察卡按事件序先落位，终稿文字落在卡片下方，恢复顺序一致', () => {
	const events = [
		{ type: 'message.delta', content: '我先读表。', phase: 'draft' },
		{ type: 'message.reclassified', to: 'process', content: '我先读表。' },
		{ type: 'tool.started', tool: 'read_device_states' },
		{ type: 'tool.completed', tool: 'read_device_states', status: 'completed' },
		{ type: 'observation.reported', observedAt: '2026-10-22T01:00:00Z', blocks: [{ type: 'energy', devices: [] }] },
		{ type: 'message.delta', content: '以上是读数。', phase: 'draft' },
		{ type: 'message.completed', content: '以上是读数。' },
		{ type: 'run.completed', outcome: 'message' },
	]
	const turn = createTurn('turn', '昨天用了多少电')
	for (const event of events) applyEvent(turn, event)
	assert.deepEqual(turn.items.map(item => item.kind), ['obs', 'draftText'])
	assert.equal(turn.items[1].settled, true, '终稿文字在卡片下方沉淀')
	assert.equal(turn.activities.some(item => item.kind === 'idea'), true)
	const [restored] = restoreTurns([{ id: 'turn', content: '昨天用了多少电', events }])
	assert.deepEqual(restored.items.map(item => item.kind), ['obs', 'draftText'])
	assert.equal(restored.streaming, false)
	assert.equal(restored.running, false)
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

test('任务提案恢复后保留确认状态，已安排任务不会退化为未确认', () => {
	const proposal = { taskId: 'task-1', label: '会议准备', status: 'PENDING_CONFIRMATION', phases: [{ at: '2026-09-28T06:00:00.000Z', actions: [] }] }
	const turns = restoreTurns([{ id: 'turn', content: '安排会议', events: [
		{ type: 'task.proposed', taskId: 'task-1', task: proposal },
		{ type: 'task.resolved', taskId: 'task-1', status: 'SCHEDULED' },
		{ type: 'run.awaiting_confirmation' },
	], task: { ...proposal, status: 'SCHEDULED', created: true } }])
	assert.equal(turns[0].task.status, 'SCHEDULED')
	assert.equal(turns[0].task.created, true)
	assert.equal(turns[0].running, false)
})

test('区间任务提案与恢复保留区间边界与检查点顺序', () => {
	const interval = { startsAt: '2026-10-05T06:00:00.000Z', endsAt: '2026-10-05T08:00:00.000Z' }
	const phases = [
		{ at: '2026-10-05T06:10:00.000Z', actions: [{ kind: 'lighting', deviceId: 'light-1', deviceName: '灯', command: { closeOrOpen: 1 } }] },
		{ at: '2026-10-05T07:30:00.000Z', actions: [{ kind: 'lighting', deviceId: 'light-1', deviceName: '灯', command: { closeOrOpen: 0 } }] },
	]
	const proposal = { taskId: 'task-9', label: '下午巡检', status: 'PENDING_CONFIRMATION', interval, phases }
	const turn = createTurn('turn', '安排下午巡检')
	applyEvent(turn, { type: 'task.proposed', taskId: proposal.taskId, task: proposal })
	assert.deepEqual(turn.task.interval, interval, '提案事件保留区间边界')
	assert.deepEqual(turn.task.phases.map(phase => phase.at), phases.map(phase => phase.at), '检查点顺序保留')
	const [restored] = restoreTurns([{ id: 'turn', content: turn.content, events: [],
		task: { ...proposal, status: 'SCHEDULED', created: true } }])
	assert.deepEqual(restored.task.interval, interval, '恢复任务保留区间边界')
	assert.deepEqual(restored.task.phases, phases, '恢复任务保留检查点')

	mergeTaskDetail(restored.task, { status: 'executing', executionActive: true, report: null, interval,
		phases: [
			{ id: 'ph-1', at: phases[0].at, status: 'completed' },
			{ id: 'ph-2', at: phases[1].at, status: 'executing' },
		] })
	assert.deepEqual(restored.task.phases.map(phase => phase.id), ['ph-1', 'ph-2'], '无 id 检查点按时刻对齐后写入阶段 id')
	assert.deepEqual(restored.task.phases.map(phase => phase.status), ['completed', 'executing'])
	assert.deepEqual(restored.task.phases[0].actions, phases[0].actions, '轮询合并不覆盖提案动作')
	assert.equal(restored.task.executionActive, true)

	mergeTaskDetail(restored.task, { status: 'executing', executionActive: false, report: null, interval,
		phases: [
			{ id: 'ph-1', at: '2026-10-05T09:00:00.000Z', status: 'completed' },
			{ id: 'ph-2', at: '2026-10-05T10:00:00.000Z', status: 'completed' },
		] })
	assert.deepEqual(restored.task.phases.map(phase => phase.status), ['completed', 'completed'], '写入 id 后按 id 同步阶段状态')
	assert.equal(restored.task.executionActive, false)
})

test('同一任务的创建与取消收据在会话恢复后分别保留', () => {
	const created = { taskId: 'task-1', label: '会议准备', status: 'SCHEDULED', created: true, phases: [] }
	const cancellation = { taskId: 'task-1', cancellationId: 'cancel-1', kind: 'cancellation',
		label: '会议准备', status: 'CONFIRMED', phases: [] }
	const turns = restoreTurns([
		{ id: 'create', content: '创建任务', events: [], task: created },
		{ id: 'cancel', content: '取消任务', events: [
			{ type: 'task.cancellation.proposed', task: { ...cancellation, status: 'PENDING_CONFIRMATION' } },
			{ type: 'task.cancellation.resolved', cancellationId: 'cancel-1', status: 'CONFIRMED' },
		], task: cancellation },
	])
	assert.equal(turns[0].task.taskId, 'task-1')
	assert.equal(turns[1].task.cancellationId, 'cancel-1')
	assert.equal(turns[1].task.status, 'CONFIRMED')
})

test('同轮两项任务分别保留确认状态', () => {
	const first = { taskId: 'meeting', status: 'PENDING_CONFIRMATION' }
	const second = { taskId: 'closing', status: 'PENDING_CONFIRMATION' }
	const turn = createTurn('turn', '开会并安排下班关灯')
	applyEvent(turn, { type: 'task.proposed', taskId: first.taskId, task: first })
	applyEvent(turn, { type: 'task.proposed', taskId: second.taskId, task: second })
	applyEvent(turn, { type: 'task.resolved', taskId: first.taskId, status: 'SCHEDULED' })
	assert.deepEqual(turn.tasks.map(task => task.status), ['SCHEDULED', 'PENDING_CONFIRMATION'])
	const [restored] = restoreTurns([{ id: 'turn', content: turn.content, events: [], tasks: turn.tasks }])
	assert.deepEqual(restored.tasks.map(task => task.taskId), ['meeting', 'closing'])
})

test('任务身份引用和两次修改收据分别恢复，后来的引用不覆盖原轮', () => {
 const turn = createTurn('ref-turn', '解释任务结果')
 const reference = { type: 'task', taskId: 'actual-task' }
 applyEvent(turn, { type: 'run.started', reference })
 applyEvent(turn, { type: 'task.change.proposed', changeId: 'change-a', task: { kind: 'change', changeId: 'change-a', target: reference, status: 'PENDING_CONFIRMATION' } })
 applyEvent(turn, { type: 'task.change.resolved', changeId: 'change-a', status: 'CONFIRMED' })
 assert.equal(turn.tasks[0].status, 'CONFIRMED')
 const restored = restoreTurns([{ id: 'first', content: '改本次', events: [{ type: 'run.started', reference }, { type: 'task.change.proposed', task: turn.tasks[0] }] },
  { id: 'second', content: '改周期', events: [{ type: 'run.started', reference: { type: 'task_plan', planId: 'plan-a' } }, { type: 'task.change.proposed', task: { kind: 'change', changeId: 'change-b', status: 'CANCELLED' } }] }])
 assert.deepEqual(restored.map(item => item.tasks[0].changeId), ['change-a', 'change-b'])
 assert.equal(restored[0].reference.taskId, 'actual-task')
 assert.equal(restored[1].reference.planId, 'plan-a')
})

test('原轮系统承接保留前段答复，必要问题独立展示', () => {
 const restored = restoreTurns([{ id: 'original-turn', content: '创建只读任务', events: [
  { type: 'run.started', turnId: 'original-turn' },
  { type: 'message.completed', content: '任务已准备，请确认。' },
  { type: 'task.proposed', taskId: 'task-a', task: { taskId: 'task-a', status: 'PENDING_CONFIRMATION' } },
  { type: 'run.awaiting_confirmation' },
  { type: 'run.started', turnId: 'original-turn' },
  { type: 'message.delta', content: '原定时间已过。' },
  { type: 'message.completed', content: '原定时间已过。希望改为什么时间？' },
  { type: 'run.completed' },
 ] }])[0]
 assert.equal(restored.content, '创建只读任务')
 const texts = restored.items.filter(item => item.kind === 'text').map(item => item.text ?? restored.text)
 assert.deepEqual(texts, ['任务已准备，请确认。', '原定时间已过。希望改为什么时间？'])
 assert.equal(restored.tasks.length, 1)
})

test('系统承接中的权威终稿覆盖草稿增量，后续空轮不能擦除旧答复', () => {
 const turn = createTurn('original', '创建任务')
 applyEvent(turn, { type: 'run.started' })
 applyEvent(turn, { type: 'message.delta', phase: 'draft', content: '草稿增量' })
 applyEvent(turn, { type: 'message.completed', content: '原任务的权威终稿' })
 assert.equal(turn.items[0].text, '原任务的权威终稿')
 applyEvent(turn, { type: 'run.completed' })
 applyEvent(turn, { type: 'run.started' })
 applyEvent(turn, { type: 'run.failed', message: '读取中断' })
 applyEvent(turn, { type: 'run.started' })
 applyEvent(turn, { type: 'message.delta', phase: 'draft', content: '新问题草稿' })
 applyEvent(turn, { type: 'message.completed', content: '需要新的执行时间' })
 assert.deepEqual(turn.items.filter(item => ['text','draftText'].includes(item.kind)).map(item => item.text ?? turn.text), ['原任务的权威终稿', '需要新的执行时间'])
})

test('原轮两次系统承接分别保留原答复、中断正文与新问题', () => {
 const [turn] = restoreTurns([{ id: 'original', content: '创建任务', events: [
  { type: 'run.started' }, { type: 'message.delta', phase: 'draft', content: '原答复草稿' },
  { type: 'message.completed', content: '原任务已准备，请确认' }, { type: 'run.awaiting_confirmation' },
  { type: 'run.started' }, { type: 'message.delta', phase: 'draft', content: '正在核实原定时间' }, { type: 'run.aborted' },
  { type: 'run.started' }, { type: 'message.delta', phase: 'draft', content: '问题草稿' },
  { type: 'message.completed', content: '需要新的执行时间' }, { type: 'run.completed' },
 ] }])
 assert.deepEqual(turn.items.filter(item => ['text','draftText'].includes(item.kind)).map(item => item.text ?? turn.text), ['原任务已准备，请确认', '正在核实原定时间', '需要新的执行时间'])
})
