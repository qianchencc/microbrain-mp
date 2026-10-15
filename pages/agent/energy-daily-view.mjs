// 公司逐日能耗统计的视图模型：把 company-energy-daily 接口的诚实口径转成界面状态。
// 规则：usage=null/状态非正常 → 显示“—”，不补零、不取绝对值；
// 未确认口径（aggregation.status!=verified 或 basis.unit!=kWh）数字不带“度”。

export const STRIP_COL_WIDTH = 21 // px，与 .eday 列宽一致
export const STRIP_PAGE_DAYS = 30
export const PIE_COLORS = ['#3c8c6b', '#a47b35', '#8fb294', '#cfe0cd', '#dde5d8']

// 日期条增量合并：按 date 去重、升序，返回新数组（供 didPrepend 位移补偿计算 added）。
export function mergeStripDays(current, days) {
 const map = new Map((current || []).map(d => [d.date, d]))
 ;(days || []).forEach(day => map.set(day.date, {
  date: day.date,
  usage: typeof day.usage === 'number' ? day.usage : null,
  elapsedUsage: typeof day.elapsedUsage === 'number' ? day.elapsedUsage : null,
  elapsedMeters: day.elapsedMeters ?? 0,
  complete: Boolean(day.complete),
  covered: day.coveredMeters ?? 0,
  expected: day.expectedMeters ?? 0,
  pending: false,
  failed: false
 }))
 return [...map.values()].sort((a, b) => a.date < b.date ? -1 : 1)
}

// 占位日：面板把整段日期预铺为 pending 柱，数据块按区间补进原位——
// 条带永不缺列，日历跳任何日期都有目标柱，横滑跨月无拼接。
export function padStripDays(current, from, to) {
 const map = new Map((current || []).map(d => [d.date, d]))
 for (let d = from; d <= to; d = shiftDate(d, 1)) {
  if (map.has(d)) continue
  map.set(d, { date: d, pending: true, failed: false, usage: null, elapsedUsage: null, elapsedMeters: 0, complete: false, covered: 0, expected: 0 })
 }
 return [...map.values()].sort((a, b) => a.date < b.date ? -1 : 1)
}

// 补块失败的区间标记：只动仍是 pending 的日，已落位的真实数据不改。
export function markStripFailed(current, from, to) {
 return (current || []).map(d => d.pending && d.date >= from && d.date <= to ? { ...d, pending: false, failed: true } : d)
}

// 楼层构成环：SVG data-uri 经 <image> 渲染（与 timeline-svg/energy-chart 同法，wxss 无 conic-gradient）。
export function donutImage(values, size = 58) {
 const R = 20, C = 2 * Math.PI * R
 const total = (values || []).reduce((a, b) => a + b, 0)
 let arcs = '', off = 0
 ;(values || []).forEach((v, i) => {
  if (!v || !total) return
  const len = v / total * C
  arcs += `<circle cx="29" cy="29" r="${R}" fill="none" stroke="${PIE_COLORS[i % PIE_COLORS.length]}" stroke-width="10" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 29 29)"/>`
  off += len
 })
 const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 58 58"><circle cx="29" cy="29" r="${R}" fill="none" stroke="#eef2ea" stroke-width="10"/>${arcs}</svg>`
 return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

export function shiftDate(date, delta) {
 const d = new Date(Date.parse(date + 'T00:00:00Z') + delta * 864e5)
 return d.toISOString().slice(0, 10)
}

export function shanghaiToday() {
 return new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)
}

export function dayLabel(date, latestCompleteDay) {
 const label = `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`
 return date === latestCompleteDay ? label + ' · 昨日' : label
}

export function unitOf(report) {
 return report?.basis?.unit === 'kWh' ? '度' : ''
}

export function unitNote(report) {
 if (!report) return ''
 if (report.basis?.unit === 'kWh') return report.aggregation?.label ? `统计范围 · ${report.aggregation.label}` : ''
 return ''
}

// 逐日条用 days[]（已按日期升序）；bar 高度按可视窗口最大值归一。
export function stripDays(report) {
 return (report?.days || []).map(day => ({
  date: day.date,
  usage: typeof day.usage === 'number' ? day.usage : null,
  complete: Boolean(day.complete),
  covered: day.coveredMeters ?? 0,
  expected: day.expectedMeters ?? 0
 }))
}

// 楼层/区域构成：按表名前缀归组（26楼/27楼/农旅…），与原型口径一致。
export function floorOf(name = '') {
 const m = name.match(/(\d+)\s*楼/)
 if (m) return `${m[1]}楼`
 if (name.includes('农旅')) return '农旅'
 return '其他'
}

export function meterRows(report, date) {
 if (!report) return []
 return (report.meters || []).map(meter => {
  const cell = meter.daily?.[date]
  return {
   id: meter.id,
   name: meter.name,
   location: meter.location || '',
   floor: floorOf(meter.name || meter.location || ''),
   usage: cell && typeof cell.usage === 'number' ? cell.usage : null,
   status: cell?.status || 'not_computable'
  }
 })
}

export function floorComposition(rows) {
 const sums = new Map()
 rows.forEach(row => {
  if (row.usage == null) return
  sums.set(row.floor, (sums.get(row.floor) || 0) + row.usage)
 })
 const entries = [...sums.entries()].sort((a, b) => b[1] - a[1])
 const total = entries.reduce((s, [, v]) => s + v, 0)
 return {
  total,
  items: entries.map(([label, value]) => ({ label, value: round2(value), share: total ? value / total : 0 }))
 }
}

