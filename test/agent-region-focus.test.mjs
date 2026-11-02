import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
// @boundary-private-test-seam: exercise the public region-focus lifecycle without a Vue renderer.

let instance = 0
const DIRECTORY = [{ id: 'r1', name: '26楼运营办公区' }, { id: 'r2', name: '27楼研发区' }]
const never = () => new Promise(() => {})
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

async function setup(t, now = '2026-11-02T04:00:00Z') {
 const priorUni = globalThis.uni, priorFixture = globalThis.regionFocusFixture
 t.mock.timers.enable({ apis: ['Date'], now: Date.parse(now) })
 const storage = new Map()
 const fixture = {
  scope: 'alice',
  read: async () => ({ regions: DIRECTORY, cache: { updatedAt: new Date().toISOString() } }),
 }
 globalThis.regionFocusFixture = fixture
 globalThis.uni = {
  getStorageSync: key => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
  removeStorageSync: key => storage.delete(key),
 }
 const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'vue') return { shortCircuit: true, url: 'data:text/javascript,export const ref=value=>({value});export const computed=get=>({get value(){return get()}})' }
  if (specifier === '@/apis/agent/observations') return { shortCircuit: true, url: 'data:text/javascript,export const listRegions=(...args)=>globalThis.regionFocusFixture.read(...args);export const markRegionSeen=async()=>{}' }
  if (specifier === '@/utils/agent-session') return { shortCircuit: true, url: 'data:text/javascript,export const getAgentStorageScope=()=>{if(!globalThis.regionFocusFixture.scope)throw Object.assign(Error("session invalid"),{status:401});return globalThis.regionFocusFixture.scope};export const isAgentStorageScope=scope=>scope===globalThis.regionFocusFixture.scope;export const waitForAgentSession=async()=>getAgentStorageScope()' }
  return next(specifier, context)
 } })
 t.after(() => { hooks.deregister(); globalThis.uni = priorUni; globalThis.regionFocusFixture = priorFixture })
 const open = () => import(new URL(`../pages/agent/domains/regions/region-focus.js?region-test=${++instance}`, import.meta.url).href)
 const seed = async () => {
  const module = await open()
  await module.loadRegionFocus()
  module.selectFocusRegion('r2')
  await flush()
  return module
 }
 return { fixture, open, seed }
}
const names = module => module.regions.value.map(region => region.name)

test('重开后已有区域立即可选，不等待后台请求', async t => {
 const { fixture, open, seed } = await setup(t)
 await seed()
 fixture.read = never
 const reopened = await open()
 let ready = false
 reopened.loadRegionFocus().then(() => { ready = true })
 await flush()
 assert.deepEqual(names(reopened), ['26楼运营办公区', '27楼研发区'])
 assert.equal(reopened.focusRegion.value.id, 'r2')
 assert.equal(reopened.regionsLoading.value, false)
 assert.equal(ready, true)
 assert.equal(reopened.selectFocusRegion('r1'), true)
})

test('跨上海日保留可用名称，后台更新后替换目录及失效选区', async t => {
 const { fixture, open, seed } = await setup(t, '2026-11-02T15:59:00Z')
 await seed()
 t.mock.timers.tick(120000)
 let complete
 fixture.read = section => section === 'directory' ? new Promise(resolve => { complete = resolve }) : never()
 const reopened = await open()
 reopened.loadRegionFocus()
 await flush()
 assert.deepEqual(names(reopened), ['26楼运营办公区', '27楼研发区'])
 assert.equal(reopened.regionsLoading.value, false)
 assert.equal(reopened.selectFocusRegion('r2'), true)
 complete({ regions: [{ id: 'r3', name: '新办公区' }], cache: { updatedAt: new Date().toISOString() } })
 await flush()
 assert.deepEqual(names(reopened), ['新办公区'])
 assert.equal(reopened.focusRegion.value.id, 'r3')
 assert.equal(reopened.selectFocusRegion('r2'), false)
})

test('后台目录同步失败不抹掉已有区域', async t => {
 const { fixture, open, seed } = await setup(t)
 await seed()
 t.mock.timers.tick(86400000)
 fixture.read = section => section === 'directory' ? Promise.reject(Error('目录同步失败')) : never()
 const reopened = await open()
 reopened.loadRegionFocus()
 await flush()
 assert.deepEqual(names(reopened), ['26楼运营办公区', '27楼研发区'])
 assert.equal(reopened.selectFocusRegion('r2'), true)
 assert.equal(reopened.regionsError.value, '目录同步失败')
})

test('拒绝访问后清除当前及持久区域，不在重开时恢复', async t => {
 const { fixture, open, seed } = await setup(t)
 await seed()
 fixture.read = async () => { throw Object.assign(Error('拒绝访问'), { status: 403 }) }
 const reopened = await open()
 reopened.loadRegionFocus()
 await flush()
 assert.deepEqual(names(reopened), [])
 assert.equal(reopened.focusRegionId.value, '')
 fixture.read = never
 const again = await open()
 again.loadRegionFocus()
 await flush()
 assert.deepEqual(names(again), [])
 assert.equal(again.regionsLoading.value, true)
})

test('换账号时不展示旧目录，旧身份迟到结果不能回写', async t => {
 const { fixture, open, seed } = await setup(t)
 const module = await seed()
 t.mock.timers.tick(86400000)
 let alice, bob
 fixture.read = section => {
  if (section !== 'directory') return never()
  return new Promise(resolve => { if (fixture.scope === 'alice') alice = resolve; else bob = resolve })
 }
 module.loadRegionFocus()
 await flush()
 fixture.scope = 'bob'
 const pendingBob = module.loadRegionFocus()
 await flush()
 assert.deepEqual(names(module), [])
 alice({ regions: [{ id: 'late', name: '旧账号迟到目录' }] })
 await flush()
 assert.deepEqual(names(module), [])
 bob({ regions: [{ id: 'bob', name: '乙账号区域' }] })
 await pendingBob
 assert.deepEqual(names(module), ['乙账号区域'])
 assert.equal(module.focusRegion.value.id, 'bob')
 fixture.scope = 'alice'
 fixture.read = never
 const restoredAlice = await open()
 restoredAlice.loadRegionFocus()
 await flush()
 assert.deepEqual(names(restoredAlice), ['26楼运营办公区', '27楼研发区'])
})

test('登录失效不能继续显示上一个身份的区域', async t => {
 const { fixture, seed } = await setup(t)
 const module = await seed()
 fixture.scope = ''
 await assert.rejects(module.loadRegionFocus(), /session invalid/)
 assert.deepEqual(names(module), [])
 assert.equal(module.focusRegionId.value, '')
})
