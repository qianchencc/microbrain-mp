import test from 'node:test'
import assert from 'node:assert/strict'
import { createVoiceInput } from '../pages/agent/voice-input.mjs'

function setup() {
 const results = [], phases = [], errors = []
 let stops = 0, starts = 0
 const manager = { start: () => { starts++ }, stop: () => { stops++ } }
 const voice = createVoiceInput({ getManager: () => manager, onPhase: x => phases.push(x), onResult: x => results.push(x), onError: x => errors.push(x) })
 return { voice, manager, results, phases, errors, stops: () => stops, starts: () => starts }
}
test('voice release before permission/start stops when start arrives and submits only once', () => {
 const s = setup()
 s.voice.start(); s.voice.release(); s.voice.start()
 assert.equal(s.starts(), 1)
 assert.equal(s.stops(), 0)
 s.manager.onStart()
 assert.equal(s.stops(), 1)
 s.manager.onStop({ result: ' 打开会议室灯 ' })
 s.manager.onStop({ result: '重复' })
 assert.deepEqual(s.results, ['打开会议室灯'])
 assert.equal(s.phases.at(-1), 'idle')
})
test('swipe cancellation discards recognition and allows a fresh recording', () => {
 const s = setup()
 s.voice.start(); s.manager.onStart(); s.voice.release(true)
 s.manager.onStop({ result: '取消的内容' })
 assert.deepEqual(s.results, [])
 s.voice.start(); s.manager.onStart(); s.voice.release()
 s.manager.onStop({ result: '查询空调' })
 assert.deepEqual(s.results, ['查询空调'])
})
test('leaving during permission prompt stops delayed recording without sending', () => {
 const s = setup()
 s.voice.start(); s.voice.dispose(); s.manager.onStart()
 assert.equal(s.stops(), 1)
 s.manager.onStop({ result: '不得发送' })
 assert.deepEqual(s.results, [])
})
test('unavailable plugin and empty recognition report useful errors', () => {
 const errors = []
 const voice = createVoiceInput({ getManager: () => { throw new Error('unregistered') }, onPhase: () => {}, onResult: () => assert.fail(), onError: e => errors.push(e) })
 assert.equal(voice.start(), false)
 assert.match(errors[0], /文字输入/)
 const s = setup()
 s.voice.start(); s.manager.onStart(); s.voice.release(); s.manager.onStop({ result: ' ' })
 assert.equal(s.errors.length, 1)
 assert.deepEqual(s.results, [])
})