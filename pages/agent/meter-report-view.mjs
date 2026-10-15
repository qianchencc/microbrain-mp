// meter_report 观察块（区间统计 / 时间对比）视图模型：参数行、主数字、分段柱、位置构成、
// 贡献涨跌条与依据行全部由报告事实派生；图表一律经 energy-chart.mjs 生成，组件内不写几何。
// 口径：总量单位「度」；无数据/数据不全的表不进合计，在参数行与构成尾部如实标注。
// 对比只比较两期都有效的同一批表：差额 = 本期 − 基期；贡献按位置差额绝对值排序。
import { meterBarChart, meterRankingChart, loadShapeChart, floorSplitChart, contributionChart } from './energy-chart.mjs'
import { comparisonDate } from './energy-comparison-view.mjs'
import { fmtShanghaiDateTime } from './observation-view.mjs'

const finite = value => typeof value === 'number' && Number.isFinite(value)
export const meterReportIsComparison = report => report?.kind === 'comparison'
export const meterReportAxis = report => report?.params?.axis === 'region' ? 'region' : 'time'
export function meterReportHasData(report) {
 if (!report) return false
 if (!meterReportIsComparison(report)) return (report?.coverage?.dataMeters ?? 0) > 0
 if (meterReportAxis(report) === 'region') {
  return (report?.sides?.a?.coverage?.dataMeters ?? 0) > 0 || (report?.sides?.b?.coverage?.dataMeters ?? 0) > 0
 }
 return (report?.coverage?.dataMeters ?? 0) > 0
  || (report?.sides?.a?.dataMeters ?? 0) > 0
  || (report?.sides?.b?.dataMeters ?? 0) > 0
}
// 对比卡「曲线 | 分段」切换：曲线 = 本期/上期 24 小时负荷叠加；分段 = 两期同粒度双柱。
export const meterCompareViews = [{ key: 'curve', label: '曲线' }, { key: 'bars', label: '分段' }]

export const meterReportGrains = [{ key: 'day', label: '日' }, { key: 'week', label: '周' }, { key: 'month', label: '月' }]

// 单日跨度默认且只提供「时」粒度；更长跨度给 日/周/月。
export const meterReportIsDay = report => {
 const span = report?.params?.span?.requested || {}
 return Date.parse(span.to) - Date.parse(span.from) <= 86_400_000
}
export const meterReportGrainOptions = report => meterReportIsDay(report) ? [{ key: 'hour', label: '时' }] : meterReportGrains

// 度值：千分位、至多 1 位小数；小值不取整以免空刻度。
export const degreeText = value => finite(value)
 ? (Math.abs(value) >= 1000 ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : String(Math.round(value * 100) / 100))
 : '—'

const boundaryLabel = (iso, withYear) => {
 const text = String(iso || '')
 const ms = Date.parse(text)
 if (!Number.isFinite(ms) || text.length < 16) return text.slice(0, 10)
 const day = withYear ? text.slice(0, 10) : text.slice(5, 10)
 const h = Number(text.slice(11, 13)), m = Number(text.slice(14, 16))
 return h === 0 && m === 0 ? day : `${day} ${text.slice(11, 16)}`
}
const spanLabel = (requested, short) => {
 const fromMs = Date.parse(requested?.from || ''), toMs = Date.parse(requested?.to || '')
 const crossYear = Number.isFinite(fromMs) && Number.isFinite(toMs)
  && String(requested.from || '').slice(0, 4) !== String(requested.to || '').slice(0, 4)
 return `${boundaryLabel(requested?.from, !short || crossYear)} → ${boundaryLabel(requested?.to, crossYear)}`
}

export function meterReportSpan(report) {
 const requested = report?.params?.span?.requested || {}
 return spanLabel(requested, false)
}

