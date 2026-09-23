import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

// fileURLToPath 解码中文路径；URL.pathname 会留下 %E6%96%B0… 导致 readdir ENOENT。
const sourceRoot = fileURLToPath(new URL('../apps/agent-miniapp/pages/agent/', import.meta.url))
const targetRoot = fileURLToPath(new URL('../pages/agent/', import.meta.url))

// 这些差异不是迁移遗漏：index.vue 只保留客户会话接入点；AssistantMarkdown/answer.mjs
// 是客户版为避免新增 markdown-it 依赖的轻量渲染器；AGENTS.md 记录各自仓库边界。
const allowedDifferent = new Set([
	'AGENTS.md',
	'components/AssistantMarkdown.vue',
	'index.vue',
])
const allowedSourceOnly = new Set([
	'markdown.mjs',
	'proto-art/access-sliding-door.png',
	'proto-art/central-ac-cassette.png',
	'proto-art/lighting-grille-luminaire.png',
	'proto-art/lighting-linear-luminaire.png',
	'prototype-action-panel.html',
	'prototype-reply-roster.html',
])
const allowedTargetOnly = new Set([
	'answer.mjs',
	// 客户侧视频回放跳转探索原型（与基线 prototype-*.html 同类，非共享实现）。
	'proto-playback-jump.html',
])

function files(root, prefix = '') {
	return readdirSync(root).flatMap(name => {
		const path = join(root, name)
		const relative = prefix ? `${prefix}/${name}` : name
		return statSync(path).isDirectory() ? files(path, relative) : [relative]
	}).sort()
}

test('客户版 Agent 与原项目的共享实现保持逐字节一致', () => {
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
