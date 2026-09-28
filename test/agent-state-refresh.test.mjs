import test from 'node:test'
import assert from 'node:assert/strict'
import { createStateRefresh } from '../pages/agent/state-refresh.mjs'

test('弹出自动刷新有独立冷却，手动刷新始终可执行', () => {
 const originalNow = Date.now
 let now = 1000, calls = 0
 Date.now = () => now
 try {
  const refresh = createStateRefresh(() => { calls++ }, { autoCooldownMs: 10000 })
  refresh.auto()
  refresh.auto()
  refresh.run()
  assert.equal(calls, 2)
  now += 10000
  refresh.auto()
  assert.equal(calls, 3)
 } finally { Date.now = originalNow }
})
