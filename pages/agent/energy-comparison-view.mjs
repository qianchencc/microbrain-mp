const finite = value => typeof value === 'number' && Number.isFinite(value)
export const comparisonNumber = value => finite(value) ? value.toFixed(2).replace(/\.00$/, '') : '—'
export const comparisonDate = iso => String(iso || '').slice(5, 10).replace('-', '/')
export const comparisonRatio = week => week?.ratio == null ? '—' : `${week.ratio > 0 ? '+' : ''}${week.ratio.toFixed(1)}%`
export function comparisonColumns(report) {
 const columns = (report.weeks || []).map(week => ({ ...week, label: comparisonDate(week.requested.from), endLabel: comparisonDate(week.requested.to), current: false }))
 if (report.current) columns.push({ ...report.current, usage: report.current.partialUsage, ratio: null, label: '本周', endLabel: '进行中', status: 'partial', current: true })
 return columns
}
export function energyComparisonChart(report, columns = comparisonColumns(report), plotWidth = 360) {
 const maximum = Math.max(1, ...columns.map(w => finite(w.usage) ? w.usage : 0))
 const magnitude = 10 ** Math.floor(Math.log10(maximum)), step = [1, 2, 2.5, 5, 10].map(n => n * magnitude).find(n => maximum / n <= 4)
 const top = Math.ceil(maximum / step) * step, height = 120, bottom = 151, width = (plotWidth - 50) / Math.max(1, columns.length)
 const grid = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => {
  const value = i * step, y = bottom - value / top * height
  return `<path d="M36 ${y}H${plotWidth - 9}" stroke="#dde5da" ${i ? 'stroke-dasharray="3 5"' : ''}/><text x="27" y="${y + 3}" text-anchor="end" fill="#8e9b89" font-size="9">${Number(value.toPrecision(4))}</text>`
 }).join('')
 const bars = columns.map((w, i) => {
  const x = 38 + width * i + width / 2, h = finite(w.usage) ? w.usage / top * height : 0, y = bottom - h, barWidth = Math.min(30, width * .55)
  const label = comparisonNumber(w.usage)
  const fill = w.current ? '#f1f5f0' : w.status === 'partial' ? 'url(#hatch)' : 'url(#jade)'
  const bar = !finite(w.usage) ? '' : h > 0 ? `<rect x="${x - barWidth / 2}" y="${y}" width="${barWidth}" height="${h}" rx="5" fill="${fill}" ${w.current ? 'stroke="#a4b6a8" stroke-dasharray="3 3"' : ''}/>` : `<path d="M${x - 8} ${bottom - 1}h16" stroke="#b5beb0" stroke-width="2" stroke-linecap="round" ${w.current ? 'stroke-dasharray="3 3"' : ''}/>`
  return `${bar}<text x="${x}" y="${Math.max(14, y - 8)}" text-anchor="middle" font-size="11" font-weight="600" fill="${w.status === 'partial' ? '#957441' : '#355a43'}">${label}</text>`
 }).join('')
 return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${plotWidth} 166"><defs><linearGradient id="jade" x2="0" y2="1"><stop stop-color="#398d6e"/><stop offset="1" stop-color="#176b54"/></linearGradient><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="7" height="7" fill="#d9e8dc"/><path d="M0 0v7" stroke="#74a58c" stroke-width="3"/></pattern></defs><g font-family="sans-serif">${grid}${bars}</g></svg>`)
}
