import { fieldLabels } from './ac-draft.js'

export function createTurn(id, content) {
	return { id, content, text: '', activities: [], draft: null, result: null, running: true, traceOpen: true, error: '', startedAt: Date.now(), seconds: 0 }
}

export function applyEvent(turn, event) {
	if (event.type === 'tool.started') {
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
	if (event.type === 'message.delta') { turn.text += event.content || ''; turn.traceOpen = false }
	if (event.type === 'action.proposed') { turn.draft = { ...event, status: 'PENDING_CONFIRMATION' }; turn.traceOpen = false }
	if (event.type === 'action.resolved' && turn.draft?.draftId === event.draftId) turn.draft.status = event.status
	if (['run.completed', 'run.failed', 'run.awaiting_confirmation'].includes(event.type)) { turn.running = false; turn.seconds = Math.max(1, Math.round((Date.now() - turn.startedAt) / 1000)) }
	if (event.type === 'run.failed') {
		turn.error = event.message || '本次回答未完成'
		for (const item of turn.activities) if (item.status === 'running') item.status = 'failed'
	}
}

export function restoreTurns(savedTurns = []) {
	const turns = savedTurns.map(saved => {
		const turn = createTurn(saved.id, saved.content)
		for (const event of saved.events || []) applyEvent(turn, event)
		turn.draft = saved.draft || null
		turn.result = saved.result || null
		turn.traceOpen = false
		const started = Date.parse(saved.startedAt || saved.events?.find(event => event.type === 'run.started')?.createdAt)
		const finished = Date.parse(saved.events?.find(event => ['run.completed', 'run.failed', 'run.awaiting_confirmation'].includes(event.type))?.timestamp)
		turn.seconds = Number.isFinite(started) && Number.isFinite(finished) && finished >= started ? Math.max(1, Math.round((finished - started) / 1000)) : 0
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
	const rejected = receipt.fields?.filter(field => field.outcome === 'REJECTED').map(field => fieldLabels[field.field] || field.field)
	if (rejected?.length) return `未受理：${rejected.join('、')}`
	return { ACCEPTED: '指令已受理', REJECTED: '未受理', PARTIALLY_ACCEPTED: '部分受理', ALREADY_SATISFIED: '已达到目标，无需操作' }[receipt.outcome] || '结果待核实'
}
