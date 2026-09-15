export function createTurn(id, content) {
	return { id, content, text: '', streaming: false, activities: [], draft: null, result: null, running: true, traceOpen: true, error: '' }
}

export function applyEvent(turn, event) {
	if (event.type === 'tool.started') {
		// 工具调用前的模型评注不属于最终回答，出现工具时收起，等待终稿覆盖。
		if (turn.streaming && turn.text) { turn.text = ''; turn.streaming = false }
		turn.activities.push({ id: `${turn.id}-${turn.activities.length}`, tool: event.tool, label: event.label, status: 'running', summary: '' })
	}
	if (event.type === 'tool.progress') {
		const item = [...turn.activities].reverse().find(activity => activity.tool === event.tool && activity.status === 'running')
		if (item && event.summary) item.summary = event.summary
	}
	if (event.type === 'tool.completed') {
		const item = [...turn.activities].reverse().find(activity => activity.tool === event.tool && activity.status === 'running')
		if (item) Object.assign(item, { status: event.status || 'completed', summary: event.summary || '', label: event.label || item.label, details: event.details })
	}
	if (event.type === 'message.delta') { turn.streaming = true; turn.text += event.content || ''; turn.traceOpen = false }
	if (event.type === 'message.completed') { turn.text = event.content || turn.text; turn.streaming = false }
	if (event.type === 'action.proposed') { turn.streaming = false; turn.draft = { ...event, status: 'PENDING_CONFIRMATION' }; turn.traceOpen = false }
	if (event.type === 'action.resolved' && turn.draft?.draftId === event.draftId) turn.draft.status = event.status
	if (['run.completed', 'run.failed', 'run.awaiting_confirmation'].includes(event.type)) { turn.running = false; turn.streaming = false }
	if (event.type === 'run.failed') turn.error = event.message || '本次回答未完成'
}

export function friendlyError(message) {
	const text = String(message || '')
	if (/request:fail|network|timeout|超时/i.test(text)) return '网络连接中断，本次回答未完成'
	if (/请求处理失败|502|503|504|Service/i.test(text)) return '服务暂时不可用，本次回答未完成'
	if (/会话已过期/.test(text)) return '会话已过期，请清除后重新开始'
	return text || '本次回答未完成'
}

export function restoreTurns(savedTurns = []) {
	const turns = savedTurns.map(saved => {
		const turn = createTurn(saved.id, saved.content)
		for (const event of saved.events || []) applyEvent(turn, event)
		turn.draft = saved.draft || null
		turn.result = saved.result || null
		turn.traceOpen = false
		return turn
	})
	const seen = new Set()
	for (const turn of [...turns].reverse()) {
		if (!turn.draft) continue
		if (seen.has(turn.draft.draftId)) { turn.draft = null; turn.result = null }
		else seen.add(turn.draft.draftId)
	}
	return turns
}

export function operationText(action) {
	const command = action.command || {}
	if (action.kind === 'access') return `开门 ${command.count || 1} 次`
	if (action.kind === 'lighting') return command.closeOrOpen === 1 ? '开启' : '关闭'
	const modes = { auto: '自动', cool: '制冷', heat: '制热', dry: '除湿', fan: '送风' }
	const fans = { low: '低风', middle: '中风', high: '高风' }
	return [command.power === 'on' ? '开启' : command.power === 'off' ? '关闭' : '', modes[command.mode], command.temperature == null ? '' : `${command.temperature}°C`, fans[command.fanSpeed]].filter(Boolean).join(' · ') || '调整参数'
}

export function receiptText(receipt) {
	if (!receipt) return ''
	if (receipt.outcome === 'UNSELECTED') return '未选择'
	if (receipt.attempts) return `${receipt.attempts.filter(item => item.outcome === 'ACCEPTED').length}/${receipt.attempts.length} 次已受理`
	return { ACCEPTED: '指令已受理', REJECTED: '未受理', PARTIALLY_ACCEPTED: '部分受理', ALREADY_SATISFIED: '已达到目标，无需操作' }[receipt.outcome] || '结果待核实'
}
