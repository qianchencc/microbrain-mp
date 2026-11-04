import test from 'node:test'
import assert from 'node:assert/strict'
import { receiptPhase, executionNotice } from '../pages/agent/lib/actions.mjs'
import { receiptText, restoreTurns } from '../pages/agent/lib/conversation.mjs'

// 受理≠物理成功：门禁开门无物理回执，受理即「已下发」终态，绝不渲染成已开门/已完成。
test('门禁与无回读控制受理后只到已下发，不宣称物理成功', () => {
	const door = { kind: 'access', command: {} }
	const lighting = { kind: 'lighting', command: { closeOrOpen: 1 } }
	const ac = { kind: 'ac', command: { power: 'on' } }
	assert.equal(receiptText({ outcome: 'ACCEPTED' }), '已下发')
	assert.equal(receiptPhase(door, 'ACCEPTED', undefined), 'accepted')
	assert.equal(receiptPhase(lighting, 'ACCEPTED', undefined), 'accepted')
	assert.equal(receiptPhase(ac, 'ACCEPTED', undefined), 'accepted')
	assert.equal(receiptPhase(door, 'DEVICE_APPLIED', 'confirmed'), 'accepted')
	// 设备侧证实才说已完成：DEVICE_APPLIED 或受理后回读 confirmed。
	assert.equal(receiptText({ outcome: 'DEVICE_APPLIED' }), '已完成')
	assert.equal(receiptPhase(lighting, 'DEVICE_APPLIED', undefined), 'complete')
	assert.equal(receiptPhase(ac, 'ACCEPTED', 'confirmed'), 'complete')
})

// 未知/超时 ≠ 失败：单独一类，不下被拒结论，也不冒充成功。
test('未知与超时回执区别于被拒，不渲染为失败', () => {
	const action = { kind: 'lighting', command: { closeOrOpen: 1 } }
	for (const outcome of ['UNKNOWN', 'TIMEOUT', 'DISPATCHED_UNKNOWN', 'INTERRUPTED']) {
		assert.equal(receiptPhase(action, outcome, undefined), 'unknown')
		assert.equal(receiptPhase({ kind: 'access', command: {} }, outcome, undefined), 'unknown')
	}
	assert.equal(receiptText({ outcome: 'TIMEOUT' }), '下发结果未知')
	assert.equal(receiptText({ outcome: 'UNKNOWN' }), '下发结果未知')
	assert.equal(receiptPhase(action, 'REJECTED', undefined), 'failed')
	assert.equal(receiptText({ outcome: 'REJECTED' }), '未受理')
	assert.equal(receiptText({ outcome: 'NOT_DISPATCHED' }), '未执行')
})

// 空调参数级部分受理按字段点名保持可见，不折叠成整体成功或整体失败。
test('空调参数级混合结果按字段可见', () => {
	const action = { kind: 'ac', command: { power: 'on', temperature: 26 } }
	assert.equal(receiptPhase(action, 'PARTIALLY_ACCEPTED', undefined), 'partial')
	assert.equal(receiptPhase(action, 'PARTIALLY_ACCEPTED', 'confirmed'), 'partial')
	assert.equal(receiptText({ outcome: 'PARTIALLY_ACCEPTED' }), '部分已下发')
	assert.equal(receiptText({ outcome: 'PARTIALLY_ACCEPTED', fields: [
		{ field: 'power', outcome: 'ACCEPTED' }, { field: 'mode', outcome: 'REJECTED' },
	] }), '未受理：模式')
	assert.equal(receiptText({ outcome: 'PARTIALLY_ACCEPTED', fields: [
		{ field: 'temperature', outcome: 'ACCEPTED' }, { field: 'fanSpeed', outcome: 'TIMEOUT' },
	] }), '部分结果未知：风速')
	assert.equal(receiptText({ outcome: 'PARTIALLY_ACCEPTED', fields: [
		{ field: 'mode', outcome: 'REJECTED' }, { field: 'fanSpeed', outcome: 'UNKNOWN' },
	] }), '未受理：模式；结果未知：风速')
})

// 执行中只认草案权威状态 EXECUTING；缺 message 或总结生成中都不得推断成执行中。
test('执行中回执只来自权威 EXECUTING 状态', () => {
	assert.equal(executionNotice({ status: 'EXECUTING' }, null).kind, 'executing')
	assert.equal(executionNotice({ status: 'EXECUTING' }, { status: 'ACCEPTED', message: '指令已下发' }).kind, 'executing')
	// 真实门禁旧记录：ACCEPTED + 受理回执但持久化结果缺 message——绝不回落到「正在执行」。
	const legacyDoor = { draftId: 'd1', status: 'ACCEPTED', receipts: [{ actionId: 'a1', outcome: 'ACCEPTED' }] }
	const notice = executionNotice({ status: 'ACCEPTED' }, legacyDoor)
	assert.equal(notice.kind, 'sent')
	assert.match(notice.text, /已下发/)
	assert.doesNotMatch(notice.text, /正在执行/)
	// 总结仍在生成不是执行：草案权威已终态。
	const summarizing = executionNotice({ status: 'ACCEPTED' }, { status: 'ACCEPTED', message: '', summary: { status: 'running' } })
	assert.equal(summarizing.kind, 'sent')
	assert.equal(executionNotice({ status: 'PENDING_CONFIRMATION' }, null), null)
})

