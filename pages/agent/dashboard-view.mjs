export const metricValue = value => typeof value === 'number' && Number.isFinite(value) ? String(value) : '—'
