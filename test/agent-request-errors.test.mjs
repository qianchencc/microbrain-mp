import assert from 'node:assert/strict'
import test from 'node:test'
import { requestJson, downloadHttpError, recoverDraftRequest } from '../apis/agent/request.mjs'
// @boundary-private-test-seam: tests the request adapter contract directly.
import { friendlyError } from '../pages/agent/lib/conversation.mjs'

test('lost door confirmation reads the original receipt without another control request', async () => {
 const original = globalThis.uni, calls = []
 try {
  globalThis.uni = { request: options => {
   calls.push(options.method)
   options.success({ statusCode: 200, data: { draftId: 'door', status: 'INTERRUPTED', revision: 1, result: { status: 'INTERRUPTED', receipts: [{ outcome: 'DISPATCHED_UNKNOWN' }] } } })
  } }
  const result = await recoverDraftRequest('/api/agent/action-drafts/door/confirm?source=company', 'POST', { revision: 1 }, {}, 1000, () => true)
  assert.equal(result.status, 'INTERRUPTED')
  assert.deepEqual(calls, ['GET'])
 } finally { globalThis.uni = original }
})

test('lost selection response adopts the persisted revision; conflicts do not overwrite a newer draft', async () => {
 const original = globalThis.uni, calls = []
 try {
  let snapshot = { draftId: 'd', status: 'PENDING_CONFIRMATION', revision: 2, selectedActionIds: ['a'], revisionOperation: 'ACTION_DRAFT_SELECTION_CHANGED' }
  globalThis.uni = { request: options => { calls.push(options.method); options.success({ statusCode: 200, data: snapshot }) } }
  const result = await recoverDraftRequest('/api/agent/action-drafts/d/selection', 'PATCH', { revision: 1, selectedActionIds: ['a'] }, {}, undefined, () => true)
  assert.equal(result.revision, 2)
  snapshot = { ...snapshot, selectedActionIds: ['b'] }
  await assert.rejects(recoverDraftRequest('/api/agent/action-drafts/d/selection', 'PATCH', { revision: 1, selectedActionIds: ['a'] }, {}, undefined, () => true), error => error.status === 409)
  assert.deepEqual(calls, ['GET', 'GET'])
 } finally { globalThis.uni = original }
})

test('lost revalidation adopts the fresh draft without creating another draft or crossing identity', async () => {
 const original = globalThis.uni
 let active = true, invalidateOnReplacement = false, writes = 0
 try {
  const expired = { draftId: 'old', status: 'EXPIRED', revision: 2, revalidatedInto: 'fresh' }
  const fresh = { draftId: 'fresh', status: 'PENDING_CONFIRMATION', revision: 1, selectedActionIds: ['light-1'] }
  globalThis.uni = { request: options => {
   if (options.method !== 'GET') {
    writes += 1
    throw new Error('revalidation must not be submitted again')
   }
   const replacement = options.url.includes('/fresh?')
   if (replacement && invalidateOnReplacement) active = false
   options.success({ statusCode: 200, data: replacement ? fresh : expired })
  } }
  const result = await recoverDraftRequest('/api/agent/action-drafts/old/revalidate?source=company', 'POST', { revision: 1 }, {}, undefined, () => active)
  assert.equal(result.draftId, 'fresh')
  assert.equal(result.status, 'PENDING_CONFIRMATION')
  assert.deepEqual(result.selectedActionIds, ['light-1'])
  assert.equal(writes, 0)

  invalidateOnReplacement = true
  await assert.rejects(recoverDraftRequest('/api/agent/action-drafts/old/revalidate?source=company', 'POST', { revision: 1 }, {}, undefined, () => active))
  assert.equal(active, false)
  assert.equal(writes, 0)
 } finally { globalThis.uni = original }
})

test('zero-dispatch confirmation retries only the unchanged pending revision and never crosses identity', async () => {
 const original = globalThis.uni, calls = []
 try {
  let active = true
  globalThis.uni = { request: options => { calls.push(options.method); options.success({ statusCode: 200, data: options.method === 'GET' ? { status: 'PENDING_CONFIRMATION', revision: 1 } : { status: 'ACCEPTED' } }) } }
  assert.equal((await recoverDraftRequest('/api/agent/action-drafts/d/confirm', 'POST', { revision: 1 }, {}, undefined, () => active)).status, 'ACCEPTED')
  active = false
  await assert.rejects(recoverDraftRequest('/api/agent/action-drafts/d/confirm', 'POST', { revision: 1 }, {}, undefined, () => active))
  assert.deepEqual(calls, ['GET', 'POST'])
 } finally { globalThis.uni = original }
})

test('Agent requests retain server reasons and identify HTTP failures with no response body', async () => {
 const original = globalThis.uni
 try {
  const reason = '检查点智能分析：模型服务返回 HTTP 503（编号 phase-1）'
  globalThis.uni = { request: options => options.success({ statusCode: 503, data: { message: reason } }) }
  await assert.rejects(requestJson('/api/agent/tasks/1', 'GET'), error => error.message === reason)
  assert.equal(friendlyError(reason), reason)
  globalThis.uni = { request: options => options.success({ statusCode: 502, data: '<html>private proxy body</html>' }) }
  await assert.rejects(requestJson('/api/agent/tasks/1', 'GET'), error => error.status === 502 && error.message === '业务请求失败' && !error.message.includes('private proxy body'))
 } finally { globalThis.uni = original }
})

test('PDF download retains the saved HTTP error response instead of replacing it with a generic failure', async () => {
 const original = globalThis.uni
 try {
  const reason = '报告导出失败：存储空间不足（编号 request-2）'
  globalThis.uni = { getFileSystemManager: () => ({ readFile: options => options.success({ data: JSON.stringify({ message: reason }) }) }) }
  assert.equal((await downloadHttpError({ statusCode: 503, tempFilePath: '/tmp/download-response' })).message, reason)
  globalThis.uni = { getFileSystemManager: () => ({ readFile: options => options.success({ data: '<html>proxy unavailable</html>' }) }) }
  const error = await downloadHttpError({ statusCode: 502, tempFilePath: '/tmp/download-response' })
  assert.equal(error.message, '报告下载失败')
  assert.doesNotMatch(error.message, /html|proxy unavailable/)
  globalThis.uni = { getFileSystemManager: () => { throw new Error('filesystem unavailable') } }
  assert.equal((await downloadHttpError({ statusCode: 503, tempFilePath: '/tmp/download-response' })).message, '报告下载失败')
 } finally { globalThis.uni = original }
})
