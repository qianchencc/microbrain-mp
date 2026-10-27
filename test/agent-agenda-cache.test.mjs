import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

let instance = 0
const RANGE = { from: '2026-10-27T00:00:00+08:00', to: '2026-12-28T00:00:00+08:00' }

async function setup(t) {
 const previousUni = globalThis.uni, previousScope = globalThis.agendaTestScope
 globalThis.agendaTestScope = 'alice'
 t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-27T02:00:00Z') })
 const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@/config') return { url: 'data:text/javascript,export default {agentUrl:"https://agent.test/api"}', shortCircuit: true }
  if (specifier === '@/utils/agent-session') return { url: 'data:text/javascript,export const getAgentHeaders=()=>({});export const getAgentStorageScope=()=>globalThis.agendaTestScope', shortCircuit: true }
  return next(specifier, context)
 } })
 t.after(() => { hooks.deregister(); globalThis.uni = previousUni; globalThis.agendaTestScope = previousScope })
 const calls = []
 globalThis.uni = { request(options) {
  calls.push(options)
  const url = new URL(options.url)
  const limit = Number(url.searchParams.get('limit'))
  const data = url.pathname.endsWith('/notifications')
   ? { unreadCount: limit === 1 ? 2 : 7, items: [] }
   : { tasks: [{ taskId: 't1', label: '夜间简报' }] }
  queueMicrotask(() => options.success({ statusCode: 200, data }))
 } }
 const client = await import(new URL(`../apis/agent/index.js?agenda-test=${++instance}`, import.meta.url).href)
 return { client, calls }
}

test('精简与详细共用同一议程快照：切换模式或重挂载不重复读取', async t => {
 const { client, calls } = await setup(t)
 const simple = await client.readAgentAgenda(RANGE)
 assert.equal(calls.length, 1)
 const detailed = await client.readAgentAgenda(RANGE)
 assert.deepEqual(detailed, simple)
 assert.equal(calls.length, 1)
 assert.deepEqual(client.peekAgentAgenda(RANGE), simple)
})

test('一分钟到期才重新读取；手动刷新绕过已完成快照', async t => {
 const { client, calls } = await setup(t)
 await client.readAgentAgenda(RANGE)
 t.mock.timers.tick(59_999)
 await client.readAgentAgenda(RANGE)
 assert.equal(calls.length, 1)
 t.mock.timers.tick(1)
 await client.readAgentAgenda(RANGE)
 assert.equal(calls.length, 2)
 await client.readAgentAgenda({ ...RANGE, force: true })
 assert.equal(calls.length, 3)
})

test('未读数只复用 limit=1 的快照，与明细列表参数各自隔离', async t => {
 const { client, calls } = await setup(t)
 assert.equal((await client.readAgentUnread({ limit: 1 })).unreadCount, 2)
 assert.equal(calls.length, 1)
 assert.equal((await client.readAgentUnread({ limit: 1 })).unreadCount, 2)
 assert.equal(calls.length, 1)
 assert.equal((await client.readAgentUnread({ limit: 30 })).unreadCount, 7)
 assert.equal(calls.length, 2)
 assert.equal(client.peekAgentUnread({ limit: 1 }).unreadCount, 2)
})

test('确认任务后议程快照失效，下一次进入重新读取', async t => {
 const { client, calls } = await setup(t)
 await client.readAgentAgenda(RANGE)
 assert.equal(calls.length, 1)
 await client.confirmTask('task-1', 3, 'company')
 assert.equal(client.peekAgentAgenda(RANGE), null)
 await client.readAgentAgenda(RANGE)
 assert.equal(calls.length, 3)
})

test('换身份不复用旧议程快照', async t => {
 const { client, calls } = await setup(t)
 await client.readAgentAgenda(RANGE)
 globalThis.agendaTestScope = 'bob'
 assert.equal(client.peekAgentAgenda(RANGE), null)
 await client.readAgentAgenda(RANGE)
 assert.equal(calls.length, 2)
})
