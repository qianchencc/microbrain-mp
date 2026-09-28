import { fieldLabels, fanLabels, modeLabels } from './ac-draft.js'

const statusText = { scheduled: '待执行', executing: '执行中', completed: '已完成', partial: '部分完成', failed: '未完成', cancelled: '已取消', missed: '已错过', interrupted: '执行中断', verified: '已核验', satisfied: '已达标', pending: '待执行' }
const outcomeText = { satisfied: '已达标，无需下发', verified: '已下发并核验', unconfirmed: '已受理，未核验', rejected: '平台拒绝', unknown: '结果未知', not_dispatched: '未下发', unreadable: '状态读取失败', missing: '设备不可用', pending: '待执行' }

export function taskTime(instant) {
 if (!instant) return ''
 const local = new Date(Date.parse(instant) + 8 * 3600000).toISOString()
 return `${local.slice(0, 10)} ${local.slice(11, 16)}`
}

export function targetText(kind, target) {
 if (!target || typeof target !== 'object') return '目标未指定'
 const parts = []
 if (typeof target.closeOrOpen === 'number') parts.push(target.closeOrOpen === 1 ? '开启' : '关闭')
 if (target.power) parts.push(target.power === 'on' ? '开启' : '关闭')
 if (Number.isFinite(target.temperature)) parts.push(`${target.temperature}℃`)
 if (target.mode) parts.push(modeLabels[target.mode] || target.mode)
 if (target.fanSpeed) parts.push(fanLabels[target.fanSpeed] || target.fanSpeed)
 if (kind === 'access' && !parts.length) parts.push('开门一次')
 return parts.join(' · ') || '目标未指定'
}

export function resultText(device) {
 const rejected = (device.details?.fields || []).filter(field => field.outcome === 'REJECTED')
  .map(field => fieldLabels[field.field] || field.field)
 if (device.details?.receipt === 'PARTIALLY_ACCEPTED') return `部分受理：${rejected.join('、')}被拒绝，设备未核验`
 if (device.outcome === 'rejected' && rejected.length) return `平台拒绝：${rejected.join('、')}`
 if (device.details?.timedOut) return '平台响应超时，结果未知'
 return outcomeText[device.outcome] || device.outcome || '待执行'
}

export function taskDetailView(task) {
 if (!task) return null
 const phases = task.phases.map((phase, index) => ({
  ...phase, title: task.phases.length === 1 ? '执行' : index === 0 ? '开始' : '结束',
  time: taskTime(phase.at), clock: taskTime(phase.at).slice(-5), statusText: statusText[phase.status] || phase.status,
  devices: (phase.devices || []).map(device => ({ ...device, targetText: targetText(device.kind, device.target),
   resultText: resultText(device),
   resultTone: ['verified', 'satisfied'].includes(device.outcome) ? 'ok' : ['unconfirmed', 'unknown'].includes(device.outcome) ? 'warn' : device.outcome === 'pending' ? 'wait' : 'fail' })),
 }))
 const count = new Set(phases.flatMap(phase => phase.devices.map(device => device.id))).size
 const problemCount = phases.flatMap(phase => phase.devices).filter(device => !['verified', 'satisfied', 'pending'].includes(device.outcome)).length
 const summary = task.status === 'scheduled' ? `${count} 台设备等待执行`
  : task.status === 'cancelled' ? '任务已取消，已执行的动作不会回滚'
  : task.status === 'missed' ? '任务已错过，没有自动补执行'
  : problemCount ? `${problemCount} 项结果需要关注` : `${count} 台设备目标已达成`
 const whenText = phases.length > 1 && phases[0].time.slice(0, 10) === phases.at(-1).time.slice(0, 10)
  ? `${phases[0].time} 至 ${phases.at(-1).clock}` : phases.map(phase => phase.time).join(' 至 ')
 return { ...task, phases, whenText, createdText: taskTime(task.createdAt), statusText: statusText[task.status] || task.status,
  summary, sourceText: task.source?.type === 'sample' ? '本地演示记录' : task.source?.type === 'immediate_draft' ? 'Agent 即时操作' : 'Agent 定时任务' }
}
