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
  complete: Boolean(day.complete),
  covered: day.coveredMeters ?? 0,
  expected: day.expectedMeters ?? 0
 }))
 return [...map.values()].sort((a, b) => a.date < b.date ? -1 : 1)
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
 return '示数增量 · 单位与倍率未经客户确认'
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
