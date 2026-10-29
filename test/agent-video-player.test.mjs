import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { defaultPlaybackDates, playbackDates, playbackWindowDates } from '../pages/agent/lib/observations.mjs'
import { videoPageUrl } from '../pages/webView/video-query.mjs'

const flush = async () => { for (let n = 0; n < 8; n++) await new Promise(resolve => setImmediate(resolve)) }
const script = await readFile(new URL('../deploy/h5player/player.js', import.meta.url), 'utf8')
function player({ source = 'company', fetch: fetchImpl, play = async () => {}, stop = async () => {}, seek = async () => {}, osd, sdkMissing = false, mode = 'live', beginTime = '2026-10-08T00:00:00+08:00', endTime = '2026-10-08T02:00:00+08:00' } = {}) {
 const elements = new Map(), listeners = new Map(), instances = [], requests = [], states = [], history = []
 const element = id => {
  if (!elements.has(id)) elements.set(id, { style: {}, dataset: {}, innerHTML: '', textContent: '', listeners: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener(name, fn) { this.listeners[name] = fn }, getBoundingClientRect: () => ({ width: 390, height: 700 }) })
  return elements.get(id)
 }
 const window = { addEventListener: (name, fn) => listeners.set(name, fn), wx: { miniProgram: { navigateBack: () => states.push('back') } },
  JSPlugin: class {
   constructor() { this.stops = 0; this.position = Date.parse(beginTime); this.rate = 1; this.controls = []; instances.push(this) }
   JS_SetWindowControlCallback(callbacks) { this.callbacks = callbacks; return Promise.resolve() }
   async JS_Play(url, options, ...args) { this.url = url; this.options = options; this.args = args; await play(url, options, this.callbacks); this.callbacks.firstFrameDisplay(0, 640, 368) }
   JS_Stop() { this.stops++; return stop() }
   async JS_Seek(...args) { this.controls.push(['seek', ...args]); await seek(); this.position = Date.parse(args[1].replace('Z', '+08:00')) }
   async JS_Pause() { this.controls.push(['pause']) }
   async JS_Resume() { this.controls.push(['resume']) }
   async JS_GetOSDTime() { return osd ? osd(this.position) : this.position }
   async JS_Fast() { this.rate *= 2; this.controls.push(['rate', this.rate]); return this.rate < 1 ? -1 / this.rate : this.rate }
   async JS_Slow() { this.rate /= 2; this.controls.push(['rate', this.rate]); return this.rate < 1 ? -1 / this.rate : this.rate }
  } }
 if (sdkMissing) delete window.JSPlugin
 const query = new URLSearchParams({ deviceId: 'camera-1', source, api: 'https://runtime.test/api', token: 'secret', tenantCode: 'XSJ', mode, beginTime, endTime });
 const context = { window, URL, URLSearchParams, AbortController, Promise,
  location: { origin: 'https://customer.test', href: 'https://customer.test/player?' + query, search: '?' + query },
  history: { length: 1, replaceState: (_a, _b, url) => history.push(String(url)) },
  document: { hidden: false, getElementById: element, querySelector: element, addEventListener: (name, fn) => listeners.set(name, fn), createElement: () => ({}), head: { appendChild: script => script.onerror() } },
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  fetch: async (url, init) => { requests.push({ url, init }); return fetchImpl ? fetchImpl(url, init) : { ok: true, json: async () => ({ url: `wss://private.test/${requests.length}`, mode, beginTime, endTime }) } } }
 vm.runInNewContext(script, context)
 return { elements, listeners, instances, requests, states, history, context }
}

