import { fieldLabels } from './ac-draft.js'

export function createTurn(id, content) {
	return { id, serverId: id.startsWith('local-') ? '' : id, content, text: '', streaming: false, activities: [], draft: null, task: null, tasks: [], roster: null, result: null, observations: [], running: true, traceOpen: true, error: '', startedAt: Date.now(), seconds: 0 }
}

export function canRecoverTurn(turn, isLatest) {
	// 纯问答轮（无草案无结果）无论成败都可原位改写；未达服务端的失败轮（serverId 为空，
	// 服务端没有可退役的条目）同样可改写；带设备操作事实的轮次保持只读。
	return Boolean(isLatest && !turn.running && !turn.draft && !turn.tasks?.length && !turn.task && !turn.result)
}

export function restartTurn(turn, content = turn.content) {
	Object.assign(turn, {
		content,
		text: '',
		activities: [],
		draft: null,
		task: null,
		tasks: [],
		roster: null,
		result: null,
		observations: [],
		running: true,
		traceOpen: true,
		error: '',
		startedAt: Date.now(),
		seconds: 0,
		serverId: '',
	})
}

export function applyEvent(turn, event, turns = [turn]) {
	if (event.type === 'run.started' && event.reference) turn.reference = event.reference
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
	if (event.type === 'observation.reported') {
		const blocks = (event.blocks || []).filter(block => {
			if (!['energy_comparison', 'company_energy', 'energy_report'].includes(block.type) || !block.report?.reportId) return true
			const existing = turns.flatMap(item => item.observations).flatMap(obs => obs.blocks).find(item => item.type === block.type && item.report?.reportId === block.report.reportId)
			if (!existing) return true
			existing.report = block.report
			return false
		})
		if (blocks.length) turn.observations.push({ observedAt: event.observedAt, blocks })
		turn.traceOpen = false
	}
	if (event.type === 'action.proposed') { turn.draft = { ...event, status: 'PENDING_CONFIRMATION' }; turn.roster = event.inventory || null; turn.traceOpen = false }
	if (event.type === 'action.resolved' && turn.draft?.draftId === event.draftId) turn.draft.status = event.status
	if (event.type === 'task.proposed' || event.type === 'task.cancellation.proposed' || event.type === 'task.change.proposed') {
		if (!turn.tasks.some(task => (task.changeId || task.cancellationId || task.taskId) === (event.task.changeId || event.task.cancellationId || event.task.taskId))) turn.tasks.push(event.task)
		turn.task = turn.tasks[0]
		turn.traceOpen = false
	}
	if (event.type === 'task.resolved') for (const task of turn.tasks) if (task.taskId === event.taskId && !task.cancellationId) task.status = event.status
	if (event.type === 'task.change.resolved') for (const task of turn.tasks) if (task.changeId === event.changeId) task.status = event.status
	if (event.type === 'task.cancellation.resolved') for (const task of turn.tasks) if (task.cancellationId === event.cancellationId) task.status = event.status
	if (['run.completed', 'run.failed', 'run.aborted', 'run.awaiting_confirmation'].includes(event.type)) { turn.running = false; turn.streaming = false; turn.seconds = Math.max(1, Math.round((Date.now() - turn.startedAt) / 1000)) }
	if (event.type === 'run.failed') {
		turn.error = event.message || '本次回答未完成：服务端未返回具体原因'
		for (const item of turn.activities) if (item.status === 'running') item.status = 'failed'
	}
	if (event.type === 'run.aborted') {
		turn.error = event.message || '本次回答已停止'
		for (const item of turn.activities) if (['running', 'searching'].includes(item.status)) item.status = 'skipped'
	}
}

export function mergeTaskDetail(task, detail) {
	task.status = detail.status
	task.executionActive = detail.executionActive
	task.report = detail.report ?? null
	if (detail.interval) task.interval = detail.interval
	for (const phase of task.phases || []) {
		const fresh = (detail.phases || []).find(item => (phase.id ? item.id === phase.id : item.at === phase.at))
		if (fresh) { phase.id = fresh.id; phase.status = fresh.status }
	}
}

export function friendlyError(message) {
	const text = String(message || '')
	return text || '本次回答未完成：未取得具体失败原因'
}

export function restoreTurns(savedTurns = []) {
	const turns = []
	for (const saved of savedTurns) {
		const turn = createTurn(saved.id, saved.content)
		for (const event of saved.events || []) applyEvent(turn, event, [...turns, turn])
		turn.draft = saved.draft || null
		turn.tasks = saved.tasks?.length ? saved.tasks : saved.task ? [saved.task] : turn.tasks
		turn.task = turn.tasks[0] || null
		turn.result = saved.result || null
		turn.traceOpen = false
		const started = Date.parse(saved.startedAt || saved.events?.find(event => event.type === 'run.started')?.createdAt)
		const finished = Date.parse(saved.events?.find(event => ['run.completed', 'run.failed', 'run.aborted', 'run.awaiting_confirmation'].includes(event.type))?.timestamp)
		turn.seconds = Number.isFinite(started) && Number.isFinite(finished) && finished >= started ? Math.max(1, Math.round((finished - started) / 1000)) : 0
		turns.push(turn)
	}
	const seen = new Set()
	for (const turn of [...turns].reverse()) {
		if (!turn.draft) continue
		if (seen.has(turn.draft.draftId)) { turn.draft = null; turn.result = null }
		else seen.add(turn.draft.draftId)
	}
	const taskIds = new Set()
	for (const turn of [...turns].reverse()) {
		turn.tasks = turn.tasks.filter(task => {
			const key = task.changeId || task.cancellationId || task.taskId
			if (taskIds.has(key)) return false
			taskIds.add(key)
			return true
		})
		turn.task = turn.tasks[0] || null
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
