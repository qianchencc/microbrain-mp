import assert from 'node:assert/strict'
import test from 'node:test'
import { createNdjsonStreamDecoder } from '../apis/agent/ndjson.mjs'

test('NDJSON 分块即使拆分中文 UTF-8 字节也不会丢事件', () => {
	const received = []
	const decoder = createNdjsonStreamDecoder(event => received.push(event))
	const bytes = new TextEncoder().encode([
		JSON.stringify({ type: 'run.started' }),
		JSON.stringify({ type: 'message.delta', content: '已找到设备' }),
		JSON.stringify({ type: 'run.awaiting_confirmation', draftId: 'draft-1' }),
	].join('\n') + '\n')
	const splitAt = bytes.indexOf(0xe5) + 1

	decoder.push(bytes.slice(0, splitAt).buffer)
	decoder.push(bytes.slice(splitAt, splitAt + 7).buffer)
	decoder.push(bytes.slice(splitAt + 7).buffer)
	decoder.end()

	assert.deepEqual(received, [
		{ type: 'run.started' },
		{ type: 'message.delta', content: '已找到设备' },
		{ type: 'run.awaiting_confirmation', draftId: 'draft-1' },
	])
})

test('传输错误文案与终态哨兵：心跳/增量不算终态，截断流可被识别', async () => {
	const { TRANSPORT_ERROR_TEXT, createTerminalTracker } = await import('../apis/agent/stream-errors.mjs')
	assert.equal(TRANSPORT_ERROR_TEXT, '连接中断，请重试')

	const tracker = createTerminalTracker()
	const decoder = createNdjsonStreamDecoder(tracker.track)
	// 截断流：只有开始与增量，没有终态（幽灵轮的形态）。
	decoder.push(new TextEncoder().encode(JSON.stringify({ type: 'run.started' }) + '\n'
		+ JSON.stringify({ type: 'message.delta', content: '正在检索' }) + '\n'
		+ JSON.stringify({ type: 'heartbeat' }) + '\n').buffer)
	decoder.end()
	assert.equal(tracker.seen, false, '无终态事件的截断流不应被当作完成')

	const finished = createTerminalTracker()
	const finishedDecoder = createNdjsonStreamDecoder(finished.track)
	finishedDecoder.push(new TextEncoder().encode(JSON.stringify({ type: 'message.delta', content: '好' }) + '\n'
		+ JSON.stringify({ type: 'run.failed', message: 'x' }) + '\n').buffer)
	finishedDecoder.end()
	assert.equal(finished.seen, true, 'run.failed 是终态')

	const awaiting = createTerminalTracker()
	awaiting.track({ type: 'run.awaiting_confirmation', draftId: 'd' })
	assert.equal(awaiting.seen, true, '待确认也是终态')
})
