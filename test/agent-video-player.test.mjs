import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const flush = async () => { for (let n = 0; n < 8; n++) await new Promise(resolve => setImmediate(resolve)) }
const script = await readFile(new URL('../deploy/h5player/player.js', import.meta.url), 'utf8')
function player({ source = 'company', fetch: fetchImpl, play = async () => {}, stop = async () => {}, sdkMissing = false } = {}) {
 const elements = new Map(), listeners = new Map(), instances = [], requests = [], states = [], history = []
 const element = id => {
  if (!elements.has(id)) elements.set(id, { style: {}, dataset: {}, innerHTML: '', textContent: '', listeners: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener(name, fn) { this.listeners[name] = fn }, getBoundingClientRect: () => ({ width: 390, height: 700 }) })
  return elements.get(id)
 }
 const window = { addEventListener: (name, fn) => listeners.set(name, fn), wx: { miniProgram: { navigateBack: () => states.push('back') } },
  JSPlugin: class { constructor() { this.stops = 0; instances.push(this) } JS_SetWindowControlCallback(callbacks) { this.callbacks = callbacks; return Promise.resolve() } async JS_Play(url, options) { this.url = url; await play(url, options); this.callbacks.firstFrameDisplay(0, 640, 368) } JS_Stop() { this.stops++; return stop() } } }
 if (sdkMissing) delete window.JSPlugin
 const context = { window, URL, URLSearchParams, AbortController, Promise,
  location: { origin: 'https://customer.test', href: `https://customer.test/player?deviceId=camera-1&source=${source}&api=https%3A%2F%2Fruntime.test%2Fapi&token=secret&tenantCode=XSJ`, search: `?deviceId=camera-1&source=${source}&api=https%3A%2F%2Fruntime.test%2Fapi&token=secret&tenantCode=XSJ` },
  history: { length: 1, replaceState: (_a, _b, url) => history.push(String(url)) },
  document: { hidden: false, getElementById: element, querySelector: element, addEventListener: (name, fn) => listeners.set(name, fn), createElement: () => ({}), head: { appendChild: script => script.onerror() } },
  setTimeout: () => 1, clearTimeout() {},
  fetch: async (url, init) => { requests.push({ url, init }); return fetchImpl ? fetchImpl(url, init) : { ok: true, json: async () => ({ url: `wss://private.test/${requests.length}` }) } } }
 vm.runInNewContext(script, context)
 return { elements, listeners, instances, requests, states, history, context }
}

test('shared player retry keeps source and session, fetches a fresh URL and releases each SDK session', async () => {
 for (const source of ['company', 'office']) {
  const p = player({ source }); await flush()
  assert.equal(p.elements.get('footState').textContent, '播放中')
  assert.ok(p.requests[0].url.endsWith('?source=' + source))
  assert.equal(p.requests[0].init.headers.Tenantcode, 'XSJ')
  assert.equal(p.requests[0].init.headers.Authorization, 'Bearer secret')
  assert.equal(p.history[0].includes('secret'), false)
  p.elements.get('btnRelink').listeners.click(); await flush()
  assert.equal(p.instances[0].stops, 1)
  assert.notEqual(p.instances[0].url, p.instances[1].url)
  p.elements.get('btnBack').listeners.click(); await flush()
  assert.equal(p.instances[1].stops, 1)
  assert.deepEqual(p.states, ['back'])
 }
})

test('return during stream fetch prevents late playback, and failed fetching allows return', async () => {
 let complete
 const p = player({ fetch: () => new Promise(resolve => { complete = resolve }) }); await flush()
 p.elements.get('btnBack').listeners.click()
 complete({ ok: true, json: async () => ({ url: 'wss://private.test/late' }) }); await flush()
 assert.equal(p.requests[0].init.signal.aborted, true)
 assert.equal(p.instances.length, 1)
 assert.equal(p.instances[0].url, undefined)
 assert.equal(p.instances[0].stops, 1)
 const unavailable = player({ fetch: async () => ({ ok: false, status: 503 }) }); await flush()
 assert.equal(unavailable.elements.get('footState').textContent, '不可用')
 assert.match(unavailable.elements.get('errSub').textContent, /不代表摄像头离线/)
 unavailable.elements.get('btnBack2').listeners.click(); await flush(); assert.deepEqual(unavailable.states, ['back'])
})

test('SDK failure cannot request an upstream session; explicit return waits for a successful SDK stop', async () => {
 const missing = player({ sdkMissing: true }); await flush()
 assert.equal(missing.requests.length, 0)
 assert.equal(missing.elements.get('footState').textContent, '不可用')
 let finishStop
 const p = player({ stop: () => new Promise(resolve => { finishStop = resolve }) }); await flush()
 p.elements.get('btnBack').listeners.click(); await flush()
 assert.deepEqual(p.states, [])
 finishStop(); await flush(); assert.deepEqual(p.states, ['back'])
})

test('return during SDK connection releases the late session instead of painting the page', async () => {
 let finish
 const p = player({ play: () => new Promise(resolve => { finish = resolve }) }); await flush()
 p.elements.get('btnBack').listeners.click(); finish(); await flush()
 assert.ok(p.instances[0].stops >= 1)
 assert.notEqual(p.elements.get('footState').textContent, '播放中')
})

test('video navigation carries source and device without waiting for stream fetching', async () => {
 // Resolve uni-app aliases for Node; exercise the exported navigation function.
 let source = await readFile(new URL('../pages/agent/video-player.js', import.meta.url), 'utf8')
 const config = 'data:text/javascript,' + encodeURIComponent('export default { videoPlayerUrl:"https://customer.test/player",agentUrl:"https://runtime.test/api" }')
 const api = 'data:text/javascript,' + encodeURIComponent('export function getVideoStream(){ return new Promise(()=>{}); }')
 source = source.replace("'@/config'", JSON.stringify(config)).replace("'@/apis/agent'", JSON.stringify(api))
 const oldUni = globalThis.uni, oldPages = globalThis.getCurrentPages
 let navigation
 globalThis.getCurrentPages = () => [{}]
 globalThis.uni = { navigateTo: options => { navigation = options.url; options.success() }, showToast() {} }
 try {
  const module = await import('data:text/javascript,' + encodeURIComponent(source))
  assert.equal(await module.openVideoPlayer({ deviceId: 'camera-1', source: 'company' }), true)
  assert.ok(navigation.includes('source=company'))
  assert.equal(new URL(navigation, 'https://mini.test').searchParams.has('url'), false)
 } finally { globalThis.uni = oldUni; globalThis.getCurrentPages = oldPages }
})
