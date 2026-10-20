// 共享图表语法：SVG data-URI 承载，供 WeChat image 渲染。
// 柱状约定：value null/not_computable → “缺测”留白；status partial → 斜纹（短窗实测）；current → 虚线进行中；
// value 0 → 基线扁条；paired → 灰绿基期 + 玉绿本期双柱。x 轴标签随图内嵌，横向滚动时与柱体同步。
// 涨跌条（contributionChart）：以零线为中心发散，+Δ 向右玉绿、−Δ 向左黄铜，highlight 行铺淡黄铜底。
// 折线约定：点按真实 x 坐标定位，相邻间隔超过中位间隔约 2.5 倍即断段（缺测不伪装成连续曲线）；
// 稀疏时保留顶点小点，密集时只留线与淡色面积；孤立单点段始终画点。

const finite = value => typeof value === 'number' && Number.isFinite(value)
const FONT = 'font-family="sans-serif"'

function niceScale(max) {
 const magnitude = 10 ** Math.floor(Math.log10(Math.max(max, 1e-9)))
 for (const m of [.1, .2, .25, .5, 1, 2, 2.5, 5, 10]) {
  const step = m * magnitude
  if (Math.ceil(max / step) <= 4) return { step, top: Math.ceil(max / step) * step }
 }
 return { step: magnitude * 10, top: Math.ceil(max / (magnitude * 10)) * magnitude * 10 }
}

const tickLabel = value => String(Number(value.toPrecision(4)))
const barLabel = value => {
 if (!finite(value)) return '—'
 const rounded = Math.round(value * 10) / 10
 return Math.abs(rounded) >= 1000 ? rounded.toLocaleString('en-US', { maximumFractionDigits: 0 }) : String(rounded)
}

