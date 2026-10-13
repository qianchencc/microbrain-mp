export function dashboardCounts(snapshot) {
 const counts = { environment: 0, energy: 0, safety: 0 }
 for (const device of snapshot?.devices || []) if (device.kind in counts) counts[device.kind]++
 return counts
}

export const metricValue = value => typeof value === 'number' && Number.isFinite(value) ? String(value) : '—'
