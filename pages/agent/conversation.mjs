import { fieldLabels } from './ac-draft.js'

export function createTurn(id, content) {
	return { id, serverId: id.startsWith('local-') ? '' : id, content, text: '', streaming: false, activities: [], items: [], lastSeq: 0, draft: null, task: null, tasks: [], roster: null, result: null, observations: [], running: true, traceOpen: true, error: '', startedAt: Date.now(), seconds: 0 }
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
		items: [],
		lastSeq: 0,
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

// 一轮答复是有序类型化条目流：过程项（草稿、工具活动）进 activities 台账，
// 业务项（正文/观察卡/操作卡/任务卡）按事件到达序进 items，永不在已渲染内容上方插入。
function pushItem(turn, kind, extra = {}) {
	// 权威正文条目出现时，已沉淀草稿回归自身累积文本：两段正文各渲各的，不重复整轮答复。
	if (kind === 'text') for (const item of turn.items) if (item.kind === 'draftText') item.settled = false
	const item = { kind, id: `${turn.id}-item-${turn.items.length}`, seq: turn.lastSeq, ...extra }
	turn.items.push(item)
	return item
}
function foldIdea(turn, text) {
	if (!text) return
	turn.activities.push({ kind: 'idea', id: `${turn.id}-idea-${turn.activities.length}`, tool: 'idea', label: '检索思路', status: 'completed', summary: text })
}

export function applyEvent(turn, event, turns = [turn]) {
	// tool/run 事件经 presentation 队列延迟应用，可能与即时应用的后续增量交错；
	// sequence 是事件真实到达序，折叠只作用于早于本事件的条目。
	if (typeof event.sequence === 'number') turn.lastSeq = event.sequence
	if (event.type === 'run.started') {
		// 同一委托的系统承接追加新答复，前段终稿保留自己的文本。
		for (const item of turn.items) {
			if (item.kind === 'text') item.text ??= turn.text
			else if (item.kind === 'draftText' && item.settled) item.text = turn.text
		}
		turn.text = ''; turn.error = ''; turn.running = true; turn.streaming = false
	}
	if (event.type === 'run.started' && event.reference) turn.reference = event.reference
	if (event.type === 'run.started' && event.focusRegion) turn.focusRegion = event.focusRegion
	if (event.type === 'run.started' && event.turnId) turn.serverId = event.turnId
	if (event.type === 'tool.started') {
		// 未定稿的正文折叠为思路行，不删除已渲染内容（reclassified 已先行处理时此处为空操作）。
		if (turn.streaming) {
			const index = turn.items.findLastIndex(item => (item.kind === 'draftText' || item.kind === 'text')
				&& (typeof event.sequence !== 'number' || typeof item.seq !== 'number' || item.seq <= event.sequence))
			if (index >= 0) {
				const [pending] = turn.items.splice(index, 1)
				foldIdea(turn, pending.kind === 'draftText' ? pending.text : turn.text)
				if (pending.kind === 'text') turn.text = ''
				turn.streaming = false
			}
		}
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
	if (event.type === 'message.delta') {
		turn.streaming = true
		if (event.phase === 'draft') {
			const last = turn.items.at(-1)
			if (last?.kind === 'draftText' && !last.settled) last.text += event.content || ''
			else pushItem(turn, 'draftText', { text: event.content || '' })
		} else {
			turn.text += event.content || ''
			if (turn.items.at(-1)?.kind !== 'text') pushItem(turn, 'text')
			turn.traceOpen = false
		}
	}
	if (event.type === 'message.completed') {
		turn.text = event.content || turn.text
		turn.streaming = false
		// 同一段文字原地沉淀为终稿权重：settled 只改颜色不改元素身份，不移动、不重打。
		const last = turn.items.at(-1)
		if (last?.kind === 'draftText') last.settled = true
		else if (turn.text && last?.kind !== 'text') pushItem(turn, 'text')
	}
	if (event.type === 'message.reclassified') {
		const last = turn.items.at(-1)
		if (last?.kind === 'draftText') {
			turn.items.pop()
			foldIdea(turn, event.content || last.text)
		} else {
			// 草稿项缺失（增量被前端边界吞掉）时按事件全文补记思路行，不丢过程证据。
			foldIdea(turn, event.content)
		}
		if (event.content || last?.kind === 'draftText') turn.traceOpen = true
		turn.streaming = false
	}
	if (event.type === 'observation.reported') {
		const blocks = (event.blocks || []).filter(block => {
			// report_artifact 用保存附件 id 去重：事件重放/跨轮重复携带同一链接时更新旧块，不重复成卡。
			const key = block.type === 'report_artifact' ? block.report?.id
				: ['energy_comparison', 'company_energy', 'energy_report'].includes(block.type) ? block.report?.reportId : undefined
			if (!key) return true
			const existing = turns.flatMap(item => item.observations).flatMap(obs => obs.blocks).find(item => item.type === block.type
				&& (block.type === 'report_artifact' ? item.report?.id === key : item.report?.reportId === key))
			if (!existing) return true
			existing.report = block.report
			return false
		})
		if (blocks.length) {
			const group = { observedAt: event.observedAt, blocks }
			turn.observations.push(group)
			pushItem(turn, 'obs', { obs: group })
		}
		turn.traceOpen = false
	}
	if (event.type === 'action.proposed') {
		turn.draft = { ...event, status: 'PENDING_CONFIRMATION' }; turn.roster = event.inventory || null; turn.traceOpen = false
		if (!turn.items.some(item => item.kind === 'panel')) pushItem(turn, 'panel')
	}
	if (event.type === 'action.resolved' && turn.draft?.draftId === event.draftId) turn.draft.status = event.status
	if (event.type === 'task.proposed' || event.type === 'task.cancellation.proposed' || event.type === 'task.change.proposed') {
		if (!turn.tasks.some(task => (task.changeId || task.cancellationId || task.taskId) === (event.task.changeId || event.task.cancellationId || event.task.taskId))) {
			turn.tasks.push(event.task)
			pushItem(turn, 'task', { task: event.task })
		}
		turn.task = turn.tasks[0]
		turn.traceOpen = false
	}
	if (event.type === 'task.resolved') for (const task of turn.tasks) if (task.taskId === event.taskId && !task.cancellationId) task.status = event.status
	if (event.type === 'task.change.resolved') for (const task of turn.tasks) if (task.changeId === event.changeId) task.status = event.status
	if (event.type === 'task.cancellation.resolved') for (const task of turn.tasks) if (task.cancellationId === event.cancellationId) task.status = event.status
	if (['run.completed', 'run.failed', 'run.aborted', 'run.awaiting_confirmation'].includes(event.type)) {
		turn.running = false
		turn.streaming = false
		// 中断轮把未沉淀的草稿保留为可见正文；已沉淀的不再覆盖权威终稿。
		const last = turn.items.at(-1)
		if (last?.kind === 'draftText' && !last.settled) { last.settled = true; turn.text = last.text }
		turn.seconds = Math.max(1, Math.round((Date.now() - turn.startedAt) / 1000))
	}
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
		// 恢复按 sequence 重放与实时一致的条目序；旧历史事件缺该字段则按数组序。
		const events = saved.events || []
		const ordered = events.every(event => typeof event.sequence === 'number') ? [...events].sort((a, b) => a.sequence - b.sequence) : events
		for (const event of ordered) applyEvent(turn, event, [...turns, turn])
		turn.draft = saved.draft || null
		turn.tasks = saved.tasks?.length ? saved.tasks : saved.task ? [saved.task] : turn.tasks
		turn.task = turn.tasks[0] || null
		turn.result = saved.result || null
		// 保存的草案/任务可能缺少对应提案事件：task 条目重指保存对象，缺项按保存事实补齐。
		for (const item of turn.items) if (item.kind === 'task') {
			const key = item.task.changeId || item.task.cancellationId || item.task.taskId
			item.task = turn.tasks.find(task => (task.changeId || task.cancellationId || task.taskId) === key) || item.task
		}
		for (const task of turn.tasks) if (!turn.items.some(item => item.kind === 'task' && item.task === task)) pushItem(turn, 'task', { task })
		if (turn.draft && !turn.items.some(item => item.kind === 'panel')) pushItem(turn, 'panel')
		turn.traceOpen = false
		const started = Date.parse(saved.startedAt || saved.events?.find(event => event.type === 'run.started')?.createdAt)
		const finished = Date.parse(saved.events?.find(event => ['run.completed', 'run.failed', 'run.aborted', 'run.awaiting_confirmation'].includes(event.type))?.timestamp)
		turn.seconds = Number.isFinite(started) && Number.isFinite(finished) && finished >= started ? Math.max(1, Math.round((finished - started) / 1000)) : 0
		turns.push(turn)
	}
	const seen = new Set()
	for (const turn of [...turns].reverse()) {
		if (!turn.draft) continue
		if (seen.has(turn.draft.draftId)) { turn.draft = null; turn.result = null; turn.items = turn.items.filter(item => item.kind !== 'panel') }
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
		turn.items = turn.items.filter(item => item.kind !== 'task' || turn.tasks.includes(item.task))
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
