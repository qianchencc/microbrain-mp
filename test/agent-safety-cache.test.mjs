import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

let instance = 0
async function setup(t) {
 const previousUni = globalThis.uni, previousScope = globalThis.safetyTestScope
 globalThis.safetyTestScope = 'alice'
 t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-26T12:00:00Z') })
 const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@/config') return { url: 'data:text/javascript,export default {agentUrl:"https://agent.test/api"}', shortCircuit: true }
  if (specifier === '@/utils/agent-session') return { url: 'data:text/javascript,export const getAgentHeaders=()=>({});export const getAgentStorageScope=()=>globalThis.safetyTestScope', shortCircuit: true }
  return next(specifier, context)
 } })
 t.after(() => { hooks.deregister(); globalThis.uni = previousUni; globalThis.safetyTestScope = previousScope })
 const calls = []
 const response = url => {
  const query = new URL(url).searchParams, type = query.get('type')
  return { source: 'company', items: [{ eventId: `${type}:${query.get('cursor') || 'first'}`, deviceId: type, ledger: type }],
   observedAt: new Date().toISOString(), window: { from: query.get('from') || '1970-01-01T00:00:00.000Z', to: query.get('to') },
   coverageComplete: false, nextCursor: `${type}:next` }
 }
 globalThis.uni = { request(options) { calls.push(options); queueMicrotask(() => options.success({ statusCode: 200, data: response(options.url) })) } }
 const client = await import(new URL(`../apis/agent/index.js?safety-test=${++instance}`, import.meta.url).href)
 const query = { type: 'gas', to: '2026-10-26T23:59:59.999+08:00', limit: 20 }
 return { client, calls, query, response }
}

test('台账燃气→烟感→水浸→燃气短时切换只读取三次，同义参数顺序复用结果', async t => {
 const { client, calls, query } = await setup(t)
 const gas = await client.listSafetyHistory(query)
 await client.listSafetyHistory({ ...query, type: 'smoke' })
 await client.listSafetyHistory({ ...query, type: 'water' })
 const returned = await client.listSafetyHistory({ limit: 20, to: query.to, type: 'gas', from: undefined, cursor: null, ignored: '' })
 assert.deepEqual(returned, gas)
 assert.equal(calls.length, 3)
 assert.deepEqual(calls.map(call => new URL(call.url).searchParams.get('type')), ['gas', 'smoke', 'water'])
 assert.ok(calls.every(call => call.method === 'GET' && new URL(call.url).searchParams.get('source') === 'company'))
})

test('日期、分页游标和数量各自隔离；正常未翻完的分页仍可复用', async t => {
 const { client, calls, query } = await setup(t)
 const first = await client.listSafetyHistory(query)
 const pageQuery = { ...query, ...first.window, cursor: first.nextCursor }
 const next = await client.listSafetyHistory(pageQuery)
 assert.notDeepEqual(next.items, first.items)
 await client.listSafetyHistory({ ...query, from: '2026-10-01T00:00:00+08:00' })
 await client.listSafetyHistory({ ...query, to: '2026-10-25T23:59:59.999+08:00' })
 await client.listSafetyHistory({ ...query, limit: 40 })
 assert.deepEqual(await client.listSafetyHistory(query), first)
 assert.deepEqual(await client.listSafetyHistory(pageQuery), next)
 assert.equal(calls.length, 5)
})

test('同一页并发合并且结果互不污染；一分钟到期或强制刷新重新读取', async t => {
 const { client, calls, query } = await setup(t)
 const [first, second] = await Promise.all([client.listSafetyHistory(query), client.listSafetyHistory(query)])
 first.items[0].deviceId = 'local edit'
 assert.equal(second.items[0].deviceId, 'gas')
 assert.equal(calls.length, 1)
 t.mock.timers.tick(59_999)
 assert.deepEqual(await client.listSafetyHistory(query), second)
 assert.equal(calls.length, 1)
 t.mock.timers.tick(1)
 await client.listSafetyHistory(query)
 assert.equal(calls.length, 2)
 await client.listSafetyHistory(query, { force: true })
 assert.equal(calls.length, 3)
})

test('读取失败允许重试；权限拒绝清理此前缓存的其他类型', async t => {
 const { client, calls, query, response } = await setup(t)
 await client.listSafetyHistory(query)
 let status = 503
 globalThis.uni.request = options => {
  calls.push(options)
  queueMicrotask(() => options.success({ statusCode: status, data: status === 200 ? response(options.url) : { code: status === 403 ? 'FORBIDDEN' : 'SAFETY_EVENT_READ_FAILED', message: '读取失败' } }))
 }
 const smoke = { ...query, type: 'smoke' }
 await assert.rejects(client.listSafetyHistory(smoke), error => error.status === 503)
 status = 200
 await client.listSafetyHistory(smoke)
 await client.listSafetyHistory(smoke)
 assert.equal(calls.length, 3)
 status = 403
 await assert.rejects(client.listSafetyHistory({ ...query, type: 'water' }), error => error.status === 403)
 status = 200
 await client.listSafetyHistory(query)
 assert.equal(calls.length, 5)
})

test('换身份重新读取，旧身份迟到响应不能返回或覆盖新身份数据', async t => {
 const { client, calls, query, response } = await setup(t)
 let finishOld
 globalThis.uni.request = options => { calls.push(options); finishOld = () => options.success({ statusCode: 200, data: { ...response(options.url), items: [{ eventId: 'alice' }] } }) }
 const old = client.listSafetyHistory(query)
 const rejected = assert.rejects(old, error => error.code === 'AGENT_READ_INVALIDATED')
 await Promise.resolve()
 globalThis.safetyTestScope = 'bob'
 globalThis.uni.request = options => { calls.push(options); queueMicrotask(() => options.success({ statusCode: 200, data: { ...response(options.url), items: [{ eventId: 'bob' }] } })) }
 const current = await client.listSafetyHistory(query)
 finishOld()
 await rejected
 assert.equal(current.items[0].eventId, 'bob')
 assert.deepEqual(await client.listSafetyHistory(query), current)
 assert.equal(calls.length, 2)
})

test('台账列表复用时，详情与摄像头仍始终实时读取', async t => {
 const { client, calls, query } = await setup(t)
 await client.listSafetyHistory(query)
 await client.listSafetyHistory(query)
 const reference = { eventId: 'event-1', ledger: 'gas', deviceId: 'gas' }
 for (let i = 0; i < 2; i++) { await client.getSafetyEvent(reference); await client.getSafetyEventCameras(reference) }
 assert.equal(calls.filter(call => new URL(call.url).pathname.endsWith('/safety-events')).length, 1)
 assert.equal(calls.length, 5)
})
