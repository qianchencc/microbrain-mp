// Dashboard projection entrypoint. Small dashboard-only formatting stays outside the page host.
export const metricValue = value => typeof value === 'number' && Number.isFinite(value) ? String(value) : '—'
