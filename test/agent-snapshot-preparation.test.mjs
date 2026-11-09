import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { monthlyEnergyWindows, readMonthlyEnergy } from '../pages/agent/lib/energy.mjs'
import { createReadScope, isReadCancelled } from '../utils/agent-read-scope.mjs'

let instance = 0
// read-preparation 只注册一次 App hide 回调；记录该真实回调供后续用例触发。
let appHideHandler = null
const preparing = { status: 'preparing', message: '数据准备中', cache: { status: 'preparing', refreshing: true, updatedAt: null, retryAfterMs: 1000 } }
const ready = { devices: [{ id: 'sensor-1', reading: { temp: 25 } }], cache: { status: 'fresh', refreshing: false, updatedAt: '2026-11-02T00:00:00Z', retryAfterMs: 1000 } }
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
async function advance(t, ms = 1000) { t.mock.timers.tick(ms); await flush() }
async function setup(t, respond) {
 const id = ++instance, before = { uni: globalThis.uni, pages: globalThis.getCurrentPages, scope: globalThis.snapshotTestScope }
 let pages = [{}]
 globalThis.snapshotTestScope = `alice-${id}`
 globalThis.getCurrentPages = () => pages
 t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.parse('2026-11-02T00:00:00Z') })
 const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@/config') return { url: 'data:text/javascript,export default {agentUrl:"https://agent.test/api"}', shortCircuit: true }
  if (specifier === '@/utils/agent-session') return { url: 'data:text/javascript,export const getAgentHeaders=()=>({});export const getAgentStorageScope=()=>globalThis.snapshotTestScope', shortCircuit: true }
  return next(specifier, context)
 } })
 t.after(() => { hooks.deregister(); globalThis.uni = before.uni; globalThis.getCurrentPages = before.pages; globalThis.snapshotTestScope = before.scope })
 const calls = []
 globalThis.uni = { request(options) {
  calls.push(options)
  const reply = (data, statusCode = 200) => options.success({ statusCode, data })
  respond(options, calls.length, reply)
 }, onAppHide(handler) { appHideHandler = handler } }
 const client = await import(new URL(`../apis/agent/index.js?snapshot-preparation=${id}`, import.meta.url).href)
 return { client, calls, hide: () => { pages = [{}] }, show: () => { pages = [{}] }, hideApp: () => { appHideHandler?.() } }
}

test('冷概览准备中自动重读并交付真实结果，不把准备中作为空成功', async t => {
 const { client, calls } = await setup(t, (_options, count, reply) => reply(count < 3 ? preparing : ready))
 let painted = null
 const result = client.getCompanyDashboard('environment').then(value => { painted = value; return value })
 await flush()
 assert.equal(painted, null)
 assert.equal(calls.length, 1)
 await advance(t)
 assert.equal(calls.length, 2)
 assert.equal(painted, null)
 await advance(t)
 assert.deepEqual(await result, ready)
 assert.deepEqual(painted.devices[0].reading, { temp: 25 })
 await client.getCompanyDashboard('environment')
 assert.equal(calls.length, 3)
})

test('已有结果在准备期间保留，有限准备超时后停止重读', async t => {
 const { client, calls } = await setup(t, (_options, count, reply) => reply(count === 1 ? ready : preparing))
 await client.getCompanyDevices()
 let outcome
 const refresh = client.getCompanyDevices({ force: true }).then(value => { outcome = { value } }, error => { outcome = { error } })
 await flush()
 assert.deepEqual(await client.getCompanyDevices(), ready)
 for (let i = 0; i < 240 && !outcome; i++) await advance(t)
 assert.ok(outcome, '准备请求必须有限终止')
 await refresh
 assert.equal(outcome.error.code, 'AGENT_READ_PREPARING')
 assert.match(outcome.error.message, /准备中/)
 const stopped = calls.length
 await advance(t, 5000)
 assert.equal(calls.length, stopped)
 await advance(t, 25_000)
 const next = client.getCompanyDevices({ isActive: () => false }).catch(error => error)
 assert.equal(isReadCancelled(await next), true)
 assert.equal(calls.length, stopped)
})

test('首次长窗口报表准备超过半分钟后仍自动交付，不要求用户再次刷新', async t => {
 const { client } = await setup(t, (_options, count, reply) => reply(count < 46 ? preparing : ready))
 const result = client.getCompanyMeterReport({ kind: 'statistics', from: '2025-11-01T00:00:00+08:00', to: '2026-11-01T00:00:00+08:00' })
 await flush()
 for (let i = 0; i < 45; i++) await advance(t)
 assert.deepEqual(await result, ready)
})

