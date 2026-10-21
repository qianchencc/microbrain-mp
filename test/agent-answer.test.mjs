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

test('renderAnswer 把管道表格渲染为 table 节点，缺少分隔行的竖线行保持段落', () => {
	const nodes = renderAnswer('用电对比（22台电表全部有效）：\n\n| 指标 | 9月 | 10月 |\n|---|---|---|\n| 总用电 | 1989.63 度 | **1338.95** 度 |\n| 日均用电 | 66.32 度/日 | 66.95 度/日 |\n\n天数不同，看日均。\n\n设备 A | 设备 B 对照，不是表格')
	assertRichTextSchema(nodes)
	assert.deepEqual(nodes.map(node => node.name), ['p', 'table', 'p', 'p'])
	const table = nodes[1]
	const [thead, tbody] = table.children
	assert.deepEqual(thead.children[0].children.map(cell => cell.name), ['th', 'th', 'th'])
	assert.equal(tbody.children.length, 2)
	const firstBodyCell = tbody.children[0].children[2]
	assert.equal(firstBodyCell.name, 'td')
	assert.deepEqual(firstBodyCell.children[0], { name: 'strong', children: [{ type: 'text', text: '1338.95' }] })
	assert.deepEqual(nodes[3].children, [{ type: 'text', text: '设备 A | 设备 B 对照，不是表格' }])
})
