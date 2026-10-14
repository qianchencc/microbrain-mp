import test from 'node:test'
import assert from 'node:assert/strict'
import { meterReportParamLine, meterReportHero, meterReportBuckets, meterReportRanking, meterReportEvidence, meterReportHistoryQuery } from '../pages/agent/meter-report-view.mjs'

// 对应 runtime 夹具：m-c 数据不全（停报 10-04）、m-d 无数据。
const report = {
 reportId: 'r1', type: 'meter-report', kind: 'statistics',
 params: {
  span: { requested: { from: '2026-10-01T00:00:00+08:00', to: '2026-10-08T00:00:00+08:00' }, observed: { from: '2026-10-01T00:00:00.000+08:00', to: '2026-10-08T00:00:00.000+08:00' } },
  scope: { level: 'floor', label: '26楼', basis: 'areaName', meterCount: 4 },
  grain: 'day',
 },
 total: { value: 210, unit: '度', yuan: 241.5, tariff: 1.15 },
 buckets: { grain: 'day', items: [] },
 bucketsAll: {
  day: [
   { from: '2026-10-01T00:00:00.000+08:00', to: '2026-10-02T00:00:00.000+08:00', value: 60, partial: true, days: 1 },
   { from: '2026-10-07T00:00:00.000+08:00', to: '2026-10-08T00:00:00.000+08:00', value: 30, partial: true, days: 1 },
  ],
  week: [{ from: '2026-10-01T00:00:00.000+08:00', to: '2026-10-08T00:00:00.000+08:00', value: 210, partial: true, days: 7 }],
  month: [{ from: '2026-10-01T00:00:00.000+08:00', to: '2026-10-08T00:00:00.000+08:00', value: 210, partial: true, days: 7 }],
 },
 composition: {
  kind: 'ranking',
  rows: [
   { label: '26楼运营部', value: 70, meterIds: ['m-a'] },
   { label: '26楼办公室', value: 140, meterIds: ['m-b'] },
  ],
  rest: null,
  excluded: { noData: 1, partial: 1, through: '2026-10-04T00:00:00.000+08:00' },
 },
 coverage: { meters: 4, dataMeters: 2, noData: ['m-d'], partial: [{ id: 'm-c', through: '2026-10-04T00:00:00.000+08:00' }], truncated: false },
 meters: [
  { id: 'm-a', name: '运营部电表', areaName: '26楼运营部', floor: '26楼', value: 70, status: 'ok', observed: { fromSample: { readTime: '2026-10-01T00:00:00.000+08:00', value: 100 }, toSample: { readTime: '2026-10-08T00:00:00.000+08:00', value: 170 } } },
  { id: 'm-b', name: '26楼办公室电表', areaName: '26楼办公室', floor: '26楼', value: 140, status: 'ok', observed: { fromSample: { readTime: '2026-10-01T00:00:00.000+08:00', value: 200 }, toSample: { readTime: '2026-10-08T00:00:00.000+08:00', value: 340 } } },
  { id: 'm-c', name: '27楼展厅电表', areaName: '27楼展厅', floor: '27楼', value: null, status: 'partial', observed: { fromSample: { readTime: '2026-10-01T00:00:00.000+08:00', value: 300 }, toSample: { readTime: '2026-10-04T00:00:00.000+08:00', value: 390 } } },
  { id: 'm-d', name: '地下室电表', areaName: '地下室', floor: null, value: null, status: 'noData', observed: { fromSample: null, toSample: null } },
 ],
}

test('参数行：跨度·范围·台数，数据不全给截至时刻、无数据单列', () => {
 assert.equal(meterReportParamLine(report), '2026-10-01 → 10-08 · 26楼 4台 · 1台数据截至10/04 · 1台无数据')
 const clean = { ...report, coverage: { meters: 2, dataMeters: 2, noData: [], partial: [], truncated: false } }
 assert.equal(meterReportParamLine(clean), '2026-10-01 → 10-08 · 26楼 4台')
 const matched = { ...report, params: { ...report.params, scope: { level: 'nameMatch', label: '按名称匹配「办公室」', basis: 'nameMatch', meterCount: 12 } } }
 assert.match(meterReportParamLine(matched), /按名称匹配「办公室」 12台/)
})

test('合计行：度与目录电价估算金额', () => {
 assert.deepEqual(meterReportHero(report), { value: '210', yuan: '约 ¥241.5 · 按 1.15 元/度' })
 const mixedTariff = { ...report, total: { ...report.total, yuan: null, tariff: null } }
 assert.equal(meterReportHero(mixedTariff).yuan, '')
 const big = { ...report, total: { value: 4950.84, unit: '度', yuan: 5693.47, tariff: 1.15 } }
 assert.equal(meterReportHero(big).value, '4,950.8')
})

test('分段柱：partial 段斜纹，不足粒度的尾段标「·N天」，完整粒度不加天数', () => {
 const day = meterReportBuckets(report, 'day')
 assert.equal(day.points.length, 2)
 assert.equal(day.points[0].status, 'partial')
 assert.match(day.points[0].label, /^10\/01/)
 // 尾段只有 1 天也满足 day 粒度 → 不因天数加注
 assert.equal(day.points[0].label, '10/01')
 // 足 7 天的周段：partial 仅因缺表 → 斜纹但不加天数；短于一粒度的段才标「·N天」。
 const week = meterReportBuckets(report, 'week')
 assert.equal(week.points[0].label, '10/01')
 const shortWeek = { ...report, bucketsAll: { ...report.bucketsAll, week: [{ ...report.bucketsAll.week[0], days: 6 }] } }
 assert.equal(meterReportBuckets(shortWeek, 'week').points[0].label, '10/01·6天')
 const month = meterReportBuckets(report, 'month')
 assert.equal(month.points[0].label, '10月·7天')
 assert.ok(day.hasData)
})

test('位置构成：排行行 + 其余聚合 + 排除行折叠为文字', () => {
 const ranking = meterReportRanking(report)
 assert.equal(ranking.rows.length, 2)
 assert.equal(ranking.rows[0].label, '26楼运营部')
 assert.deepEqual(ranking.excluded, ['数据不全 1 处 —', '无数据 1 处 —'])
 assert.match(decodeURIComponent(ranking.src.slice('data:image/svg+xml;utf8,'.length)), /<svg/)
 const withRest = { ...report, composition: { ...report.composition, rows: report.composition.rows, rest: { count: 14, value: 107.6 } } }
 assert.equal(meterReportRanking(withRest).rows.at(-1).label, '其余 14 处')
 assert.equal(meterReportRanking(withRest).rows.at(-1).value, 107.6)
})

test('依据行：逐表实际起止采样与状态；无采样表如实标注', () => {
 const rows = meterReportEvidence(report)
 assert.equal(rows.length, 4)
 const ok = rows[0]
 assert.equal(ok.label, '26楼运营部')
 assert.equal(ok.statusText, '计入合计')
 assert.equal(ok.valueText, '70 度')
 assert.match(ok.bounds, /起 2026-10-01 00:00 · 示数 100 · 止 2026-10-08 00:00 · 示数 170/)
 const partial = rows[2]
 assert.equal(partial.statusText, '数据不全')
 assert.equal(partial.valueText, '—')
 const empty = rows[3]
 assert.equal(empty.statusText, '无数据')
 assert.equal(empty.bounds, '区间内无采样记录')
 assert.deepEqual(meterReportHistoryQuery(report, 'm-c'), { equipmentId: 'm-c', from: '2026-10-01T00:00:00+08:00', to: '2026-10-08T00:00:00+08:00' })
})