test('账户503核验中使用1秒退避后自动继续，不当成登录失效', async t => {
 const { client, calls } = await setup(t, (_options, count, reply) => count === 1
  ? reply({ code: 'ACCOUNT_IDENTITY_PREPARING', message: '账户身份核验中，请稍后重试', recovery: '请稍后重试' }, 503)
  : reply(ready))
 const result = client.getCompanyDevices()
 await flush()
 assert.equal(calls.length, 1)
 await advance(t, 999)
 assert.equal(calls.length, 1)
 await advance(t, 1)
 assert.deepEqual(await result, ready)
 assert.equal(calls.length, 2)
})

test('任务读取范围准备中不会伪造空未读数，完成后自动交付后端事实', async t => {
 const expected = { notifications: [{ id: 'notice-existing' }], unreadCount: 1 }
 const { client } = await setup(t, (_options, count, reply) => count === 1
  ? reply({ code: 'TASK_READ_PREPARING', message: '任务读取数据准备中，请稍后重试' }, 503)
  : reply(expected))
 let painted
 const result = client.readAgentNotifications().then(value => { painted = value; return value })
 await flush()
 assert.equal(painted, undefined)
 await advance(t)
 assert.deepEqual(await result, expected)
 assert.equal(painted.unreadCount, 1)
})

test('页面隐藏和组件关闭停止后续准备中请求，不产生无限轮询', async t => {
 const { client, calls, hide } = await setup(t, (_options, _count, reply) => reply(preparing))
 const first = client.getCompanyDevices().catch(error => error)
 await flush(); hide(); await advance(t)
 assert.equal(isReadCancelled(await first), true)
 assert.equal(calls.length, 1)
 let active = true
 const second = client.getEnvironmentHistory({ from: '2026-11-01', to: '2026-11-02' }, { isActive: () => active }).catch(error => error)
 await flush(); active = false; await advance(t)
 assert.equal(isReadCancelled(await second), true)
 await advance(t, 60_000)
 assert.equal(calls.length, 2)
})

test('准备中隐藏后立即重读：新读取继续自动完成，旧任务不写回结果', async t => {
 let oldReply
 const oldValue = { devices: [{ id: 'old-sensor' }], cache: ready.cache }
 const newValue = { devices: [{ id: 'new-sensor' }], cache: ready.cache }
 const { client, calls, hide, show } = await setup(t, (_options, count, reply) => {
  if (count === 1) { reply(preparing); return }
  if (count === 2) { oldReply = reply; return }
  reply(count === 3 ? preparing : newValue)
 })
 const first = client.getCompanyDevices().catch(error => error)
 await flush()
 assert.equal(calls.length, 1)
 await advance(t)
 assert.equal(calls.length, 2)
 hide(); show()
 const second = client.getCompanyDevices()
 await flush()
 assert.equal(calls.length, 3)
 await advance(t)
 assert.deepEqual(await second, newValue)
 oldReply(oldValue)
 assert.equal(isReadCancelled(await first), true)
 assert.deepEqual(await client.getCompanyDevices(), newValue)
 assert.equal(calls.length, 4)
})

test('同一页面对象随 App 隐藏后立即重读：新读取自动继续，旧任务不写回', async t => {
 let oldReply
 const oldValue = { devices: [{ id: 'old-app-sensor' }], cache: ready.cache }
 const newValue = { devices: [{ id: 'new-app-sensor' }], cache: ready.cache }
 const { client, calls, hideApp } = await setup(t, (_options, count, reply) => {
  if (count === 1) { reply(preparing); return }
  if (count === 2) { oldReply = reply; return }
  reply(count === 3 ? preparing : newValue)
 })
 const first = client.getCompanyDevices().catch(error => error)
 await flush()
 assert.equal(calls.length, 1)
 await advance(t)
 assert.equal(calls.length, 2)
 hideApp()
 const second = client.getCompanyDevices()
 await flush()
 assert.equal(calls.length, 3)
 await advance(t)
 assert.deepEqual(await second, newValue)
 oldReply(oldValue)
 assert.equal(isReadCancelled(await first), true)
 assert.deepEqual(await client.getCompanyDevices(), newValue)
 assert.equal(calls.length, 4)
})

