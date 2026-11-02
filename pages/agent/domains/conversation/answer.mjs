// 回复正文的轻量渲染：段落 / 标题 / 无序与有序列表 / 管道表格 / 加粗 / 行内代码 / 分隔线。
// 流式期间前端只展示纯文本，完成后才切换到这里的 rich-text 节点，避免流中反复重排。
// 微信 rich-text 契约：文本叶子必须是 { type: 'text', text }，元素样式只能放 attrs.style。
import { AGENT_COLORS } from '../../styles/colors.js'

const paragraphStyle = 'margin:0 0 10px;line-height:1.8;'
const headingStyle = 'margin:12px 0 6px;font-weight:650;line-height:1.6;'
const listStyle = 'margin:0 0 10px;padding-left:22px;line-height:1.8;'
const itemStyle = 'margin:4px 0;'
const tableStyle = 'margin:0 0 10px;border-collapse:collapse;font-size:13px;line-height:1.6;'
const headCellStyle = `padding:6px 9px;border:1px solid ${AGENT_COLORS.line};background:${AGENT_COLORS.tint};font-weight:650;text-align:left;`
const cellStyle = `padding:6px 9px;border:1px solid ${AGENT_COLORS.line};vertical-align:top;`
const codeStyle = `padding:1px 5px;border-radius:4px;background:${AGENT_COLORS.tint};font-family:monospace;font-size:.9em;`
const ruleStyle = `margin:12px 0;border:0;border-top:1px solid ${AGENT_COLORS.line};`

const textNode = text => ({ type: 'text', text })
const elementNode = (name, style, children) => ({
	name,
	...(style ? { attrs: { style } } : {}),
	children,
})

const tableDivider = /^\s*\|?[\s:|-]+\|?\s*$/
const tableCells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
const headingLine = /^\s{0,3}#{1,4}\s+(.+)$/
const orderedItem = /^\s*\d+[.)、]\s+(.*)$/
const bulletItem = /^\s*(?:[-*•])\s+(.*)$/
const ruleLine = /^\s{0,3}(?:-{3,}|_{3,}|\*{3,})\s*$/

export function renderAnswer(text) {
	const blocks = []
	let list = null
	const closeList = () => {
		if (list) { blocks.push(list); list = null }
	}
	const lines = String(text || '').split('\n')
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i]
		if (line.includes('|') && i + 1 < lines.length && tableDivider.test(lines[i + 1])) {
			const head = tableCells(line)
			const body = []
			let cursor = i + 2
			while (cursor < lines.length && lines[cursor].includes('|') && lines[cursor].trim()) {
				body.push(tableCells(lines[cursor]))
				cursor += 1
			}
			if (head.length >= 2 && body.length) {
				closeList()
				const width = head.length
				const cells = row => Array.from({ length: width }, (_, index) => row[index] ?? '')
				blocks.push(elementNode('table', tableStyle, [
					elementNode('thead', '', [
						elementNode('tr', '', cells(head).map(cell => elementNode('th', headCellStyle, inline(cell)))),
					]),
					elementNode('tbody', '', body.map(row => elementNode('tr', '', cells(row).map(cell => elementNode('td', cellStyle, inline(cell)))))),
				]))
				i = cursor - 1
				continue
			}
		}
		const bullet = bulletItem.exec(line)
		const ordered = bullet ? null : orderedItem.exec(line)
		if (bullet || ordered) {
			const kind = ordered ? 'ol' : 'ul'
			if (list && list.name !== kind) closeList()
			list ??= elementNode(kind, listStyle, [])
			list.children.push(elementNode('li', itemStyle, inline((bullet || ordered)[1])))
			continue
		}
		if (!line.trim()) { closeList(); continue }
		closeList()
		const heading = headingLine.exec(line)
		if (heading) { blocks.push(elementNode('p', headingStyle, inline(heading[1]))); continue }
		if (ruleLine.test(line)) { blocks.push(elementNode('hr', ruleStyle, [])); continue }
		blocks.push(elementNode('p', paragraphStyle, inline(line)))
	}
	closeList()
	if (!blocks.length) blocks.push(elementNode('p', paragraphStyle, [textNode(' ')]))
	return blocks
}

function inline(text) {
	const parts = []
	const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g
	let last = 0
	let match
	while ((match = pattern.exec(text))) {
		if (match.index > last) parts.push(textNode(text.slice(last, match.index)))
		if (match[1] !== undefined) parts.push(elementNode('strong', '', [textNode(match[1])]))
		else parts.push(elementNode('code', codeStyle, [textNode(match[2])]))
		last = match.index + match[0].length
	}
	if (last < text.length) parts.push(textNode(text.slice(last)))
	return parts.length ? parts : [textNode(text)]
}