// columns: [{ value, baseline?, label, sub?, status?, current?, approx? }]
// options: { paired, maxLabels, minCell }
// 返回 { src, width, height, padLeft, padRight, hasData }：padLeft/padRight 为 viewBox 内左右边距，
// 供图下 HTML 列以百分比 margin 与柱体一一对齐。
export function meterBarChart(columns, options = {}) {
 const list = Array.isArray(columns) ? columns : []
 const paired = Boolean(options.paired)
 const minCell = options.minCell ?? (paired ? 62 : 46)
 const padLeft = 34, padRight = 8
 const width = Math.max(options.minWidth ?? 300, Math.ceil(list.length * minCell + padLeft + padRight))
 const height = 176, top = 22, base = 140
 const cell = (width - padLeft - padRight) / Math.max(1, list.length)
 const max = Math.max(1, ...list.flatMap(c => [finite(c.value) ? c.value : 0, paired && finite(c.baseline) ? c.baseline : 0]))
 const { step, top: ceiling } = niceScale(max)
 const y = v => base - v / ceiling * (base - top)
 const showLabels = list.length <= (options.maxLabels ?? 8)

 let grid = ''
 for (let v = 0; v <= ceiling + step / 2; v += step) {
  const gy = y(v)
  grid += `<line x1="${padLeft}" x2="${width - padRight}" y1="${gy}" y2="${gy}" stroke="${v === 0 ? '#c9cfc0' : '#e1e6d8'}"${v === 0 ? ' stroke-width="1.5"' : ' stroke-dasharray="3 5"'}/>`
  if (v > 0) grid += `<text x="${padLeft - 7}" y="${gy + 3}" text-anchor="end" font-size="9" fill="#a9b3a2">${tickLabel(v)}</text>`
 }

 const bars = list.map((c, i) => {
  const cx = padLeft + cell * (i + .5)
  const missing = !finite(c.value)
  const missingBase = paired && !finite(c.baseline)
  let svg = ''
  if (missing && (!paired || missingBase)) {
   svg += `<text x="${cx}" y="${base - 14}" text-anchor="middle" font-size="9.5" fill="#a9b6a4">缺测</text>`
  } else if (paired) {
   const bw = Math.min(18, cell * .26)
   const bx = missing ? cx + bw / 2 : cx
   if (!missingBase) {
    const bh = c.baseline / ceiling * (base - top)
    if (bh > 0) svg += `<rect x="${bx - bw - 2}" y="${y(c.baseline)}" width="${bw}" height="${bh}" rx="3" fill="#bfd2b9"/>`
    else svg += `<line x1="${bx - bw - 1}" x2="${bx - 3}" y1="${base - 1}" y2="${base - 1}" stroke="#bfd2b9" stroke-width="2"/>`
   }
   if (!missing) {
    const ch = c.value / ceiling * (base - top)
    if (ch > 0) svg += `<rect x="${cx + 2}" y="${y(c.value)}" width="${bw}" height="${ch}" rx="3" fill="url(#jade)"/>`
    else svg += `<line x1="${cx + 3}" x2="${cx + bw + 1}" y1="${base - 1}" y2="${base - 1}" stroke="#74a58c" stroke-width="2"/>`
   }
  } else {
   const bw = Math.min(30, cell * .55)
   const h = c.value / ceiling * (base - top)
   if (c.current) svg += `<rect x="${cx - bw / 2}" y="${y(c.value)}" width="${bw}" height="${Math.max(h, 4)}" rx="4" fill="#176b54" fill-opacity=".05" stroke="#a3b8ac" stroke-dasharray="4 4"/>`
   else if (c.status === 'partial') svg += `<rect x="${cx - bw / 2}" y="${y(c.value)}" width="${bw}" height="${Math.max(h, 4)}" rx="4" fill="url(#hatch)"/>`
   else if (h > 0) svg += `<rect x="${cx - bw / 2}" y="${y(c.value)}" width="${bw}" height="${h}" rx="4" fill="url(#jade)"/>`
   else svg += `<line x1="${cx - 9}" x2="${cx + 9}" y1="${base - 1}" y2="${base - 1}" stroke="#b5beb0" stroke-width="2" stroke-linecap="round"/>`
  }
  if (!missing && showLabels) {
   const color = c.current ? '#8a958c' : c.status === 'partial' ? '#957441' : '#355a43'
   const prefix = c.approx ? '≈' : ''
   svg += `<text x="${cx}" y="${Math.max(11, y(c.value) - 7)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${color}">${prefix}${barLabel(c.value)}</text>`
  }
  if (c.label) svg += `<text x="${cx}" y="${base + 15}" text-anchor="middle" font-size="9.5" fill="#80917b">${escapeXml(c.label)}</text>`
  if (c.sub) svg += `<text x="${cx}" y="${base + 27}" text-anchor="middle" font-size="8.5" fill="#a3b09c">${escapeXml(c.sub)}</text>`
  return svg
 }).join('')

 const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ${FONT}><defs><linearGradient id="jade" x2="0" y2="1"><stop stop-color="#388e6d"/><stop offset="1" stop-color="#176b54"/></linearGradient><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="7" height="7" fill="#d9e8dc"/><path d="M0 0v7" stroke="#74a58c" stroke-width="3"/></pattern></defs>${grid}${bars}</svg>`
 return { src: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), width, height, padLeft, padRight, hasData: list.some(c => finite(c.value) || (paired && finite(c.baseline))) }
}

function escapeXml(text) {
 return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// 横向排行条：位置名左列、玉绿条 ∝ value/max、末端数值；null 值行画占位线不画条。
// rows: [{ label, value|null, highlight? }]（highlight 预留：构成排行中强调当前表）
export function meterRankingChart(rows, options = {}) {
 const list = Array.isArray(rows) ? rows : []
 const width = options.width ?? 320
 const rowHeight = 26, topPad = 2, labelW = 96, valueW = 56
 const height = topPad * 2 + list.length * rowHeight
 const max = Math.max(...list.map(row => finite(row.value) ? row.value : 0), 1e-9)
 const barArea = width - labelW - valueW - 8
 const clip = label => { const text = String(label ?? ''); return escapeXml(text.length > 9 ? text.slice(0, 9) + '…' : text) }

 const body = list.map((row, i) => {
  const y = topPad + i * rowHeight
  const mid = y + rowHeight / 2
  let svg = `<text x="0" y="${mid + 3}" font-size="10.5" fill="#4a5d4e">${clip(row.label)}</text>`
  if (finite(row.value)) {
   const w = Math.max(3, row.value / max * barArea)
   svg += `<rect x="${labelW}" y="${y + 5}" width="${w.toFixed(2)}" height="${rowHeight - 11}" rx="4" fill="${row.highlight ? '#b89443' : options.color || 'url(#jade)'}"/>`
   svg += `<text x="${width}" y="${mid + 3}" text-anchor="end" font-size="10.5" font-weight="600" fill="#355a43">${barLabel(row.value)}</text>`
  } else {
   svg += `<line x1="${labelW + 4}" x2="${labelW + 22}" y1="${mid}" y2="${mid}" stroke="#c2cabc" stroke-width="2" stroke-linecap="round"/>`
   svg += `<text x="${width}" y="${mid + 3}" text-anchor="end" font-size="10.5" fill="#a9b6a4">—</text>`
  }
  return svg
 }).join('')

 const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ${FONT}><defs><linearGradient id="jade" x2="0" y2="1"><stop stop-color="#388e6d"/><stop offset="1" stop-color="#176b54"/></linearGradient></defs>${body}</svg>`
 return { src: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), width, height, hasData: list.some(row => finite(row.value)) }
}

