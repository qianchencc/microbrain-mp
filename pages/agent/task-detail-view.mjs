import { fieldLabels, fanLabels, modeLabels } from './ac-draft.js'
import { resolveDeviceArtwork } from './device-art/catalog.js'

const statusText = { scheduled: '未执行', executing: '执行中', completed: '已执行', partial: '明确报错', failed: '明确报错', unconfirmed: '明确报错', cancelled: '已取消', missed: '明确报错', interrupted: '明确报错', verified: '已执行', satisfied: '不必执行', pending: '未执行' }
const companyStatusText = { scheduled: '未执行', executing: '执行中', completed: '已完成', partial: '部分完成', failed: '执行失败', unconfirmed: '结果待核验', cancelled: '已取消', missed: '执行错过', interrupted: '执行中断', verified: '已核验', satisfied: '无需执行', pending: '未执行' }
const statusLabel = (status, source) => (source === 'company' ? companyStatusText[status] : statusText[status]) || status

export function executionResult(device) {
 if (device.outcome === 'observed') return '已读取'
 if (device.outcome === 'satisfied') return '不必执行'
 if (device.outcome === 'unconfirmed' && device.details?.requiresVerification) return '结果待核验'
 if (device.outcome === 'verified' || (device.outcome === 'unconfirmed' && !device.details?.requiresVerification && device.details?.receipt === 'ACCEPTED' && !device.details?.timedOut)) return '已执行'
 if (['pending', 'not_dispatched'].includes(device.outcome)) return '未执行'
 return '明确报错'
}

export function repeatText(repeat) {
 if (!repeat) return ''
 const days = ['日', '一', '二', '三', '四', '五', '六', '日']
 const label = repeat.frequency === 'daily' ? '每天' : repeat.frequency === 'weekdays' ? '周一至周五 · 不含节假日调整'
  : repeat.frequency === 'monthly' ? `每月${repeat.dayOfMonth}日${repeat.dayOfMonth > 28 ? ' · 无此日期则跳过' : ''}`
  : `每周${[...(repeat.weekdays || [])].sort((a, b) => a - b).map(day => days[day]).join('、')}`
 return label + (repeat.until ? ` · 至 ${repeat.until}` : '')
}

const readComparisonLabels = { previousPeriod: '环比', yearOverYear: '同比' }
const readRelativePeriodLabels = {
 day: '每次执行统计前一日（上海时间）',
 week: '每次执行统计前一周（上海时间）',
 month: '每次执行统计前一月（上海时间）',
}

function readPeriodText(period) {
 if (period?.kind === 'previous') return readRelativePeriodLabels[period.unit] || ''
 if (period?.kind !== 'absolute') return ''
 const from = taskTime(period.from), to = taskTime(period.to)
 return from && to ? `${from} 至 ${to}（上海时间）` : ''
}

function readAgentSpecView(spec) {
 if (!spec) return null
 const period = readPeriodText(spec.period)
 const comparisons = (spec.comparisons || []).map(kind => readComparisonLabels[kind] || kind).filter(Boolean)
 return {
  periodText: period ? `统计期间 · ${period}` : '',
  comparisonText: `比较项 · ${comparisons.length ? comparisons.join('、') : '不比较'}`,
  comparisons,
 }
}

export function readAgentView(agent) {
 if (!agent) return null
 const spec = readAgentSpecView(agent.spec)
 return {
  ...agent,
  objectiveText: `检查点指令 · ${agent.objective}`,
  periodText: spec?.periodText || '',
  comparisonText: spec?.comparisonText || '',
  comparisons: spec?.comparisons || [],
 }
}

const acModeLabels = { inspect: '空调只读巡检', adjust_to_26: '有限条件调温' }

export function readAcView(ac) {
 if (!ac?.mode) return null
 return {
  title: acModeLabels[ac.mode] || '空调检查',
  summary: ac.mode === 'adjust_to_26' ? '仅满足条件时设为26℃ · 不开机、不改模式或风速' : '空调只读巡检 · 不下发设备控制',
  criteriaText: '条件 · 已开机 + 制冷 + 设定温度低于26℃',
 }
}

export function mergeTaskPlan(task, plan) {
 task.planStatus = plan.status
 task.planId = plan.planId
 task.nextAt = plan.nextAt
 task.nextOccurrenceId = plan.nextOccurrenceId
 task.latestTask = plan.latestTask
 task.status = ['paused', 'deleted'].includes(plan.status) ? plan.status : plan.nextAt ? 'scheduled' : plan.latestTask?.status || 'completed'
}

export function taskPlanSnapshot(plan) {
 if (!plan) return null
 return { ...plan, id: plan.planId, status: ['paused', 'deleted'].includes(plan.status) ? plan.status : plan.nextAt ? 'scheduled' : plan.latestTask?.status || 'completed', report: null, canCancel: false }
}

export function taskNavigation(task) {
 const at = task.repeat && !task.occurrence ? task.nextAt : task.interval?.startsAt ?? task.phases?.[0]?.at
 const id = task.repeat && !task.occurrence
  ? task.nextOccurrenceId || (at ? `occurrence:${task.planId || task.taskId}:${taskTime(at).slice(0, 10)}` : '')
  : task.taskId || task.id
 if (!at || !id || !task.regionIds?.length) return null
 return { taskId: id, date: taskTime(at).slice(0, 10), regionId: task.regionIds[0] }
}