test('recording controls pause, preview without seeking, then seek in the same session and change speed', async () => {
 const p = player({ mode: 'playback' }); await flush()
 await p.elements.get('btnPause').listeners.click(); await flush()
 assert.equal(p.elements.get('btnPause').textContent, '继续')
 const range = p.elements.get('playbackSeek'); range.value = '3600'
 range.listeners.input(); await flush()
 assert.equal(p.instances[0].controls.filter(row => row[0] === 'seek').length, 0)
 await range.listeners.change(); await flush()
 assert.deepEqual(p.instances[0].controls.find(row => row[0] === 'seek'), ['seek', 0, '2026-10-08T01:00:00Z', '2026-10-08T02:00:00Z'])
 assert.equal(p.elements.get('btnPause').textContent, '暂停')
 assert.equal(p.requests.length, 1)
 const speed = p.elements.get('playbackSpeed'); speed.value = '4'; await speed.listeners.change(); await flush()
 assert.equal(p.instances[0].rate, 4)
 speed.value = '0.5'; await speed.listeners.change(); await flush()
 assert.equal(p.instances[0].rate, 0.5)
 await p.elements.get('btnMode').listeners.click(); await flush()
 assert.equal(new URL(p.requests.at(-1).url).searchParams.get('mode'), 'live')
 assert.equal(p.instances[0].stops, 1)
 await p.elements.get('btnMode').listeners.click(); await flush()
 assert.equal(new URL(p.requests.at(-1).url).searchParams.get('beginTime'), '2026-10-08T00:00:00+08:00')
})

test('a rejected seek shows a retryable error and does not move the recording position', async () => {
 const p = player({ mode: 'playback', seek: async () => { throw '0x01730ec1' } }); await flush()
 const range = p.elements.get('playbackSeek'); range.value = '3600'
 range.listeners.input(); await range.listeners.change(); await flush()
 assert.equal(p.instances[0].position, Date.parse('2026-10-08T00:00:00+08:00'))
 assert.match(p.elements.get('controlMessage').textContent, /定位失败/)
 assert.equal(p.elements.get('btnPause').disabled, false)
 assert.equal(p.requests.length, 1)
})

test('a late recording time read cannot move the cursor back after seeking', async () => {
 let resolveOld, calls = 0
 const p = player({ mode: 'playback', osd: time => ++calls === 1 ? new Promise(resolve => { resolveOld = resolve }) : Promise.resolve(time) }); await flush()
 const range = p.elements.get('playbackSeek'); range.value = '3600'
 await range.listeners.change(); await flush()
 assert.equal(p.elements.get('playbackTime').textContent, '01:00:00')
 resolveOld(Date.parse('2026-10-08T00:01:00+08:00')); await flush()
 assert.equal(p.elements.get('playbackTime').textContent, '01:00:00')
})

