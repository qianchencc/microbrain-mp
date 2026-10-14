// meter_report 观察块（区间统计）视图模型：参数行、合计、分段柱、位置构成与依据行全部
// 由报告事实派生；图表一律经 energy-chart.mjs 生成，组件内不写几何。
// 口径：总量单位「度」；无数据/数据不全的表不进合计，在参数行与构成尾部如实标注。
import { meterBarChart, meterRankingChart } from './energy-chart.mjs'
import { comparisonDate } from './energy-comparison-view.mjs'
import { fmtShanghaiDateTime } from './observation-view.mjs'

const finite = value => typeof value === 'number' && Number.isFinite(value)

export const meterReportGrains = [{ key: 'day', label: '日' }, { key: 'week', label: '周' }, { key: 'month', label: '月' }]

// 度值：千分位、至多 1 位小数；小值不取整以免空刻度。
export const degreeText = value => finite(value)
 ? (Math.abs(value) >= 1000 ? value.toLocaleString('zh-CN', { maximumFractionDigits: 1 }) : String(Math.round(value * 10) / 10))
 : '—'

export function meterReportSpan(report) {
 const requested = report?.params?.span?.requested || {}
 return `${String(requested.from || '').slice(0, 10)} → ${String(requested.to || '').slice(5, 10)}`
}

// 参数行：时间跨度 · 范围名 台数 · 覆盖尾注（数据不全给截至时刻，无数据只报数）。
export function meterReportParamLine(report) {
 const scope = report?.params?.scope || {}
 const coverage = report?.coverage || {}
 let line = `${meterReportSpan(report)} · ${scope.label || '全部电表'} ${scope.meterCount ?? report?.meters?.length ?? 0}台`
 const through = (coverage.partial || []).map(item => item.through).filter(Boolean).sort().at(-1)
 if ((coverage.partial || []).length) line += ` · ${coverage.partial.length}台数据截至${comparisonDate(through)}`
 if (coverage.noData?.length) line += ` · ${coverage.noData.length}台无数据`
 return line
}

export function meterReportHero(report) {
 const total = report?.total || {}
 return {
  value: finite(total.value) ? degreeText(total.value) : null,
  yuan: finite(total.yuan) && finite(total.tariff) ? `约 ¥${degreeText(total.yuan)} · 按 ${total.tariff} 元/度` : '',
 }
}

// 分段柱：bucketsAll 已带全部分粒度，切换粒度只换投影，区间总量不变。
// partial 段画斜纹；不足一个完整粒度的尾段在 x 标注重标「·N天」。
export function meterReportBuckets(report, grain) {
 const items = report?.bucketsAll?.[grain] || (report?.buckets?.grain === grain ? report.buckets.items : []) || []
 const columns = items.map(bucket => ({
  value: finite(bucket.value) ? bucket.value : null,
  label: bucketLabel(bucket, grain),
  status: bucket.partial ? 'partial' : undefined,
 }))
 return { ...meterBarChart(columns), points: columns }
}

function bucketLabel(bucket, grain) {
 const base = grain === 'month' ? `${Number(String(bucket.from).slice(5, 7))}月` : comparisonDate(bucket.from)
 const natural = grain === 'day' ? 1 : grain === 'week' ? 7 : daysInMonth(bucket.from)
 return bucket.partial && bucket.days < natural ? `${base}·${bucket.days}天` : base
}

function daysInMonth(fromIso) {
 const year = Number(String(fromIso).slice(0, 4)), month = Number(String(fromIso).slice(5, 7))
 return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

// 位置构成：前 8 行 + 其余聚合；被排除的表折叠为两行文字，不进柱条。
export function meterReportRanking(report) {
 const composition = report?.composition || {}
 const rows = [...(composition.rows || [])].map(row => ({ label: row.label, value: finite(row.value) ? row.value : null }))
 if (composition.rest && composition.rest.count > 0) rows.push({ label: `其余 ${composition.rest.count} 处`, value: composition.rest.value })
 const excluded = []
 if (composition.excluded?.partial) excluded.push(`数据不全 ${composition.excluded.partial} 处 —`)
 if (composition.excluded?.noData) excluded.push(`无数据 ${composition.excluded.noData} 处 —`)
 return { ...meterRankingChart(rows), rows, excluded }
}

// 依据行：每台表的实际起止采样时刻与示数；两端缺失或区间内无采样如实标注。
export function meterReportEvidence(report) {
 const sampleText = sample => `${fmtShanghaiDateTime(sample.readTime)} · 示数 ${degreeText(sample.value)}`
 return (report?.meters || []).map(meter => {
  const from = meter.observed?.fromSample, to = meter.observed?.toSample
  return {
   id: meter.id,
   name: meter.name,
   label: meter.areaName || meter.name,
   statusText: ({ ok: '计入合计', noData: '无数据', partial: '数据不全' })[meter.status] || meter.status,
   bounds: from || to ? `起 ${from ? sampleText(from) : '缺失'} · 止 ${to ? sampleText(to) : '缺失'}` : '区间内无采样记录',
   valueText: finite(meter.value) ? `${degreeText(meter.value)} 度` : '—',
  }
 })
}

// 点电表进原始采样页：沿报告请求窗口，读取沿用既有逐表历史接口。
export function meterReportHistoryQuery(report, meterId) {
 const requested = report?.params?.span?.requested || {}
 return { equipmentId: meterId, from: requested.from, to: requested.to }
}