// 参数行：时间跨度（时间对比为本期 vs 基期，区域对比为本期 · A范围 vs B范围）· 覆盖尾注。
export function meterReportParamLine(report) {
 const scope = report?.params?.scope || {}
 const coverage = report?.coverage || {}
 const base = report?.params?.baseline?.requested
 let line = ''
 if (meterReportAxis(report) === 'region') {
  const other = report?.params?.other || {}
  line = `${meterReportSpan(report)} · ${scope.label || '全部电表'} ${scope.meterCount ?? report?.sides?.a?.coverage?.meters ?? 0}台 vs ${other.label || '全部电表'} ${other.meterCount ?? report?.sides?.b?.coverage?.meters ?? 0}台`
  if (report?.overlapMeterIds?.length) line += ` · 重叠 ${report.overlapMeterIds.length} 台`
  const aExcluded = (report?.sides?.a?.coverage?.noData?.length || 0) + (report?.sides?.a?.coverage?.partial?.length || 0)
  const bExcluded = (report?.sides?.b?.coverage?.noData?.length || 0) + (report?.sides?.b?.coverage?.partial?.length || 0)
  if (aExcluded) line += ` · A ${aExcluded}台未计入`
  if (bExcluded) line += ` · B ${bExcluded}台未计入`
 } else {
  const spanReq = report?.params?.span?.requested
  const diffYear = Boolean(base) && String(spanReq?.from || '').slice(0, 4) !== String(base?.from || '').slice(0, 4)
  const when = base ? `${spanLabel(spanReq, !diffYear)} vs ${spanLabel(base, !diffYear)}` : meterReportSpan(report)
  line = `${when} · ${scope.label || '全部电表'} ${scope.meterCount ?? report?.meters?.length ?? 0}台`
 }
 const through = (coverage.partial || []).map(item => item.through).filter(Boolean).sort().at(-1)
 if (meterReportAxis(report) !== 'region' && (coverage.partial || []).length) line += ` · ${coverage.partial.length}台数据截至${comparisonDate(through)}`
 else if (meterReportAxis(report) !== 'region') {
  const reqTo = Date.parse(report?.params?.span?.requested?.to || '')
  const obsTo = Date.parse(report?.params?.span?.observed?.to || '')
  if (Number.isFinite(reqTo) && Number.isFinite(obsTo) && reqTo - obsTo > 86_400_000) {
   line += ` · 截至${comparisonDate(report.params.span.observed.to)}`
  }
 }
 if (meterReportAxis(report) !== 'region' && coverage.noData?.length) line += ` · ${coverage.noData.length}台无数据`
 if (coverage.truncated) line += ' · 读取不全'
 return line
}

const signed = value => {
 const visible = Math.round(Math.abs(value) * 100) / 100
 return { sign: visible === 0 ? '' : value > 0 ? '+' : '−', tone: visible === 0 ? '' : value > 0 ? 'up' : 'down' }
}
const signedDegree = value => { const s = signed(value); return { ...s, text: `${s.sign}${degreeText(Math.abs(value))}` } }

const sideTotal = (side, empty) => (!empty && finite(side?.total?.value)) ? `${degreeText(side.total.value)} 度` : '—'