test('shared player retry keeps source and session, fetches a fresh URL and releases each SDK session', async () => {
 for (const source of ['company', 'office']) {
  const p = player({ source }); await flush()
  assert.equal(p.elements.get('footState').textContent, '播放中')
  assert.equal(new URL(p.requests[0].url).searchParams.get('source'), source)
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

test('playback preserves its recording window and uses verified SDK playback arguments, without LIVE labeling', async () => {
 const p = player({ mode: 'playback' }); await flush()
 const query = new URL(p.requests[0].url).searchParams
 assert.equal(query.get('mode'), 'playback')
 assert.equal(query.get('beginTime'), '2026-10-08T00:00:00+08:00')
 assert.equal(p.instances[0].options.mode, 1)
 assert.deepEqual(p.instances[0].args, [0, '2026-10-08T00:00:00Z', '2026-10-08T02:00:00Z'])
 assert.equal(p.elements.get('liveBadge').textContent, '录像')
 assert.equal(p.elements.get('footState').textContent, '录像播放中')
 p.elements.get('btnRelink').listeners.click(); await flush()
 assert.equal(new URL(p.requests[1].url).searchParams.get('endTime'), query.get('endTime'))
 p.instances[1].callbacks.StreamEnd(); await flush()
 assert.equal(p.elements.get('footState').textContent, '回放结束')
 const wrongMode = player({ mode: 'playback', fetch: async () => ({ ok: true, json: async () => ({ url: 'wss://private.test/live', mode: 'live' }) }) }); await flush()
 assert.equal(wrongMode.instances[0].url, undefined)
 assert.match(wrongMode.elements.get('errSub').textContent, /窗口与所选期间不一致/)
})

test('SDK playback uses the verified Shanghai clock marker while API instants and retries stay unchanged', async () => {
 const p = player({ mode: 'playback', beginTime: '2026-10-08T15:45:00Z', endTime: '2026-10-08T16:15:00Z' }); await flush()
 const query = new URL(p.requests[0].url).searchParams
 assert.equal(query.get('beginTime'), '2026-10-08T15:45:00Z')
 assert.equal(query.get('endTime'), '2026-10-08T16:15:00Z')
 assert.deepEqual(p.instances[0].args, [0, '2026-10-08T23:45:00Z', '2026-10-09T00:15:00Z'])
 p.elements.get('btnRetry').listeners.click(); await flush()
 assert.deepEqual(p.instances[1].args, p.instances[0].args)
 assert.equal(new URL(p.requests[1].url).searchParams.get('beginTime'), query.get('beginTime'))
})

test('media server rejection identifies the failed stage and preserves safe diagnostic codes', async () => {
 const p = player({ mode: 'playback', play: async (_url, _options, callbacks) => {
  callbacks.pluginErrorHandler(0, '0x01730ec1', { statusCode: 1, statusString: 'ERROR', subStatusCode: 'server', errorMsg: 'Bearer secret wss://private.test/session' })
  throw '0x01730ec1'
 } }); await flush()
 assert.equal(p.elements.get('errTitle').textContent, '上游录像服务未能开始播放')
 assert.match(p.elements.get('errDetail').textContent, /0x01730ec1/)
 assert.match(p.elements.get('errDetail').textContent, /server/)
 assert.match(p.elements.get('errDetail').textContent, /2026-10-08 00:00/)
 assert.doesNotMatch(p.elements.get('errSub').textContent, /解码失败|没有录像|离线/)
 assert.doesNotMatch(p.elements.get('errDetail').textContent, /secret|wss:|Bearer/)
 p.elements.get('btnBack2').listeners.click(); await flush(); assert.deepEqual(p.states, ['back'])
})

test('fetch, authorization, unavailable recording and SDK decoding failures show different actionable messages', async () => {
 const network = player({ fetch: async () => { throw new TypeError('fetch failed https://private.test?token=secret') } }); await flush()
 assert.equal(network.elements.get('errTitle').textContent, '无法连接取流服务')
 assert.doesNotMatch(network.elements.get('errDetail').textContent, /secret|https:/)
 const expired = player({ fetch: async () => ({ ok: false, status: 401 }) }); await flush()
 assert.equal(expired.elements.get('errTitle').textContent, '会话或设备范围无法核验')
 assert.match(expired.elements.get('errDetail').textContent, /HTTP：401/)
 const empty = player({ mode: 'playback', fetch: async () => ({ ok: false, status: 404, json: async () => ({ code: 'VIDEO_RECORDING_UNAVAILABLE' }) }) }); await flush()
 assert.equal(empty.elements.get('errTitle').textContent, '未取得可播放录像')
 assert.match(empty.elements.get('errSub').textContent, /仍需平台核实/)
 const decoded = player(); await flush()
 decoded.instances[0].callbacks.pluginErrorHandler(0, '0x12f910033', {})
 await flush()
 assert.equal(decoded.elements.get('errTitle').textContent, '播放器无法处理视频流')
 assert.equal(decoded.instances[0].stops, 1)
 decoded.elements.get('btnRetry').listeners.click(); await flush()
 decoded.instances[0].callbacks.pluginErrorHandler(0, '0x01730ec1', { subStatusCode: 'server' }); await flush()
 assert.equal(decoded.elements.get('footState').textContent, '播放中', '旧SDK错误不能覆盖重试后的新画面')
})

test('recording selection spans Shanghai midnight and rejects reversed or overlong windows', () => {
 const review = { beginTime: '2026-10-08T15:45:00Z', endTime: '2026-10-08T16:15:00Z' }
 assert.deepEqual(playbackDates(playbackWindowDates(review)), { beginTime: '2026-10-08T23:45:00+08:00', endTime: '2026-10-09T00:15:00+08:00' })
 const dates = defaultPlaybackDates(Date.parse('2026-10-08T16:10:00Z'))
 assert.deepEqual(dates, { fromDate: '2026-10-08', fromTime: '23:40', toDate: '2026-10-09', toTime: '00:10' })
 assert.deepEqual(playbackDates(dates), { beginTime: '2026-10-08T23:40:00+08:00', endTime: '2026-10-09T00:10:00+08:00' })
 assert.throws(() => playbackDates({ ...dates, toDate: '2026-10-12' }), /最多查看三天/)
 assert.throws(() => playbackDates({ ...dates, toDate: '2026-10-07' }), /结束时间/)
})

test('miniapp WebView handoff preserves decoded plus-offset timestamps and special characters', () => {
 const url = videoPageUrl({ path: 'https://customer.test/player', source: 'company', mode: 'playback', deviceId: 'camera-1', name: '监控A+1&2', api: 'https://runtime.test/api',
  beginTime: '2026-10-08T00:00:00+08:00', endTime: encodeURIComponent('2026-10-08T02:00:00+08:00'), token: 'secret+&%', tenantCode: 'XSJ' })
 const params = new URL(url).searchParams
 assert.equal(params.get('beginTime'), '2026-10-08T00:00:00+08:00')
 assert.equal(params.get('endTime'), '2026-10-08T02:00:00+08:00')
 assert.equal(params.get('token'), 'secret+&%')
 assert.equal(params.get('name'), '监控A+1&2')
 const literal = new URL(videoPageUrl({ path: 'https://customer.test/player', videoTarget: encodeURIComponent(JSON.stringify({ deviceId: 'cam%2F1', name: '监控%2F1' })) })).searchParams
 assert.equal(literal.get('deviceId'), 'cam%2F1')
 assert.equal(literal.get('name'), '监控%2F1')
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
 const unavailable = player({ fetch: async () => ({ ok: false, status: 503, json: async () => ({ code: 'VIDEO_STREAM_UNAVAILABLE' }) }) }); await flush()
 assert.equal(unavailable.elements.get('footState').textContent, '不可用')
 assert.equal(unavailable.elements.get('errTitle').textContent, '视频取流暂不可用')
 assert.doesNotMatch(unavailable.elements.get('errSub').textContent, /摄像头已离线|没有录像/)
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
 let source = await readFile(new URL('../pages/agent/domains/video/video-player.js', import.meta.url), 'utf8')
 const config = 'data:text/javascript,' + encodeURIComponent('export default { videoPlayerUrl:"https://customer.test/player",agentUrl:"https://runtime.test/api" }')
 source = source.replace("'@/config'", JSON.stringify(config))
 const oldUni = globalThis.uni, oldPages = globalThis.getCurrentPages
 let navigation
 globalThis.getCurrentPages = () => [{}]
 globalThis.uni = { navigateTo: options => { navigation = options.url; options.success() }, showToast() {} }
 try {
  const module = await import('data:text/javascript,' + encodeURIComponent(source))
  assert.equal(await module.openVideoPlayer({ deviceId: 'camera-1', name: '监控%2F1 + A&B', source: 'company' }), true)
  assert.ok(navigation.includes('source=company'))
  const options = Object.fromEntries(new URL(navigation, 'https://mini.test').searchParams)
  for (const target of [options.videoTarget, encodeURIComponent(options.videoTarget)]) {
   const query = new URL(videoPageUrl({ ...options, videoTarget: target })).searchParams
   assert.equal(query.get('name'), '监控%2F1 + A&B')
   assert.equal(query.get('deviceId'), 'camera-1')
  }
  assert.equal(new URL(navigation, 'https://mini.test').searchParams.has('url'), false)
 } finally { globalThis.uni = oldUni; globalThis.getCurrentPages = oldPages }
})
