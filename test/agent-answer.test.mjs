import test from 'node:test'
import assert from 'node:assert/strict'
import { renderAnswer } from '../pages/agent/answer.mjs'

// 微信 rich-text 节点契约：文本叶子必须是 { type: 'text', text }，元素样式只能放 attrs.style。
function assertRichTextSchema(nodes) {
	const walk = node => {
		if (node.type === 'text') {
			assert.equal(typeof node.text, 'string')
			assert.deepEqual(Object.keys(node).sort(), ['text', 'type'])
			return
		}
		assert.equal(typeof node.name, 'string')
		assert.notEqual(node.name, '#text')
		assert.equal(node.style, undefined, '元素样式必须放在 attrs.style，不允许顶层 style')
		assert.ok(Array.isArray(node.children))
		if (node.attrs) assert.deepEqual(Object.keys(node.attrs), ['style'])
		node.children.forEach(walk)
	}
	nodes.forEach(walk)
}

test('renderAnswer 输出符合微信 rich-text 契约的段落与列表节点', () => {
	const nodes = renderAnswer('拟关闭以下照明设备：\n\n- 26楼东区 · **照明开关-01**\n- 26楼东区 · 照明开关-02\n\n走廊灯已是关闭状态。')
	assertRichTextSchema(nodes)
	assert.deepEqual(nodes.map(node => node.name), ['p', 'ul', 'p'])
	assert.deepEqual(nodes[0].children, [{ type: 'text', text: '拟关闭以下照明设备：' }])
	assert.equal(nodes[1].children.length, 2)
	const firstItem = nodes[1].children[0]
	assert.equal(firstItem.name, 'li')
	assert.deepEqual(firstItem.children[0], { type: 'text', text: '26楼东区 · ' })
	assert.deepEqual(firstItem.children[1], { name: 'strong', children: [{ type: 'text', text: '照明开关-01' }] })
	assert.deepEqual(nodes[2].children, [{ type: 'text', text: '走廊灯已是关闭状态。' }])
})
