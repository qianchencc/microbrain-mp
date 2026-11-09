// Dashboard projection entrypoint. Small dashboard-only formatting stays outside the page host.
export const metricValue = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : '—';
export function directorySyncLabel(cache) {
  const timestamp = typeof cache?.updatedAt === 'string' ? Date.parse(cache.updatedAt) : NaN;
  const updated = Number.isFinite(timestamp)
    ? new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(5, 16).replace('T', ' ')
    : '';
  const stale = cache?.status === 'stale';
  if (!updated) return '';
  return `${stale ? '上次同步' : '同步于'} ${updated}${stale ? ' · 待更新' : ''}`;
}
export { createCompanyOverview } from '../domains/dashboard/company-overview.mjs';
