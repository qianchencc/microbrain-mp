import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const sourceRoot = fileURLToPath(new URL('../apps/agent-miniapp/pages/agent/', import.meta.url))
const targetRoot = fileURLToPath(new URL('../pages/agent/', import.meta.url))

// 客户入口、Markdown 和下面四个生产适配点保留客户差异；其余共享 Agent
// 运行实现必须从独立回归壳单向同步，不能反向改写独立壳来满足 parity。
const allowedDifferent = new Set([
	'AGENTS.md',
	'avatar.js',
	'components/AssistantMarkdown.vue',
	'components/ActionDraftCard.vue',
	'components/DeviceSheet.vue',
	'conversation.mjs',
	'index.vue',
])
const allowedSourceOnly = new Set([
	'AGENTS.md',
	'markdown.mjs',
	'proto-art/access-sliding-door.png',
	'proto-art/central-ac-cassette.png',
	'proto-art/lighting-grille-luminaire.png',
	'proto-art/lighting-linear-luminaire.png',
	'prototype-action-panel.html',
	'prototype-reply-roster.html',
])
const allowedTargetOnly = new Set(['answer.mjs'])

function files(root, prefix = '') {
	return readdirSync(root).flatMap(name => {
		const path = join(root, name)
		const relative = prefix ? `${prefix}/${name}` : name
		return statSync(path).isDirectory() ? files(path, relative) : [relative]
	}).sort()
}

test('客户版 Agent 共享实现单向跟随原项目基线', () => {
	const sourceFiles = files(sourceRoot)
	const targetFiles = files(targetRoot)
	const sourceOnly = sourceFiles.filter(file => !targetFiles.includes(file))
	const targetOnly = targetFiles.filter(file => !sourceFiles.includes(file))
	assert.deepEqual(sourceOnly.filter(file => !allowedSourceOnly.has(file)), [])
	assert.deepEqual(targetOnly.filter(file => !allowedTargetOnly.has(file)), [])

	const different = sourceFiles.filter(file => targetFiles.includes(file))
		.filter(file => readFileSync(join(sourceRoot, file), 'utf8') !== readFileSync(join(targetRoot, file), 'utf8'))
	assert.deepEqual(different.filter(file => !allowedDifferent.has(file)), [])
})
