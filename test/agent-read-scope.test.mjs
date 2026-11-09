import test from 'node:test'
import assert from 'node:assert/strict'
import { createReadScope, cancelRead } from '../utils/agent-read-scope.mjs'

const deferred = () => {
 let resolve, reject
 const promise = new Promise((yes, no) => { resolve = yes; reject = no })
 return { promise, resolve, reject }
}
function fixture() {
 const state = { identity: 'synthetic-a', active: true, region: 'region-a', rows: [], error: '', loading: false, notices: [] }
 const reads = createReadScope({ identity: () => state.identity, active: () => state.active, context: () => state.region })
 const load = (job) => reads.run('timeline', () => job.promise, {
  start: () => { state.loading = true },
  data: value => { state.rows = value.rows },
  error: error => { state.error = error.message; state.notices.push(error.message) },
  denied: () => { state.rows = [] },
  finish: () => { state.loading = false },
 })
 return { state, reads, load }
}

test('工作台返回办公室后，旧读取的失败不能通知或改写新页面', async () => {
 const { state, reads, load } = fixture(), old = deferred()
 const work = load(old)
 state.active = false
 reads.invalidate()
 state.rows = [{ id: 'office-current' }]
 state.loading = false
 old.reject(cancelRead('inactive'))
 await work
 assert.deepEqual(state.rows, [{ id: 'office-current' }])
 assert.deepEqual(state.notices, [])
 assert.equal(state.error, '')
 assert.equal(state.loading, false)
})

test('离开再返回后，旧代次不会复活或结束新请求的加载', async () => {
 const { state, reads, load } = fixture(), old = deferred(), fresh = deferred()
 const previous = load(old)
 state.active = false
 reads.invalidate()
 state.active = true
 const current = load(fresh)
 old.resolve({ rows: [{ id: 'old' }] })
 await previous
 assert.deepEqual(state.rows, [])
 assert.equal(state.loading, true)
 fresh.resolve({ rows: [{ id: 'new' }] })
 await current
 assert.deepEqual(state.rows, [{ id: 'new' }])
 assert.equal(state.loading, false)
})

test('切换区域使旧结果失效，不依赖每个回调自行比较区域', async () => {
 const { state, load } = fixture(), job = deferred()
 const work = load(job)
 state.region = 'region-b'
 state.rows = [{ id: 'region-b-device' }]
 job.resolve({ rows: [{ id: 'region-a-device' }] })
 await work
 assert.deepEqual(state.rows, [{ id: 'region-b-device' }])
 assert.deepEqual(state.notices, [])
})

test('隐藏时真实403仍清除保留数据，但旧身份403不能清除新身份', async () => {
 const { state, reads, load } = fixture(), denied = deferred()
 state.rows = [{ id: 'retained' }]
 const work = load(denied)
 state.active = false
 reads.invalidate()
 denied.reject(Object.assign(Error('forbidden'), { status: 403 }))
 await work
 assert.deepEqual(state.rows, [])
 assert.deepEqual(state.notices, [])
 state.active = true
 const old = deferred(), previous = load(old)
 state.identity = 'synthetic-b'
 state.rows = [{ id: 'new-owner' }]
 old.reject(Object.assign(Error('old identity forbidden'), { status: 403 }))
 await previous
 assert.deepEqual(state.rows, [{ id: 'new-owner' }])
})

test('可见期间的真实读取失败保留原因并结束加载，取消不进入错误通道', async () => {
 const { state, load } = fixture(), failed = deferred()
 const work = load(failed)
 failed.reject(Error('后端读取失败'))
 await work
 assert.equal(state.error, '后端读取失败')
 assert.deepEqual(state.notices, ['后端读取失败'])
 assert.equal(state.loading, false)
 const cancelled = deferred(), next = load(cancelled)
 cancelled.reject(cancelRead('superseded'))
 await next
 assert.deepEqual(state.notices, ['后端读取失败'])
})

test('身份变化立即清除已完成读取的保留事实，旧403不能清掉新身份结果', async () => {
 const { state, reads, load } = fixture(), first = deferred()
 const initial = load(first)
 first.resolve({ rows: [{ id: 'owner-a' }] })
 await initial
 const late = deferred(), previous = load(late)
 state.identity = 'synthetic-b'
 reads.identityChanged()
 assert.deepEqual(state.rows, [])
 const fresh = deferred(), current = load(fresh)
 fresh.resolve({ rows: [{ id: 'owner-b' }] })
 await current
 late.reject(Object.assign(Error('old denial'), { status: 403 }))
 await previous
 assert.deepEqual(state.rows, [{ id: 'owner-b' }])
 assert.equal(state.loading, false)
 assert.deepEqual(state.notices, [])
})

test('首次会话准备可以取得身份，不把初始登录当作一次身份切换', async () => {
 const readiness = deferred(), rows = []
 let identity
 const reads = createReadScope({
  identity: () => { if (!identity) throw Error('not ready'); return identity },
  ready: () => readiness.promise,
 })
 const work = reads.run('directory', () => ({ region: 'backend-region' }), {
  data: value => rows.push(value.region),
 })
 identity = 'synthetic-ready'
 reads.identityChanged()
 readiness.resolve()
 assert.equal((await work).status, 'value')
 assert.deepEqual(rows, ['backend-region'])
})

test('异步渲染后续提交仍属于原读取，离开视图后不能触发已读等消费事件', async () => {
 const rendered = deferred(), release = deferred(), events = []
 let active = true, publish
 const reads = createReadScope({ identity: () => 'synthetic-a', active: () => active })
 const work = reads.run('report', options => { publish = options.publish; return { reportId: 'report-a' } }, {
  data: async value => {
   rendered.resolve()
   await release.promise
   publish(() => events.push(value.reportId))
  },
 })
 await rendered.promise
 active = false
 reads.invalidate()
 release.resolve()
 assert.equal((await work).status, 'cancelled')
 assert.deepEqual(events, [])
})

test('同身份切到另一区域后，旧区域403不能清除当前区域结果', async () => {
 const { state, load } = fixture(), old = deferred()
 const work = load(old)
 state.region = 'region-b'
 state.rows = [{ id: 'allowed-region-b' }]
 old.reject(Object.assign(Error('region-a denied'), { status: 403 }))
 await work
 assert.deepEqual(state.rows, [{ id: 'allowed-region-b' }])
 assert.deepEqual(state.notices, [])
})
