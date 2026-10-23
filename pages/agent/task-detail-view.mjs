import { fieldLabels, fanLabels, modeLabels } from './ac-draft.js'
import { resolveDeviceArtwork } from './device-art/catalog.js'

const statusText = { scheduled: '未执行', executing: '执行中', completed: '已执行', partial: '部分完成', failed: '未完成', unconfirmed: '待核验', cancelled: '已取消', missed: '未执行', interrupted: '已中断', verified: '已执行', satisfied: '不必执行', pending: '未执行' }
const companyStatusText = { scheduled: '未执行', executing: '执行中', completed: '已完成', partial: '部分完成', failed: '未完成', unconfirmed: '结果待核验', cancelled: '已取消', missed: '未执行', interrupted: '已中断', verified: '已核验', satisfied: '无需执行', pending: '未执行' }
const statusLabel = (status, source) => (source === 'company' ? companyStatusText[status] : statusText[status]) || status

export function executionResult(device, source) {
 if (device.outcome === 'observed') return '已读取'
 if (device.outcome === 'satisfied') return '不必执行'
 if (device.outcome === 'unconfirmed' && device.details?.requiresVerification) return '结果待核验'
 if (device.outcome === 'verified' || (device.outcome === 'unconfirmed' && !device.details?.requiresVerification && device.details?.receipt === 'ACCEPTED' && !device.details?.timedOut)) return '已执行'
 if (['pending', 'not_dispatched'].includes(device.outcome)) return '未执行'
 if (source === 'company' && device.outcome === 'unknown') return '结果未知'
 return '未完成'
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
  cadenceText: ac.cadenceMinutes ? `频率 · 每 ${ac.cadenceMinutes} 分钟检查一次` : '',
  scheduleText: ac.cadenceMinutes ? '' : '排程 · 指定时刻检查一次',
  actionText: ac.mode === 'adjust_to_26' ? '动作 · 满足条件时把设定温度调整为26℃' : '动作 · 只读取状态，不调整设备',
  limitText: '限制 · 不自动开机、不切换模式、不调整风速',
 }
}

