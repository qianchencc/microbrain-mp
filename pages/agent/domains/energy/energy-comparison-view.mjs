import { meterBarChart } from './energy-chart.mjs';

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
export const comparisonNumber = (value) =>
  finite(value) ? value.toFixed(2).replace(/\.00$/, '') : '—';
export const comparisonDate = (iso) =>
  String(iso || '')
    .slice(5, 10)
    .replace('-', '/');
export const comparisonRatio = (week) =>
  week?.ratio == null
    ? '—'
    : week.ratio === 0
      ? '0%'
      : `${week.ratio > 0 ? '+' : '−'}${Math.abs(week.ratio).toFixed(1)}%`;
export const comparisonChip = (week) =>
  week?.current
    ? 'na'
    : week?.ratio == null
      ? 'na'
      : week.ratio > 0
        ? 'up'
        : week.ratio < 0
          ? 'down'
          : 'na';

export function comparisonColumns(report) {
  const columns = (report.weeks || []).map((week) => ({
    ...week,
    label: comparisonDate(week.requested.from),
    endLabel: comparisonDate(week.requested.to),
    current: false,
  }));
  if (report.current)
    columns.push({
      ...report.current,
      usage: report.current.partialUsage,
      ratio: null,
      label: '本周',
      endLabel: '进行中',
      status: 'partial',
      current: true,
    });
  return columns;
}

// 图表柱体与下方 HTML 环比列共用同一几何：padLeft/padRight 为 viewBox 内边距，
// 供元信息行按 width 的百分比 margin 对齐每一列。
export function energyComparisonChart(report, columns = comparisonColumns(report)) {
  return meterBarChart(
    columns.map((week) => ({
      value: finite(week.usage) ? week.usage : null,
      status: week.status,
      current: week.current,
      approx: week.approx,
    })),
    { minCell: 48 }
  );
}