// comparison.*.meterUsage（meterId → 用量）→ 楼层构成条目（与 floorComposition 同序）。
export function compositionFromUsage(meterUsage, nameOf) {
 const sums = new Map()
 for (const [id, v] of Object.entries(meterUsage || {})) {
  if (typeof v !== 'number') continue
  const floor = floorOf(nameOf(id) || '')
  sums.set(floor, (sums.get(floor) || 0) + v)
 }
 return [...sums.entries()].sort((a, b) => b[1] - a[1])
  .map(([label, value]) => ({ label, value: round2(value) }))
}

export function round2(n) {
 return Math.round((n + Number.EPSILON) * 100) / 100
}

export function fmtUsage(value, unit) {
 return value == null ? '—' : `${value}${unit ? ' ' + unit : ''}`
}

// 较前一日 / 较上周同日：只在两侧都可算时给百分比。
export function comparePct(current, base) {
 if (typeof current !== 'number' || typeof base !== 'number' || !base) return null
 return round2((current - base) / base * 100)
}

export function statusText(status) {
 return ({ comparable: '', partial: '边界不齐', not_computable: '不可算' })[status] || ''
}

const localEnergyDate = ms => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10)
const localEnergyTime = ms => new Date(ms + 8 * 3600_000).toISOString().replace('Z', '+08:00')
const preciseEnergyTime = value => typeof value === 'string'
 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
 && Number.isFinite(Date.parse(value))
 && new Date(value.slice(0, 10) + 'T00:00:00Z').toISOString().slice(0, 10) === value.slice(0, 10) ? Date.parse(value) : NaN

export function fixedEnergyContext(query) {
 if (query == null) return null
 const from = preciseEnergyTime(query.from), to = preciseEnergyTime(query.to)
 if (typeof query.equipmentId !== 'string' || !query.equipmentId.trim()
  || !Number.isFinite(from) || !Number.isFinite(to) || from >= to) throw new Error('固定统计范围须包含电表及有效起止时刻')
 return { equipmentId: query.equipmentId.trim(), from: query.from, to: query.to,
  minDate: localEnergyDate(from), maxDate: localEnergyDate(to - 1) }
}

export function fixedEnergyWindow(context, days = 90, end = context.maxDate) {
 if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('读取窗口须为1至90天')
 if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end < context.minDate || end > context.maxDate
  || !Number.isFinite(Date.parse(end + 'T00:00:00Z')) || shiftDate(end, 0) !== end) return null
 const start = [context.minDate, shiftDate(end, -(days - 1))].sort().at(-1)
 const from = Math.max(Date.parse(context.from), Date.parse(start + 'T00:00:00+08:00'))
 const to = Math.min(Date.parse(context.to), Date.parse(shiftDate(end, 1) + 'T00:00:00+08:00'))
 return { kind: 'statistics', scopeLevel: 'location', meterId: context.equipmentId,
  from: from === Date.parse(context.from) ? context.from : localEnergyTime(from),
  to: to === Date.parse(context.to) ? context.to : localEnergyTime(to), grain: 'day' }
}

export function meterStatisticsDailyView(source, context) {
 const meter = source?.meters?.[0], requested = source?.params?.span?.requested
 const from = Date.parse(requested?.from), to = Date.parse(requested?.to)
 if (source?.kind !== 'statistics' || source?.meters?.length !== 1 || meter.id !== context.equipmentId
  || !Number.isFinite(from) || !Number.isFinite(to) || from >= to
  || from < Date.parse(context.from) || to > Date.parse(context.to)) throw new Error('返回的电表或时间范围与固定统计范围不符')
 const items = source.bucketsAll?.day || (source.buckets?.grain === 'day' ? source.buckets.items : []) || []
 const daily = {}
 const days = items.map(item => {
  const start = Date.parse(item.from), end = Date.parse(item.to)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < from || end > to || start >= end
   || item.value !== null && (typeof item.value !== 'number' || !Number.isFinite(item.value) || item.value < 0)) throw new Error('日分段超出固定统计范围或数值无效')
  const date = localEnergyDate(start), usage = item.value
  const complete = usage !== null && !item.partial && source.coverage?.dataMeters === 1
  daily[date] = { usage, status: usage === null ? 'not_computable' : complete ? 'comparable' : 'partial' }
  return { date, usage, complete, coveredMeters: usage === null ? 0 : 1, expectedMeters: 1, elapsedUsage: null, elapsedMeters: 0 }
 })
 return {
  source: 'company', observedAt: source.observedAt, timezone: 'Asia/Shanghai',
  basis: { field: 'epf', boundaryHour: 0, cycle: '请求区间按日分段 · 按实际采样边界计量', unit: 'kWh', nonOverlapping: true },
  window: { ...requested }, latestSampleTime: source.params.span.observed?.to || meter.observed?.toSample?.readTime || null,
  latestCompleteDay: days.filter(day => day.complete).at(-1)?.date || null, truncated: Boolean(source.coverage?.truncated),
  aggregation: { status: 'verified', label: source.params.scope.label, note: '固定电表与统计期间', policyVersion: null },
  comparison: { currentDay: null, previousDay: null, lastWeekSameDay: null }, days,
  meters: [{ id: meter.id, name: meter.name, location: meter.areaName || '', latest: meter.observed?.toSample?.readTime || null,
   complete: !source.coverage?.truncated, daily }],
 }
}