// 报告设备行聚合与 report-summary 同口径：adjusted 优先，not_dispatched/unknown 逐级让位；
// before 取设备首次出现的调前 setpoint，after 按最终处置表达，不据指令反推。
const ENERGY_DEVICE_ROW_LIMIT = 6
function acReportDeviceRows(phases, target) {
 const seen = new Map()
 for (const phase of phases || []) {
  for (const block of phase.observations || []) {
   if (block?.type !== 'ac_inspection' || block.mode !== 'adjust_to_26') continue
   for (const device of block.devices || []) {
    const entry = seen.get(device.deviceId)
    if (!entry) seen.set(device.deviceId, { name: device.name, before: device.setpoint, disposition: device.disposition })
    else if (device.disposition === 'adjusted') entry.disposition = 'adjusted'
    else if (device.disposition === 'not_dispatched' && entry.disposition !== 'adjusted') entry.disposition = 'not_dispatched'
    else if (device.disposition === 'unknown' && !['adjusted', 'not_dispatched'].includes(entry.disposition)) entry.disposition = 'unknown'
   }
  }
 }
 const rows = [...seen.entries()].map(([deviceId, device]) => {
  const before = Number.isFinite(device.before) ? `${device.before}℃` : '—'
  if (device.disposition === 'adjusted') return { deviceId, name: device.name, before, after: `${target}℃`, tone: 'ok' }
  if (device.disposition === 'not_needed') return { deviceId, name: device.name, before, after: '无需调整', tone: 'muted' }
  return { deviceId, name: device.name, before, after: { not_dispatched: '未下发', unknown: '结果未知' }[device.disposition] || '未调温', tone: 'muted' }
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
   devices: acReportDeviceRows(reportPhases, impact.baseline?.target ?? 26),
  }
 }
 if (impact.status === 'unavailable' && devices) {
  return {
   kind: 'unavailable', tone: 'muted',
   text: impact.reason || '暂无法可靠估算节能情况',
   hero: { value: '暂无法可靠估算', unit: '', label: `本次已调节 ${devices.adjusted || 0} 台空调`, badge: '口径缺失', footnote: impact.reason || '' },
   facts: [
    { value: `${devices.total || 0} 台`, label: '纳入范围' },
    { value: `${devices.adjusted || 0} 台`, label: '实际调节' },
    { value: `${devices.satisfied || 0} 台`, label: '无需调整' },
   ],
   basisTitle: '已确认的执行事实',
   formula: `${devices.total || 0} 台纳入 · ${devices.adjusted || 0} 台调节 · ${devices.satisfied || 0} 台无需调整`,
   notes: [],
   devices: acReportDeviceRows(reportPhases, 26),
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
 const counts = [`已调 ${devices.adjusted || 0}`, `无需 ${devices.satisfied || 0}`, `跳过 ${devices.skipped || 0}`]
 if (devices.failed) counts.push(`失败 ${devices.failed}`)
 if (devices.unknown) counts.push(`未知 ${devices.unknown}`)
 if (devices.unverified) counts.push(`待核验 ${devices.unverified}`)
 return {
  checkpointsText: `${summary.checkpoints || 0} 次检查`,
  devicesText: `涉及 ${devices.total || 0} 台 · ${counts.join(' · ')}`,
  energy: energyImpactView(summary.energyImpact, devices, reportPhases),
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

export function resultText(device, source) {
 if (device.details?.requiresVerification) {
  if (device.outcome === 'verified') return '已核验'
  if (device.outcome === 'unconfirmed' && device.details.receipt === 'ACCEPTED') return device.details.readback?.observedState === null ? '已受理 · 回读失败' : '已受理 · 目标未核验'
 }
 const status = executionResult(device, source)
 if (status !== '未完成') return status
 const rejected = (device.details?.fields || []).filter(field => field.outcome === 'REJECTED')
  .map(field => fieldLabels[field.field] || field.field)
 if (rejected.length) return `${status} · ${rejected.join('、')}未受理`
 if (device.details?.timedOut) return `${status} · 平台响应超时`
 const reason = { rejected: '平台未受理', unknown: '结果未知', unreadable: '状态未读取', missing: '设备不可用' }[device.outcome]
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
   devices: (phase.devices || []).map(device => {
    const outcome = executionResult(device, task.agentSource)
    return { ...device, artwork: resolveDeviceArtwork({ ...device, deviceName: device.name }).src,
     targetText: targetText(device.kind, device.target),
     resultText: phase.status === 'cancelled' ? '已取消，未下发' : resultText(device, task.agentSource),
     resultTone: phase.status === 'cancelled' ? 'wait' : device.details?.requiresVerification && device.outcome === 'unconfirmed' ? 'warn' : outcome === '未完成' ? 'fail' : outcome === '结果未知' ? 'warn' : outcome === '未执行' ? 'wait' : 'ok' }
   }),
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
  summary: taskExecutionSummaryView(task.report.summary, reportPhases),
 } : null
 return { ...task, phases, whenText, report, repeatText: repeatText(task.repeat), nextText: task.nextAt ? taskTime(task.nextAt) : '', createdText: taskTime(task.createdAt),
  statusText: task.occurrence?.virtual ? '未来安排' : interval && task.status === 'executing'
   ? task.executionActive ? '设备执行中' : '区间进行中'
   : statusLabel(task.status, task.agentSource),
  sourceText: task.agentSource === 'company' ? task.source?.type === 'recurring_plan' ? '公司周期计划' : '公司定时任务'
   : task.source?.type === 'recurring_plan' ? 'Agent 周期计划' : task.source?.type === 'sample' ? '本地演示记录' : task.source?.type === 'immediate_draft' ? 'Agent 即时操作' : 'Agent 定时任务' }
}
