import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { avatarLayers } from '../pages/agent/avatar.js'

// Agent 头像是固定预计算 SVG：body/eyes 分层、不按会话随机、不依赖 blobatar。
const decode = uri => decodeURIComponent(uri.replace('data:image/svg+xml;charset=utf-8,', ''))

test('avatarLayers 返回固定 body/eyes SVG data URI，不随调用变化', () => {
	const first = avatarLayers()
	const second = avatarLayers()
	assert.deepEqual(first, second)
	for (const layer of [first.body, first.eyes]) {
		assert.ok(layer.startsWith('data:image/svg+xml;charset=utf-8,'))
	}
	assert.ok(decode(first.body).includes('#176b54'))
	assert.ok(decode(first.eyes).includes('#e9fff4'))
})

test('AgentAvatar 组件使用分层头像与扫视/眨眼/reduced-motion，不降级为图标方块', () => {
	const source = readFileSync(new URL('../pages/agent/components/AgentAvatar.vue', import.meta.url), 'utf8')
	for (const marker of ['layers.body', 'layers.eyes', 'eyes-pos', 'blink', 'scheduleLook', 'scheduleBlink', 'prefers-reduced-motion']) {
		assert.ok(source.includes(marker), `AgentAvatar.vue 缺少 ${marker}`)
	}
	assert.ok(!source.includes('sparkles.svg'))
})
