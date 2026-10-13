import { meterBarChart } from './energy-chart.mjs'
import { comparisonDate } from './energy-comparison-view.mjs'

export const energyKindLabel = kind => ({ statistics: '用电统计', comparison: '用电对比', inspection: '电表检查' })[kind] || '计量结果'
export const energyValue = value => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'

const finite = value => typeof value === 'number' && Number.isFinite(value)
export const singleMeterOf = report => !report.summary?.total && report.meters?.length === 1 ? report.meters[0] : null
const DAY = 86400000
const shortName = name => {
 const text = String(name || '计量点').replace(/电表$/, '')
 return text.length > 6 ? text.slice(0, 6) + '…' : text
}
const periodLabel = period => {
 if (period.label) return period.label
 const span = Date.parse(period.to) - Date.parse(period.from)
 return span >= 25 * DAY ? String(period.from).slice(5, 7).replace(/^0/, '') + '月' : comparisonDate(period.from)
}

// 三种图形态：
// series — 统计按日/周/月分桶；paired — 两期对比逐表双柱；periods — 明确多期对比按期成柱。
export function energyBusinessChart(report, grain = 'week') {
 const single = singleMeterOf(report)
 if (report.kind === 'comparison' && report.windows?.length <= 2) {
  const pairs = report.meters
   .filter(m => m.periods.some(p => finite(p.usage)))
   .sort((a, b) => Math.abs((b.periods.at(-1)?.usage ?? 0) - (b.periods[0]?.usage ?? 0)) - Math.abs((a.periods.at(-1)?.usage ?? 0) - (a.periods[0]?.usage ?? 0)))
   .slice(0, 12)
   .map(m => ({ baseline: m.periods[0]?.usage, value: m.periods.at(-1)?.usage, label: shortName(m.meter.name), status: m.periods.at(-1)?.status }))
  const chart = meterBarChart(pairs, { paired: true })
  return { ...chart, mode: 'paired', points: pairs }
 }
 if (report.kind === 'comparison') {
  const points = report.periods.map((p, i) => ({ value: p.metric?.value ?? single?.periods[i]?.usage ?? null, label: periodLabel(p), sub: comparisonDate(p.to), status: p.metric ? p.metric.status === 'complete' ? 'comparable' : 'partial' : single?.periods[i]?.status || 'not_computable' }))
  const chart = meterBarChart(points, { minCell: 62 })
  return { ...chart, mode: 'periods', points }
 }
 const source = single?.series?.[grain] || report.series?.[grain] || []
 const points = source.map(p => ({ value: finite(p.usage) ? p.usage : null, label: grain === 'month' ? periodLabel({ from: p.from, to: p.to }) : comparisonDate(p.from), status: p.status }))
 const chart = meterBarChart(points)
 return { ...chart, mode: 'series', points }
}

export function legacyCompanyEnergy(report) {
 const metric = p => p?.usage == null ? null : { value: p.usage, unit: 'kWh', status: p.status === 'comparable' ? 'complete' : 'partial', meterIds: report.meters.filter(m => m.includedInTotal).map(m => m.meter.id) }
 const periods = [report.baseline, ...report.periods].filter(Boolean), total = metric(periods.at(-1)), previous = metric(periods.at(-2))
 return { ...report, meters: report.meters.map(m => ({ ...m, periods: [m.baseline, ...m.periods].filter(Boolean) })), type: 'energy-report', kind: 'comparison', requested: report.window, windows: periods.map(p => p.requested), periods: periods.map(p => ({ ...p.requested, metric: metric(p) })), series: { day: [], week: [], month: [] }, summary: { total, previous, difference: total && previous ? total.value - previous.value : null, ratio: periods.at(-1)?.ratio, average: null }, coverage: { requestedMeters: report.progress.total, completedMeters: report.progress.completed, validMeters: report.progress.completed, failedMeters: report.progress.failed, status: report.progress.status }, findings: [], rules: { growthThreshold: null }, basis: { ...report.basis, aggregation: report.aggregation.status, policyVersion: report.aggregation.policyVersion } }
}
