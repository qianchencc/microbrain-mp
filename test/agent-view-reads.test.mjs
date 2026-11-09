import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

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
