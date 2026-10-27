import { fanLabels, modeLabels } from './ac-draft.js'
import { resolveDeviceArtwork } from './device-art/catalog.js'

import { taskStatusText, taskStatusTone, taskResultStatus, deviceResultView, deviceResultReason } from './task-presentation.mjs'

export const executionResult = device => deviceResultView(device).text

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
  objectiveText: `任务要求 · ${agent.objective}`,
  periodText: spec?.periodText || '',
  comparisonText: spec?.comparisonText || '',
  comparisons: spec?.comparisons || [],
 }
}

const acModeLabels = { inspect: '空调检查', adjust_to_26: '空调温度调整' }

// 目标温度是提案/任务保存的事实：归一化后的 action/condition 值，缺失时回退默认 26。
export const acTargetOf = ac => ac?.action?.setpoint ?? ac?.condition?.setpoint?.value ?? ac?.target ?? 26

export function readAcView(ac) {
 if (!ac?.mode) return null
 const target = acTargetOf(ac)
 return {
  title: acModeLabels[ac.mode] || '空调检查',
  summary: ac.mode === 'adjust_to_26' ? `符合条件的空调调到${target}℃` : '只检查状态，不调整空调',
  criteriaText: ac.mode === 'adjust_to_26' ? `只调整开着、正在制冷且设定温度低于${target}℃的空调` : '',
  cadenceText: ac.cadenceMinutes ? `每 ${ac.cadenceMinutes} 分钟检查一次` : '',
  scheduleText: ac.cadenceMinutes ? '' : '按指定时间检查一次',
  actionText: ac.mode === 'adjust_to_26' ? `符合条件时调到${target}℃` : '只检查，不调整设备',
  limitText: '不开机、不改模式和风速',
 }
}

// 报告设备行聚合与 report-summary 同口径：adjusted 优先，not_dispatched/unknown 逐级让位；
// before 取首个 adjusted 检查点记录的调前 setpoint，after 只写平台权威快照的回读值（afterSetpoint），
// 缺回读时如实标「目标」而不是把指令值写成设备实际结果。
const ENERGY_DEVICE_ROW_LIMIT = 6
// 报告的调温目标取检查点记录的 criteria；旧数据缺失时回退 26。
const acReportTarget = phases => phases?.flatMap(phase => phase.observations || [])
 .find(block => block?.type === 'ac_inspection')?.criteria?.setpoint?.value ?? 26
function acReportDeviceRows(phases, target) {
 const seen = new Map()
 for (const phase of phases || []) {
  for (const block of phase.observations || []) {
   if (block?.type !== 'ac_inspection' || block.mode !== 'adjust_to_26') continue
   for (const device of block.devices || []) {
    const entry = seen.get(device.deviceId)
    if (!entry) seen.set(device.deviceId, { name: device.name, before: device.setpoint, disposition: device.disposition,
     after: device.disposition === 'adjusted' ? device.afterSetpoint : undefined })
    else if (device.disposition === 'adjusted') {
     if (entry.disposition !== 'adjusted') entry.before = device.setpoint
     entry.disposition = 'adjusted'
     if (!Number.isFinite(entry.after)) entry.after = device.afterSetpoint
    }
    else if (device.disposition === 'not_dispatched' && entry.disposition !== 'adjusted') entry.disposition = 'not_dispatched'
    else if (device.disposition === 'unknown' && !['adjusted', 'not_dispatched'].includes(entry.disposition)) entry.disposition = 'unknown'
   }
  }
 }
 const rows = [...seen.entries()].map(([deviceId, device]) => {
  const before = Number.isFinite(device.before) ? `${device.before}℃` : '—'
  if (device.disposition === 'adjusted') return { deviceId, name: device.name, before, after: Number.isFinite(device.after) ? `平台回读 ${device.after}℃` : `目标 ${target}℃`, tone: 'ok' }
  if (device.disposition === 'not_needed') return { deviceId, name: device.name, before, after: '无需调整', tone: 'muted' }
  return { deviceId, name: device.name, before, after: { not_dispatched: '这次未调整', unknown: '结果待确认' }[device.disposition] || '未调温', tone: 'muted' }
 })
 return { rows: rows.slice(0, ENERGY_DEVICE_ROW_LIMIT), more: Math.max(0, rows.length - ENERGY_DEVICE_ROW_LIMIT) }
}

