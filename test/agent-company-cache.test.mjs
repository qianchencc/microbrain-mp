import test from 'node:test'
import assert from 'node:assert/strict'
import { createAgentReadCache } from '../apis/agent/agent-read-cache.mjs'
import { isReadCancelled } from '../utils/agent-read-scope.mjs'
// @boundary-private-test-seam: tests the cache adapter contract directly.

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function setup() {
 let owner = 'alice', time = 0, calls = 0
 const cache = createAgentReadCache(() => owner, () => time)
 const load = async () => ({ count: ++calls, rows: [] })
 return { cache, load, calls: () => calls, owner: value => { owner = value }, time: value => { time = value } }
}
test('重进复用一分钟内成功结果；过期或手动刷新才重新读取', async () => {
 const f = setup()
 const first = await f.cache.read('daily', f.load)
 first.rows.push('local edit')
 f.time(59_999)
 assert.deepEqual(await f.cache.read('daily', f.load), { count: 1, rows: [] })
 assert.equal(f.calls(), 1)
 f.time(60_000)
 assert.equal((await f.cache.read('daily', f.load)).count, 2)
 assert.equal((await f.cache.read('daily', f.load, true)).count, 3)
})
test('首页和抽屉同时读取同一窗口，只发送一次在途请求', async () => {
 const f = setup(), job = deferred(); let calls = 0
 const load = () => { calls++; return job.promise }
 const a = f.cache.read('daily', load), b = f.cache.read('daily', load)
 await Promise.resolve(); assert.equal(calls, 1)
 job.resolve({ value: 7 })
 assert.deepEqual(await a, { value: 7 }); assert.deepEqual(await b, { value: 7 })
})
test('失败不当成缓存成功；下一次进入允许重试', async () => {
 const f = setup()
 await assert.rejects(f.cache.read('daily', async () => { throw new Error('offline') }), /offline/)
 assert.equal((await f.cache.read('daily', f.load)).count, 1)
})
test('换身份不复用旧数据；旧请求迟到不能写进新身份缓存', async () => {
 const f = setup(), old = deferred()
 const a = f.cache.read('daily', () => old.promise)
 f.owner('bob')
 assert.equal((await f.cache.read('daily', f.load)).count, 1)
 old.resolve({ count: 99 })
 await assert.rejects(a, /身份|失效/)
 assert.equal((await f.cache.read('daily', f.load)).count, 1)
})
test('刷新或控制后的清理阻止旧请求复活；新请求可正常复用', async () => {
 const f = setup(), old = deferred()
 const a = f.cache.read('daily', () => old.promise)
 f.cache.clear()
 const b = await f.cache.read('daily', f.load)
 old.resolve({ count: 99 })
 await assert.rejects(a, isReadCancelled)
 assert.deepEqual(await f.cache.read('daily', f.load), b)
})
test('拒绝授权清理整组缓存；不能继续展示同组其他成功结果', async () => {
 const f = setup()
 await f.cache.read('daily', f.load)
 await assert.rejects(f.cache.read('monthly', async () => { throw Object.assign(new Error('forbidden'), { status: 403 }) }), /forbidden/)
 assert.equal(f.cache.peek('daily'), null)
})
test('概览快照跨页面复用，过期只作短时占位，不能无限保留或跨身份展示', () => {
 const f = setup()
 f.cache.put('snapshot', { devices: 43 })
 f.time(60_001)
 assert.equal(f.cache.peek('snapshot').fresh, false)
 assert.deepEqual(f.cache.peek('snapshot').value, { devices: 43 })
 f.owner('bob'); assert.equal(f.cache.peek('snapshot'), null)
 f.cache.put('snapshot', { devices: 7 }); f.time(360_002)
 assert.equal(f.cache.peek('snapshot'), null)
})

test('截断或部分失败的业务结果不能抑制下一次读取', async () => {
 const f = setup(); let calls = 0
 for (const value of [{ truncated: true }, { coverage: { truncated: true } }, { errors: [{ message: 'partial' }] }]) {
  await f.cache.read('daily', async () => { calls++; return value })
  assert.equal(f.cache.peek('daily'), null)
 }
 await f.cache.read('daily', async () => { calls++; return { truncated: false } })
 await f.cache.read('daily', f.load)
 assert.equal(calls, 4)
 assert.equal(f.calls(), 0)
})
test('历史窗口逐渐增多时缓存数量有界，最早一项会重新读取', async () => {
 const f = setup()
 for (let i = 0; i < 41; i++) await f.cache.read('window-' + i, f.load)
 assert.equal(f.cache.peek('window-0'), null)
 assert.ok(f.cache.peek('window-40'))
})

test('定点失效取消旧消费者，不能删除更新的成功快照', async () => {
 const f = setup(), pending = deferred()
 const old = f.cache.read('daily', () => pending.promise)
 await Promise.resolve()
 f.cache.drop('daily')
 await f.cache.read('daily', async () => ({ value: 'new' }))
 pending.resolve({ value: 'old' })
 await assert.rejects(old, isReadCancelled)
 assert.deepEqual(f.cache.peek('daily').value, { value: 'new' })
})

test('准备中和不可用不能覆盖既有完整结果或延长有效期', async () => {
 const f = setup()
 await f.cache.read('daily', f.load)
 f.time(30_000)
 await f.cache.read('daily', async () => ({ status: 'preparing' }), { force: true })
 await f.cache.read('daily', async () => ({ cache: { status: 'unavailable' } }), { force: true })
 assert.deepEqual(f.cache.peek('daily').value, { count: 1, rows: [] })
 f.time(60_000)
 assert.equal(f.cache.peek('daily').fresh, false)
})

test('后端 stale 结果只作占位：保留数据与原始时间，下次读取重新询问后端', async () => {
 const f = setup()
 const stale = { rows: [{ id: 'row-1' }], cache: { status: 'stale', refreshing: false, updatedAt: '2026-11-01T08:00:00Z', lastError: { code: 'UPSTREAM_TIMEOUT', message: '上游读取超时' } } }
 let backendReads = 0
 const first = await f.cache.read('daily-stale', async () => { backendReads++; return stale })
 assert.deepEqual(first, stale)
 const placeholder = f.cache.peek('daily-stale')
 assert.equal(placeholder.fresh, false)
 assert.deepEqual(placeholder.value.rows, [{ id: 'row-1' }])
 assert.equal(placeholder.value.cache.updatedAt, '2026-11-01T08:00:00Z')
 assert.equal(placeholder.value.cache.lastError.message, '上游读取超时')
 f.time(1_000)
 await f.cache.read('daily-stale', f.load)
 assert.equal(backendReads, 1)
 assert.equal(f.calls(), 1)
})

test('活动周期切换后新读取不并入失活任务，旧结果不写回新快照', async () => {
 const f = setup(), held = deferred()
 let active = true
 const old = f.cache.read('daily-activity', () => held.promise, { isActive: () => active })
 await Promise.resolve()
 active = false
 const fresh = f.cache.read('daily-activity', async () => ({ count: 7 }), { isActive: () => true })
 assert.deepEqual(await fresh, { count: 7 })
 held.resolve({ count: 99 })
 await assert.rejects(old, isReadCancelled)
 assert.deepEqual(f.cache.peek('daily-activity').value, { count: 7 })
 assert.equal(f.cache.peek('daily-activity').fresh, true)
})
