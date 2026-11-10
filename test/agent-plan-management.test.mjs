import test from 'node:test'
import assert from 'node:assert/strict'
import * as tasks from '../pages/agent/lib/tasks.mjs'
// plan-management 失败路径会调用 showAgentError 弹 toast；node 环境补一个空实现。
globalThis.uni = { showToast() {} }

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function fixture(overrides = {}) {
  const plan = { planId: 'plan-a', label: '照明', version: 3, status: 'enabled', nextAt: '2026-11-06T08:45:00Z', canPause: true }
  const context = { active: true, source: 'office', scope: 'account-a', key: 'plans', plans: [plan] }
  const writes = [], messages = [], changes = []
  const manager = tasks.createPlanManagement({
    readContext: () => context,
    updatePlan: next => { context.plans = context.plans.map(item => item.planId === next.planId ? next : item) },
    api: {
      setStatus: async (...args) => { writes.push(args); return { plan: { ...plan, version: 4, status: 'paused', nextAt: null } } },
      getPlan: async () => ({ plan }),
      cancelPlan: async (...args) => { writes.push(args); return { status: 'cancelled' } },
      ...overrides.api,
    },
    confirm: overrides.confirm || (async () => true),
    notify: message => messages.push(message),
    changed: () => changes.push(true),
  })
  return { manager, plan, context, writes, messages, changes }
}

test('周期状态以服务端状态与能力为准，未来时间不把已删除或未知状态变成已开启', () => {
  const future = { nextAt: '2026-11-06T08:45:00Z', canPause: true }
  assert.equal(tasks.planPresentation({ ...future, status: 'enabled' }).enabled, true)
  assert.equal(tasks.planPresentation({ ...future, status: 'deleted' }).enabled, false)
  assert.equal(tasks.planPresentation({ ...future, status: 'future_status' }).enabled, false)
  assert.equal(tasks.planPresentation({ status: 'paused', canResume: true }).canToggle, true)
  assert.equal(tasks.planPresentation({ status: 'paused', canResume: false }).canToggle, false)
})


test('暂停后只采用当前版本返回的计划；失效在途响应不污染新页面', async () => {
  const first = fixture()
  await first.manager.toggle(first.plan.planId)
  assert.deepEqual(first.writes, [['plan-a', 3, 'pause', 'office', false]])
  assert.equal(first.context.plans[0].status, 'paused')
  assert.equal(first.manager.state.busy, false)
  assert.equal(first.changes.length, 1)
  const response = deferred()
  const second = fixture({ api: { setStatus: () => response.promise } })
  const pending = second.manager.toggle(second.plan.planId)
  await Promise.resolve()
  second.manager.invalidate()
  second.context.key = 'task-detail'
  response.resolve({ plan: { ...second.plan, status: 'paused', version: 4 } })
  await pending
  assert.equal(second.context.plans[0].status, 'enabled')
  assert.equal(second.changes.length, 0)
})

test('版本冲突采用权威恢复计划并保留错误，不把失败说成暂停成功', async () => {
  const f = fixture({ api: { setStatus: async () => { throw Object.assign(new Error('计划版本已变化'), { data: { recovery: { plan: { planId: 'plan-a', status: 'paused', version: 5 } } } }) } } })
  await f.manager.toggle(f.plan.planId)
  assert.equal(f.context.plans[0].version, 5)
  assert.equal(f.manager.state.error, '计划版本已变化')
  assert.deepEqual(f.changes, [])
  assert.deepEqual(f.messages, [])
})

test('批量暂停保留不可管理计划与逐项失败，身份变更会停止后续操作', async () => {
  const f = fixture({ api: { setStatus: async id => {
    f.writes.push(id)
    if (id === 'plan-b') throw new Error('没有管理权限')
    return { plan: { ...f.plan, status: 'paused', version: 4 } }
  } } })
  f.context.plans.push({ ...f.plan, planId: 'plan-b', label: '会议室' }, { ...f.plan, planId: 'plan-c', canPause: false })
  await f.manager.pauseAll()
  assert.deepEqual(f.writes, ['plan-a', 'plan-b'])
  assert.match(f.manager.state.error, /会议室：没有管理权限/)
  assert.equal(f.context.plans[2].status, 'enabled')
  const g = fixture({ api: { setStatus: async id => { g.writes.push(id); g.context.scope = 'account-b'; return { plan: { ...g.plan, status: 'paused' } } } } })
  g.context.plans.push({ ...g.plan, planId: 'plan-b' })
  await g.manager.pauseAll()
  assert.deepEqual(g.writes, ['plan-a'])
  assert.equal(g.context.plans[0].status, 'enabled')
})

test('单项启停直接提交，连续切换采用当前版本，缺少下次时间不改变已开启状态', async () => {
 let dialogs = 0
 let step = 0
 const replies = [
  { planId: 'plan-a', version: 4, status: 'paused', nextAt: null, canPause: false, canResume: true },
  { planId: 'plan-a', version: 5, status: 'enabled', nextAt: null, canPause: true, canResume: false },
  { planId: 'plan-a', version: 6, status: 'paused', nextAt: null, canPause: false, canResume: true },
 ]
 const f = fixture({
  confirm: async () => { dialogs++; return true },
  api: { setStatus: async (...args) => { f.writes.push(args); return { plan: replies[step++] } } },
 })
 await f.manager.toggle('plan-a')
 assert.equal(f.context.plans[0].status, 'paused')
 await f.manager.toggle('plan-a')
 assert.equal(tasks.planPresentation(f.context.plans[0]).enabled, true)
 assert.equal(tasks.planPresentation(f.context.plans[0]).statusText, '已开启')
 await f.manager.toggle('plan-a')
 assert.deepEqual(f.writes, [
  ['plan-a', 3, 'pause', 'office', false],
  ['plan-a', 4, 'resume', 'office', true],
  ['plan-a', 5, 'pause', 'office', false],
 ])
 assert.equal(f.context.plans[0].version, 6)
 assert.equal(f.context.plans[0].status, 'paused')
 assert.equal(f.manager.state.busy, false)
 assert.equal(dialogs, 0)
})

test('启停失败不改变后端状态，释放忙碌标记后可在同页重试', async () => {
 let fail = true
 const f = fixture({ api: { setStatus: async () => {
  if (fail) { fail = false; throw new Error('连接中断') }
  return { plan: { ...f.plan, version: 4, status: 'paused', canPause: false, canResume: true } }
 } } })
 await f.manager.toggle('plan-a')
 assert.equal(f.context.plans[0].status, 'enabled')
 assert.equal(f.context.plans[0].version, 3)
 assert.equal(f.manager.state.busy, false)
 assert.equal(f.manager.state.error, '连接中断')
 await f.manager.toggle('plan-a')
 assert.equal(f.context.plans[0].status, 'paused')
 assert.equal(f.context.plans[0].version, 4)
 assert.equal(f.manager.state.busy, false)
 assert.equal(f.manager.state.error, '')
})