/** 任务报告的执行摘要与节能口径投影（原型 proto-energy-estimate.html A 变体）；数字缺失时保留原因，不补零。 */
export function energyImpactView(impact, devices, reportPhases) {
 if (!impact) return null
 if (impact.status === 'measured') {
  const span = impact.from && impact.to ? ` · ${taskTime(impact.from)} 至 ${taskTime(impact.to)}` : ''
  const value = impact.value === null || impact.value === undefined ? '差额不可比' : `${impact.value} ${impact.unit}`
  return { text: `${impact.label || '关联能耗变化'} · ${value} · ${impact.meterCount} 只电表${span}`, tone: 'ok' }
 }
 if (impact.status === 'estimated' && impact.basis === 'assumption') {
  const rate = Math.round((impact.assumptions?.ratePerDegree || 0) * 1000) / 10
  const missing = Math.max(0, (impact.coverage?.adjusted || 0) - (impact.coverage?.estimated || 0))
  const hoursMs = Date.parse(impact.to) - Date.parse(impact.from)
  const hours = Number.isFinite(hoursMs) && hoursMs > 0 ? Math.round(hoursMs / 360000) / 10 : null
  const product = hours ? Math.round((impact.deviceCount || 0) * (impact.baseline?.averageRise || 0)
   * (impact.assumptions?.ratePerDegree || 0) * (impact.assumptions?.powerKw || 0) * hours * 100) / 100 : null
  return {
   kind: 'assumption', tone: 'warn', tag: '估算',
   text: `预计节电约 ${impact.value} ${impact.unit} · 折合电费约 ¥${impact.cost?.value ?? '—'}`,
   hero: {
    value: `≈ ${impact.value}`, unit: impact.unit,
    label: `预计减少用电 · 估算值 · 约 ¥${impact.cost?.value ?? '—'}`,
    footnote: `基于 ${impact.coverage?.adjusted ?? impact.deviceCount ?? 0} 台实际调节设备的调前温度、经验比例和执行时长估算`,
   },
   facts: [
    { value: `${devices?.adjusted ?? impact.coverage?.adjusted ?? 0} 台`, label: '实际调节' },
    { value: `${devices?.satisfied ?? 0} 台`, label: '无需调整' },
    { value: `${impact.baseline?.target ?? '—'}℃`, label: '统一目标' },
   ],
   basisTitle: '估算依据',
   formula: `${impact.deviceCount ?? '—'} 台 × ${impact.baseline?.averageRise ?? '—'}℃ × ${rate}% × ${impact.assumptions?.powerKw ?? '—'}kW${hours ? ` × ${hours}h` : ''} ≈ ${product ?? impact.value} 度`,
   notes: [
    `采用调前平均 ${impact.baseline?.averageSetpoint ?? '—'}℃、每升高 1℃ 约节电 ${rate}% 的经验参数；这是估算，不代表已实测节电`,
    `估算窗口 · ${taskTime(impact.from)} 至 ${taskTime(impact.to)}（上海时间）${missing ? ` · 其中 ${missing} 台缺少调前温度未参与` : ''}`,
   ],
   devices: acReportDeviceRows(reportPhases, impact.baseline?.target ?? acReportTarget(reportPhases)),
  }
 }
 if (impact.status === 'unavailable' && devices) {
  return {
   kind: 'unavailable', tone: 'muted',
   text: impact.reason || '暂无法可靠估算节能情况',
   hero: { value: '暂无法可靠估算', unit: '', label: `本次已调节 ${devices.adjusted || 0} 台空调`, badge: '暂时算不出节电量', footnote: impact.reason || '' },
   facts: [
    { value: `${devices.total || 0} 台`, label: '纳入范围' },
    { value: `${devices.adjusted || 0} 台`, label: '实际调节' },
    { value: `${devices.satisfied || 0} 台`, label: '无需调整' },
   ],
   basisTitle: '已确认的执行事实',
   formula: `${devices.total || 0} 台纳入 · ${devices.adjusted || 0} 台调节 · ${devices.satisfied || 0} 台无需调整`,
   notes: [],
   devices: acReportDeviceRows(reportPhases, acReportTarget(reportPhases)),
  }
 }
 if (impact.status === 'estimated') {
  const span = impact.from && impact.to ? ` · ${taskTime(impact.from)} 至 ${taskTime(impact.to)}` : ''
  return { text: `关联用电估算 · ${impact.value} ${impact.unit} · ${impact.meterCount} 只电表${span}；${impact.reason}`, tone: 'warn' }
 }
 return { text: impact.reason || '暂无法可靠估算节能情况', tone: 'muted' }
}