export function meterReportHero(report) {
 if (meterReportIsComparison(report)) {
  const diff = report?.diff || {}, sides = report?.sides || {}
  if (meterReportAxis(report) === 'region') {
   const scopeA = report?.params?.scope?.label || 'A', scopeB = report?.params?.other?.label || 'B'
   const aValid = (report?.sides?.a?.coverage?.dataMeters ?? 0) > 0, bValid = (report?.sides?.b?.coverage?.dataMeters ?? 0) > 0
   const totalText = (side, ok) => ok && finite(side?.total?.value) ? `${degreeText(side.total.value)} 度` : '—'
   return {
    mode: 'region',
    label: `用电量 · ${scopeA} vs ${scopeB}`,
    value: aValid || bValid ? `${totalText(sides.a, aValid)} vs ${totalText(sides.b, bValid)}` : null,
    detail: finite(diff.value)
     ? `差 ${signedDegree(diff.value).text} 度${finite(diff.pct) ? ` · ${signedDegree(diff.pct).text}%` : ''}`
     : '',
    pctNote: !finite(diff.value) ? (diff.pctNote || '') : (finite(diff.pct) ? '' : diff.pctNote || ''),
   }
  }
  const span = report?.params?.span?.requested || {}, base = report?.params?.baseline?.requested || {}
  const cohortEmpty = (report?.coverage?.dataMeters ?? null) === 0
  const aEmpty = sides.a?.dataMeters !== undefined ? sides.a.dataMeters === 0 : cohortEmpty
  const bEmpty = sides.b?.dataMeters !== undefined ? sides.b.dataMeters === 0 : cohortEmpty
  const isDailyBasis = diff.basis === 'dailyAvg'
  const relation = report?.params?.relation
  const isYear = relation === 'yearOverYear'
  const baseLabel = isYear ? '去年同期' : '上期'
  const adjacent = !isDailyBasis && Date.parse(base.to) === Date.parse(span.from)
   && Date.parse(span.to) - Date.parse(span.from) === Date.parse(base.to) - Date.parse(base.from)
  const ratioLabel = relation === 'yearOverYear' ? '同比'
   : relation === 'previousPeriod' ? '环比'
   : relation === 'custom' ? '较基期'
   : adjacent ? '环比' : '较基期'
  const oneSide = aEmpty !== bEmpty
  const sideTag = oneSide ? ` · ${aEmpty ? `${baseLabel}用电` : '本期用电'}` : ''
  const label = relation !== undefined
   ? `${relation === 'yearOverYear' ? '用电同比' : relation === 'previousPeriod' ? '用电环比' : '用电时间对比'}${isDailyBasis && !oneSide ? ' · 日均' : ''}${sideTag}`
   : `${isDailyBasis && !oneSide ? '日均用电' : '用电量'} · 与上期相比${sideTag}`
  const primary = aEmpty ? sides.b : sides.a
  const sideWithDays = (side, empty) => {
   const t = sideTotal(side, empty)
   return !empty && isDailyBasis && finite(side?.effectiveDays) ? `${t}（${degreeText(side.effectiveDays)}天）` : t
  }
  return {
   label,
   value: oneSide
    ? (finite(primary?.total?.value) ? degreeText(primary.total.value) : null)
    : finite(diff.value) ? signedDegree(diff.value).text : null,
   unit: oneSide ? '度' : diff.unit || (isDailyBasis ? '度/日' : '度'),
   pct: !oneSide && finite(diff.pct) ? `${ratioLabel} ${signedDegree(diff.pct).text}%` : '',
   pctNote: oneSide ? `${aEmpty ? '本期' : baseLabel}无有效采样` : (finite(diff.pct) ? '' : (diff.pctNote || '基期为零')),
   sub: `本期 ${sideWithDays(sides.a, aEmpty)} · ${baseLabel} ${sideWithDays(sides.b, bEmpty)}`,
  }
 }
 const total = report?.total || {}
 if ((report?.coverage?.dataMeters ?? 0) === 0) return { empty: true, value: null, yuan: '' }
 return {
  value: finite(total.value) ? degreeText(total.value) : null,
  yuan: finite(total.yuan) && finite(total.tariff) ? `约 ¥${degreeText(total.yuan)} · 按 ${total.tariff} 元/度` : '',
 }
}

// 定位行：全部 → 楼层占比条；楼层/名称匹配 → 占全部与单台日均对照；单台 → 占本层与排名。
export function meterReportContext(report) {
 const context = report?.context
 if (!context) return null
 if (context.kind === 'floorSplit') return { kind: 'split', chart: floorSplitChart(context.floors) }
 if (context.kind === 'parent') {
  const share = finite(context.share) ? `${context.share}%` : '—'
  const daily = finite(context.perMeterDaily) && finite(context.parentPerMeterDaily)
   ? `单台日均 ${degreeText(context.perMeterDaily)} 度（${context.parentLabel === '全部电表' ? '全部' : context.parentLabel} ${degreeText(context.parentPerMeterDaily)}）` : ''
  return { kind: 'line', text: `占${context.parentLabel} ${share}${daily ? ' · ' + daily : ''}` }
 }
 if (context.kind === 'peer') {
  const share = finite(context.share) ? `${context.share}%` : '—'
  const rank = finite(context.rank) && finite(context.of) ? ` · 本层第 ${context.rank}/${context.of}` : ''
  return { kind: 'line', text: `占${context.parentLabel} ${share}${rank}` }
 }
 return null
}
// 2×2 指标格（统计）/ 本期·上期·变化表（对比）：标签可点开一句话定义。峰值日 sub 是日期，峰值小时 sub 是时刻。
const METRIC_LABELS = {
 dailyAvg: '日均', weekdayDailyAvg: '工作日日均', nightBase: '夜间基荷', peakDay: '峰值日', top3Share: '前3占比',
 dayTotal: '当日合计', peakHour: '峰值小时', nightShare: '夜间占比', perMeterDaily: '单台日均',
}
const METRIC_DEFS = {
 dailyAvg: '统计期内平均每天用电',
 weekdayDailyAvg: '周一至周五数据完整日的平均用电',
 nightBase: '00:00–06:00 平均每小时用电，代表无人时的持续耗电',
 peakDay: '用电最多的一天（只计数据完整的日子）',
 top3Share: '用电最多的 3 个位置占总量的比例',
 dayTotal: '统计日当天的总用电',
 peakHour: '用电最多的一个小时',
 nightShare: '00:00–06:00 用电占比，越高说明越多持续用电',
 perMeterDaily: '日均 ÷ 有数据的电表台数',
}
const metricSub = sub => sub ? (String(sub).includes(':') ? sub : comparisonDate(sub)) : ''
const metricLabel = metric => metric.key === 'nightBase' && metric.nightWindow === '20:00-08:00' ? '夜间负荷' : (METRIC_LABELS[metric.key] || metric.key)
const metricDefinition = metric => metric.dayWindow === 'previous08:00-08:00' && metric.key === 'peakDay'
 ? '前日08:00–当日08:00用电最多的完整计量日，日期按结束日'
 : metric.dayWindow === 'previous08:00-08:00' && metric.key === 'weekdayDailyAvg'
 ? '按结束日期取周一至周五的完整计量日平均用电（前日08:00–当日08:00）'
 : metric.key === 'nightBase' && metric.nightWindow === '20:00-08:00' ? '20:00–次日08:00 用电量 ÷ 12小时，取范围内有效完整夜间的平均' : (METRIC_DEFS[metric.key] || '')
