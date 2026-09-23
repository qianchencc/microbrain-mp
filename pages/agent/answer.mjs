// 回复正文的轻量渲染：段落 / 无序列表 / 加粗。流式期间前端只展示纯文本，
// 完成后才切换到这里的 rich-text 节点，避免流中反复重排。
// 微信 rich-text 契约：文本叶子必须是 { type: 'text', text }，元素样式只能放 attrs.style。
const paragraphStyle = 'margin:0 0 10px;line-height:1.8;'
const listStyle = 'margin:0 0 10px;padding-left:22px;line-height:1.8;'
const itemStyle = 'margin:4px 0;'

const textNode = text => ({ type: 'text', text })
const elementNode = (name, style, children) => ({
	name,
	...(style ? { attrs: { style } } : {}),
	children,
})

export function renderAnswer(text) {
	const blocks = []
	let list = null
	const closeList = () => {
		if (list) { blocks.push(list); list = null }
	}
	for (const line of String(text || '').split('\n')) {
		const bullet = /^\s*(?:[-*•])\s+(.*)$/.exec(line)
		if (bullet) {
			list ??= elementNode('ul', listStyle, [])
			list.children.push(elementNode('li', itemStyle, inline(bullet[1])))
			continue
		}
		if (!line.trim()) { closeList(); continue }
		closeList()
		blocks.push(elementNode('p', paragraphStyle, inline(line)))
	}
	closeList()
	if (!blocks.length) blocks.push(elementNode('p', paragraphStyle, [textNode(' ')]))
	return blocks
}

function inline(text) {
	const parts = []
	const pattern = /\*\*([^*]+)\*\*/g
	let last = 0
	let match
	while ((match = pattern.exec(text))) {
		if (match.index > last) parts.push(textNode(text.slice(last, match.index)))
		parts.push(elementNode('strong', '', [textNode(match[1])]))
		last = match.index + match[0].length
	}
	if (last < text.length) parts.push(textNode(text.slice(last)))
	return parts.length ? parts : [textNode(text)]
}
