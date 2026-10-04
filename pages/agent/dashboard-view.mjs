// 维修演示是一组独立小时用电样例，不覆盖上游读数，也不进入执行上下文。
const repairHours = [12, 11, 10, 9, 10, 13, 24, 38, 58, 74, 68, 61, 56, 63, 76, 82, 69, 53, 42, 33, 25, 20, 17, 14]
export const repairEnergy = { hours: repairHours, total: repairHours.reduce((sum, value) => sum + value, 0), peak: Math.max(...repairHours) }

export function energyChart(values) {
 if (!values.length) return ''
 const width = 320, height = 80, peak = Math.max(...values, 1)
 const points = values.map((value, i) => [8 + i / Math.max(values.length - 1, 1) * (width - 16), 70 - value / peak * 60])
 const path = points.reduce((line, [x, y], i) => {
  if (!i) return `M${x},${y}`
  const [px, py] = points[i - 1], mid = (px + x) / 2
  return `${line} C${mid},${py} ${mid},${y} ${x},${y}`
 }, '')
 const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="fill" x2="0" y2="1"><stop stop-color="#4b9470" stop-opacity=".24"/><stop offset="1" stop-color="#4b9470" stop-opacity="0"/></linearGradient></defs><path d="M8 10H312M8 40H312M8 70H312" stroke="#dce5dc" stroke-width=".5"/><path d="${path} L312,78 L8,78Z" fill="url(#fill)"/><path d="${path}" fill="none" stroke="#388563" stroke-width="2.2" stroke-linecap="round"/></svg>`
 return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function dashboardCounts(snapshot) {
 const counts = { environment: 0, energy: 0, safety: 0 }
 for (const device of snapshot?.devices || []) if (device.kind in counts) counts[device.kind]++
 return counts
}

export const metricValue = value => typeof value === 'number' && Number.isFinite(value) ? String(value) : '—'
