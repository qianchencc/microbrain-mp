import { fieldLabels, fanLabels, modeLabels } from './ac-draft.js'
import { resolveDeviceArtwork } from './device-art/catalog.js'

const statusText = { scheduled: '未执行', executing: '执行中', completed: '已执行', partial: '明确报错', failed: '明确报错', unconfirmed: '明确报错', cancelled: '已取消', missed: '明确报错', interrupted: '明确报错', verified: '已执行', satisfied: '不必执行', pending: '未执行' }

export function executionResult(device) {
 if (device.outcome === 'satisfied') return '不必执行'
 if (device.outcome === 'verified' || (device.outcome === 'unconfirmed' && device.details?.receipt === 'ACCEPTED' && !device.details?.timedOut)) return '已执行'
 if (['pending', 'not_dispatched'].includes(device.outcome)) return '未执行'
 return '明确报错'
}

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
 const status = executionResult(device)
 if (status !== '明确报错') return status
 const rejected = (device.details?.fields || []).filter(field => field.outcome === 'REJECTED')
  .map(field => fieldLabels[field.field] || field.field)
 if (rejected.length) return `${status} · ${rejected.join('、')}被拒绝`
 if (device.details?.timedOut) return `${status} · 平台响应超时`
 const reason = { rejected: '平台拒绝', unknown: '结果未知', unreadable: '状态读取失败', missing: '设备不可用' }[device.outcome]
 return reason ? `${status} · ${reason}` : status
}

const phaseTone = status =>
 ['verified', 'satisfied', 'completed'].includes(status) ? 'ok'
 : status === 'partial' ? 'warn'
 : ['failed', 'missed', 'interrupted'].includes(status) ? 'fail'
 : status === 'executing' ? 'active' : status === 'cancelled' ? 'off' : 'wait'

// 两阶段之间的连线按上一阶段推进程度填充：已跑完（含失败/中断）满格；执行中按时间进度；未到/错过/取消不填充。
function linkProgress(phase, next) {
 if (!next) return null
 if (['verified', 'satisfied', 'completed', 'partial', 'failed', 'unconfirmed', 'interrupted'].includes(phase.status)) return 100
 if (phase.status !== 'executing') return 0
 const span = Date.parse(next.at) - Date.parse(phase.at)
 return span > 0 ? Math.max(0, Math.min(100, (Date.now() - Date.parse(phase.at)) / span * 100)) : 100
}

export function taskDetailView(task) {
 if (!task) return null
 const phases = task.phases.map((phase, index) => ({
  ...phase, title: task.phases.length === 1 ? '执行' : index === 0 ? '开始' : '结束',
  time: taskTime(phase.at), clock: taskTime(phase.at).slice(-5), statusText: statusText[phase.status] || phase.status,
  tone: phaseTone(phase.status), link: linkProgress(phase, task.phases[index + 1]),
  devices: (phase.devices || []).map(device => ({ ...device, artwork: resolveDeviceArtwork({ ...device, deviceName: device.name }).src,
   targetText: targetText(device.kind, device.target),
   resultText: phase.status === 'cancelled' ? '已取消，未下发' : resultText(device),
   resultTone: phase.status === 'cancelled' ? 'wait' : executionResult(device) === '明确报错' ? 'fail' : executionResult(device) === '未执行' ? 'wait' : 'ok' })),
 }))
 const whenText = phases.length > 1 && phases[0].time.slice(0, 10) === phases.at(-1).time.slice(0, 10)
  ? `${phases[0].time} 至 ${phases.at(-1).clock}` : phases.map(phase => phase.time).join(' 至 ')
 return { ...task, phases, whenText, createdText: taskTime(task.createdAt), statusText: statusText[task.status] || task.status,
  sourceText: task.source?.type === 'sample' ? '本地演示记录' : task.source?.type === 'immediate_draft' ? 'Agent 即时操作' : 'Agent 定时任务' }
}
