import { executionResult, targetText } from './task-detail-view.mjs'
import { creatorVariant } from './region-device-view.mjs'

const settled = step => ['已执行', '不必执行'].includes(executionResult(step))

function summary(steps) {
 if (steps.some(step => step.phaseStatus === 'cancelled')) {
  const retained = steps.find(step => step.phaseStatus !== 'cancelled')
  if (!retained) return { text: '已取消', tone: 'wait' }
  const result = retained.phaseStatus === 'executing' ? '执行中' : retained.phaseStatus === 'missed' ? '已错过'
   : retained.phaseStatus === 'interrupted' ? '明确报错' : executionResult(retained)
  return { text: `${result} · 后续已取消`, tone: retained.phaseStatus === 'executing' ? 'active' : 'warn' }
 }
 if (steps.every(step => step.phaseStatus === 'missed')) return { text: '明确报错', tone: 'fail' }
 if (steps.some(step => step.phaseStatus === 'interrupted')) return { text: '明确报错', tone: 'fail' }
 if (steps.some(step => step.phaseStatus === 'executing')) return { text: '执行中', tone: 'active' }
 if (steps.length === 1) return { text: executionResult(steps[0]),
  tone: settled(steps[0]) ? 'ok' : executionResult(steps[0]) === '未执行' ? 'wait' : executionResult(steps[0]) === '结果待核验' ? 'warn' : 'fail' }
 if (steps.some(step => executionResult(step) === '明确报错')) return { text: '明确报错', tone: 'fail' }
 if (steps.some(step => executionResult(step) === '未执行')) return { text: '未执行', tone: 'wait' }
 if (steps.some(step => executionResult(step) === '结果待核验')) return { text: '结果待核验', tone: 'warn' }
 if (steps.every(step => executionResult(step) === '不必执行')) return { text: '不必执行', tone: 'ok' }
 return { text: '已执行', tone: 'ok' }
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