export function meterReportMetrics(report) {
 return (report?.metrics || []).map(metric => ({
  key: metric.key,
  label: metricLabel(metric),
  valueText: finite(metric.value) ? degreeText(metric.value) : '—',
  unit: metric.unit || '',
  sub: metricSub(metric.sub),
  def: metricDefinition(metric),
 }))
}

export function meterReportMetricHeads(report) {
 if (meterReportAxis(report) === 'region') {
  return [report?.params?.scope?.label || 'A', report?.params?.other?.label || 'B', '差']
 }
 return ['本期', report?.params?.relation === 'yearOverYear' ? '去年同期' : '上期', '变化']
}

// 对比指标表：指标 / 本期 / 上期 / 变化 四列；两侧数值带单位小字，峰值日的 sub 是日期、峰值小时是时刻；
// 变化只给带符号数值（单位与该行一致），正→up（玉绿）、负→down（黄铜）、null→—。
export function meterReportMetricTable(report) {
 return (report?.metrics || []).map(metric => {
  const unit = metric.unit ? ` ${metric.unit}` : ''
  const cell = side => ({
   text: finite(side?.value) ? `${degreeText(side.value)}${unit}` : '—',
   sub: metricSub(side?.sub),
  })
  return {
   key: metric.key,
   label: metricLabel(metric),
   a: cell(metric.a),
   b: cell(metric.b),
   change: finite(metric.change)
    ? (() => { const s = signedDegree(metric.change); return { text: s.text, tone: s.tone } })()
    : { text: '—', tone: '' },
   def: metricDefinition(metric),
  }
 })
}

