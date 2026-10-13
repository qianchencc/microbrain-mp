// 共享柱状图语法：SVG data-URI 承载，供 WeChat image 渲染。
// 约定：value null/not_computable → “缺测”留白；status partial → 斜纹（短窗实测）；current → 虚线进行中；
// value 0 → 基线扁条；paired → 灰绿基期 + 玉绿本期双柱。x 轴标签随图内嵌，横向滚动时与柱体同步。

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
  let svg = ''
  if (missing) {
   svg += `<text x="${cx}" y="${base - 14}" text-anchor="middle" font-size="9.5" fill="#a9b6a4">缺测</text>`
  } else if (paired) {
   const bw = Math.min(18, cell * .26)
   const bh = finite(c.baseline) ? c.baseline / ceiling * (base - top) : 0
   const ch = c.value / ceiling * (base - top)
   if (bh > 0) svg += `<rect x="${cx - bw - 2}" y="${y(c.baseline)}" width="${bw}" height="${bh}" rx="3" fill="#bfd2b9"/>`
   else svg += `<line x1="${cx - bw - 1}" x2="${cx - 3}" y1="${base - 1}" y2="${base - 1}" stroke="#bfd2b9" stroke-width="2"/>`
   if (ch > 0) svg += `<rect x="${cx + 2}" y="${y(c.value)}" width="${bw}" height="${ch}" rx="3" fill="url(#jade)"/>`
   else svg += `<line x1="${cx + 3}" x2="${cx + bw + 1}" y1="${base - 1}" y2="${base - 1}" stroke="#74a58c" stroke-width="2"/>`
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

 const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ${FONT}><defs><linearGradient id="jade" x2="0" y2="1"><stop stop-color="#388e6d"/><stop offset="1" stop-color="#176b54"/></linearGradient><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="7" height="7" fill="#d9e8dc"/><path d="M0 0v7" stroke="#74a58c" stroke-width="3"/></pattern></defs>${grid}${bars}</svg>`
 return { src: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), width, height, padLeft, padRight, hasData: list.some(c => finite(c.value)) }
}

function escapeXml(text) {
 return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
