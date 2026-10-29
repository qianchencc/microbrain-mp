import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { shiftDate, taskListRange } from '../pages/agent/lib/tasks.mjs'
// @boundary-private-test-seam: isolates module-level cache behavior.

let instance = 0
const RANGE = { from: '2026-10-27T00:00:00+08:00', to: '2026-12-28T00:00:00+08:00' }
const TASKS = { tasks: [{ taskId: 't1', label: '夜间简报' }] }

async function setup(t, { hold } = {}) {
 const previousUni = globalThis.uni, previousScope = globalThis.agendaTestScope
 const testInstance = ++instance
 globalThis.agendaTestScope = `alice-${testInstance}`
 t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-27T02:00:00Z') })
 const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@/config') return { url: 'data:text/javascript,export default {agentUrl:"https://agent.test/api"}', shortCircuit: true }
  if (specifier === '@/utils/agent-session') return { url: 'data:text/javascript,export const getAgentHeaders=()=>({});export const getAgentStorageScope=()=>globalThis.agendaTestScope', shortCircuit: true }
  return next(specifier, context)
 } })
 t.after(() => { hooks.deregister(); globalThis.uni = previousUni; globalThis.agendaTestScope = previousScope })
 const calls = [], pending = []
 globalThis.uni = { request(options) {
  calls.push(options)
  const url = new URL(options.url), limit = Number(url.searchParams.get('limit'))
  const data = url.pathname.endsWith('/notifications')
   ? { unreadCount: limit === 1 ? 2 : 7, notifications: [{ id: 'n1' }], nextCursor: '' }
   : url.pathname.endsWith('/task-plans')
    ? { plans: [{ planId: 'p1' }] }
    : TASKS
  const reply = () => options.success({ statusCode: 200, data })
  if (hold?.(options)) { pending.push(reply); return }
  queueMicrotask(reply)
 } }
 // 每个测试必须取得独立的模块级读缓存；生产调用方仍只走 tasks.js 领域入口。
 const client = await import(new URL(`../apis/agent/index.js?agenda-test=${testInstance}`, import.meta.url).href)
 return { client, calls, pending }
}
const reads = calls => calls.filter(call => call.method === 'GET')

test('精简与详细共用同一议程快照：切换模式或重挂载不重复读取', async t => {
 const { client, calls } = await setup(t)
 const simple = await client.readAgentTasks({ source: 'company', ...RANGE })
 assert.equal(calls.length, 1)
 const detailed = await client.readAgentTasks({ source: 'company', ...RANGE })
 assert.deepEqual(detailed, simple)
 assert.equal(calls.length, 1)
 assert.deepEqual(client.peekAgentTasks({ source: 'company', ...RANGE }), simple)
})

test('一分钟到期才重新读取；手动刷新绕过已完成快照', async t => {
 const { client, calls } = await setup(t)
 await client.readAgentTasks({ source: 'company', ...RANGE })
 t.mock.timers.tick(59_999)
 await client.readAgentTasks({ source: 'company', ...RANGE })
 assert.equal(calls.length, 1)
 t.mock.timers.tick(1)
 await client.readAgentTasks({ source: 'company', ...RANGE })
 assert.equal(calls.length, 2)
 await client.readAgentTasks({ source: 'company', ...RANGE, force: true })
 assert.equal(calls.length, 3)
})

test('未读数只复用 limit=1 的快照，与通知列表参数各自隔离', async t => {
 const { client, calls } = await setup(t)
 assert.equal((await client.readAgentNotifications({ source: 'company', limit: 1 })).unreadCount, 2)
 assert.equal(calls.length, 1)
 assert.equal((await client.readAgentNotifications({ source: 'company', limit: 1 })).unreadCount, 2)
 assert.equal(calls.length, 1)
 assert.equal((await client.readAgentNotifications({ source: 'company' })).unreadCount, 7)
 assert.equal(calls.length, 2)
 assert.equal(client.peekAgentNotifications({ source: 'company', limit: 1 }).unreadCount, 2)
})

test('两端任务、周期安排与通知快照按来源和窗口各自隔离', async t => {
 const { client, calls } = await setup(t)
 await client.readAgentTasks({ source: 'office', ...taskListRange('upcoming') })
 await client.readAgentTasks({ source: 'office', ...taskListRange('results') })
 assert.equal(calls.length, 2)
 await client.readAgentTasks({ source: 'office', ...taskListRange('upcoming') })
 assert.equal(calls.length, 2)
 await client.readAgentPlans({ source: 'office' })
 assert.equal(calls.length, 3)
 await client.readAgentNotifications({ source: 'office' })
 assert.equal(client.peekAgentTasks({ source: 'company', ...taskListRange('upcoming') }), null)
 assert.equal(client.peekAgentPlans({ source: 'office' }).plans.length, 1)
 assert.equal(client.peekAgentNotifications({ source: 'office' }).nextCursor, '')
})

test('Company「全部任务」首块与首页 62 天议程同键，预取与打开只读一次', async t => {
 const { client, calls } = await setup(t)
 const today = shiftDate('2026-10-27', 0)
 const dashboard = { from: `${today}T00:00:00+08:00`, to: `${shiftDate(today, 62)}T00:00:00+08:00` }
 await client.readAgentTasks({ source: 'company', ...dashboard })
 await client.readAgentTasks({ source: 'company', ...taskListRange('all', today) })
 assert.deepEqual(taskListRange('all', today), dashboard)
 assert.equal(calls.length, 1)
})

test('确认任务后议程快照失效，下一次进入重新读取', async t => {
 const { client, calls } = await setup(t)
 await client.readAgentTasks({ source: 'company', ...RANGE })
 assert.equal(calls.length, 1)
 await client.confirmTask('task-1', 3, 'company')
 assert.equal(client.peekAgentTasks({ source: 'company', ...RANGE }), null)
 await client.readAgentTasks({ source: 'company', ...RANGE })
 assert.equal(calls.length, 3)
})