// 24 小时负荷：覆盖不足时 rates 为 null → 整节隐藏；单日画当天实际曲线；
// 单台范围画同层对照（本表实线 + 本层单台平均虚线）；对比画本期实线 + 上期虚线（任一侧有数据即显示）。
export function meterReportLoadCurve(report) {
 const nightWindow = (report?.metrics || []).find(m => m.key === 'nightBase')?.nightWindow
 if (meterReportIsComparison(report)) {
  const a = report?.sides?.a?.shape24?.rates, b = report?.sides?.b?.shape24?.rates
  if (!Array.isArray(a) && !Array.isArray(b)) return null
  const region = meterReportAxis(report) === 'region'
  const perMeter = Boolean(report?.sides?.a?.shape24?.perMeter || report?.sides?.b?.shape24?.perMeter)
  const suffix = region && perMeter ? ' · 单台平均' : ''
  const legend = region
   ? [`${report?.params?.scope?.label || 'A'}${suffix}`, `${report?.params?.other?.label || 'B'}${suffix}`]
   : ['本期', report?.params?.relation === 'yearOverYear' ? '去年同期' : '上期']
  const chart = loadShapeChart(Array.isArray(a) ? a : [], {
   peer: Array.isArray(b) ? b : [], legend, nightWindow,
   ...(region ? { peerColor: '#b89443', peerDash: '' } : {}),
  })
  const hasData = (Array.isArray(a) && a.some(v => finite(v))) || (Array.isArray(b) && b.some(v => finite(v)))
  if (!hasData) return null
  return { ...chart, hasData: true, title: `${meterReportIsDay(report) ? '当日小时负荷' : '24小时负荷'}${suffix}` }
 }
 const rates = report?.shape24?.rates
 if (!Array.isArray(rates)) return null
 const peerRates = report?.peer?.floorPerMeterRates
 const parentLabel = report?.context?.kind === 'peer' ? report.context.parentLabel : ''
 const chart = loadShapeChart(rates, { nightWindow, ...(peerRates ? { peer: peerRates, legend: ['本表', `${parentLabel}单台平均`] } : {}) })
 if (!chart.hasData) return null
 return { ...chart, title: meterReportIsDay(report) ? '当日小时负荷' : '24小时负荷' }
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
 if (grain === 'hour') return String(bucket.from).slice(11, 16) // 'HH:00'
 const base = grain === 'month' ? `${Number(String(bucket.from).slice(5, 7))}月` : comparisonDate(bucket.from)
 const natural = grain === 'day' ? 1 : grain === 'week' ? 7 : daysInMonth(bucket.from)
 return bucket.partial && bucket.days < natural ? `${base}·${bucket.days}天` : base
}

export function meterReportCompareView(report) {
 const a = report?.sides?.a?.shape24?.rates, b = report?.sides?.b?.shape24?.rates
 const sideOk = rates => Array.isArray(rates) && rates.some(v => finite(v))
 return sideOk(a) && sideOk(b) ? 'curve' : 'bars'
}

export function meterReportCompareViews(report) {
 const a = report?.sides?.a?.shape24?.rates, b = report?.sides?.b?.shape24?.rates
 const sideOk = rates => Array.isArray(rates) && rates.some(v => finite(v))
 return sideOk(a) || sideOk(b) ? meterCompareViews : meterCompareViews.filter(v => v.key === 'bars')
}

export function meterReportBarLegend(report) {
 if (!meterReportIsComparison(report)) return []
 if (meterReportAxis(report) === 'region') {
  return [
   { label: report?.params?.scope?.label || 'A', color: '#3d8a68' },
   { label: report?.params?.other?.label || 'B', color: '#bfd2b9' },
  ]
 }
 const baseWord = report?.params?.relation === 'yearOverYear' ? '去年同期' : '上期'
 return [{ label: '本期', color: '#3d8a68' }, { label: baseWord, color: '#bfd2b9' }]
}

// 对比分段：两期同粒度双柱（基期灰绿、本期玉绿），按下标配对；不同长度时多余侧照常画、对侧为 null。
export function meterReportCompareBuckets(report) {
 const a = report?.sides?.a?.buckets || {}, b = report?.sides?.b?.buckets || {}
 const grain = a.grain === 'hour' ? 'hour' : 'day'
 const count = Math.max(a.items?.length || 0, b.items?.length || 0)
 const columns = Array.from({ length: count }, (_, i) => {
  const va = a.items?.[i], vb = b.items?.[i]
  const ref = va || vb || {}
  return {
   value: va && finite(va.value) ? va.value : null,
   baseline: vb && finite(vb.value) ? vb.value : null,
   label: bucketLabel(ref, grain),
   status: (va?.partial || vb?.partial) ? 'partial' : undefined,
  }
 })
 return { ...meterBarChart(columns, { paired: true }), points: columns }
}