// 涨跌贡献条：以零线为中心的横向发散条。delta>0 向右玉绿、<0 向左黄铜、=0 画中心刻痕；
// highlight 行铺淡黄铜底（单台范围时标出本表所在位置）。数值带 ± 号按涨跌着色。
// rows: [{ label, delta, highlight? }]
export function contributionChart(rows, options = {}) {
 const list = Array.isArray(rows) ? rows : []
 const width = options.width ?? 320
 const rowHeight = 26, topPad = 2, labelW = 96, valueW = 58
 const height = topPad * 2 + list.length * rowHeight + 2
 const max = Math.max(...list.map(row => finite(row.delta) ? Math.abs(row.delta) : 0), 1e-9)
 const barArea = width - labelW - valueW - 8
 const zero = labelW + barArea / 2
 const clip = label => { const text = String(label ?? ''); return escapeXml(text.length > 9 ? text.slice(0, 9) + '…' : text) }
 const JADE = '#3d8a68', BRASS = '#b89443'

 let body = `<line x1="${zero}" x2="${zero}" y1="${topPad}" y2="${topPad + list.length * rowHeight}" stroke="#c9cfc0" stroke-width="1.5"/>`
 body += list.map((row, i) => {
  const y = topPad + i * rowHeight
  const mid = y + rowHeight / 2
  let svg = ''
  if (row.highlight) svg += `<rect x="0" y="${y + 1}" width="${width}" height="${rowHeight - 2}" rx="5" fill="#f5efdf"/>`
  svg += `<text x="6" y="${mid + 3}" font-size="10.5" fill="${row.highlight ? '#8a6a2f' : '#4a5d4e'}">${clip(row.label)}</text>`
  const delta = finite(row.delta) ? row.delta : null
  if (delta === null) {
   svg += `<line x1="${zero - 9}" x2="${zero + 9}" y1="${mid}" y2="${mid}" stroke="#c2cabc" stroke-width="2" stroke-linecap="round"/>`
   svg += `<text x="${width}" y="${mid + 3}" text-anchor="end" font-size="10.5" fill="#a9b6a4">—</text>`
  } else {
   const w = Math.max(3, Math.abs(delta) / max * (barArea / 2 - 2))
   if (delta > 0) svg += `<rect x="${zero + 1}" y="${y + 5}" width="${w.toFixed(2)}" height="${rowHeight - 11}" rx="4" fill="${JADE}"/>`
   else if (delta < 0) svg += `<rect x="${(zero - 1 - w).toFixed(2)}" y="${y + 5}" width="${w.toFixed(2)}" height="${rowHeight - 11}" rx="4" fill="${BRASS}"/>`
   else svg += `<line x1="${zero - 4}" x2="${zero + 4}" y1="${mid}" y2="${mid}" stroke="#a9b6a4" stroke-width="2" stroke-linecap="round"/>`
   const tone = delta > 0 ? JADE : delta < 0 ? BRASS : '#a9b6a4'
   const sign = delta > 0 ? '+' : delta < 0 ? '−' : ''
   const valueText = options.formatValue ? escapeXml(options.formatValue(delta)) : `${sign}${barLabel(Math.abs(delta))}`
   svg += `<text x="${width}" y="${mid + 3}" text-anchor="end" font-size="10.5" font-weight="600" fill="${tone}">${valueText}</text>`
  }
  return svg
 }).join('')

 const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ${FONT}>${body}</svg>`
 return { src: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), width, height, hasData: list.some(row => finite(row.delta)) }
}

const toMs = value => typeof value === 'number' ? value : Date.parse(value)

// 非负传感域的纵轴刻度：按原始跨度选 nice step，再把上下界对齐到 step 的整数倍；
// 数据整体非负时下界不超过 0。返回 { lo, hi, ticks }。
function niceDomain(min, max) {
 let span = max - min
 if (!finite(span) || span <= 0) { min = finite(min) ? min : 0; max = min + 2; span = 2 }
 const { step } = niceScale(span)
 const pad = span * .1
 let lo = Math.floor((min - pad) / step) * step
 const hi = Math.ceil((max + pad) / step) * step
 if (min >= 0 && lo < 0) lo = 0
 const ticks = []
 for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toPrecision(8)))
 return { lo, hi, ticks }
}

// points: [{ at: <ms 或可解析时间>, value: number|null, ref?: 原始对象 }]
// options: { from, to（x 窗界）, selected?: 与 ref 同一对象的选中点 }
// 返回 { src, width, height, xOf, hasData }：xOf(at) 给出 SVG 横坐标，供点击命中复用同一几何。
export function trendLineChart(points, options = {}) {
 const width = options.width ?? 360, height = options.height ?? 154
 const padLeft = 32, padRight = 10, top = 14, base = height - 14
 const from = toMs(options.from), span = Math.max(1, toMs(options.to) - from)
 const xOf = at => padLeft + (toMs(at) - from) / span * (width - padLeft - padRight)

 const list = (Array.isArray(points) ? points : [])
  .map(p => ({ at: toMs(p.at), value: finite(p.value) ? p.value : null, ref: p.ref ?? p }))
  .filter(p => Number.isFinite(p.at) && p.value !== null)
  .sort((a, b) => a.at - b.at)

 const { lo, hi, ticks } = niceDomain(list.length ? Math.min(...list.map(p => p.value)) : 0, list.length ? Math.max(...list.map(p => p.value)) : 0)
 const y = v => base - (v - lo) / (hi - lo) * (base - top)

 let grid = ''
 for (const t of ticks) {
  const gy = y(t)
  grid += `<line x1="${padLeft}" x2="${width - padRight}" y1="${gy.toFixed(2)}" y2="${gy.toFixed(2)}" stroke="${t === lo ? '#d2dcd0' : '#e1e9df'}" stroke-dasharray="3 5"/>`
  grid += `<text x="${padLeft - 6}" y="${(gy + 3).toFixed(2)}" text-anchor="end" font-size="9" fill="#a9b3a2">${tickLabel(t)}</text>`
 }

 const intervals = []
 for (let i = 1; i < list.length; i++) intervals.push(list[i].at - list[i - 1].at)
 const sorted = intervals.slice().sort((a, b) => a - b)
 const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : Infinity
 const gapLimit = intervals.length >= 3 ? median * 2.5 : span * .2

 const segments = []
 for (const p of list) {
  const last = segments.at(-1)
  if (last && p.at - last.at(-1).at <= gapLimit) last.push(p)
  else segments.push([p])
 }

 let body = ''
 for (const seg of segments) {
  const line = seg.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.at).toFixed(2)} ${y(p.value).toFixed(2)}`).join('')
  if (seg.length === 1) {
   body += `<circle cx="${xOf(seg[0].at).toFixed(2)}" cy="${y(seg[0].value).toFixed(2)}" r="3" fill="#3c8c6b" stroke="#fbfdf8" stroke-width="1.5"/>`
   continue
  }
  const first = xOf(seg[0].at).toFixed(2), last = xOf(seg.at(-1).at).toFixed(2)
  body += `<path d="${line}L${last} ${base}L${first} ${base}Z" fill="url(#trendFill)"/>`
  body += `<path d="${line}" fill="none" stroke="#2e7d5c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
 }
 if (list.length <= 48) {
  body += list.filter(p => !segments.some(s => s.length === 1 && s[0] === p)).map(p =>
   `<circle cx="${xOf(p.at).toFixed(2)}" cy="${y(p.value).toFixed(2)}" r="1.9" fill="#3c8c6b"/>`).join('')
 }
 const selected = list.find(p => p.ref === options.selected)
 if (selected) {
  body += `<circle cx="${xOf(selected.at).toFixed(2)}" cy="${y(selected.value).toFixed(2)}" r="5" fill="#b89443" stroke="#fbfdf8" stroke-width="1.5"/>`
 }

 const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ${FONT}><defs><linearGradient id="trendFill" x2="0" y2="1"><stop stop-color="#3f8f6d" stop-opacity=".26"/><stop offset="1" stop-color="#3f8f6d" stop-opacity="0"/></linearGradient></defs>${grid}${body}</svg>`
 return { src: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), width, height, xOf, hasData: list.length > 0 }
}