export function taskExecutionSummaryView(summary, reportPhases) {
 if (!summary?.devices) return null
 const devices = summary.devices
 return {
  checkpointsText: Number.isFinite(summary.checkpoints) ? `${summary.checkpoints}次检查有结果` : '',
  devicesText: [Number.isFinite(devices.total) ? `涉及${devices.total}台设备` : '设备数量未提供', devices.adjusted > 0 ? `其中${devices.adjusted}台曾调整温度` : ''].filter(Boolean).join(' · '),
  energy: energyImpactView(summary.energyImpact, devices, reportPhases),
 }
}

export function mergeTaskPlan(task, plan) {
 task.planStatus = plan.status
 task.planId = plan.planId
 task.nextAt = plan.nextAt
 task.nextCheckpointAt = plan.nextCheckpointAt
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
 if (kind === 'safety' && read?.alertWindow === 'previous_week') return '汇总上一自然周告警（上海时间，周一至周日）'
 if (kind === 'safety' && read?.alertDays) return `读取近 ${read.alertDays} 天告警`
 return ({ ac: '读取空调状态', environment: '读取环境数据', energy: '读取最新能耗', safety: '读取告警台账', video: '检查在线状态' })[kind] || '只读检查'
}

// 只展示接口可见的阶段要求，不从模板还原被授权裁剪的指令。
export function taskRequirementsText(task) {
 const requirements = new Set()
 let explicitControl = false
 for (const phase of task?.phases || []) {
  const agent = readAgentView(phase?.read?.agent)
  if (agent) {
   if (agent.spec) {
    if (agent.periodText) requirements.add(agent.periodText)
    if (agent.comparisonText) requirements.add(agent.comparisonText)
   } else if (agent.objective) requirements.add(agent.objectiveText)
   continue
  }
  const ac = readAcView(phase?.read?.ac)
  if (ac) {
   requirements.add(ac.title)
   requirements.add(ac.criteriaText)
   if (ac.cadenceText) requirements.add(ac.cadenceText)
   requirements.add(ac.actionText)
   continue
  }
  for (const device of phase?.devices || []) {
   if (device?.target?.observe === true) {
    const text = device.kind === 'energy' ? '读取电表数据' : readTargetText(device.kind, device.target)
    if (text) requirements.add(text)
   } else if (device?.target && typeof device.target === 'object' && Object.keys(device.target).length) explicitControl = true
  }
 }
 if (!requirements.size && explicitControl) requirements.add('按计划时间执行')
 return [...requirements].join('；')
}

