import assert from 'node:assert/strict'
import test from 'node:test'
import { createNdjsonStreamDecoder } from '../apis/agent/ndjson.mjs'
// @boundary-private-test-seam: tests the NDJSON transport adapter directly.

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

test('chunked HTTP rejection reaches the message client with its reason and no presentation event or resend', async () => {
 const { registerHooks } = await import('node:module')
 const { readFileSync } = await import('node:fs')
 const clientUrl = new URL('../apis/agent/conversation.js', import.meta.url).href
 const implementationUrl = new URL('../apis/agent/index.js', import.meta.url).href
 const hooks = registerHooks({
  resolve(specifier, context, next) {
   if (specifier === '@/config') return { url: 'data:text/javascript,export default {agentUrl:"https://agent.test/api"}', shortCircuit: true }
   if (specifier === '@/utils/agent-session') return { url: 'data:text/javascript,export const getAgentHeaders=()=>({});export const getAgentStorageScope=()=>"scope"', shortCircuit: true }
   return next(specifier, context)
  },
  load(url, context, next) {
   if (url !== implementationUrl) return next(url, context)
   // Match the WeChat build's conditional branch; exercise the exported client.
   const source = readFileSync(new URL(url), 'utf8').replace(/\/\/ #ifndef MP-WEIXIN[\s\S]*?\/\/ #endif/g, '')
   return { format: 'module', source, shortCircuit: true }
  },
 })
 const originalWx = globalThis.wx
 try {
  const { streamMessage } = await import(clientUrl)
  const { createPresentation } = await import('../pages/agent/lib/conversation.mjs')
  const presented = [], presentation = createPresentation(event => presented.push(event))
  const reason = '当前账户身份暂不可用：等待响应超时（编号 account-1）'
  let calls = 0, responseMode = 'chunked'
  globalThis.wx = { request(options) {
   calls++
   let chunk
   queueMicrotask(() => {
    const bytes = new TextEncoder().encode(JSON.stringify({ code: 'ACCOUNT_IDENTITY_UNAVAILABLE', message: reason }))
    if (responseMode === 'chunked') { chunk({ data: bytes.slice(0, 55).buffer }); chunk({ data: bytes.slice(55).buffer }) }
    options.success({ statusCode: 503, ...(responseMode === 'buffered' ? { data: bytes.buffer } : responseMode === 'string' ? {data: new TextDecoder().decode(bytes)} : {}) })
   })
   return { onChunkReceived(callback) { chunk = callback }, abort() {} }
  } }
  for (const mode of ['chunked', 'buffered', 'string']) {
   responseMode = mode
   await assert.rejects(streamMessage('conv', '原委托', event => presentation.push(event), undefined, 'company').promise,
   error => error.message === reason && error.data.code === 'ACCOUNT_IDENTITY_UNAVAILABLE')
  }
  assert.deepEqual(presented, [])
  assert.equal(calls, 3)
 } finally { globalThis.wx = originalWx; hooks.deregister() }
})