// 楼层占比条：一段堆叠横条，颜色区分楼层；段内标签「26楼 3,022度 61%」（有表被排除时追加「· 8/22台」），
// 太窄的段把标签整条放到条的下一行（带段色），不截断。
export function floorSplitChart(floors, options = {}) {
 const list = (Array.isArray(floors) ? floors : []).filter(f => finite(f.value))
 const width = options.width ?? 340
 const total = list.reduce((sum, f) => sum + f.value, 0)
 const palette = ['#2e7d5c', '#b89443', '#7a9a86', '#8b6f4e', '#5a7a6a', '#9a8a6a']
 const barH = 18, top = 2
 const labels = list.map((f, i) => {
  const share = total > 0 ? Math.round(f.value / total * 100) : 0
  const coverage = f.meters > f.dataMeters ? ` · ${f.dataMeters}/${f.meters}台` : ''
  return { f, i, share, text: `${f.floor} ${barLabel(f.value)}度 ${share}%${coverage}` }
 })
 const narrow = labels.filter(l => (l.f.value / (total || 1)) * width < 118)
 const height = top + barH + (narrow.length ? narrow.length * 14 + 4 : 0) + 2
 let cursor = 0, segs = '', below = ''
 for (const l of labels) {
  const w = total > 0 ? l.f.value / total * width : 0
  const color = palette[l.i % palette.length]
  segs += `<rect x="${cursor.toFixed(2)}" y="${top}" width="${w.toFixed(2)}" height="${barH}"${cursor === 0 ? ' rx="3"' : ''} fill="${color}"/>`
  if (w >= 118) segs += `<text x="${(cursor + 7).toFixed(2)}" y="${top + 13}" font-size="10" fill="#f6f8f1">${escapeXml(l.text)}</text>`
  else below += `<text x="${(cursor + Math.min(w / 2, 40)).toFixed(2)}" y="${top + barH + 13 + narrow.indexOf(l) * 14}" text-anchor="middle" font-size="9.5" fill="${color}">${escapeXml(l.text)}</text>`
  cursor += w
 }
 const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ${FONT}>${segs}${below}</svg>`
 return { src: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), width, height, hasData: list.length > 0 }
}

// 24 小时平均负荷曲线：x 轴为一天 0–23 点（点位在每小时格中心），00–06 画浅底带并在带内左下
// 标注「夜间」；rates 中 null 的时段断段不连线。纵轴只随数据定标，小范围保留小数刻度（0.1/0.2/…）。
// options.peer 叠加第二条灰绿虚线（如同层单台平均），options.legend=[本表名, 对照名] 在顶部给图例。
export function loadShapeChart(rates, options = {}) {
 const width = options.width ?? 360, height = options.height ?? 160
 const padLeft = 30, padRight = 8, top = options.legend ? 24 : 10, base = height - 22
 const list = Array.from({ length: 24 }, (_, h) => finite(rates?.[h]) ? rates[h] : null)
 const peerList = options.peer ? Array.from({ length: 24 }, (_, h) => finite(options.peer[h]) ? options.peer[h] : null) : []
 const { step, top: ceiling } = niceScale(Math.max(...list.map(v => v ?? 0), ...peerList.map(v => v ?? 0), 1e-9))
 const spanX = width - padLeft - padRight, cell = spanX / 24
 const x = h => padLeft + (h + .5) * cell
 const y = v => base - v / ceiling * (base - top)

 let grid = ''
 for (let v = 0; v <= ceiling + step / 2; v += step) {
  const gy = y(v)
  grid += `<line x1="${padLeft}" x2="${width - padRight}" y1="${gy.toFixed(2)}" y2="${gy.toFixed(2)}" stroke="${v === 0 ? '#c9cfc0' : '#e1e6d8'}"${v === 0 ? ' stroke-width="1.5"' : ' stroke-dasharray="3 5"'}/>`
  grid += `<text x="${padLeft - 6}" y="${(gy + 3).toFixed(2)}" text-anchor="end" font-size="9" fill="#a9b3a2">${tickLabel(v)}</text>`
 }
 // 夜间时段底带：小时格 0–5，标签置于带内左下不压曲线。
 const nightRanges = options.nightWindow === '20:00-08:00' ? [[0, 8], [20, 24]] : [[0, 6]]
 const band = nightRanges.map(([from, to]) =>
  `<rect x="${(padLeft + from * cell).toFixed(2)}" y="${top}" width="${((to - from) * cell).toFixed(2)}" height="${base - top}" fill="#5a6a52" fill-opacity=".07"/>`
  + `<text x="${padLeft + from * cell + 4}" y="${base - 4}" font-size="9" fill="#8b9882">夜间</text>`).join('')
 const xTicks = [0, 6, 12, 18, 23].map(h =>
  `<text x="${x(h).toFixed(2)}" y="${base + 13}" text-anchor="middle" font-size="9" fill="#80917b">${h}</text>`).join('')

 const segments = []
 for (const [h, v] of list.entries()) {
  if (v === null) continue
  const last = segments.at(-1)
  if (last && last.at(-1).h === h - 1) last.push({ h, v })
  else segments.push([{ h, v }])
 }
 const drawLine = (points, color, dash) => {
  const segs = []
  for (const [h, v] of points.entries()) {
   if (v === null) continue
   const last = segs.at(-1)
   if (last && last.at(-1).h === h - 1) last.push({ h, v })
   else segs.push([{ h, v }])
  }
  return segs.map(seg => seg.length === 1
   ? `<circle cx="${x(seg[0].h).toFixed(2)}" cy="${y(seg[0].v).toFixed(2)}" r="3" fill="${color}" stroke="#fbfdf8" stroke-width="1.5"/>`
   : `<path d="${seg.map((p, i) => `${i ? 'L' : 'M'}${x(p.h).toFixed(2)} ${y(p.v).toFixed(2)}`).join('')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`).join('')
 }
 let body = ''
 if (peerList.some(v => v !== null)) body += drawLine(peerList, options.peerColor || '#8fa086', options.peerDash === undefined ? '5 4' : options.peerDash)
 for (const seg of segments) {
  const line = seg.map((p, i) => `${i ? 'L' : 'M'}${x(p.h).toFixed(2)} ${y(p.v).toFixed(2)}`).join('')
  if (seg.length === 1) {
   body += `<circle cx="${x(seg[0].h).toFixed(2)}" cy="${y(seg[0].v).toFixed(2)}" r="3" fill="#3c8c6b" stroke="#fbfdf8" stroke-width="1.5"/>`
   continue
  }
  body += `<path d="${line}L${x(seg.at(-1).h).toFixed(2)} ${base}L${x(seg[0].h).toFixed(2)} ${base}Z" fill="url(#trendFill)"/>`
  body += `<path d="${line}" fill="none" stroke="#2e7d5c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
 }
 const peerColor = options.peerColor || '#8fa086'
 const peerDash = options.peerDash === undefined ? '5 4' : options.peerDash
 const legend = options.legend
  ? `<line x1="${padLeft}" x2="${padLeft + 16}" y1="10" y2="10" stroke="#2e7d5c" stroke-width="2"/><text x="${padLeft + 21}" y="13" font-size="9" fill="#5a6f5b">${escapeXml(options.legend[0])}</text>`
   + `<line x1="${padLeft + 96}" x2="${padLeft + 112}" y1="10" y2="10" stroke="${peerColor}" stroke-width="2"${peerDash ? ` stroke-dasharray="${peerDash}"` : ''}/><text x="${padLeft + 117}" y="13" font-size="9" fill="${peerColor}">${escapeXml(options.legend[1])}</text>`
  : ''

 const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ${FONT}><defs><linearGradient id="trendFill" x2="0" y2="1"><stop stop-color="#3f8f6d" stop-opacity=".26"/><stop offset="1" stop-color="#3f8f6d" stop-opacity="0"/></linearGradient></defs>${grid}${band}${legend}${body}${xTicks}</svg>`
 return { src: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), width, height, hasData: list.some(v => v !== null) }
}