test('后端 stale 概览保留数据与时间，下次读取仍询问后端', async t => {
 const stale = { environment: [{ id: 'sensor-1', reading: { temp: 25 } }], errors: [],
  cache: { status: 'stale', refreshing: false, updatedAt: '2026-11-01T08:00:00Z', retryAfterMs: 1000,
   lastError: { code: 'UPSTREAM_TIMEOUT', message: '上游读取超时' } } }
 const { client, calls } = await setup(t, (_options, _count, reply) => reply(stale))
 const first = await client.getCompanyDashboard('environment')
 assert.equal(first.cache.updatedAt, '2026-11-01T08:00:00Z')
 assert.equal(first.cache.lastError.message, '上游读取超时')
 assert.equal(calls.length, 1)
 const second = await client.getCompanyDashboard('environment')
 assert.equal(second.cache.status, 'stale')
 assert.equal(calls.length, 2)
})

test('旧身份迟到结果既不写入新身份，也不清掉新身份已取得的结果', async t => {
 let oldReply
 const newer = { ...ready, devices: [{ id: 'bob-sensor' }] }
 const { client } = await setup(t, (_options, count, reply) => { if (count === 1) oldReply = reply; else reply(newer) })
 const old = client.getCompanyDevices().catch(error => error)
 await flush()
 globalThis.snapshotTestScope = 'bob'
 assert.deepEqual(await client.getCompanyDevices(), newer)
 oldReply(ready)
 assert.ok((await old) instanceof Error)
 assert.deepEqual(await client.getCompanyDevices(), newer)
})

test('不同来源的迟到读取不能覆盖另一来源的快照', async t => {
 let officeReply
 const range = { from: '2026-11-02', to: '2026-11-03' }
 const { client, calls } = await setup(t, (options, _count, reply) => {
  if (new URL(options.url).searchParams.get('source') === 'office') officeReply = reply
  else reply({ tasks: [{ taskId: 'company-task' }] })
 })
 const office = client.readAgentTasks({ source: 'office', ...range })
 await flush()
 await client.readAgentTasks({ source: 'company', ...range })
 officeReply({ tasks: [{ taskId: 'office-task' }] })
 assert.equal((await office).tasks[0].taskId, 'office-task')
 assert.equal(client.peekAgentTasks({ source: 'company', ...range }).tasks[0].taskId, 'company-task')
 assert.equal(calls.length, 2)
})

test('手动刷新只重新询问后端，保留30天查询且不添加上游强刷参数', async t => {
 const { client, calls } = await setup(t, (_options, count, reply) => reply({ days: [{ date: '2026-11-01', usage: count }], cache: ready.cache }))
 await client.getCompanyEnergyDaily({ days: 30 })
 await client.getCompanyEnergyDaily({ days: 30 })
 assert.equal(calls.length, 1)
 assert.equal((await client.getCompanyEnergyDaily({ days: 30 }, { force: true })).days[0].usage, 2)
 assert.equal(calls.length, 2)
 assert.equal(new URL(calls[1].url).search, '?source=company&days=30')
 assert.equal(calls[1].method, 'GET')
})

test('不可用响应不写缓存，400/401/403和网络故障保留错误语义', async t => {
 let failure = null
 const { client, calls } = await setup(t, (options, _count, reply) => {
  if (failure === 'network') options.fail({ errMsg: 'backend offline' })
  else if (failure === 'unavailable') reply({ status: 'unavailable', message: '快照暂不可用', cache: { status: 'unavailable' } })
  else if (failure) reply({ code: failure === 401 ? 'UNAUTHORIZED' : failure === 403 ? 'FORBIDDEN' : 'INVALID_QUERY', message: '原始服务端原因' }, failure)
  else reply(ready)
 })
 await client.getCompanyDevices()
 failure = 'unavailable'
 await assert.rejects(client.getCompanyDevices({ force: true }), error => error.code === 'AGENT_READ_UNAVAILABLE')
 assert.deepEqual(await client.getCompanyDevices(), ready)
 failure = 400
 await assert.rejects(client.getCompanyDevices({ force: true }), error => error.status === 400 && error.message === '原始服务端原因')
 assert.deepEqual(await client.getCompanyDevices(), ready)
 for (const status of [401, 403]) {
  failure = status
  await assert.rejects(client.getCompanyDevices({ force: true }), error => error.status === status && error.message === '原始服务端原因')
  failure = null
  const before = calls.length
  await client.getCompanyDevices()
  assert.equal(calls.length, before + 1)
 }
 failure = 'network'
 await assert.rejects(client.getCompanyDevices({ force: true }), error => error.transport && error.message === 'backend offline')
})

