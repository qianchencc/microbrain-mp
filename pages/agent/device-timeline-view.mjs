import { targetText } from './task-detail-view.mjs'

const settled = outcome => ['verified', 'satisfied'].includes(outcome)
const outcomeLabel = { verified: '已核验', satisfied: '已满足', unconfirmed: '待核验', unknown: '结果未知', rejected: '未受理',
 unreadable: '读取失败', missing: '设备缺失', not_dispatched: '未下发', pending: '待执行' }

function summary(steps) {
 if (steps.length === 1) return { text: outcomeLabel[steps[0].outcome] || '结果未知',
  tone: settled(steps[0].outcome) ? 'ok' : ['unconfirmed', 'unknown'].includes(steps[0].outcome) ? 'warn' : steps[0].outcome === 'pending' ? 'wait' : 'fail' }
 const outcomes = steps.map(step => step.outcome)
 if (outcomes.every(settled)) return { text: '已完成', tone: 'ok' }
 if (outcomes.some(outcome => outcome === 'pending')) return { text: outcomes.every(outcome => outcome === 'pending') ? '待执行' : '进行中', tone: 'wait' }
 if (outcomes.some(settled)) return { text: '部分完成', tone: 'warn' }
 if (outcomes.some(outcome => ['unconfirmed', 'unknown'].includes(outcome))) return { text: '待核验', tone: 'warn' }
 return { text: '未完成', tone: 'fail' }
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
  const targets = steps.map(step => targetText(device.kind, step.target))
  const allSettled = steps.every(step => settled(step.outcome))
  const result = summary(steps)
  return [{
   id: steps.map(step => step.phaseId).join('-'), taskId: first.taskId, at: first.at,
   endAt: steps.length > 1 ? last.at : undefined, label: targets.join(' → '), taskLabel: first.taskLabel,
   sourceText: first.sourceType === 'sample' ? '演示' : first.sourceType === 'immediate_draft' ? '即时' : '定时',
   resultText: result.text, resultTone: result.tone, creatorName: first.creatorName,
   faded: allSettled,
  }]
 })
}
