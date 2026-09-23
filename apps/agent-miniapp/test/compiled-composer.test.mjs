import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const dist = new URL('../unpackage/dist/build/mp-weixin/pages/agent/', import.meta.url)

test('输入栏走键盘停靠而非整页上推：adjust-position 关闭、组件级键盘事件上报', async () => {
	const [composerWxml, indexWxml, indexWxss] = await Promise.all([
		readFile(new URL('components/AgentComposer.wxml', dist), 'utf8'),
		readFile(new URL('index.wxml', dist), 'utf8'),
		readFile(new URL('index.wxss', dist), 'utf8'),
	])
	assert.match(composerWxml, /adjust-position="\{\{false\}\}"/)
	assert.match(composerWxml, /bindkeyboardheightchange=/)
	assert.doesNotMatch(composerWxml, /cursor-spacing|adjust-keyboard-to/)
	assert.match(indexWxml, /composer-shell[^>]*style=/)
	assert.match(indexWxss, /\.composer-shell[^}]*transition:padding-bottom/)
})

test('消息编辑收编进主输入框：composer 有编辑上下文条，气泡内不再挂第二个 textarea', async () => {
	const [composerWxml, userWxml] = await Promise.all([
		readFile(new URL('components/AgentComposer.wxml', dist), 'utf8'),
		readFile(new URL('components/UserMessage.wxml', dist), 'utf8'),
	])
	assert.match(composerWxml, /edit-strip/)
	assert.doesNotMatch(userWxml, /<textarea|user-editor/)
})