export const resultText = device => deviceResultView(device).text
const phaseTone = taskStatusTone

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
  const presentationStatus = taskResultStatus(phase)
  return {
   ...phase, readAgent: readAgentView(phase.read?.agent), readAc: readAcView(phase.read?.ac), observations: merged.filter(block => block?.type !== 'report_artifact'),
   report: link ? { reportId: link.id, title: link.title, status: link.status, phaseId: phase.id, phaseAt: phase.at } : null,
   title: phase.read?.ac || phase.read?.agent || phase.devices?.some(d => d.target?.observe) ? `第${index + 1}次检查` : task.phases.length === 1 ? '操作记录' : `第${index + 1}次操作`,
   time: taskTime(phase.at), clock: taskTime(phase.at).slice(-5), presentationStatus, statusText: taskStatusText(presentationStatus),
   tone: phaseTone(presentationStatus), link: linkProgress(phase, task.phases[index + 1]),
   devices: (phase.devices || []).map(device => {
    const result = deviceResultView(device)
    return { ...device, artwork: resolveDeviceArtwork({ ...device, deviceName: device.name }).src,
     targetText: targetText(device.kind, device.target),
     resultText: phase.status === 'cancelled' ? '已取消' : result.text,
     resultReason: deviceResultReason(device),
     resultTone: phase.status === 'cancelled' ? 'wait' : result.tone }
   }),
  }
 })
 const start = interval ? taskTime(interval.startsAt) : phases[0]?.time || ''
 const end = interval ? taskTime(interval.endsAt) : phases.length > 1 ? phases.at(-1).time : ''
 const whenText = end && start.slice(0, 10) === end.slice(0, 10)
  ? `${start} 至 ${end.slice(-5)}` : [start, end].filter(Boolean).join(' 至 ')
 const report = task.report ? {
  generatedText: taskTime(task.report.generatedAt),
  outcomeText: taskStatusText(taskResultStatus({ status: task.report.outcome, phases: reportPhases })),
  checkpoints: task.report.phases.length,
  devicesVisible: new Set(task.report.phases.flatMap(phase => phase.devices.map(device => device.id))).size,
  summary: taskExecutionSummaryView(task.report.summary, reportPhases),
 } : null
 const pending = phases.filter(phase => ['pending', 'scheduled'].includes(phase.status))
 const finished = phases.filter(phase => !['pending', 'scheduled', 'executing'].includes(phase.status))
 const executing = phases.filter(phase => phase.status === 'executing')
 const rulesText = [...new Set(phases.flatMap(phase => phase.readAc
  ? [phase.readAc.criteriaText || phase.readAc.summary, phase.readAc.cadenceText || phase.readAc.scheduleText, phase.readAc.limitText]
  : phase.readAgent ? [phase.readAgent.objectiveText, phase.readAgent.periodText, phase.readAgent.comparisonText] : []).filter(Boolean))].join('；')
 const presentationStatus = taskResultStatus(task)
 const focus = phases.findIndex(phase => phase.status === 'executing' || ['pending', 'scheduled'].includes(phase.status))
 const previewStart = Math.max(0, focus < 0 ? phases.length - 3 : focus - 1)
 const previewPhases = phases.length > 3 ? phases.slice(previewStart, previewStart + 3) : phases
 const nextAt = pending[0]?.at || task.nextCheckpointAt || task.nextAt
 const nextLabel = (task.phases || []).some(phase => phase?.read?.ac?.cadenceMinutes) ? '下一次检查' : '下一次执行'
 return { ...task, phases, previewPhases, rulesText, presentationStatus, occurrenceText: task.occurrence ? task.occurrence.virtual ? '以后的安排' : '本次任务' : '', progressText: `已结束${finished.length}次${executing.length ? ` · 正在做${executing.length}次` : ''} · 还有${pending.length}次安排`, whenText, report, repeatText: repeatText(task.repeat), nextText: nextAt ? taskTime(nextAt) : '', nextLabel, createdText: taskTime(task.createdAt),
  statusText: taskStatusText(presentationStatus),
  sourceText: task.agentSource === 'company' ? task.source?.type === 'recurring_plan' ? '公司重复安排' : '公司定时任务'
   : task.source?.type === 'recurring_plan' ? '重复安排' : task.source?.type === 'sample' ? '本地演示记录' : task.source?.type === 'immediate_draft' ? '即时操作' : '定时任务' }
}
