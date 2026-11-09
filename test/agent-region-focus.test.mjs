import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { cancelRead, createReadScope, isReadCancelled } from '../utils/agent-read-scope.mjs'
// @boundary-private-test-seam: exercise the public region-focus lifecycle without a Vue renderer.

let instance = 0
const DIRECTORY = [{ id: 'r1', name: '26楼运营办公区' }, { id: 'r2', name: '27楼研发区' }]
const never = () => new Promise(() => {})
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

async function setup(t, now = '2026-11-02T04:00:00Z') {
 const priorUni = globalThis.uni, priorFixture = globalThis.regionFocusFixture
 t.mock.timers.enable({ apis: ['Date'], now: Date.parse(now) })
 const storage = new Map(), notices = []
 const fixture = {
  scope: 'alice',
  read: async () => ({ regions: DIRECTORY, cache: { updatedAt: new Date().toISOString() } }),
 }
 globalThis.regionFocusFixture = fixture
 globalThis.uni = {
  showToast: options => notices.push(options.title),
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
 return { fixture, open, seed, notices }
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

test('同一天重新进入时，空目录也接纳后端新增区域', async t => {
 const { fixture, open } = await setup(t)
 fixture.read = async () => ({ regions: [] })
 const first = await open()
 await first.loadRegionFocus()
 await flush()
 assert.deepEqual(names(first), [])
 let complete
 fixture.read = section => section === 'directory'
  ? new Promise(resolve => { complete = resolve })
  : never()
 const reopened = await open()
 await reopened.loadRegionFocus()
 await flush()
 assert.equal(reopened.regionsLoading.value, true)
 assert.equal(typeof complete, 'function')
 complete({ regions: [{ id: 'new-office', name: '示例办公区' }] })
 await flush()
 assert.deepEqual(names(reopened), ['示例办公区'])
 assert.equal(reopened.focusRegionId.value, 'new-office')
 assert.equal(reopened.regionsLoading.value, false)
})

test('同一天刷新完整名单时接纳更名、移除失效选区并保留有效选区', async t => {
 const { fixture, seed } = await setup(t)
 const module = await seed()
 fixture.read = async () => ({ regions: [
  { id: 'r2', name: '更名后的示例办公区' }, { id: 'r3', name: '新增示例区域' },
 ] })
 await module.loadRegionFocus()
 await flush()
 assert.deepEqual(names(module), ['更名后的示例办公区', '新增示例区域'])
 assert.equal(module.focusRegionId.value, 'r2')
 fixture.read = async () => ({ regions: [{ id: 'r3', name: '新增示例区域' }] })
 await module.loadRegionFocus()
 await flush()
 assert.equal(module.focusRegionId.value, 'r3')
 assert.equal(module.selectFocusRegion('r2'), false)
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

test('办公室返回仪表盘后，取消的区域目录读取不能弹登录变化或改写错误状态', async t => {
 const { fixture, open, notices } = await setup(t)
 let reject, officeActive = true
 fixture.read = () => new Promise((_resolve, fail) => { reject = fail })
 const module = await open()
 const loading = module.loadRegionFocus({ isActive: () => officeActive })
 await flush()
 officeActive = false
 reject(cancelRead('inactive'))
 await assert.rejects(loading, isReadCancelled)
 assert.deepEqual(notices, [])
 assert.equal(module.regionsError.value, '')
 assert.equal(module.regionsLoading.value, false)
})

test('离开办公室后的迟到成功不落位，重进仍读取并显示当前目录', async t => {
 const { fixture, open, notices } = await setup(t)
 let complete, officeActive = true
 fixture.read = () => new Promise(resolve => { complete = resolve })
 const module = await open()
 const loading = module.loadRegionFocus({ isActive: () => officeActive })
 await flush()
 officeActive = false
 complete({ regions: [{ id: 'late', name: '退出后才返回的区域' }] })
 await loading
 assert.deepEqual(names(module), [])
 assert.equal(module.focusRegionId.value, '')
 fixture.read = async () => ({ regions: DIRECTORY })
 officeActive = true
 await module.loadRegionFocus({ isActive: () => officeActive })
 assert.deepEqual(names(module), ['26楼运营办公区', '27楼研发区'])
 assert.equal(module.focusRegionId.value, 'r1')
 assert.deepEqual(notices, [])
})

test('隐藏期间收到真实403仍清除区域，但不向仪表盘发出通知', async t => {
 const { fixture, open, seed, notices } = await setup(t)
 const module = await seed()
 t.mock.timers.tick(86400000)
 let reject, officeActive = true
 fixture.read = section => section === 'directory'
  ? new Promise((_resolve, fail) => { reject = fail })
  : never()
 await module.loadRegionFocus({ isActive: () => officeActive })
 await flush()
 officeActive = false
 reject(Object.assign(Error('拒绝访问'), { status: 403 }))
 await flush()
 assert.deepEqual(names(module), [])
 assert.equal(module.focusRegionId.value, '')
 assert.equal(module.regionsError.value, '')
 assert.deepEqual(notices, [])
 fixture.read = never
 const reopened = await open()
 reopened.loadRegionFocus()
 await flush()
 assert.deepEqual(names(reopened), [], '真实撤权后不能恢复持久保存的旧目录')
})

test('共享目录的首个页面关闭不打断仍可见的工作台消费者', async t => {
 const { fixture, open } = await setup(t)
 let complete, requestOptions, officeActive = true, calls = 0
 fixture.read = (section, options) => {
  if (section !== 'directory') return never()
  calls++
  requestOptions = options
  return new Promise(resolve => { complete = resolve })
 }
 const module = await open()
 const office = createReadScope({ identity: () => fixture.scope, active: () => officeActive })
 const workbench = createReadScope({ identity: () => fixture.scope })
 const a = office.run('directory', module.loadRegionFocus)
 await flush()
 const b = workbench.run('directory', module.loadRegionFocus)
 await flush()
 officeActive = false
 office.invalidate()
 assert.equal(requestOptions.isActive(), true)
 complete({ regions: DIRECTORY })
 assert.equal((await a).status, 'cancelled')
 assert.equal((await b).status, 'value')
 assert.deepEqual(names(module), DIRECTORY.map(region => region.name))
 assert.equal(calls, 1)
})

test('目录已交付后，后台attention仍属于可见视图；隐藏后的更新不能落位', async t => {
 const { fixture, open } = await setup(t)
 let complete, active = true
 fixture.read = section => section === 'directory'
  ? Promise.resolve({ regions: DIRECTORY })
  : new Promise(resolve => { complete = resolve })
 const module = await open()
 const reads = createReadScope({ identity: () => fixture.scope, active: () => active })
 await reads.run('directory', module.loadRegionFocus)
 complete({ regions: [{ ...DIRECTORY[0], attention: { unseenCount: 2 } }] })
 await flush()
 assert.equal(module.regions.value[0].attention.unseenCount, 2)
 await reads.run('directory', module.loadRegionFocus)
 active = false
 reads.invalidate()
 complete({ regions: [{ ...DIRECTORY[0], attention: { unseenCount: 99 } }] })
 await flush()
 assert.equal(module.regions.value[0].attention.unseenCount, 2)
})