// 聚合状态只是线索，逐条回执才是证据：未知传输不算已下发，兜底文案从回执推导。
test('缺消息的旧结果按逐条回执推导兜底文案', () => {
	// 零受理而存在未知：只说结果未知，不说部分已下发（未知传输不是已下发证据）。
	const unknownOnly = executionNotice({ status: 'INTERRUPTED' }, { status: 'INTERRUPTED', receipts: [
		{ actionId: 'a1', outcome: 'UNKNOWN' }, { actionId: 'a2', outcome: 'TIMEOUT' },
	] })
	assert.equal(unknownOnly.kind, 'attention')
	assert.match(unknownOnly.text, /下发结果未知/)
	assert.doesNotMatch(unknownOnly.text, /已下发/)
	// 未知+被拒：结果未知，可附未受理项。
	assert.equal(executionNotice({ status: 'INTERRUPTED' }, { status: 'INTERRUPTED', receipts: [
		{ actionId: 'a1', outcome: 'UNKNOWN' }, { actionId: 'a2', outcome: 'REJECTED' },
	] }).text, '下发结果未知，有未受理项')
	// 已受理+未知：部分已下发，其余结果未知。
	assert.equal(executionNotice({ status: 'PARTIALLY_ACCEPTED' }, { status: 'PARTIALLY_ACCEPTED', receipts: [
		{ actionId: 'a1', outcome: 'ACCEPTED' }, { actionId: 'a2', outcome: 'UNKNOWN' },
	] }).text, '部分指令已下发，其余下发结果未知')
	// 已受理+被拒：部分已下发，其余未受理。
	assert.equal(executionNotice({ status: 'PARTIALLY_ACCEPTED' }, { status: 'PARTIALLY_ACCEPTED', receipts: [
		{ actionId: 'a1', outcome: 'ACCEPTED' }, { actionId: 'a2', outcome: 'REJECTED' },
	] }).text, '部分指令已下发，其余未受理')
	// 无需操作+被拒：如实并陈，不虚构已下发。
	const noDispatch = executionNotice({ status: 'NO_CHANGE' }, { status: 'NO_CHANGE', receipts: [
		{ actionId: 'a1', outcome: 'ALREADY_SATISFIED' }, { actionId: 'a2', outcome: 'REJECTED' },
	] })
	assert.match(noDispatch.text, /无需操作/)
	assert.match(noDispatch.text, /未受理/)
	assert.doesNotMatch(noDispatch.text, /已下发/)
})

// 终态文案以规范化 message 为准；缺失时按权威 status 真实兜底，未知不写成失败。
test('终态文案优先规范化消息并按状态真实兜底', () => {
	assert.equal(executionNotice({ status: 'PARTIALLY_ACCEPTED' }, { status: 'PARTIALLY_ACCEPTED' }).kind, 'attention')
	assert.match(executionNotice({ status: 'PARTIALLY_ACCEPTED' }, { status: 'PARTIALLY_ACCEPTED' }).text, /部分/)
	assert.equal(executionNotice({ status: 'REJECTED' }, { status: 'REJECTED' }).kind, 'attention')
	assert.match(executionNotice({ status: 'INTERRUPTED' }, { status: 'INTERRUPTED' }).text, /结果未知/)
	assert.match(executionNotice({ status: 'NO_CHANGE' }, { status: 'NO_CHANGE' }).text, /无需操作/)
	assert.match(executionNotice({ status: 'CANCELLED' }, { status: 'CANCELLED' }).text, /未执行/)
	assert.match(executionNotice({ status: 'EXPIRED' }, { status: 'EXPIRED' }).text, /未执行/)
})

test('旧空调参数证据优先于粗粒度拒绝，执行时回读才支持完成', () => {
	const draft = { status: 'REJECTED', actions: [{ id: 'a1', kind: 'ac' }] }
	const partial = executionNotice(draft, { receipts: [{ actionId: 'a1', outcome: 'REJECTED', response: { fields: [
		{ field: 'power', outcome: 'accepted' }, { field: 'temperature', outcome: 'rejected' },
	] } }] })
	assert.equal(partial.kind, 'attention')
	assert.match(partial.text, /部分.*已下发/)
	const confirmed = executionNotice({ ...draft, status: 'ACCEPTED' }, {
		receipts: [{ actionId: 'a1', outcome: 'ACCEPTED' }], readback: { a1: 'confirmed' },
	})
	assert.match(confirmed.text, /已完成/)
	const unconfirmed = executionNotice({ ...draft, status: 'ACCEPTED' }, {
		receipts: [{ actionId: 'a1', outcome: 'ACCEPTED' }], observedStates: { ac: { power: 'on' } },
	})
	assert.match(unconfirmed.text, /已下发/)
	assert.doesNotMatch(unconfirmed.text, /已完成/)
})

// 权威恢复后回执与实时同一投影：旧记录缺 message 不再丢事实，受理回执仍可读出已下发。
test('恢复保留缺消息的旧执行结果并可真实呈现', () => {
	const turns = restoreTurns([{ id: 't1', content: '开一下门', events: [], draft: {
		draftId: 'd1', status: 'ACCEPTED', revision: 2, actions: [{ id: 'a1', deviceId: 'dev1', kind: 'access', command: {} }], selectedActionIds: ['a1'],
	}, result: { draftId: 'd1', status: 'ACCEPTED', receipts: [{ actionId: 'a1', outcome: 'ACCEPTED' }] } }])
	const notice = executionNotice(turns[0].draft, turns[0].result)
	assert.equal(notice.kind, 'sent')
	assert.match(notice.text, /已下发/)
	assert.equal(receiptText(turns[0].result.receipts[0]), '已下发')
	const executing = restoreTurns([{ id: 't2', content: '开灯', events: [], draft: {
		draftId: 'd2', status: 'EXECUTING', revision: 1, actions: [{ id: 'a2', deviceId: 'dev2', kind: 'lighting', command: { closeOrOpen: 1 } }], selectedActionIds: ['a2'],
	}, result: null }])
	assert.equal(executionNotice(executing[0].draft, executing[0].result).kind, 'executing')
})
