import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeEnvironmentHistory,
  environmentSampleIdentity,
  environmentTrendPoints,
  environmentWindowLabel,
  environmentTrendTicks,
} from '../pages/agent/lib/observations.mjs';
import { trendLineChart } from '../pages/agent/lib/energy.mjs';

const at = (minute) => `2020-01-01T00:${String(minute).padStart(2, '0')}:00Z`;
const sample = (id, minute, value, quality = {}) => ({
  id,
  recordedAt: minute === null ? null : at(minute),
  deviceCode: 'fixture-code',
  values: { temp: value },
  quality,
});
const report = (samples, nextPage, complete, totalElements = samples.length) => ({
  source: 'company',
  window: { from: at(0), to: '2020-01-01T01:00:00Z' },
  samples,
  nextPage,
  totalElements,
  coverage: { complete },
  metrics: [{ key: 'temp', label: '温度', unit: '°C' }],
});

test('续页合并保留同ID不同采样、未知时间和覆盖缺口，不用未知采样制造峰值', () => {
  const unknown = sample('fixture-unknown', null, 999, { timeUnknown: true });
  const first = report([sample('same', 0, 10), unknown], 1, false, 3);
  const last = report([sample('same', 2, 20)], null, true, 3);
  const merged = mergeEnvironmentHistory(first, last);
  assert.equal(merged.status, 'partial');
  assert.equal(merged.coverage.complete, false);
  assert.equal(merged.coverage.unknownTimeSamples, 1);
  assert.equal(merged.metrics[0].count, 2);
  assert.deepEqual(merged.metrics[0].peak, { value: 20, at: at(2) });
  assert.equal(merged.samples.find((row) => row.id === 'fixture-unknown').recordedAt, null);
  assert.notEqual(
    environmentSampleIdentity(merged.samples[0]),
    environmentSampleIdentity(merged.samples[1])
  );
});

test('完整无记录与尚未覆盖分开；分页漂移缺少记录不能宣称完整', () => {
  assert.equal(mergeEnvironmentHistory(null, report([], null, true)).status, 'empty');
  assert.equal(mergeEnvironmentHistory(null, report([], null, false)).status, 'partial');
  const merged = mergeEnvironmentHistory(
    report([sample('a', 0, 10)], 1, false, 3),
    report([sample('b', 1, 20)], null, true, 3)
  );
  assert.equal(merged.coverage.complete, false);
});

test('选择身份区分来源ID与回退ID、同秒不同测点和空测点', () => {
  const base = sample('2020-01-01T00:00:00Z:site', 0, 10);
  const fallback = { ...base, sourceIdMissing: true, deviceCode: null };
  const real = { ...fallback, sourceIdMissing: false };
  const literalSite = { ...fallback, deviceCode: 'site' };
  assert.equal(new Set([fallback, real, literalSite].map(environmentSampleIdentity)).size, 3);
  const merged = mergeEnvironmentHistory(
    report([fallback], 1, false, 2),
    report([real], null, true, 2)
  );
  assert.equal(merged.metrics[0].count, 2);
});

test('明确缺测点断开折线，前后有效点仍可见，不把缺测画成零', () => {
  const rows = [sample('a', 0, 10), sample('gap', 1, null), sample('b', 2, 20)];
  const merged = mergeEnvironmentHistory(null, report(rows, null, true));
  assert.equal(merged.coverage.missingValueSamples, 1);
  assert.equal(merged.coverage.complete, false);
  const points = environmentTrendPoints(rows, 'temp');
  assert.deepEqual(
    points.map((point) => point.value),
    [10, null, 20]
  );
  const chart = trendLineChart(points, { from: at(0), to: '2020-01-01T01:00:00Z' });
  assert.equal(chart.hasData, true);
  const svg = decodeURIComponent(chart.src.split(',').slice(1).join(','));
  assert.doesNotMatch(svg, /<path\s/);
  const centers = [...svg.matchAll(/<circle\s+cx="([\d.]+)"/g)].map((match) => Number(match[1]));
  assert.deepEqual(centers, [chart.xOf(at(0)), chart.xOf(at(2))]);
});

test('环境历史窗口标签按上海时间展示，跨年保留年份', () => {
  assert.equal(
    environmentWindowLabel({ from: '2026-11-02T00:00:00+08:00', to: '2026-11-08T20:50:00+08:00' }),
    '11-02 00:00 至 11-08 20:50'
  );
  assert.equal(
    environmentWindowLabel({ from: '2026-12-31T23:00:00+08:00', to: '2027-01-01T01:00:00+08:00' }),
    '2026-12-31 23:00 至 2027-01-01 01:00'
  );
  assert.equal(environmentWindowLabel({ from: 'bad', to: '2026-11-08T20:50:00+08:00' }), '');
  assert.equal(environmentWindowLabel(null), '');
});

test('跨天窗口刻度按北京日界每天一个，不再逐日插 12:00', () => {
  const ticks = environmentTrendTicks({
    from: '2026-11-02T00:00:00+08:00',
    to: '2026-11-08T20:50:00+08:00',
  });
  const labels = ticks.map((tick) => tick.label);
  // 起点恰在北京日界：首尾刻度与日界刻度去重后 8 个
  assert.deepEqual(labels, ['11/2', '11/3', '11/4', '11/5', '11/6', '11/7', '11/8', '11/8 20:50']);
  assert.ok(ticks.length <= 10, `刻度过密: ${labels.join(',')}`);
  // 刻度单调且首尾覆盖窗口边界
  assert.ok(ticks[0].at <= Date.parse('2026-11-02T00:00:00+08:00'));
  assert.ok(ticks.at(-1).at >= Date.parse('2026-11-08T20:50:00+08:00'));
  for (let i = 1; i < ticks.length; i += 1) assert.ok(ticks[i].at > ticks[i - 1].at);
});

test('短窗刻度为均匀 HH:mm 且含起止', () => {
  const ticks = environmentTrendTicks({
    from: '2026-11-08T14:49:58+08:00',
    to: '2026-11-08T20:49:58+08:00',
  });
  const labels = ticks.map((tick) => tick.label);
  assert.equal(labels[0], '14:49');
  assert.equal(labels.at(-1), '20:49');
  assert.ok(labels.length >= 5 && labels.length <= 9);
  assert.ok(labels.every((label) => /^\d{2}:\d{2}$/.test(label)));
});

test('刻度标签不随设备本地时区漂移：UTC 输入在任意时区结果一致', () => {
  const window = { from: '2026-11-01T16:00:00Z', to: '2026-11-08T12:50:00Z' };
  const ticks = environmentTrendTicks(window);
  const dayLabels = ticks.map((tick) => tick.label).filter((label) => label.includes('/'));
  assert.ok(dayLabels.includes('11/2'));
  assert.ok(dayLabels.includes('11/8'));
  assert.ok(!dayLabels.includes('11/1'), `不应出现 UTC 日界标签: ${dayLabels.join(',')}`);
});
