import { fieldLabels } from './ac-draft.js'

export function createTurn(id, content) {
	return { id, serverId: id.startsWith('local-') ? '' : id, content, text: '', streaming: false, activities: [], draft: null, task: null, roster: null, result: null, running: true, traceOpen: true, error: '', startedAt: Date.now(), seconds: 0 }
}

export function canRecoverTurn(turn, isLatest) {
	// 纯问答轮（无草案无结果）无论成败都可原位改写；未达服务端的失败轮（serverId 为空，
	// 服务端没有可退役的条目）同样可改写；带设备操作事实的轮次保持只读。
	return Boolean(isLatest && !turn.running && !turn.draft && !turn.task && !turn.result)
}

export function restartTurn(turn, content = turn.content) {
	Object.assign(turn, {
		content,
		text: '',
		activities: [],
		draft: null,
		task: null,
		roster: null,
		result: null,
		running: true,
		traceOpen: true,
		error: '',
		startedAt: Date.now(),
		seconds: 0,
		serverId: '',
	})
}

export function applyEvent(turn, event) {
	if (event.type === 'run.started' && event.focusRegion) turn.focusRegion = event.focusRegion
	if (event.type === 'run.started' && event.turnId) turn.serverId = event.turnId
	if (event.type === 'tool.started') {
		if (turn.streaming && turn.text) { turn.text = ''; turn.streaming = false }
		const previous = turn.activities.at(-1)
		if (event.tool === 'find_device_candidates' && previous?.tool === event.tool && previous.status === 'searching') {
			previous.attempts = (previous.attempts || 1) + 1
			previous.invocationIds = [...(previous.invocationIds || []), event.invocationId].filter(Boolean)
			return
		}
		turn.activities.push({ id: `${turn.id}-${turn.activities.length}`, tool: event.tool, invocationId: event.invocationId, label: event.label, status: 'running', summary: '' })
	}
	if (event.type === 'tool.completed') {
		const item = [...turn.activities].reverse().find(activity => activity.tool === event.tool && ['running', 'searching'].includes(activity.status))
		if (item) {
			const count = event.details?.count
			if (event.tool === 'find_device_candidates' && count === 0) {
				Object.assign(item, { status: 'searching', summary: '正在调整检索范围…', label: event.label || item.label, details: event.details })
			} else {
				Object.assign(item, { status: event.status || 'completed', summary: event.summary || '', label: event.label || item.label, details: event.details })
			}
		}
	}
	if (event.type === 'tool.progress') {
		const item = [...turn.activities].reverse().find(activity => activity.tool === event.tool && ['running', 'searching'].includes(activity.status))
		if (item) Object.assign(item, { status: event.tool === 'find_device_candidates' ? 'searching' : item.status, summary: event.summary || item.summary })
	}
	if (event.type === 'message.delta') { turn.streaming = true; turn.text += event.content || ''; turn.traceOpen = false }
	if (event.type === 'message.completed') { turn.text = event.content || turn.text; turn.streaming = false }
	if (event.type === 'action.proposed') { turn.draft = { ...event, status: 'PENDING_CONFIRMATION' }; turn.roster = event.inventory || null; turn.traceOpen = false }
	if (event.type === 'action.resolved' && turn.draft?.draftId === event.draftId) turn.draft.status = event.status
	if (event.type === 'task.proposed') { turn.task = event.task; turn.traceOpen = false }
	if (event.type === 'task.resolved' && turn.task?.taskId === event.taskId) turn.task.status = event.status
	if (event.type === 'task.cancellation.proposed') { turn.task = event.task; turn.traceOpen = false }
	if (event.type === 'task.cancellation.resolved' && turn.task?.cancellationId === event.cancellationId) turn.task.status = event.status
	if (['run.completed', 'run.failed', 'run.aborted', 'run.awaiting_confirmation'].includes(event.type)) { turn.running = false; turn.streaming = false; turn.seconds = Math.max(1, Math.round((Date.now() - turn.startedAt) / 1000)) }
	if (event.type === 'run.failed') {
		turn.error = event.message || '本次回答未完成'
		for (const item of turn.activities) if (item.status === 'running') item.status = 'failed'
	}
	if (event.type === 'run.aborted') {
		turn.error = event.message || '本次回答已停止'
		for (const item of turn.activities) if (['running', 'searching'].includes(item.status)) item.status = 'skipped'
	}
}

export function friendlyError(message) {
	const text = String(message || '')
	if (/request:fail|network|timeout|超时/i.test(text)) return '网络连接中断，本次回答未完成'
	if (/请求处理失败|502|503|504|Service/i.test(text)) return '服务暂时不可用，本次回答未完成'
	if (/会话已过期|客户登录已失效/i.test(text)) return '会话已过期，请重新登录'
	return text || '本次回答未完成'
}

export function restoreTurns(savedTurns = []) {
	const turns = savedTurns.map(saved => {
		const turn = createTurn(saved.id, saved.content)
		for (const event of saved.events || []) applyEvent(turn, event)
		turn.draft = saved.draft || null
		turn.task = saved.task || turn.task
		turn.result = saved.result || null
		turn.traceOpen = false
		const started = Date.parse(saved.startedAt || saved.events?.find(event => event.type === 'run.started')?.createdAt)
		const finished = Date.parse(saved.events?.find(event => ['run.completed', 'run.failed', 'run.aborted', 'run.awaiting_confirmation'].includes(event.type))?.timestamp)
		turn.seconds = Number.isFinite(started) && Number.isFinite(finished) && finished >= started ? Math.max(1, Math.round((finished - started) / 1000)) : 0
		return turn
	})
	const seen = new Set()
	for (const turn of [...turns].reverse()) {
		if (!turn.draft) continue
		if (seen.has(turn.draft.draftId)) { turn.draft = null; turn.result = null }
		else seen.add(turn.draft.draftId)
	}
	const taskIds = new Set()
	for (const turn of [...turns].reverse()) {
		if (!turn.task) continue
		const key = turn.task.cancellationId || turn.task.taskId
		if (taskIds.has(key)) turn.task = null
		else taskIds.add(key)
	}
	return turns
}

export function operationText(action) {
	const command = action.command || {}
	if (action.kind === 'access') return '开门一次'
	if (action.kind === 'lighting') return command.closeOrOpen === 1 ? '开启' : '关闭'
	const modes = { auto: '自动', cool: '制冷', heat: '制热', dry: '除湿', fan: '送风' }
	const fans = { low: '低风', middle: '中风', high: '高风' }
	return [command.power === 'on' ? '开启' : command.power === 'off' ? '关闭' : '', modes[command.mode], command.temperature == null ? '' : `${command.temperature}°C`, fans[command.fanSpeed]].filter(Boolean).join(' · ') || '调整参数'
}

export function receiptText(receipt) {
	if (!receipt) return ''
	if (receipt.outcome === 'UNSELECTED') return '未选择'
	if (receipt.attempts) return `${receipt.attempts.filter(item => item.outcome === 'ACCEPTED').length}/${receipt.attempts.length} 次已受理`
	const rejected = receipt.fields?.filter(field => field.outcome === 'REJECTED').map(field => fieldLabels[field.field] || field.field)
	if (rejected?.length) return `未受理：${rejected.join('、')}`
	return { ACCEPTED: '指令已受理', REJECTED: '未受理', PARTIALLY_ACCEPTED: '部分受理', ALREADY_SATISFIED: '已达到目标，无需操作', DISPATCHED_UNKNOWN: '已下发，待核实', NOT_DISPATCHED: '未执行' }[receipt.outcome] || '结果待核实'
}
