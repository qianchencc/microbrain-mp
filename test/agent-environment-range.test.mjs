import test from 'node:test';
import assert from 'node:assert/strict';
import {
  environmentDateRange,
  environmentRangeLimits,
  environmentChartPoints,
  environmentBucketState,
  environmentTrendTicks,
  mergeEnvironmentHistory,
} from '../pages/agent/lib/observations.mjs';

test('修改起点仅在必要时联动终点，最多180个上海自然日', () => {
  const dates = { from: '2026-10-01', to: '2026-11-10' };
  assert.deepEqual(environmentDateRange(dates, 'from', '2026-01-01', '2026-11-10'), {
    from: '2026-01-01',
    to: '2026-06-29',
  });
  assert.deepEqual(environmentDateRange(dates, 'from', '2026-10-20', '2026-11-10'), {
    from: '2026-10-20',
    to: '2026-11-10',
  });
  assert.deepEqual(environmentDateRange(dates, 'from', '2026-11-10', '2026-11-10'), {
    from: '2026-11-10',
    to: '2026-11-10',
  });
  assert.deepEqual(environmentRangeLimits('2026-01-01', '2026-11-10'), {
    min: '2026-01-01',
    max: '2026-06-29',
  });
});

test('终点不越过今天，起点越过旧终点时终点跟随而非产生反向窗口', () => {
  assert.deepEqual(
    environmentDateRange(
      { from: '2026-09-01', to: '2026-10-01' },
      'from',
      '2026-11-01',
      '2026-11-10'
    ),
    {
      from: '2026-11-01',
      to: '2026-11-01',
    }
  );
  assert.deepEqual(environmentRangeLimits('2026-11-01', '2026-11-10'), {
    min: '2026-11-01',
    max: '2026-11-10',
  });
});

test('起点以授权历史首日为下限，旧的空区间整体纠正到首日', () => {
  const earliest = '2026-10-08';
  assert.deepEqual(
    environmentDateRange(
      { from: '2026-03-10', to: '2026-09-05' },
      'from',
      '2026-03-10',
      '2026-11-10',
      earliest
    ),
    { from: earliest, to: earliest }
  );
  assert.deepEqual(
    environmentDateRange(
      { from: earliest, to: '2026-11-10' },
      'from',
      '2026-09-10',
      '2026-11-10',
      earliest
    ),
    { from: earliest, to: '2026-11-10' }
  );
});

test('两个月窗口的刻度不会只剩月初，短跨日窗口的标签可区分日期和时刻', () => {
  const ticks = environmentTrendTicks(
    { from: '2026-09-10T00:00:00+08:00', to: '2026-11-10T23:59:59.999+08:00' },
    { width: 300 }
  );
  assert.ok(ticks.length >= 4);
  const short = environmentTrendTicks(
    { from: '2026-11-09T00:00:00+08:00', to: '2026-11-10T23:59:59.999+08:00' },
    { width: 318 }
  );
  assert.equal(new Set(short.map((t) => t.label)).size, short.length);
});

test('跨月横轴根据实际宽度避让并保留首尾日期', () => {
  const window = { from: '2026-06-10T00:00:00+08:00', to: '2026-11-10T23:59:59.999+08:00' };
  for (const width of [240, 318, 430]) {
    const ticks = environmentTrendTicks(window, { width });
    assert.ok(ticks.length >= 3 && ticks.length <= 6);
    assert.equal(ticks[0].at, Date.parse(window.from));
    assert.equal(ticks.at(-1).at, Date.parse(window.to));
    for (let i = 1; i < ticks.length; i++) {
      const left = ticks[i - 1];
      const right = ticks[i];
      const distance = ((right.left - left.left) * width) / 100;
      assert.ok(distance >= (left.label.length + right.label.length) * 3 + 8);
    }
  }
});

test('聚合趋势保留服务端原始峰值和覆盖，空日断开且不把均值当原始最新值', () => {
  const bucket = (day, value) => ({
    from: `${day}T00:00:00+08:00`,
    to: `${day}T23:59:59.999+08:00`,
    at: `${day}T12:00:00+08:00`,
    values: { temp: value },
    metrics: { temp: { mean: value, min: value, max: value, count: value === null ? 0 : 8 } },
  });
  const incoming = {
    resolution: 'day',
    samples: [],
    buckets: [bucket('2026-11-01', 22), bucket('2026-11-02', null), bucket('2026-11-03', 24)],
    metrics: [{ key: 'temp', peak: { value: 30, at: '2026-11-03T14:00:00+08:00' } }],
    latest: { temp: { value: 26, at: '2026-11-03T18:00:00+08:00' } },
    coverage: { complete: true, readSamples: 72 },
    totalElements: 72,
    nextPage: null,
  };
  const report = mergeEnvironmentHistory(null, incoming);
  assert.equal(report.metrics[0].peak.value, 30);
  assert.equal(report.latest.temp.value, 26);
  assert.equal(report.coverage.readSamples, 72);
  assert.deepEqual(
    environmentChartPoints(report, 'temp').map((p) => p.value),
    [22, null, 24]
  );
});

test('未来时段不冒充缺测，真实缺测与合法零值分别保留', () => {
  const now = Date.parse('2026-11-10T20:00:00+08:00');
  const point = (from, value) => ({ from, values: { temp: value } });
  assert.equal(
    environmentBucketState(point('2026-11-10T21:00:00+08:00', null), 'temp', now),
    'future'
  );
  assert.equal(
    environmentBucketState(point('2026-11-10T18:00:00+08:00', null), 'temp', now),
    'missing'
  );
  assert.equal(
    environmentBucketState(point('2026-11-10T18:00:00+08:00', 0), 'temp', now),
    'available'
  );
});