test('周期启停只作废周期安排快照，任务与通知快照保留', async t => {
 const { client, calls } = await setup(t)
 await client.readAgentPlans({ source: 'office' })
 await client.readAgentTasks({ source: 'office', ...RANGE })
 await client.readAgentNotifications({ source: 'office', limit: 1 })
 const before = reads(calls).length
 await client.setTaskPlanStatus('p1', 1, 'pause', 'office')
 assert.equal(client.peekAgentPlans({ source: 'office' }), null)
 assert.ok(client.peekAgentTasks({ source: 'office', ...RANGE }))
 assert.ok(client.peekAgentNotifications({ source: 'office', limit: 1 }))
 await client.readAgentPlans({ source: 'office' })
 assert.equal(reads(calls).length, before + 1)
})

test('已读写入作废通知快照：作废前在途的列表读取不回写旧已读状态', async t => {
 const { client, calls, pending } = await setup(t, { hold: options => options.method === 'GET' && options.url.includes('/notifications?') })
 await client.readAgentTasks({ source: 'company', ...RANGE })
 const list = client.readAgentNotifications({ source: 'company' })
 await new Promise(resolve => setTimeout(resolve, 0))
 assert.equal(pending.length, 1)
 await client.markNotificationSeen('n1', 'company')
 pending.shift()()
 assert.equal((await list).unreadCount, 7)
 assert.equal(client.peekAgentNotifications({ source: 'company' }), null)
 assert.ok(client.peekAgentTasks({ source: 'company', ...RANGE }))
 assert.equal(calls.length, 3)
})

test('换身份不复用旧议程快照', async t => {
 const { client, calls } = await setup(t)
 await client.readAgentTasks({ source: 'company', ...RANGE })
 globalThis.agendaTestScope = 'bob'
 assert.equal(client.peekAgentTasks({ source: 'company', ...RANGE }), null)
 await client.readAgentTasks({ source: 'company', ...RANGE })
 assert.equal(calls.length, 2)
})

test('预取后打开任务与通知不产生第二次请求；手动刷新与已读才重读', async t => {
 const { client, calls } = await setup(t)
 // 预取顺序与 AgentConversation.prewarmLists 一致。
 await client.readAgentNotifications({ source: 'office' })
 await client.readAgentTasks({ source: 'office', ...taskListRange('upcoming') })
 await client.readAgentPlans({ source: 'office' })
 assert.equal(calls.length, 3)
 // 打开 Sheet：先 peek 落位，再按同一缓存口径对齐。
 assert.ok(client.peekAgentNotifications({ source: 'office' }))
 assert.ok(client.peekAgentTasks({ source: 'office', ...taskListRange('upcoming') }))
 assert.ok(client.peekAgentPlans({ source: 'office' }))
 await client.readAgentNotifications({ source: 'office' })
 await client.readAgentTasks({ source: 'office', ...taskListRange('upcoming') })
 await client.readAgentPlans({ source: 'office' })
 assert.equal(calls.length, 3)
 await client.readAgentTasks({ source: 'office', ...taskListRange('upcoming'), force: true })
 assert.equal(calls.length, 4)
 await client.markNotificationSeen('n1', 'office')
 await client.readAgentNotifications({ source: 'office' })
 assert.equal(calls.length, 6)
})

test('日历月窗口按身份与月缓存：重复打开不重读，历史月不随时间过期', async t => {
 const { client, calls } = await setup(t)
 const past = { source: 'company', from: '2026-08-31', to: '2026-10-04', historical: true }
 const current = { source: 'company', from: '2026-09-28', to: '2026-11-01' }
 await client.readAgentCalendar(past)
 await client.readAgentCalendar(current)
 assert.equal(calls.length, 2)
 assert.equal(new URL(calls[0].url).searchParams.get('from'), past.from)
 assert.equal(new URL(calls[1].url).searchParams.get('from'), current.from)
 assert.ok(client.peekAgentCalendar(past).tasks.length)
 await client.readAgentCalendar(past)
 await client.readAgentCalendar(current)
 assert.equal(calls.length, 2)
 t.mock.timers.tick(86_400_000)
 await client.readAgentCalendar(past)
 assert.equal(calls.length, 2)
 await client.readAgentCalendar(current)
 assert.equal(calls.length, 3)
})

test('日历打开只刷新今天：不重取整格，也不影响月快照复用', async t => {
 const { client, calls } = await setup(t)
 const grid = { source: 'company', from: '2026-09-28', to: '2026-11-01' }
 const day = { source: 'company', from: '2026-10-27T00:00:00+08:00', to: '2026-10-28T00:00:00+08:00' }
 await client.readAgentCalendar(grid)
 assert.equal(calls.length, 1)
 await client.readAgentCalendarDay({ ...day, force: true })
 assert.equal(calls.length, 2)
 assert.equal(new URL(calls[1].url).searchParams.get('from'), day.from)
 await client.readAgentCalendar(grid)
 assert.equal(calls.length, 2)
 await client.readAgentCalendarDay({ ...day, force: true })
 assert.equal(calls.length, 3)
})

test('任务确认后日历月快照一并失效；历史月同样重读', async t => {
 const { client, calls } = await setup(t)
 const past = { source: 'company', from: '2026-08-31', to: '2026-10-04', historical: true }
 await client.readAgentCalendar(past)
 assert.equal(calls.length, 1)
 await client.confirmTask('task-1', 3, 'company')
 assert.equal(client.peekAgentCalendar(past), null)
 await client.readAgentCalendar(past)
 assert.equal(calls.length, 3)
})
