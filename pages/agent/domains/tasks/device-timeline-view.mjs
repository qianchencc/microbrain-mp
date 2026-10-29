import { targetText } from './task-detail-view.mjs'
import { creatorVariant } from '../regions/region-device-view.mjs'

import { deviceResultView, taskStatusText, taskStatusTone } from './task-presentation.mjs'

const settled = step => deviceResultView(step).settled

function summary(steps) {
 const remaining = steps.filter(step => step.phaseStatus !== 'cancelled')
 if (!remaining.length) return { text: '已取消', tone: 'wait' }
 const suffix = remaining.length < steps.length ? ' · 后续已取消' : ''
 const active = remaining.find(step => ['executing', 'missed', 'interrupted'].includes(step.phaseStatus))
 if (active) return { text: taskStatusText(active.phaseStatus) + suffix, tone: taskStatusTone(active.phaseStatus) }
 const failed = remaining.find(step => ['failed', 'rejected', 'unreadable', 'missing', 'read_failed'].includes(step.outcome))
 const uncertain = remaining.find(step => !settled(step))
 const result = deviceResultView(failed || uncertain || remaining.find(step => step.outcome === 'verified') || remaining[0])
 return { text: result.text + suffix, tone: result.tone }
}

export function deviceTimelineItems(events) {
 const byTask = new Map()
 for (const event of events) {
  if (!byTask.has(event.taskId)) byTask.set(event.taskId, [])
  byTask.get(event.taskId).push(event)
 }
 return [...byTask.values()].flatMap(steps => {
  steps.sort((a, b) => a.at.localeCompare(b.at))
  const first = steps[0], last = steps.at(-1)
  const device = first.device
  const interval = first.interval || null
  const targets = steps.map(step => targetText(device.kind, step.target))
  const allSettled = steps.every(settled)
  const result = summary(steps)
  const taskTerminal = !['scheduled', 'executing'].includes(first.taskStatus)
  return [{
   id: steps.map(step => step.phaseId).join('-'), taskId: first.taskId,
   at: interval?.startsAt ?? first.at,
   endAt: interval?.endsAt ?? (steps.length > 1 ? last.at : undefined),
   label: targets.join(' → '), taskLabel: first.taskLabel,
   sourceText: first.sourceType === 'recurring_plan' ? '周期' : first.sourceType === 'sample' ? '演示' : first.sourceType === 'immediate_draft' ? '即时' : '定时',
   resultText: result.text, resultTone: result.tone, creatorName: first.creatorName,
   creatorVariant: creatorVariant(first.creatorName, false),
   faded: first.taskStatus === 'cancelled' || (interval ? allSettled && taskTerminal : allSettled),
  }]
 })
}
