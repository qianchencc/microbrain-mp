// 回复正文的轻量渲染：段落 / 无序列表 / 加粗。流式期间前端只展示纯文本，
// 完成后才切换到这里的 rich-text 节点，避免流中反复重排。
const paragraphStyle = 'margin:0 0 10px;line-height:1.8;'
const listStyle = 'margin:0 0 10px;padding-left:22px;line-height:1.8;'
const itemStyle = 'margin:4px 0;'

export function renderAnswer(text) {
	const blocks = []
	let list = null
	const closeList = () => {
		if (list) { blocks.push(list); list = null }
	}
	for (const line of String(text || '').split('\n')) {
		const bullet = /^\s*(?:[-*•])\s+(.*)$/.exec(line)
		if (bullet) {
			list ??= { name: 'ul', style: listStyle, children: [] }
			list.children.push({ name: 'li', style: itemStyle, children: inline(bullet[1]) })
			continue
		}
		if (!line.trim()) { closeList(); continue }
		closeList()
		blocks.push({ name: 'p', style: paragraphStyle, children: inline(line) })
	}
	closeList()
	if (!blocks.length) blocks.push({ name: 'p', style: paragraphStyle, children: [{ name: '#text', text: ' ' }] })
	return blocks
}

function inline(text) {
	const parts = []
	const pattern = /\*\*([^*]+)\*\*/g
	let last = 0
	let match
	while ((match = pattern.exec(text))) {
		if (match.index > last) parts.push({ name: '#text', text: text.slice(last, match.index) })
		parts.push({ name: 'strong', children: [{ name: '#text', text: match[1] }] })
		last = match.index + match[0].length
	}
	if (last < text.length) parts.push({ name: '#text', text: text.slice(last) })
	return parts.length ? parts : [{ name: '#text', text }]
}
