import assert from 'node:assert/strict'
import test from 'node:test'
import { createIdleWatchdog } from '../apis/agent/idle-watchdog.mjs'

test('空闲超过阈值触发一次 onTimeout', async () => {
	let fired = 0
	const watchdog = createIdleWatchdog(5, () => fired++)
	await new Promise(resolve => setTimeout(resolve, 20))
	watchdog.stop()
	assert.equal(fired, 1)
})

test('kick 重置计时：持续有分块则不触发', async () => {
	let fired = 0
	const watchdog = createIdleWatchdog(20, () => fired++)
	const beat = setInterval(() => watchdog.kick(), 5)
	await new Promise(resolve => setTimeout(resolve, 50))
	clearInterval(beat)
	watchdog.stop()
	assert.equal(fired, 0)
})

test('stop 后不再触发', async () => {
	let fired = 0
	const watchdog = createIdleWatchdog(5, () => fired++)
	watchdog.stop()
	await new Promise(resolve => setTimeout(resolve, 20))
	assert.equal(fired, 0)
})
