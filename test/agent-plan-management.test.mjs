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

test('取消确认只复位开关；账户或页面变化后旧弹窗不能发送状态修改', async () => {
  const first = fixture({ confirm: async () => false })
  await first.manager.toggle(first.plan, false)
  assert.deepEqual(first.writes, [])
  assert.equal(first.manager.state.revision, 1)
  const modal = deferred()
  const second = fixture({ confirm: () => modal.promise })
  const pending = second.manager.toggle(second.plan, false)
  second.context.scope = 'account-b'
  modal.resolve(true)
  await pending
  assert.deepEqual(second.writes, [])
})

test('暂停后只采用当前版本返回的计划；失效在途响应不污染新页面', async () => {
  const first = fixture()
  await first.manager.toggle(first.plan, false)
  assert.deepEqual(first.writes, [['plan-a', 3, 'pause', 'office', false]])
  assert.equal(first.context.plans[0].status, 'paused')
  assert.equal(first.manager.state.busy, false)
  assert.equal(first.changes.length, 1)
  const response = deferred()
  const second = fixture({ api: { setStatus: () => response.promise } })
  const pending = second.manager.toggle(second.plan, false)
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
  await f.manager.toggle(f.plan, false)
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