// 贡献涨跌条：按位置 Δ = 本期 − 上期 排序（服务端已排），前 8 + 其余；
// 单台范围时覆盖整层并高亮本表所在位置（标题给「本表 ±Δ」）。
export function meterReportContribution(report) {
 const contribution = report?.contribution || {}
 const roundDelta = delta => {
  if (!finite(delta)) return null
  const rounded = Math.round(Math.abs(delta) * 100) / 100
  return rounded === 0 ? 0 : delta < 0 ? -rounded : rounded
 }
 const rows = [...(contribution.rows || [])].map(row => ({ label: row.label, delta: roundDelta(row.delta), highlight: Boolean(row.highlight) }))
 if (contribution.rest && contribution.rest.count > 0) rows.push({ label: `其余 ${contribution.rest.count} 处`, delta: roundDelta(contribution.rest.delta) })
 const own = rows.find(row => row.highlight)
 const isPeer = report?.context?.kind === 'peer'
 const daily = contribution.unit === '度/日'
 return {
  title: daily ? `${isPeer ? `${report.context.parentLabel} ` : '分位置'}日均变化 · 度/日` : isPeer ? `${report.context.parentLabel} 变化` : '分位置 变化',
  sub: isPeer && own && finite(own.delta) ? `本表 ${signedDegree(own.delta).text}${daily ? ' 度/日' : ''}` : '',
  shareText: finite(contribution.topShare) ? `前3项占变化的 ${contribution.topShare}%` : '前3项占变化的 —',
  shareDef: '前 3 项变化量绝对值之和 ÷ 全部变化量绝对值之和',
  rows,
  ...contributionChart(rows, { formatValue: delta => signedDegree(delta).text }),
 }
}