test('普通历史、区域目录、安全详情和候选都在准备中后交付完整后端结果', async t => {
 const reference = { eventId: 'event-1', ledger: 'smoke', deviceId: 'device-1' }
 const cases = [
  ['环境历史', client => client.getEnvironmentHistory({ from: '2026-11-01', to: '2026-11-02' }), { samples: [{ id: 'sample-1' }] }],
  ['电表历史', client => client.getEnergyHistory({ meterId: 'meter-1' }), { days: [{ date: '2026-11-01', usage: 8 }] }],
  ['期间统计', client => client.getCompanyMeterReport({ kind: 'statistics', grain: 'year', from: '2025-01-01', to: '2026-01-01' }), { total: { value: 123, unit: '度' } }],
  ['安全列表', client => client.listSafetyHistory({ type: 'smoke', limit: 20 }), { items: [{ eventId: 'event-1' }] }],
  ['安全详情', client => client.getSafetyEvent(reference), { record: { eventId: 'event-1' } }],
  ['监控候选', client => client.getSafetyEventCameras(reference), { candidates: [{ id: 'camera-1' }] }],
  ['区域目录', client => client.listRegions('directory'), { regions: [{ id: 'region-1' }] }],
  ['区域设备', client => client.listRegionDevices('region-1'), { devices: [{ id: 'device-1' }] }],
  ['区域现态', client => client.listRegionDeviceStates('region-1'), { states: [{ id: 'device-1', online: true }] }],
 ]
 for (const [name, read, expected] of cases) await t.test(name, async t => {
  const { client, calls } = await setup(t, (_options, count, reply) => reply(count === 1 ? preparing : expected))
  const result = read(client)
  await flush()
  assert.equal(calls.length, 1)
  await advance(t)
  assert.deepEqual(await result, expected)
  assert.equal(calls.length, 2)
 })
})

test('同键多个可见消费者合并准备中读取，单个关闭不阻断另一个自动更新', async t => {
 const { client, calls } = await setup(t, (_options, count, reply) => reply(count === 1 ? preparing : ready))
 let active = true
 const first = client.getCompanyDevices({ isActive: () => active }).catch(error => error)
 const second = client.getCompanyDevices({ isActive: () => true })
 await flush(); active = false
 assert.equal(calls.length, 1)
 await advance(t)
 assert.deepEqual(await second, ready)
 assert.equal(isReadCancelled(await first), true)
 assert.equal(calls.length, 2)
})

test('旧身份的迟到401不能清掉新身份已取得的成功快照', async t => {
 let oldReply
 const { client, calls } = await setup(t, (_options, count, reply) => { if (count === 1) oldReply = reply; else reply(ready) })
 const old = client.getCompanyDevices().catch(error => error)
 await flush()
 globalThis.snapshotTestScope = 'new-identity'
 await client.getCompanyDevices()
 oldReply({ code: 'UNAUTHORIZED', message: '旧身份已失效' }, 401)
 assert.equal((await old).status, 401)
 assert.deepEqual(await client.getCompanyDevices(), ready)
 assert.equal(calls.length, 2)
})

test('关闭电表统计再刷新仪表盘，已关闭月度读取的取消不弹登录变化提示', async t => {
 const { client } = await setup(t, (options, _count, reply) => {
  reply(options.url.includes('/company-meter-report') ? preparing : ready)
 })
 const notices = [], published = []
 globalThis.uni.showToast = options => notices.push(options.title)
 let statisticsOpen = true
 const reads = createReadScope({ identity: () => globalThis.snapshotTestScope, active: () => statisticsOpen })
 const reading = reads.run('monthly', options => readMonthlyEnergy(
  monthlyEnergyWindows(new Date()),
  query => client.getCompanyMeterReport(query, options),
  (key, value) => options.publish(() => published.push({ key, value })),
 ), { error: cause => globalThis.uni.showToast({ title: cause.message }) })
 await flush()
 statisticsOpen = false
 client.clearCompanyReadCache()
 const dashboard = await client.getCompanyDashboard('environment', { force: true })
 await advance(t)
 assert.equal((await reading).status, 'cancelled')
 assert.deepEqual(dashboard, ready)
 assert.deepEqual(published, [])
 assert.deepEqual(notices, [], '关闭统计后的旧请求不得向当前仪表盘弹出登录变化提示')
})

test('页面关闭与真实身份变化必须交付不同的终止语义', async t => {
 let reply
 const { client, hide } = await setup(t, (_options, _count, answer) => { reply = answer })
 const closed = client.getCompanyDevices().catch(error => error)
 await flush()
 hide()
 reply(ready)
 assert.equal(isReadCancelled(await closed), true)
 const changed = client.getCompanyDevices().catch(error => error)
 await flush()
 globalThis.snapshotTestScope = 'synthetic-new-identity'
 reply(ready)
 assert.equal((await changed).code, 'AGENT_IDENTITY_CHANGED')
})
