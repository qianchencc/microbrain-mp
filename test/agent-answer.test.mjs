import test from 'node:test'
import assert from 'node:assert/strict'
import { renderAnswer } from '../pages/agent/answer.mjs'

test('renderAnswer 输出段落与无序列表节点，加粗转 strong', () => {
	const nodes = renderAnswer('拟关闭以下照明设备：\n\n- 26楼东区 · **照明开关-01**\n- 26楼东区 · 照明开关-02\n\n走廊灯已是关闭状态。')
	assert.deepEqual(nodes.map(node => node.name), ['p', 'ul', 'p'])
	assert.deepEqual(nodes[0].children.map(node => node.text), ['拟关闭以下照明设备：'])
	assert.equal(nodes[1].children.length, 2)
	assert.equal(nodes[1].children[0].children[0].name, '#text')
	assert.equal(nodes[1].children[0].children[0].text, '26楼东区 · ')
	assert.equal(nodes[1].children[0].children[1].name, 'strong')
	assert.equal(nodes[1].children[0].children[1].children[0].text, '照明开关-01')
	assert.deepEqual(nodes[2].children.map(node => node.text), ['走廊灯已是关闭状态。'])
})

test('renderAnswer 对空文本与未收束列表保持安全', () => {
	assert.equal(renderAnswer('').length, 1)
	assert.equal(renderAnswer('回复：\n- 半截列表项')[1].children.length, 1)
})
