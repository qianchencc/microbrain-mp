import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire, registerHooks } from 'node:module'

// Resolve the existing uni-app Vue runtime through NODE_PATH; no application dependency is added.
let vue
try { vue = createRequire(import.meta.url)('vue') }
catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error }

async function reactiveView(t) {
 const previous = globalThis.viewReadVue
 globalThis.viewReadVue = vue
 const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'vue') return { shortCircuit: true, url: 'data:text/javascript,const v=globalThis.viewReadVue;export const ref=v.ref,inject=v.inject,provide=v.provide,watch=v.watch,onBeforeUnmount=v.onBeforeUnmount' }
  if (specifier === '@dcloudio/uni-app') return { shortCircuit: true, url: 'data:text/javascript,export const onShow=()=>{};export const onHide=()=>{}' }
  if (specifier === '@/utils/agent-session') return { shortCircuit: true, url: 'data:text/javascript,export const getAgentStorageScope=()=>"synthetic-reactive-view";export const waitForAgentSession=async()=>{};export const watchAgentIdentity=()=>()=>{}' }
  return next(specifier, context)
 } })
 const { useViewReads } = await import('../pages/agent/lib/reads.mjs?reactive-view')
 const renderer = vue.createRenderer({
  patchProp() {}, insert(node, parent) { (parent.children ||= []).push(node) }, remove() {},
  createElement: tag => ({ tag, children: [] }), createText: text => ({ text }), createComment: text => ({ text }),
  setText(node, text) { node.text = text }, setElementText(node, text) { node.text = text },
  parentNode: () => null, nodeSibling: () => null,
 })
 let state
 const app = renderer.createApp({ setup() {
  const plan = vue.ref({ planId: 'plan-a', version: 1 }), loading = vue.ref(false)
  const reads = useViewReads(() => true, () => ['company', plan.value.planId])
  state = { plan, loading, read: load => reads.run('plan', load, {
   start: () => { loading.value = true },
   data: value => { plan.value = value },
   finish: () => { loading.value = false },
  }) }
  return () => null
 } })
 app.mount({ children: [] })
 t.after(() => { app.unmount(); hooks.deregister(); globalThis.viewReadVue = previous })
 return state
}

test('组件首次挂载的onShow不作废已开始的初始读取', async t => {
 let resolve
 const fixture = { show: [], hide: [], unmount: [], ready: new Promise(done => { resolve = done }) }
 const previous = globalThis.viewReadFixture
 globalThis.viewReadFixture = fixture
 const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'vue') return { shortCircuit: true, url: 'data:text/javascript,export const ref=value=>({value});export const inject=(_key,fallback)=>fallback;export const provide=()=>{};export const watch=()=>()=>{};export const onBeforeUnmount=hook=>globalThis.viewReadFixture.unmount.push(hook)' }
  if (specifier === '@dcloudio/uni-app') return { shortCircuit: true, url: 'data:text/javascript,export const onShow=hook=>globalThis.viewReadFixture.show.push(hook);export const onHide=hook=>globalThis.viewReadFixture.hide.push(hook)' }
  if (specifier === '@/utils/agent-session') return { shortCircuit: true, url: 'data:text/javascript,export const getAgentStorageScope=()=>"synthetic-view";export const waitForAgentSession=()=>globalThis.viewReadFixture.ready;export const watchAgentIdentity=()=>()=>{}' }
  return next(specifier, context)
 } })
 t.after(() => { hooks.deregister(); globalThis.viewReadFixture = previous })
 const { useViewReads } = await import('../pages/agent/lib/reads.mjs')
 const state = { report: null, loading: false }
 let work
  const reads = useViewReads()
  work = reads.run('report', () => ({ usage: 8 }), {
   start: () => { state.loading = true },
   data: report => { state.report = report },
   finish: () => { state.loading = false },
  })
 t.after(() => fixture.unmount.forEach(unmount => unmount()))
 for (const show of fixture.show) show()
 resolve()
 assert.equal((await work).status, 'value')
 assert.deepEqual(state.report, { usage: 8 })
 assert.equal(state.loading, false)
})

test('同一计划的新响应对象成功落位后结束更新状态', { skip: !vue && '需要通过NODE_PATH提供uni-app现有Vue运行时' }, async t => {
 const view = await reactiveView(t)
 const result = await view.read(async () => ({ planId: 'plan-a', version: 2 }))
 assert.equal(result.status, 'value')
 assert.deepEqual(view.plan.value, { planId: 'plan-a', version: 2 })
 assert.equal(view.loading.value, false)
})

test('真实切换计划后再返回，不发布先前已失效的响应', { skip: !vue && '需要通过NODE_PATH提供uni-app现有Vue运行时' }, async t => {
 const view = await reactiveView(t)
 let resolve, started
 const pending = new Promise(done => { resolve = done })
 const entered = new Promise(done => { started = done })
 const reading = view.read(() => { started(); return pending })
 await entered
 view.plan.value = { planId: 'plan-b', version: 1 }
 view.plan.value = { planId: 'plan-a', version: 4 }
 resolve({ planId: 'plan-a', version: 2 })
 assert.equal((await reading).status, 'cancelled')
 assert.deepEqual(view.plan.value, { planId: 'plan-a', version: 4 })
})