function daysInMonth(fromIso) {
 const year = Number(String(fromIso).slice(0, 4)), month = Number(String(fromIso).slice(5, 7))
 return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

// 位置构成：前 8 行 + 其余聚合；被排除的表折叠为两行文字，不进柱条。
// 单台范围时构成是本层排行（标题为「N楼 构成」），本表所在位置行高亮。
export function meterReportRankingTitle(report) {
 return report?.context?.kind === 'peer' ? `${report.context.parentLabel} 构成 · 度` : '位置构成 · 度'
}
export function meterReportRanking(report) {
 const composition = report?.composition || {}
 const rows = [...(composition.rows || [])].map(row => ({ label: row.label, value: finite(row.value) ? row.value : null, highlight: Boolean(row.highlight) }))
 if (composition.rest && composition.rest.count > 0) rows.push({ label: `其余 ${composition.rest.count} 处`, value: composition.rest.value })
 const excluded = []
 if (composition.excluded?.partial) excluded.push(`数据不全 ${composition.excluded.partial} 处 —`)
 if (composition.excluded?.noData) excluded.push(`无数据 ${composition.excluded.noData} 处 —`)
 return { ...meterRankingChart(rows), rows, excluded }
}

export function meterReportRegionRankings(report) {
 const sideRows = side => {
  const composition = side?.composition || {}
  const rows = [...(composition.rows || [])].map(row => ({ label: row.label, value: finite(row.value) ? row.value : null, highlight: Boolean(row.highlight) }))
  if (composition.rest && composition.rest.count > 0) rows.push({ label: `其余 ${composition.rest.count} 处`, value: composition.rest.value })
  const excluded = []
  if (composition.excluded?.partial) excluded.push(`数据不全 ${composition.excluded.partial} 处 —`)
  if (composition.excluded?.noData) excluded.push(`无数据 ${composition.excluded.noData} 处 —`)
  return { rows, excluded }
 }
 const a = sideRows(report?.sides?.a), b = sideRows(report?.sides?.b)
 const titleA = `${report?.params?.scope?.label || 'A'} · ${report?.params?.scope?.meterCount ?? report?.sides?.a?.coverage?.meters ?? 0}台`
 const titleB = `${report?.params?.other?.label || 'B'} · ${report?.params?.other?.meterCount ?? report?.sides?.b?.coverage?.meters ?? 0}台`
 return [
  { title: titleA, ...meterRankingChart(a.rows), excluded: a.excluded, rows: a.rows },
  { title: titleB, ...meterRankingChart(b.rows, { color: '#b89443' }), excluded: b.excluded, rows: b.rows },
 ]
}

// 依据行：每台表的实际起止采样时刻与示数；两端缺失或区间内无采样如实标注。
// 对比报告每台表带两期（a=本期、b=基期）各自的起止采样与区间差；任一侧无效即不进对比。
export function meterReportEvidence(report) {
 const sampleText = sample => `${fmtShanghaiDateTime(sample.readTime)} · 示数 ${degreeText(sample.value)}`
 if (meterReportAxis(report) === 'region') {
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
 if (meterReportIsComparison(report)) {
  return (report?.meters || []).map(meter => {
   const sideText = side => {
    const from = side?.observed?.fromSample, to = side?.observed?.toSample
    return from || to ? `起 ${from ? sampleText(from) : '缺失'} · 止 ${to ? sampleText(to) : '缺失'}` : '期内无采样'
   }
   const bothOk = meter.a?.status === 'ok' && meter.b?.status === 'ok'
   const delta = bothOk && finite(meter.a.value) && finite(meter.b.value) ? meter.a.value - meter.b.value : null
   const sideTag = side => ({ ok: '计入', noData: '无数据', partial: '数据不全' })[side?.status] || '?'
   return {
    id: meter.id,
    name: meter.name,
    label: meter.areaName || meter.name,
    statusText: bothOk ? '计入对比' : `未计入（本期${sideTag(meter.a)}·上期${sideTag(meter.b)}）`,
    bounds: `本期 ${sideText(meter.a)}　｜　上期 ${sideText(meter.b)}`,
    valueText: delta !== null ? `${signedDegree(delta).text} 度` : '—',
   }
  })
 }
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

// 依据抽屉抬头的时间文字：对比写「本期 … · 上期 …」或区域「A … · B …」，统计写请求跨度。
export function meterReportSpanText(report) {
 if (meterReportAxis(report) === 'region') return meterReportSpan(report)
 if (meterReportIsComparison(report)) {
  const a = report?.params?.span?.requested || {}, b = report?.params?.baseline?.requested || {}
  return `本期 ${spanLabel(a, true)} · 上期 ${spanLabel(b, true)}`
 }
 return meterReportSpan(report)
}

export function meterReportEvidenceSections(report) {
 if (meterReportAxis(report) === 'region') {
  const idsA = new Set((report?.sides?.a?.meters || []).map(m => m.id))
  const idsB = new Set((report?.sides?.b?.meters || []).map(m => m.id))
  const all = meterReportEvidence(report)
  const tag = (report?.params?.scope?.label || 'A'), tagB = (report?.params?.other?.label || 'B')
  const inBoth = new Set(report?.overlapMeterIds || [])
  return [
   { tag: `A · ${tag}`, rows: all.filter(row => idsA.has(row.id)) },
   { tag: `B · ${tagB}`, rows: all.filter(row => idsB.has(row.id) && !inBoth.has(row.id)) },
  ].filter(section => section.rows.length)
 }
 return [{ tag: '', rows: meterReportEvidence(report) }]
}

// 点电表进原始采样页：沿报告请求窗口（对比覆盖基期+本期，与周比较卡的含基期窗口一致），
// 读取沿用既有逐表历史接口。
export function meterReportHistoryQuery(report, meterId) {
 const requested = report?.params?.span?.requested || {}
 if (meterReportIsComparison(report)) {
  const base = report?.params?.baseline?.requested || {}
  const starts = [requested.from, base.from].filter(v => Number.isFinite(Date.parse(v)))
  const ends = [requested.to, base.to].filter(v => Number.isFinite(Date.parse(v)))
  const from = starts.length ? starts.reduce((x, y) => Date.parse(y) < Date.parse(x) ? y : x) : requested.from
  const to = ends.length ? ends.reduce((x, y) => Date.parse(y) > Date.parse(x) ? y : x) : requested.to
  return { equipmentId: meterId, from, to }
 }
 return { equipmentId: meterId, from: requested.from, to: requested.to }
}

export function meterReportPowerFactor(report, meterId) {
 if (!report || !meterId) return []
 const find = list => (list ?? []).find(meter => meter?.id === meterId)
 const format = pf => {
  if (!pf || typeof pf !== 'object') return null
  const num = value => typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : '—'
  const core = pf.samples ? `采样均值 ${num(pf.mean)} · 最低 ${num(pf.min)} · ${pf.samples} 次有效采样` : '采样均值 — · 最低 —'
  return pf.complete === false ? `${core} · 读取不全` : core
 }
 if (!meterReportIsComparison(report)) {
  const text = format(find(report.meters)?.powerFactor)
  return text ? [`功率因数 ${text}`] : []
 }
 if (meterReportAxis(report) === 'region') {
  const text = format(find(report.sides?.a?.meters)?.powerFactor ?? find(report.sides?.b?.meters)?.powerFactor ?? find(report.meters)?.powerFactor)
  return text ? [`功率因数 ${text}`] : []
 }
 const meter = find(report.meters)
 const a = format(meter?.a?.powerFactor), b = format(meter?.b?.powerFactor)
 return [...(a ? [`本期功率因数 ${a}`] : []), ...(b ? [`上期功率因数 ${b}`] : [])]
}
