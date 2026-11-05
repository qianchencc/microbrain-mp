import test from 'node:test'
import assert from 'node:assert/strict'
import { createCompanyOverview } from '../pages/agent/lib/dashboard.mjs'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = async () => { for (let index = 0; index < 20; index++) await Promise.resolve() }
function fixture(overrides = {}) {
  let scope = 'account-a', cached = null, resets = 0
  const writes = []
  const energy = { latestCompleteDay: '2026-11-04', days: [{ date: '2026-11-04', usage: 12, complete: true }] }
  const model = createCompanyOverview({
    identity: () => scope,
    api: { ready: async () => {}, dashboard: async section => ({ devices: [], errors: [], [section]: [] }),
      devices: async () => ({ devices: [{ id: 'device-a', kind: 'energy' }] }),
      energy: async () => energy, peekUnread: () => null, unread: async () => ({ unreadCount: 2 }), ...overrides },
    cache: { read: () => cached, write: value => writes.push(value), clear: () => { cached = null } },
    effects: { reset: () => { resets++ }, tasksChanged() {} },
  })
  return { model, writes, setScope: value => { scope = value }, setCache: value => { cached = value }, resets: () => resets }
}

test('环境、台账和设备就绪即解除首页主加载，慢能耗独立完成', async () => {
  const energy = deferred()
  const { model } = fixture({ energy: () => energy.promise })
  const work = model.show()
  await flush()
  assert.equal(model.state.loading, false)
  assert.equal(model.state.energyLoading, true)
  assert.equal(model.state.devicesLoaded, true)
  assert.deepEqual(model.state.loadedSections.sort(), ['alerts', 'environment'])
  energy.resolve({ days: [{ date: '2026-11-04', usage: 10, complete: true }] })
  await work
  assert.equal(model.state.energyLoading, false)
  assert.equal(model.state.energyStrip[0].usage, 10)
})

test('分区刷新失败保留既有结果和后端时间；其他分区成功不能抹掉失败', async () => {
  let failed = false
  const { model } = fixture({ dashboard: async section => {
    if (failed && section === 'environment') throw new Error('sensor unavailable')
    return { devices: [], errors: [], [section]: [], cache: { status: 'fresh', updatedAt: '2026-11-05T10:00:00Z' } }
  } })
  await model.show()
  failed = true
  await model.load(true)
  assert.equal(model.state.sectionErrors.environment, 'sensor unavailable')
  assert.equal(model.state.sectionCache.environment.updatedAt, '2026-11-05T10:00:00Z')
  assert.equal(model.state.snapshot.errors.find(error => error.area === 'environment').message, 'sensor unavailable')
  assert.equal(model.state.devicesLoaded, true)
})

test('身份变化清除目录、通知和旧缓存，在途旧响应不能进入新概览', async () => {
  const devices = deferred(), unread = deferred()
  const { model, setScope, resets } = fixture({ devices: () => devices.promise, unread: () => unread.promise })
  const work = model.show()
  await flush()
  setScope('account-b')
  model.hide()
  model.identityChanged()
  devices.resolve({ devices: [{ id: 'old-account' }] })
  unread.resolve({ unreadCount: 99 })
  await work
  assert.deepEqual(model.state.catalogDevices, [])
  assert.equal(model.state.simpleUnread, 0)
  assert.equal(model.state.snapshot, null)
  assert.equal(resets(), 1)
})

test('后端 stale 数据只能写成 stale 占位，不能按前端写入时间升级为 fresh', async () => {
  const { model, writes } = fixture({ dashboard: async section => ({ devices: [], errors: [], [section]: [],
    cache: { status: section === 'environment' ? 'stale' : 'fresh', updatedAt: '2026-11-04T10:00:00Z' } }) })
  await model.show()
  assert.equal(writes.at(-1).cache.status, 'stale')
  assert.equal(writes.at(-1).sectionCache.environment.updatedAt, '2026-11-04T10:00:00Z')
})