export function taskTime(instant) {
 if (!instant) return ''
 const local = new Date(Date.parse(instant) + 8 * 3600000).toISOString()
 return `${local.slice(0, 10)} ${local.slice(11, 16)}`
}

export function targetText(kind, target) {
 if (!target || typeof target !== 'object') return '目标未指定'
 if (target.observe === true) return readTargetText(kind, target)
 const parts = []
 if (typeof target.closeOrOpen === 'number') parts.push(target.closeOrOpen === 1 ? '开启' : '关闭')
 if (target.power) parts.push(target.power === 'on' ? '开启' : '关闭')
 if (Number.isFinite(target.temperature)) parts.push(`${target.temperature}℃`)
 if (target.mode) parts.push(modeLabels[target.mode] || target.mode)
 if (target.fanSpeed) parts.push(fanLabels[target.fanSpeed] || target.fanSpeed)
 if (kind === 'access' && !parts.length) parts.push('开门一次')
 return parts.join(' · ') || '目标未指定'
}

export function readTargetText(kind, read) {
 if (kind === 'safety' && read?.alertWindow === 'previous_day') return '汇总前一自然日告警（上海时间）'
 if (kind === 'safety' && read?.alertDays) return `读取近 ${read.alertDays} 天告警`
 return ({ ac: '读取空调状态', environment: '读取环境数据', energy: '读取最新能耗', safety: '读取告警台账', video: '检查在线状态' })[kind] || '只读检查'
}

export function resultText(device) {
 if (device.details?.requiresVerification) {
  if (device.outcome === 'verified') return '已核验'
  if (device.outcome === 'unconfirmed' && device.details.receipt === 'ACCEPTED') return device.details.readback?.observedState === null ? '已受理 · 回读失败' : '已受理 · 目标未核验'
 }
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
 const interval = task.interval || null
 const reportPhases = task.report?.phases || []
 const phases = task.phases.map((phase, index) => {
  const reportPhase = reportPhases.find(item => (phase.id && item.id === phase.id) || item.at === phase.at)
  const merged = reportPhase?.observations || phase.observations || []
  const link = merged.find(block => block?.type === 'report_artifact')?.report
  return {
   ...phase, readAgent: readAgentView(phase.read?.agent), readAc: readAcView(phase.read?.ac), observations: merged.filter(block => block?.type !== 'report_artifact'),
   report: link ? { reportId: link.id, title: link.title, status: link.status, phaseId: phase.id, phaseAt: phase.at } : null,
   title: readAcView(phase.read?.ac)?.title || (interval ? `检查点${index + 1}` : task.phases.length === 1 ? '执行' : index === 0 ? '开始' : '结束'),
   time: taskTime(phase.at), clock: taskTime(phase.at).slice(-5), statusText: statusLabel(phase.status, task.agentSource),
   tone: phaseTone(phase.status), link: linkProgress(phase, task.phases[index + 1]),
   devices: (phase.devices || []).map(device => ({ ...device, artwork: resolveDeviceArtwork({ ...device, deviceName: device.name }).src,
    targetText: targetText(device.kind, device.target),
    resultText: phase.status === 'cancelled' ? '已取消，未下发' : resultText(device),
    resultTone: phase.status === 'cancelled' ? 'wait' : device.details?.requiresVerification && device.outcome === 'unconfirmed' ? 'warn' : executionResult(device) === '明确报错' ? 'fail' : executionResult(device) === '未执行' ? 'wait' : 'ok' })),
  }
 })
 const start = interval ? taskTime(interval.startsAt) : phases[0]?.time || ''
 const end = interval ? taskTime(interval.endsAt) : phases.length > 1 ? phases.at(-1).time : ''
 const whenText = end && start.slice(0, 10) === end.slice(0, 10)
  ? `${start} 至 ${end.slice(-5)}` : [start, end].filter(Boolean).join(' 至 ')
 const report = task.report ? {
  generatedText: taskTime(task.report.generatedAt),
  outcomeText: statusLabel(task.report.outcome, task.agentSource),
  checkpoints: task.report.phases.length,
  devicesVisible: new Set(task.report.phases.flatMap(phase => phase.devices.map(device => device.id))).size,
 } : null
 return { ...task, phases, whenText, report, repeatText: repeatText(task.repeat), nextText: task.nextAt ? taskTime(task.nextAt) : '', createdText: taskTime(task.createdAt),
  statusText: task.occurrence?.virtual ? '未来安排' : interval && task.status === 'executing'
   ? task.executionActive ? '设备执行中' : '区间进行中'
   : statusLabel(task.status, task.agentSource),
  sourceText: task.agentSource === 'company' ? task.source?.type === 'recurring_plan' ? '公司周期计划' : '公司定时任务'
   : task.source?.type === 'recurring_plan' ? 'Agent 周期计划' : task.source?.type === 'sample' ? '本地演示记录' : task.source?.type === 'immediate_draft' ? 'Agent 即时操作' : 'Agent 定时任务' }
}
