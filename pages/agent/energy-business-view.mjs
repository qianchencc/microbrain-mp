import { comparisonDate, energyComparisonChart } from './energy-comparison-view.mjs'
export const energyKindLabel = kind => ({ statistics: '用电统计', comparison: '用电对比', inspection: '电表检查' })[kind] || '计量结果'
export const energyValue = value => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
export function energySeries(report, grain) {
 const single = !report.summary.total && report.meters.length === 1 ? report.meters[0] : null
 return report.kind === 'comparison' ? report.periods.map((p, i) => ({ usage: p.metric?.value ?? single?.periods[i]?.usage ?? null, status: p.metric ? p.metric.status === 'complete' ? 'comparable' : 'partial' : single?.periods[i]?.status || 'not_computable', label: p.label || (report.periods.length > 2 ? comparisonDate(p.from) : i === 0 ? '上期' : '本期'), endLabel: comparisonDate(p.to) })) : (single?.series?.[grain] || report.series?.[grain] || []).map(p => ({ ...p, label: comparisonDate(p.from), endLabel: comparisonDate(p.to) }))
}
export function energyBusinessChart(report, grain) { const points = energySeries(report, grain); return { points, width: Math.max(360, points.length * 52), src: energyComparisonChart({}, points, Math.max(360, points.length * 52)) } }
export function legacyCompanyEnergy(report) {
 const metric = p => p?.usage == null ? null : { value: p.usage, unit: 'kWh', status: p.status === 'comparable' ? 'complete' : 'partial', meterIds: report.meters.filter(m => m.includedInTotal).map(m => m.meter.id) }
 const periods = [report.baseline, ...report.periods].filter(Boolean), total = metric(periods.at(-1)), previous = metric(periods.at(-2))
 return { ...report, meters: report.meters.map(m => ({ ...m, periods: [m.baseline, ...m.periods].filter(Boolean) })), type: 'energy-report', kind: 'comparison', requested: report.window, windows: periods.map(p => p.requested), periods: periods.map(p => ({ ...p.requested, metric: metric(p) })), series: { day: [], week: [], month: [] }, summary: { total, previous, difference: total && previous ? total.value - previous.value : null, ratio: periods.at(-1)?.ratio, average: null }, coverage: { requestedMeters: report.progress.total, completedMeters: report.progress.completed, validMeters: report.progress.completed, failedMeters: report.progress.failed, status: report.progress.status }, findings: [], rules: { growthThreshold: null }, basis: { ...report.basis, aggregation: report.aggregation.status, policyVersion: report.aggregation.policyVersion } }
}
