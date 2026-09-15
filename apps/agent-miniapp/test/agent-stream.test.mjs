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
