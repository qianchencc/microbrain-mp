import test from 'node:test'
import assert from 'node:assert/strict'
import { meterReportParamLine, meterReportHero, meterReportContext, meterReportMetrics, meterReportMetricTable, meterReportMetricHeads, meterReportLoadCurve, meterReportBuckets, meterReportCompareBuckets, meterReportCompareView, meterReportCompareViews, meterReportBarLegend, meterReportGrainOptions, meterReportRankingTitle, meterReportRanking, meterReportRegionRankings, meterReportContribution, meterReportEvidence, meterReportEvidenceSections, meterReportHistoryQuery, meterReportIsComparison, meterReportSpan, meterReportSpanText, meterReportPowerFactor, meterReportHasData, meterReportPeriodLabels, loadShapeChart, contributionChart, meterBarChart } from '../pages/agent/lib/energy.mjs'

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

test('统计卡明确展示与请求不同的实际采样起止', () => {
 const shifted = { ...report, params: { ...report.params, span: {
  requested: { from: '2026-10-01T00:00:00+08:00', to: '2026-10-08T00:00:00+08:00' },
  observed: { from: '2026-09-30T20:00:00+08:00', to: '2026-10-07T20:00:00+08:00' },
 } }, coverage: { meters: 2, dataMeters: 2, noData: [], partial: [], truncated: false } }
 assert.match(meterReportParamLine(shifted), /采样.*09-30 20:00.*10-07 20:00/)
})

test('合计行：度与目录电价估算金额', () => {
 assert.deepEqual(meterReportHero(report), { value: '210', yuan: '约 ¥241.5 · 按 1.15 元/度' })
 const mixedTariff = { ...report, total: { ...report.total, yuan: null, tariff: null } }
 assert.equal(meterReportHero(mixedTariff).yuan, '')
 const big = { ...report, total: { value: 4950.84, unit: '度', yuan: 5693.47, tariff: 1.15 } }
 assert.equal(meterReportHero(big).value, '4,950.84')
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

// 指标格：四个 key 的标签/单位/一句话定义；无值显示「—」；峰值日 sub 是日期。
test('指标格：标签与定义齐全，null 值显示 —，峰值日带日期', () => {
 const withMetrics = {
  ...report,
  metrics: [
   { key: 'dailyAvg', value: 30, unit: '度/日' },
   { key: 'nightBase', value: null, unit: '度/时' },
   { key: 'peakDay', value: 60, unit: '度', sub: '2026-10-02' },
   { key: 'top3Share', value: 100, unit: '%' },
  ],
 }
 const cards = meterReportMetrics(withMetrics)
 assert.deepEqual(cards.map(c => c.label), ['日均', '夜间基荷', '峰值日', '前3占比'])
 assert.deepEqual(cards.map(c => c.valueText), ['30', '—', '60', '100'])
 assert.equal(cards.find(c => c.key === 'nightBase').unit, '度/时')
 assert.equal(cards.find(c => c.key === 'peakDay').sub, '10/02')
 assert.equal(cards.find(c => c.key === 'nightBase').def, '00:00–06:00 平均每小时用电，代表无人时的持续耗电')
 assert.ok(cards.every(c => c.def.length > 0))
})

// 24 小时负荷：rates 为 null（覆盖不足）时整节隐藏；有 rates 时给出曲线模型。
test('24小时负荷：rates 为 null 时整节隐藏，有数据时输出曲线', () => {
 assert.equal(meterReportLoadCurve(report), null)
 assert.equal(meterReportLoadCurve({ ...report, shape24: { rates: null, coveredFraction: 0 } }), null)
 const rates = [0.3, 0.29, 0.3, 0.29, 0.29, 0.29, 0.29, 0.33, 0.65, 1.06, 1.05, 1.09, 0.87, 0.79, 0.9, 0.94, 1.04, 1, 0.52, 0.51, 0.37, 0.3, 0.27, 0.28]
 const curve = meterReportLoadCurve({ ...report, shape24: { rates, coveredFraction: 1 } })
 assert.ok(curve?.hasData)
 const svg = decodeURIComponent(curve.src.slice('data:image/svg+xml;utf8,'.length))
 assert.match(svg, /<svg/)
 assert.match(svg, /夜间/) // 00–06 底带标注
 // null 时段断段：hour 3 为 null 时折线分成两段。
 const gapped = rates.slice(); gapped[3] = null
 const svg2 = decodeURIComponent(loadShapeChart(gapped).src.slice('data:image/svg+xml;utf8,'.length))
 assert.ok((svg2.match(/stroke="#2e7d5c"/g) || []).length === 2)
})

// 小数值定标：max < 1 时纵轴刻度保留小数（0.1/0.2/0.3），不塌成全 0。
test('负荷曲线小数值刻度保留小数（max < 1）', () => {
 const svg = decodeURIComponent(loadShapeChart(Array.from({ length: 24 }, (_, h) => h % 8 === 0 ? null : 0.08 + h * 0.01)).src.slice('data:image/svg+xml;utf8,'.length))
 assert.match(svg, />0\.1</)
 assert.match(svg, />0\.2</)
 assert.match(svg, />0\.3</)
})

// 定位行三种层级：全部→楼层占比条（含覆盖率标注），楼层/名称匹配→占全部对照，单台→占本层+排名。
test('定位行：全部给楼层占比条，楼层给占全部对照，单台给占本层与排名', () => {
 const split = meterReportContext({ ...report, context: { kind: 'floorSplit', floors: [{ floor: '26楼', value: 3022, dataMeters: 22, meters: 22 }, { floor: '27楼', value: 1929, dataMeters: 17, meters: 21 }] } })
 assert.equal(split.kind, 'split')
 const splitSvg = decodeURIComponent(split.chart.src.slice('data:image/svg+xml;utf8,'.length))
 assert.match(splitSvg, /26楼 3,022度 61%/)
 assert.match(splitSvg, /27楼 1,929度 39% · 17\/21台/) // 有表被排除时标注有数据/总台数
 const parent = meterReportContext({ ...report, context: { kind: 'parent', parentLabel: '全部电表', share: 61, perMeterDaily: 4.6, parentPerMeterDaily: 3.8 } })
 assert.deepEqual(parent, { kind: 'line', text: '占全部电表 61% · 单台日均 4.6 度（全部 3.8）' })
 const peer = meterReportContext({ ...report, context: { kind: 'peer', parentLabel: '26楼', share: 2.6, rank: 7, of: 22 } })
 assert.equal(peer.text, '占26楼 2.6% · 本层第 7/22')
 assert.equal(meterReportContext(report), null) // 无 context 字段的旧报告不画定位行
})

// 单台范围：曲线换同层对照（本表 + 本层单台平均虚线），构成换本层排行并高亮本表。
test('单台范围：同层对照曲线带图例与虚线，排行标题为本层并高亮本表行', () => {
 const location = {
  ...report,
  context: { kind: 'peer', parentLabel: '26楼', share: 73.2, rank: 1, of: 2 },
  peer: { floorPerMeterRates: Array(24).fill(0.2) },
  shape24: { rates: Array(24).fill(0.4), coveredFraction: 1 },
  composition: { ...report.composition, rows: [{ label: '26楼运营部', value: 70, highlight: true }, { label: '26楼劳务办公室', value: 27 }] },
 }
 const curve = meterReportLoadCurve(location)
 assert.equal(curve.title, '24小时负荷')
 const svg = decodeURIComponent(curve.src.slice('data:image/svg+xml;utf8,'.length))
 assert.match(svg, /本表/)
 assert.match(svg, /26楼单台平均/)
 assert.match(svg, /stroke-dasharray="5 4"/)
 assert.equal(meterReportRankingTitle(location), '26楼 构成 · 度')
 const ranking = meterReportRanking(location)
 assert.equal(ranking.rows[0].highlight, true)
 assert.match(decodeURIComponent(ranking.src.slice('data:image/svg+xml;utf8,'.length)), /#b89443/) // 高亮行黄铜色
 assert.equal(meterReportRankingTitle(report), '位置构成 · 度')
})

// 单日跨度：粒度只剩「时」、分段按 HH:00 标注、指标换当日合计/峰值小时、曲线名「当日小时负荷」。
test('单日跨度：只有时粒度、HH:00 分段标签、当日合计/峰值小时指标与当日曲线名', () => {
 const day = {
  ...report,
  params: { ...report.params, span: { ...report.params.span, requested: { from: '2026-10-02T00:00:00+08:00', to: '2026-10-03T00:00:00+08:00' } }, grain: 'hour' },
  shape24: { rates: Array(24).fill(0.5), coveredFraction: 1 },
  metrics: [
   { key: 'dayTotal', value: 24.6, unit: '度' },
   { key: 'nightBase', value: 0.43, unit: '度/时' },
   { key: 'peakHour', value: 2.25, unit: '度', sub: '16:00' },
   { key: 'top3Share', value: 90, unit: '%' },
  ],
  bucketsAll: { hour: [{ from: '2026-10-02T08:00:00.000+08:00', to: '2026-10-02T09:00:00.000+08:00', value: 1.2, partial: false, days: 1 }] },
 }
 assert.deepEqual(meterReportGrainOptions(day), [{ key: 'hour', label: '时' }])
 assert.equal(meterReportBuckets(day, 'hour').points[0].label, '08:00')
 assert.equal(meterReportLoadCurve(day).title, '当日小时负荷')
 const cards = meterReportMetrics(day)
 assert.deepEqual(cards.map(c => c.label), ['当日合计', '夜间基荷', '峰值小时', '前3占比'])
 assert.equal(cards[2].sub, '16:00') // 峰值小时的 sub 是时刻不是日期
 assert.equal(meterReportMetrics({ ...report, metrics: [{ key: 'nightShare', value: 15, unit: '%' }] })[0].label, '夜间占比')
 assert.equal(meterReportGrainOptions(report).length, 3) // 多日跨度仍是 日/周/月
})

// ---------- kind=comparison（axis=time）----------
// 对应 runtime 对比报告：同一批表两侧（m-a +35、m-b −70），m-c 本期停报、m-d 无数据未进对比。
const compare = {
 reportId: 'rc1', type: 'meter-report', kind: 'comparison',
 params: {
  axis: 'time',
  span: { requested: { from: '2026-10-01T00:00:00+08:00', to: '2026-10-08T00:00:00+08:00' }, observed: { from: '2026-10-01T00:00:00.000+08:00', to: '2026-10-08T00:00:00.000+08:00' } },
  baseline: { requested: { from: '2026-09-24T00:00:00.000+08:00', to: '2026-10-01T00:00:00.000+08:00' }, observed: { from: '2026-09-24T00:00:00.000+08:00', to: '2026-10-01T00:00:00.000+08:00' } },
  scope: { level: 'all', label: '全部电表', basis: 'areaName', meterCount: 4 },
 },
 sides: {
  a: {
   total: { value: 175, unit: '度', yuan: 201.25 },
   shape24: { rates: Array.from({ length: 24 }, (_, h) => 0.3 + h * 0.02), coveredFraction: 1 },
   buckets: { grain: 'day', items: Array.from({ length: 7 }, (_, i) => ({ from: `2026-10-0${i + 1}T00:00:00.000+08:00`, to: `2026-10-0${i + 2}T00:00:00.000+08:00`, value: 25, partial: false, days: 1 })) },
  },
  b: {
   total: { value: 210, unit: '度', yuan: 241.5 },
   shape24: { rates: Array.from({ length: 24 }, (_, h) => 0.4 + h * 0.02), coveredFraction: 1 },
   buckets: { grain: 'day', items: Array.from({ length: 7 }, (_, i) => ({ from: `2026-09-${24 + i}T00:00:00.000+08:00`, to: `2026-09-${25 + i}T00:00:00.000+08:00`, value: 30, partial: false, days: 1 })) },
  },
 },
 diff: { value: -35, pct: -16.7 },
 metrics: [
  { key: 'dailyAvg', unit: '度/日', a: { value: 25 }, b: { value: 30 }, change: -5 },
  { key: 'weekdayDailyAvg', unit: '度/日', a: { value: 26 }, b: { value: 32 }, change: -6 },
  { key: 'nightBase', unit: '度/时', a: { value: 0.31 }, b: { value: 0.41 }, change: -0.1 },
  { key: 'peakDay', unit: '度', a: { value: 30, sub: '2026-10-03' }, b: { value: 34, sub: '2026-09-27' }, change: -4 },
 ],
 contribution: {
  rows: [{ label: '26楼办公室', delta: -70, meterIds: ['m-b'] }, { label: '26楼运营部', delta: 35, meterIds: ['m-a'] }],
  rest: null, topShare: 100,
 },
 context: { kind: 'floorSplit', floors: [{ floor: '26楼', value: 175, dataMeters: 2, meters: 2 }, { floor: '27楼', value: 0, dataMeters: 0, meters: 1 }] },
 coverage: { meters: 4, dataMeters: 2, noData: ['m-d'], partial: [{ id: 'm-c', through: '2026-10-04T00:00:00.000+08:00' }], truncated: false },
 meters: [
  { id: 'm-a', name: '运营部电表', areaName: '26楼运营部', floor: '26楼',
   a: { value: 105, status: 'ok', observed: { fromSample: { readTime: '2026-10-01T00:00:00.000+08:00', value: 170 }, toSample: { readTime: '2026-10-08T00:00:00.000+08:00', value: 275 } } },
   b: { value: 70, status: 'ok', observed: { fromSample: { readTime: '2026-09-24T00:00:00.000+08:00', value: 100 }, toSample: { readTime: '2026-10-01T00:00:00.000+08:00', value: 170 } } } },
  { id: 'm-b', name: '26楼办公室电表', areaName: '26楼办公室', floor: '26楼',
   a: { value: 70, status: 'ok', observed: { fromSample: { readTime: '2026-10-01T00:00:00.000+08:00', value: 340 }, toSample: { readTime: '2026-10-08T00:00:00.000+08:00', value: 410 } } },
   b: { value: 140, status: 'ok', observed: { fromSample: { readTime: '2026-09-24T00:00:00.000+08:00', value: 200 }, toSample: { readTime: '2026-10-01T00:00:00.000+08:00', value: 340 } } } },
  { id: 'm-c', name: '27楼展厅电表', areaName: '27楼展厅', floor: '27楼',
   a: { value: null, status: 'partial', observed: { fromSample: { readTime: '2026-10-01T00:00:00.000+08:00', value: 510 }, toSample: { readTime: '2026-10-04T00:00:00.000+08:00', value: 600 } } },
   b: { value: 210, status: 'ok', observed: { fromSample: { readTime: '2026-09-24T00:00:00.000+08:00', value: 300 }, toSample: { readTime: '2026-10-01T00:00:00.000+08:00', value: 510 } } } },
 ],
}

test('对比参数行：月份 · 范围台数 · 覆盖尾注', () => {
 assert.equal(meterReportIsComparison(compare), true)
 assert.equal(meterReportParamLine(compare), '10-01 → 10-08 vs 09-24 → 10-01 · 全部电表 4台 · 1台数据截至10/04 · 1台无数据')
 assert.equal(meterReportSpanText(compare), '10月 10-01 → 10-08 · 9月 09-24 → 10-01')
 assert.equal(meterReportIsComparison(report), false) // 统计报告不走对比分支
})

test('对比月份标签：同年显示月份，跨年保留年份', () => {
 assert.deepEqual(meterReportPeriodLabels(compare), { a: '10月', b: '9月' })
 const crossYear = { ...compare, params: { ...compare.params,
  span: { requested: { from: '2026-10-01T00:00:00+08:00' } },
  baseline: { requested: { from: '2025-10-01T00:00:00+08:00' } },
 } }
 assert.deepEqual(meterReportPeriodLabels(crossYear), { a: '2026年10月', b: '2025年10月' })
})

test('对比主数字：带符号差值 + 环比 + 月份小字；基期为 0 时比例给说明', () => {
 const hero = meterReportHero(compare)
 assert.equal(hero.value, '−35')
 assert.equal(hero.pct, '环比 −16.7%')
 assert.equal(hero.sub, '10月 175 度 · 9月 210 度')
 const flat = { ...compare, diff: { value: 70, pct: null, pctNote: '基期为零' } }
 const hero0 = meterReportHero(flat)
 assert.equal(hero0.value, '+70')
 assert.equal(hero0.pct, '')
 assert.equal(hero0.pctNote, '基期为零')
})

test('relation 标记决定卡面口径：同比/环比标签、去年同期表头与 pct；无标记沿用旧行为', () => {
 const marked = rel => ({ ...compare, params: { ...compare.params, relation: rel } })
 assert.equal(meterReportHero(marked('yearOverYear')).label, '用电同比')
 assert.equal(meterReportHero(marked('previousPeriod')).label, '用电环比')
 assert.equal(meterReportHero(marked('custom')).label, '用电时间对比')
 assert.equal(meterReportHero({ ...marked('yearOverYear'), diff: { ...compare.diff, basis: 'dailyAvg', unit: '度/日' } }).label, '用电同比 · 日均')
 assert.equal(meterReportHero(marked('yearOverYear')).pct, '同比 −16.7%')
 assert.equal(meterReportHero(marked('previousPeriod')).pct, '环比 −16.7%')
 assert.equal(meterReportHero(marked('custom')).pct, '较基期 −16.7%')
 assert.equal(meterReportHero(marked('yearOverYear')).sub, '10月 175 度 · 9月 210 度')
 assert.equal(meterReportHero(marked('previousPeriod')).sub, '10月 175 度 · 9月 210 度')
 assert.deepEqual(meterReportMetricHeads(marked('yearOverYear')), ['10月', '9月', '变化'])
 assert.deepEqual(meterReportMetricHeads(marked('previousPeriod')), ['10月', '9月', '变化'])
 assert.deepEqual(meterReportMetricHeads(compare), ['10月', '9月', '变化'])
 assert.equal(meterReportHero(compare).label, '用电量 · 10月 vs 9月')
 assert.deepEqual(meterReportBarLegend(marked('yearOverYear')).map(l => l.label), ['10月', '9月'])
 assert.deepEqual(meterReportBarLegend(compare).map(l => l.label), ['10月', '9月'])
 const yearCurve = meterReportLoadCurve(marked('yearOverYear'))
 assert.ok(decodeURIComponent(yearCurve.src).includes('9月'))
 const yearCompare = { ...marked('yearOverYear'), params: { ...marked('yearOverYear').params,
  span: { requested: { from: '2026-09-01T00:00:00+08:00', to: '2026-10-01T00:00:00+08:00' }, observed: compare.params.span.observed },
  baseline: { requested: { from: '2025-09-01T00:00:00+08:00', to: '2025-10-01T00:00:00+08:00' }, observed: { from: null, to: null } } } }
 const line = meterReportParamLine(yearCompare)
 assert.ok(line.includes('2026-09-01') && line.includes('2025-09-01'))
 assert.equal(meterReportParamLine({ ...compare, params: { ...compare.params, baseline: { requested: { from: '2025-09-24T00:00:00+08:00', to: '2025-10-01T00:00:00+08:00' }, observed: { from: null, to: null } } } }).includes('2025-09-24'), true)
})

test('单侧有效：主数字显示有效侧实际总量而非空占位，标出缺采样一侧', () => {
 const bEmpty = { ...compare,
  params: { ...compare.params, relation: 'yearOverYear' },
  sides: { ...compare.sides, b: { ...compare.sides.b, dataMeters: 0 } },
  diff: { value: null, pct: null, pctNote: '数据不足' } }
 const hB = meterReportHero(bEmpty)
 assert.equal(hB.label, '用电同比 · 10月用电')
 assert.equal(hB.value, '175')
 assert.equal(hB.unit, '度')
 assert.equal(hB.pct, '')
 assert.equal(hB.pctNote, '9月无有效采样')
 assert.equal(hB.sub, '10月 175 度 · 9月 —')
 const aEmpty = { ...compare,
  sides: { ...compare.sides, a: { ...compare.sides.a, dataMeters: 0 } },
  diff: { value: null, pct: null, pctNote: '数据不足' } }
 const hA = meterReportHero(aEmpty)
 assert.equal(hA.label, '用电量 · 10月 vs 9月 · 9月用电')
 assert.equal(hA.value, '210')
 assert.equal(hA.unit, '度')
 assert.equal(hA.pct, '')
 assert.equal(hA.pctNote, '10月无有效采样')
 assert.equal(hA.sub, '10月 — · 9月 210 度')
 const both = { ...aEmpty, sides: { a: { ...aEmpty.sides.a, dataMeters: 0 }, b: { ...aEmpty.sides.b, dataMeters: 0 } } }
 assert.equal(meterReportHero(both).value, null)
})

test('对比指标表：指标/月度标签/变化 四列，变化给涨跌色', () => {
 const rows = meterReportMetricTable(compare)
 assert.deepEqual(rows.map(r => r.label), ['日均', '工作日日均', '夜间基荷', '峰值日'])
 const daily = rows[0]
 assert.deepEqual(daily.a, { text: '25 度/日', sub: '' })
 assert.deepEqual(daily.b, { text: '30 度/日', sub: '' })
 assert.deepEqual(daily.change, { text: '−5', tone: 'down' })
 const peak = rows[3]
 assert.equal(peak.a.sub, '10/03') // 峰值日本期日期
 assert.equal(peak.b.sub, '09/27')
 const up = { ...compare, metrics: [{ key: 'nightBase', unit: '度/时', a: { value: 0.5 }, b: { value: 0.4 }, change: 0.1 }] }
 assert.deepEqual(meterReportMetricTable(up)[0].change, { text: '+0.1', tone: 'up' })
 const nullChange = { ...compare, metrics: [{ key: 'nightBase', unit: '度/时', a: { value: null }, b: { value: 0.4 }, change: null }] }
 assert.deepEqual(meterReportMetricTable(nullChange)[0].change, { text: '—', tone: '' })
 assert.equal(rows[1].def, '周一至周五数据完整日的平均用电')
})

test('数值精度：两位小数可分辨，零幅差无符号无色', () => {
 const rows = meterReportMetricTable({ ...compare, metrics: [
  { key: 'dailyAvg', unit: '度/日', a: { value: 66.32 }, b: { value: 66.33 }, change: -0.01 },
  { key: 'nightBase', unit: '度/时', a: { value: 2.79 }, b: { value: 2.76 }, change: 0.03 },
  { key: 'peakDay', unit: '度', a: { value: 10 }, b: { value: 10 }, change: 0 },
  { key: 'weekdayDailyAvg', unit: '度/日', a: { value: 3.001 }, b: { value: 3 }, change: 0.001 },
  { key: 'top3Share', unit: '%', a: { value: 9.3 }, b: { value: 9.301 }, change: -0.001 },
 ] })
 assert.deepEqual(rows[0].a, { text: '66.32 度/日', sub: '' })
 assert.deepEqual(rows[0].b, { text: '66.33 度/日', sub: '' })
 assert.deepEqual(rows[0].change, { text: '−0.01', tone: 'down' })
 assert.deepEqual(rows[1].change, { text: '+0.03', tone: 'up' })
 assert.deepEqual(rows[2].change, { text: '0', tone: '' })
 assert.deepEqual(rows[3].change, { text: '0', tone: '' })
 assert.deepEqual(rows[4].change, { text: '0', tone: '' })
 const hero = meterReportHero({ ...compare, diff: { value: -0.004, pct: null, pctNote: '基期为零' } })
 assert.equal(hero.value, '0')
 const heroPct = meterReportHero({ ...compare, diff: { value: -0.004, pct: 0.003 } })
 assert.equal(heroPct.value, '0')
 assert.equal(heroPct.pct, '环比 0%')
 const own = { ...compare, context: { kind: 'peer', parentLabel: '26楼' },
  contribution: { rows: [{ label: '26楼运营部', delta: -0.004, highlight: true }], rest: null, topShare: 100 } }
 assert.equal(meterReportContribution(own).sub, '本表 0')
 const ev = meterReportEvidence({ ...compare, meters: [
  { id: 'm-x', name: 'x表', areaName: 'x区',
   a: { value: 10.001, status: 'ok', observed: { fromSample: null, toSample: null } },
   b: { value: 10, status: 'ok', observed: { fromSample: null, toSample: null } } }] })
 assert.equal(ev[0].valueText, '0 度')
 const ctx = meterReportContext({ ...report, context: { kind: 'parent', parentLabel: '全部电表', share: 50, perMeterDaily: 3.01, parentPerMeterDaily: 3.02 } })
 assert.equal(ctx.text, '占全部电表 50% · 单台日均 3.01 度（全部 3.02）')
})

// 夜间口径 20:00–次日08:00：仅带 nightWindow 标记的 nightBase 改用「夜间负荷」标签与新定义；
// 无标记的旧报告（统计与对比）保持「夜间基荷」与 00–06 定义不变。
test('夜间负荷标记：nightBase 标记 20:00-08:00 时标签/定义换新，旧报告保持原口径', () => {
 const marked = meterReportMetrics({ ...report, metrics: [{ key: 'nightBase', value: 5, unit: '度/时', nightWindow: '20:00-08:00' }] })[0]
 assert.equal(marked.label, '夜间负荷')
 assert.equal(marked.valueText, '5')
 assert.equal(marked.unit, '度/时')
 assert.equal(marked.def, '20:00–次日08:00 用电量 ÷ 12小时，取范围内有效完整夜间的平均')
 const legacy = meterReportMetrics({ ...report, metrics: [{ key: 'nightBase', value: 5, unit: '度/时' }] })[0]
 assert.equal(legacy.label, '夜间基荷')
 assert.equal(legacy.def, '00:00–06:00 平均每小时用电，代表无人时的持续耗电')
 const markedRow = meterReportMetricTable({ ...compare, metrics: [{ key: 'nightBase', unit: '度/时', nightWindow: '20:00-08:00', a: { value: 5 }, b: { value: 3 }, change: 2 }] })[0]
 assert.equal(markedRow.label, '夜间负荷')
 assert.equal(markedRow.def, '20:00–次日08:00 用电量 ÷ 12小时，取范围内有效完整夜间的平均')
 const legacyRow = meterReportMetricTable(compare).find(r => r.key === 'nightBase')
 assert.equal(legacyRow.label, '夜间基荷')
 assert.equal(legacyRow.def, '00:00–06:00 平均每小时用电，代表无人时的持续耗电')
})

// 夜间底带随标记扩展为 20:00–08:00 两段（默认宽 360：格宽 13.4167）；无标记保持 0–6 单段。
test('负荷曲线夜间底带：标记 20:00-08:00 画 0–8 与 20–24 两段，旧报告仍 0–6', () => {
 const rates = Array.from({ length: 24 }, (_, h) => 0.3 + h * 0.01)
 const markedSvg = decodeURIComponent(loadShapeChart(rates, { nightWindow: '20:00-08:00' }).src.slice('data:image/svg+xml;utf8,'.length))
 assert.ok(markedSvg.includes('x="30.00"'))
 assert.ok(markedSvg.includes('width="107.33"')) // 0–8 段
 assert.ok(markedSvg.includes('x="298.33"'))
 assert.ok(markedSvg.includes('width="53.67"')) // 20–24 段
 assert.equal((markedSvg.match(/夜间/g) || []).length, 2)
 const legacySvg = decodeURIComponent(loadShapeChart(rates).src.slice('data:image/svg+xml;utf8,'.length))
 assert.ok(legacySvg.includes('width="80.50"')) // 0–6 单段不变
 assert.equal((legacySvg.match(/夜间/g) || []).length, 1)
 // 报告级接缝：statistics nightBase 带标记时负荷曲线使用新底带。
 const viaReport = meterReportLoadCurve({ ...report, metrics: [{ key: 'nightBase', value: 5, unit: '度/时', nightWindow: '20:00-08:00' }], shape24: { rates, coveredFraction: 1 } })
 const viaSvg = decodeURIComponent(viaReport.src.slice('data:image/svg+xml;utf8,'.length))
 assert.ok(viaSvg.includes('x="298.33"'))
 const viaLegacy = meterReportLoadCurve({ ...report, shape24: { rates, coveredFraction: 1 } })
 assert.ok(decodeURIComponent(viaLegacy.src.slice('data:image/svg+xml;utf8,'.length)).includes('width="80.50"'))
})

test('曲线/分段切换：两种投影视图互不改变主数字与指标', () => {
 const curve = meterReportLoadCurve(compare)
 assert.ok(curve?.hasData)
 const svg = decodeURIComponent(curve.src.slice('data:image/svg+xml;utf8,'.length))
 assert.match(svg, /10月/)
 assert.match(svg, /9月/)
 assert.match(svg, /stroke-dasharray="5 4"/) // 上期虚线
 const bars = meterReportCompareBuckets(compare)
 assert.equal(bars.points.length, 7)
 assert.deepEqual(bars.points[0], { value: 25, baseline: 30, label: '10/01', status: undefined })
 assert.ok(bars.hasData)
 // 任一侧缺曲线时：只画有数据一侧；两侧都缺 → 隐藏。
 const aOnly = { ...compare, sides: { ...compare.sides, b: { ...compare.sides.b, shape24: { rates: null, coveredFraction: 0 } } } }
 assert.ok(meterReportLoadCurve(aOnly)?.hasData)
 const neither = { ...compare, sides: { a: { ...compare.sides.a, shape24: { rates: null, coveredFraction: 0 } }, b: { ...compare.sides.b, shape24: { rates: null, coveredFraction: 0 } } } }
 assert.equal(meterReportLoadCurve(neither), null)
})

test('对比视图选项：无曲线只分段，单侧曲线双选项默认分段，双侧默认曲线', () => {
 const aRates = compare.sides.a.shape24.rates
 const neither = { ...compare, sides: {
  a: { ...compare.sides.a, shape24: { rates: null, coveredFraction: 0 } },
  b: { ...compare.sides.b, shape24: { rates: [null, null], coveredFraction: 0 } } } }
 assert.deepEqual(meterReportCompareViews(neither).map(v => v.key), ['bars'])
 assert.equal(meterReportCompareView(neither), 'bars')
 const aOnly = { ...compare, sides: { ...compare.sides, b: { ...compare.sides.b, shape24: { rates: null, coveredFraction: 0 } } } }
 assert.deepEqual(meterReportCompareViews(aOnly).map(v => v.key), ['curve', 'bars'])
 assert.equal(meterReportCompareView(aOnly), 'bars')
 assert.deepEqual(meterReportCompareViews(compare).map(v => v.key), ['curve', 'bars'])
 assert.equal(meterReportCompareView(compare), 'curve')
 assert.ok(Array.isArray(aRates))
})

test('贡献涨跌条：|Δ| 排序 + 前3占比行 + 零线两侧玉绿/黄铜', () => {
 const c = meterReportContribution(compare)
 assert.equal(c.title, '分位置 变化')
 assert.equal(c.shareText, '前3项占变化的 100%')
 assert.equal(c.shareDef, '前 3 项变化量绝对值之和 ÷ 全部变化量绝对值之和')
 assert.deepEqual(c.rows.map(r => [r.label, r.delta]), [['26楼办公室', -70], ['26楼运营部', 35]])
 const svg = decodeURIComponent(c.src.slice('data:image/svg+xml;utf8,'.length))
 assert.match(svg, /stroke="#c9cfc0" stroke-width="1\.5"/) // 零线
 assert.match(svg, /#3d8a68/) // +Δ 玉绿
 assert.match(svg, /#b89443/) // −Δ 黄铜
 assert.match(svg, /−70/)
 assert.match(svg, /\+35/)
})

test('贡献条：亚分位归中为零，日均单位标记换题', () => {
 const tiny = { ...compare, contribution: { rows: [
  { label: 'A位', delta: 0.01 }, { label: 'B位', delta: -0.01 },
  { label: 'E位', delta: 0.005 }, { label: 'F位', delta: -0.005 },
  { label: 'C位', delta: 0.001 }, { label: 'D位', delta: -0.001 }], rest: null, topShare: 100 } }
 const c = meterReportContribution(tiny)
 assert.deepEqual(c.rows.map(r => r.delta), [0.01, -0.01, 0.01, -0.01, 0, 0])
 const svg = decodeURIComponent(c.src.slice('data:image/svg+xml;utf8,'.length))
 assert.ok(svg.includes('>+0.01</text>'))
 assert.ok(svg.includes('>−0.01</text>'))
 assert.equal((svg.match(/>\+0\.01<\/text>/g) || []).length, 2)
 assert.equal((svg.match(/>−0\.01<\/text>/g) || []).length, 2)
 assert.equal((svg.match(/>0<\/text>/g) || []).length, 2)
 assert.ok(!svg.includes('>+0</text>') && !svg.includes('>−0</text>'))
 const daily = meterReportContribution({ ...compare, contribution: { unit: '度/日', rows: [{ label: 'A位', delta: 1 }], rest: null, topShare: 100 } })
 assert.equal(daily.title, '分位置日均变化 · 度/日')
 const legacy = meterReportContribution(compare)
 assert.equal(legacy.title, '分位置 变化')
 const peer = meterReportContribution({ ...compare, context: { kind: 'peer', parentLabel: '26楼' },
  contribution: { unit: '度/日', rows: [{ label: '26楼运营部', delta: -0.004, highlight: true }], rest: null, topShare: 100 } })
 assert.equal(peer.title, '26楼 日均变化 · 度/日')
 assert.equal(peer.sub, '本表 0 度/日')
 const peerLegacy = meterReportContribution({ ...compare, context: { kind: 'peer', parentLabel: '26楼' },
  contribution: { rows: [{ label: '26楼运营部', delta: -0.004, highlight: true }], rest: null, topShare: 100 } })
 assert.equal(peerLegacy.title, '26楼 变化')
 assert.equal(peerLegacy.sub, '本表 0')
 const withRest = { ...compare, contribution: { ...compare.contribution, rest: { count: 3, delta: -2.5 } } }
 assert.deepEqual(meterReportContribution(withRest).rows.at(-1), { label: '其余 3 处', delta: -2.5 })
 // 空贡献：chart.hasData = false
 const empty = contributionChart([])
 assert.equal(empty.hasData, false)
})

test('单台对比：贡献覆盖整层、本表行高亮、标题带本表 Δ', () => {
 const loc = {
  ...compare,
  params: { ...compare.params, scope: { level: 'location', label: '26楼运营部', basis: 'areaName', meterCount: 1 } },
  context: { kind: 'peer', parentLabel: '26楼', share: 60, rank: 1, of: 2 },
  contribution: {
   rows: [{ label: '26楼办公室', delta: -70, meterIds: ['m-b'] }, { label: '26楼运营部', delta: 35, meterIds: ['m-a'], highlight: true }],
   rest: null, topShare: 100,
  },
  meters: [compare.meters[0]],
 }
 const c = meterReportContribution(loc)
 assert.equal(c.title, '26楼 变化')
 assert.equal(c.sub, '本表 +35')
 assert.equal(c.rows[1].highlight, true)
 const svg = decodeURIComponent(c.src.slice('data:image/svg+xml;utf8,'.length))
 assert.match(svg, /#f5efdf/) // 高亮行淡黄铜底
 // 高亮行未进前 8 时服务端已强制塞入；视图不再重排
 const far = { ...loc, contribution: { ...loc.contribution, rows: [...Array.from({ length: 8 }, (_, i) => ({ label: `位置${i}`, delta: -10 - i, meterIds: [] })), { label: '26楼运营部', delta: 1, meterIds: ['m-a'], highlight: true }] } }
 assert.equal(meterReportContribution(far).rows.at(-1).highlight, true)
})

test('对比依据行：两期采样与 Δ；未计入表给出两侧原因', () => {
 const rows = meterReportEvidence(compare)
 const ok = rows[0]
 assert.equal(ok.statusText, '计入对比')
 assert.equal(ok.valueText, '+35 度')
 assert.match(ok.bounds, /10月 起 2026-10-01 00:00 · 示数 170 · 止 2026-10-08 00:00 · 示数 275/)
 assert.match(ok.bounds, /9月 起 2026-09-24 00:00 · 示数 100 · 止 2026-10-01 00:00 · 示数 170/)
 const excluded = rows[2]
 assert.equal(excluded.statusText, '未计入（10月数据不全·9月计入）')
 assert.equal(excluded.valueText, '—')
 // 原始采样查询覆盖基期起点 → 本期终点（与周比较卡的含基期窗口一致）
 assert.deepEqual(meterReportHistoryQuery(compare, 'm-a'), { equipmentId: 'm-a', from: '2026-09-24T00:00:00.000+08:00', to: '2026-10-08T00:00:00+08:00' })
})

const region = {
 reportId: 'rr1', type: 'meter-report', kind: 'comparison',
 params: {
  axis: 'region',
  span: { requested: { from: '2026-10-01T00:00:00+08:00', to: '2026-10-08T00:00:00+08:00' }, observed: { from: '2026-10-01T00:00:00.000+08:00', to: '2026-10-08T00:00:00.000+08:00' } },
  scope: { level: 'floor', label: '26楼', basis: 'areaName', meterCount: 2 },
  other: { level: 'floor', label: '27楼', basis: 'areaName', meterCount: 1 },
 },
 sides: {
  a: {
   scope: { level: 'floor', label: '26楼', basis: 'areaName', meterCount: 2 },
   total: { value: 504, unit: '度', yuan: 579.6 },
   shape24: { rates: Array(24).fill(1.5), coveredFraction: 1, perMeter: true },
   buckets: { grain: 'day', items: Array.from({ length: 7 }, (_, i) => ({ from: `2026-10-0${i + 1}T00:00:00.000+08:00`, to: `2026-10-0${i + 2}T00:00:00.000+08:00`, value: 72, partial: false, days: 1 })) },
   coverage: { meters: 2, dataMeters: 2, noData: [], partial: [] },
   meters: [
    { id: 'm-a', name: '运营部电表', areaName: '26楼运营部', floor: '26楼', value: 168, status: 'ok', observed: { fromSample: { readTime: '2026-10-01T00:00:00.000+08:00', value: 100 }, toSample: { readTime: '2026-10-08T00:00:00.000+08:00', value: 268 } } },
    { id: 'm-b', name: '26楼办公室电表', areaName: '26楼办公室', floor: '26楼', value: 336, status: 'ok', observed: { fromSample: { readTime: '2026-10-01T00:00:00.000+08:00', value: 200 }, toSample: { readTime: '2026-10-08T00:00:00.000+08:00', value: 536 } } },
   ],
   composition: { kind: 'ranking', rows: [{ label: '26楼办公室', value: 336, meterIds: ['m-b'] }, { label: '26楼运营部', value: 168, meterIds: ['m-a'] }], rest: null, excluded: { noData: 0, partial: 0, through: null } },
   context: { kind: 'parent', parentLabel: '全部电表', share: 60, perMeterDaily: 36, parentPerMeterDaily: 42 },
  },
  b: {
   scope: { level: 'floor', label: '27楼', basis: 'areaName', meterCount: 1 },
   total: { value: 336, unit: '度', yuan: 386.4 },
   shape24: { rates: Array(24).fill(2), coveredFraction: 1, perMeter: true },
   buckets: { grain: 'day', items: Array.from({ length: 7 }, (_, i) => ({ from: `2026-10-0${i + 1}T00:00:00.000+08:00`, to: `2026-10-0${i + 2}T00:00:00.000+08:00`, value: 48, partial: false, days: 1 })) },
   coverage: { meters: 1, dataMeters: 1, noData: [], partial: [] },
   meters: [
    { id: 'm-c', name: '27楼展厅电表', areaName: '27楼展厅', floor: '27楼', value: 336, status: 'ok', observed: { fromSample: { readTime: '2026-10-01T00:00:00.000+08:00', value: 300 }, toSample: { readTime: '2026-10-08T00:00:00.000+08:00', value: 636 } } },
   ],
   composition: { kind: 'ranking', rows: [{ label: '27楼展厅', value: 336, meterIds: ['m-c'] }], rest: null, excluded: { noData: 0, partial: 0, through: null } },
   context: { kind: 'parent', parentLabel: '全部电表', share: 40, perMeterDaily: 48, parentPerMeterDaily: 42 },
  },
 },
 diff: { value: 168, pct: 50 },
 metrics: [
  { key: 'perMeterDaily', unit: '度/台·日', a: { value: 36 }, b: { value: 48 }, change: -12 },
  { key: 'dailyAvg', unit: '度/日', a: { value: 72 }, b: { value: 48 }, change: 24 },
  { key: 'nightBase', unit: '度/时', a: { value: 3 }, b: { value: 2 }, change: 1 },
  { key: 'peakDay', unit: '度', a: { value: 72, sub: '2026-10-02' }, b: { value: 48, sub: '2026-10-03' }, change: 24 },
 ],
 overlapMeterIds: [],
 coverage: { meters: 3, dataMeters: 3, noData: [], partial: [], truncated: false },
 meters: [
  { id: 'm-a', name: '运营部电表', areaName: '26楼运营部', floor: '26楼', value: 168, status: 'ok', observed: { fromSample: { readTime: '2026-10-01T00:00:00.000+08:00', value: 100 }, toSample: { readTime: '2026-10-08T00:00:00.000+08:00', value: 268 } } },
  { id: 'm-b', name: '26楼办公室电表', areaName: '26楼办公室', floor: '26楼', value: 336, status: 'ok', observed: { fromSample: { readTime: '2026-10-01T00:00:00.000+08:00', value: 200 }, toSample: { readTime: '2026-10-08T00:00:00.000+08:00', value: 536 } } },
  { id: 'm-c', name: '27楼展厅电表', areaName: '27楼展厅', floor: '27楼', value: 336, status: 'ok', observed: { fromSample: { readTime: '2026-10-01T00:00:00.000+08:00', value: 300 }, toSample: { readTime: '2026-10-08T00:00:00.000+08:00', value: 636 } } },
 ],
}

test('区域参数行：跨度 · A台数 vs B台数 · 重叠与逐侧未计入尾注', () => {
 assert.equal(meterReportParamLine(region), '2026-10-01 → 10-08 · 26楼 2台 vs 27楼 1台')
 const overlap = { ...region, overlapMeterIds: ['m-a'], sides: { ...region.sides, b: { ...region.sides.b, coverage: { meters: 2, dataMeters: 1, noData: [], partial: [{ id: 'm-x', through: 'x' }] } } } }
 assert.equal(meterReportParamLine(overlap), '2026-10-01 → 10-08 · 26楼 2台 vs 27楼 1台 · 重叠 1 台 · B 1台未计入')
})

test('区域主数字：双总量带度、差额与比例；一侧无数据时不伪造', () => {
 const hero = meterReportHero(region)
 assert.equal(hero.mode, 'region')
 assert.equal(hero.label, '用电量 · 26楼 vs 27楼')
 assert.equal(hero.value, '504 度 vs 336 度')
 assert.equal(hero.detail, '差 +168 度 · +50%')
 const half = { ...region, sides: { ...region.sides, b: { ...region.sides.b, total: { value: 0, unit: '度', yuan: 0 }, coverage: { meters: 1, dataMeters: 0, noData: ['m-c'], partial: [] } } }, diff: { value: null, pct: null, pctNote: '数据不足' } }
 const h2 = meterReportHero(half)
 assert.equal(h2.value, '504 度 vs —')
 assert.equal(h2.detail, '')
 assert.equal(h2.pctNote, '数据不足')
 assert.equal(meterReportParamLine(half).includes('B 1台未计入'), true)
})

test('区域指标表头用 A/B 范围标签，首行单台日均', () => {
 assert.deepEqual(meterReportMetricHeads(region), ['26楼', '27楼', '差'])
 const rows = meterReportMetricTable(region)
 assert.equal(rows[0].key, 'perMeterDaily')
 assert.equal(rows[0].label, '单台日均')
 assert.equal(rows[0].a.text, '36 度/台·日')
 assert.equal(rows[0].change.text, '−12')
 assert.deepEqual(meterReportMetricHeads(compare), ['10月', '9月', '变化'])
})

test('区域曲线：A 玉绿 B 黄铜实线，单台平均后缀图例', () => {
 const curve = meterReportLoadCurve(region)
 assert.ok(curve?.hasData)
 const svg = decodeURIComponent(curve.src.slice('data:image/svg+xml;utf8,'.length))
 assert.match(svg, /26楼 · 单台平均/)
 assert.match(svg, /27楼 · 单台平均/)
 assert.match(svg, /stroke="#b89443"/)
 assert.ok(!/stroke="#b89443" stroke-width="2" stroke-dasharray/.test(svg))
 const sameCount = { ...region, sides: { a: { ...region.sides.a, shape24: { rates: region.sides.a.shape24.rates, coveredFraction: 1 } }, b: { ...region.sides.b, shape24: { rates: region.sides.b.shape24.rates, coveredFraction: 1 } } } }
 const raw = decodeURIComponent(meterReportLoadCurve(sameCount).src.slice('data:image/svg+xml;utf8,'.length))
 assert.match(raw, /26楼</)
 assert.ok(!raw.includes('单台平均'))
})

test('区域排行：两条独立榜单、标题带范围台数、B 黄铜条', () => {
 const rankings = meterReportRegionRankings(region)
 assert.equal(rankings.length, 2)
 assert.equal(rankings[0].title, '26楼 · 2台')
 assert.equal(rankings[1].title, '27楼 · 1台')
 assert.deepEqual(rankings[0].rows.map(r => r.label), ['26楼办公室', '26楼运营部'])
 assert.deepEqual(rankings[1].rows.map(r => r.label), ['27楼展厅'])
 const svg = decodeURIComponent(rankings[1].src.slice('data:image/svg+xml;utf8,'.length))
 assert.match(svg, /fill="#b89443"/)
 assert.ok(!svg.includes('url(#jade)') || !rankings[1].rows.some(r => r.value !== null && !r.highlight))
})

test('区域依据按 A/B 分组；历史查询用单跨度', () => {
 const sections = meterReportEvidenceSections(region)
 assert.equal(sections.length, 2)
 assert.equal(sections[0].tag, 'A · 26楼')
 assert.deepEqual(sections[0].rows.map(r => r.id), ['m-a', 'm-b'])
 assert.equal(sections[1].tag, 'B · 27楼')
 assert.deepEqual(sections[1].rows.map(r => r.id), ['m-c'])
 assert.equal(sections[0].rows[0].statusText, '计入合计')
 assert.match(sections[0].rows[0].bounds, /起 2026-10-01 00:00 · 示数 100 · 止 2026-10-08 00:00 · 示数 268/)
 const overlap = { ...region, overlapMeterIds: ['m-c'], sides: { ...region.sides, a: { ...region.sides.a, meters: [...region.sides.a.meters, region.sides.b.meters[0]] } } }
 const s2 = meterReportEvidenceSections(overlap)
 assert.equal(s2.length, 1)
 assert.deepEqual(meterReportHistoryQuery(region, 'm-c'), { equipmentId: 'm-c', from: '2026-10-01T00:00:00+08:00', to: '2026-10-08T00:00:00+08:00' })
})

test('04 修正：跨日/跨年与日内时刻保留、分段默认回退、空合计隐藏主数字、环比只在紧邻等长基期', () => {
 const subDay = { ...report, params: { ...report.params, span: { requested: { from: '2026-10-01T08:30:00+08:00', to: '2026-10-02T10:45:00+08:00' } } } }
 assert.equal(meterReportSpan(subDay), '2026-10-01 08:30 → 10-02 10:45')
 const crossYear = { ...compare, params: { ...compare.params, baseline: { requested: { from: '2026-12-28T00:00:00+08:00', to: '2027-01-04T00:00:00+08:00' } } } }
 assert.match(meterReportParamLine(crossYear), /2026-12-28 → 2027-01-04/)
 const laterBase = { ...compare, params: { ...compare.params, baseline: { requested: { from: '2026-09-20T00:00:00+08:00', to: '2026-10-10T00:00:00+08:00' } } } }
 assert.deepEqual(meterReportHistoryQuery(laterBase, 'm-a'), { equipmentId: 'm-a', from: '2026-09-20T00:00:00+08:00', to: '2026-10-10T00:00:00+08:00' })
 assert.equal(meterReportCompareView(compare), 'curve')
 assert.equal(meterReportCompareView({ ...compare, sides: { ...compare.sides, b: { ...compare.sides.b, shape24: { rates: null, coveredFraction: 0 } } } }), 'bars')
 assert.equal(meterReportCompareView(region), 'curve')
 assert.equal(meterReportHero({ ...report, coverage: { ...report.coverage, dataMeters: 0 }, total: { value: 0, unit: '度', yuan: null, tariff: null } }).empty, true)
 assert.match(meterReportHero(crossYear).pct || '', /较基期/)
 assert.match(meterReportHero(compare).pct || '', /环比/)
 const emptyCohort = {
  ...compare,
  coverage: { ...compare.coverage, dataMeters: 0 },
  sides: { a: { ...compare.sides.a, total: { value: 0, unit: '度', yuan: 0 } }, b: { ...compare.sides.b, total: { value: 0, unit: '度', yuan: 0 } } },
  diff: { value: null, pct: null, pctNote: '数据不足' },
 }
 const emptyHero = meterReportHero(emptyCohort)
 assert.equal(emptyHero.value, null)
 assert.equal(emptyHero.pctNote, '数据不足')
 assert.match(emptyHero.sub, /10月 — · 9月 —/)
 assert.equal(emptyHero.sub, '10月 — · 9月 —')
 assert.match(meterReportParamLine({ ...report, coverage: { ...report.coverage, truncated: true } }), /读取不全$/)
})

test('09 修正：不等长周期按日均对比、单侧有效保留该侧总量、采样停更标注截至时间、无有效数据判空', () => {
 // 1. 跨度停更：observed.to 比 requested.to 早超过 1 天且无单表 partial 时，参数行标注截至日期
 const earlyStopStats = {
  ...report,
  params: { ...report.params, span: { requested: { from: '2026-10-01T00:00:00+08:00', to: '2026-10-14T20:00:00+08:00' }, observed: { from: '2026-10-01T08:00:00.000+08:00', to: '2026-10-10T08:00:00.000+08:00' } } },
  coverage: { meters: 43, dataMeters: 43, noData: [], partial: [], truncated: false },
 }
 assert.match(meterReportParamLine(earlyStopStats), /截至10\/10/)
 assert.equal(meterReportHasData(earlyStopStats), true)
 assert.equal(meterReportHasData({ ...earlyStopStats, coverage: { ...earlyStopStats.coverage, dataMeters: 0 } }), false)

 // 2. 不等长周期对比：diff.basis='dailyAvg'，主数字单位为 度/日，副行展示两期总量与有效天数
 const unequalCmp = {
  ...compare,
  sides: {
   a: { ...compare.sides.a, total: { value: 135, unit: '度', yuan: 155.25 }, dataMeters: 2, effectiveDays: 3 },
   b: { ...compare.sides.b, total: { value: 210, unit: '度', yuan: 241.5 }, dataMeters: 2, effectiveDays: 7 },
  },
  diff: { value: 15, pct: 50, basis: 'dailyAvg', unit: '度/日' },
 }
 const hUnequal = meterReportHero(unequalCmp)
 assert.equal(hUnequal.label, '日均用电 · 10月 vs 9月')
 assert.equal(hUnequal.value, '+15')
 assert.equal(hUnequal.unit, '度/日')
 assert.equal(hUnequal.pct, '较基期 +50%')
 assert.equal(hUnequal.sub, '10月 135 度（3天） · 9月 210 度（7天）')

 // 3. 单侧有效对比：本期 0 台有效、上期 2 台有效（210 度）→ 保留上期 210 度，本期显示 —，meterReportHasData 为 true
 const oneSideCmp = {
  ...compare,
  coverage: { ...compare.coverage, dataMeters: 0 },
  sides: {
   a: { ...compare.sides.a, total: { value: 0, unit: '度', yuan: 0 }, dataMeters: 0, effectiveDays: 7 },
   b: { ...compare.sides.b, total: { value: 210, unit: '度', yuan: 241.5 }, dataMeters: 2, effectiveDays: 7 },
  },
  diff: { value: null, pct: null, pctNote: '10月无有效采样' },
 }
 const hOneSide = meterReportHero(oneSideCmp)
 assert.equal(hOneSide.value, '210')
 assert.equal(hOneSide.unit, '度')
 assert.equal(hOneSide.pctNote, '10月无有效采样')
 assert.equal(hOneSide.sub, '10月 — · 9月 210 度')
 assert.equal(meterReportHasData(oneSideCmp), true)

 // 4. 两侧均无有效数据：meterReportHasData 为 false
 const bothEmptyCmp = {
  ...oneSideCmp,
  sides: { ...oneSideCmp.sides, b: { ...oneSideCmp.sides.b, dataMeters: 0 } },
 }
 assert.equal(meterReportHasData(bothEmptyCmp), false)
})

test('分段双柱：A 缺测仍画 B；B 缺测不画假零线', () => {
  const bOnly = [{ value: null, baseline: 5, label: '10/01' }]
 const svg = decodeURIComponent(meterBarChart(bOnly, { paired: true }).src.slice('data:image/svg+xml;utf8,'.length))
 assert.match(svg, /fill="#bfd2b9"/)
 assert.ok(!svg.includes('缺测'))
 const aOnly = [{ value: 5, baseline: null, label: '10/01' }]
 const svgA = decodeURIComponent(meterBarChart(aOnly, { paired: true }).src.slice('data:image/svg+xml;utf8,'.length))
 assert.match(svgA, /fill="url\(#jade\)"/)
 assert.ok(!svgA.includes('bfd2b9'))
 const neither = meterBarChart([{ value: null, baseline: null, label: '10/01' }], { paired: true })
 assert.equal(neither.hasData, false)
 assert.ok(decodeURIComponent(neither.src).includes('缺测'))
 assert.deepEqual(meterReportBarLegend(compare).map(i => i.label), ['10月', '9月'])
 assert.deepEqual(meterReportBarLegend(region).map(i => i.label), ['26楼', '27楼'])
 assert.equal(meterReportBarLegend(report).length, 0)
})

test('图表 SVG 根节点声明 preserveAspectRatio="none"，超宽图在原生渲染中贴边铺满', () => {
 const wide = meterBarChart(Array.from({ length: 291 }, (_, i) => ({ value: i % 200 + 1, baseline: null })), { paired: true })
 const svg = decodeURIComponent(wide.src.slice('data:image/svg+xml;utf8,'.length))
 assert.match(svg, /<svg[^>]*preserveAspectRatio="none"/)
 assert.ok(wide.width > 17000)
})

import { meterPanelQuery, meterPanelScopes, createMeterPanelLoader } from '../pages/agent/lib/energy.mjs'

test('面板查询：预设跨度本地时区、单日/自定义含端点、对比轴、楼层取自 location', () => {
 const now = Date.parse('2024-09-11T10:30:00+08:00')
 assert.deepEqual(meterPanelQuery({ preset: '7d' }, now),
  { kind: 'statistics', from: '2024-09-04T10:30:00.000+08:00', to: '2024-09-11T10:30:00.000+08:00', scopeLevel: 'all' })
 assert.equal(meterPanelQuery({ preset: '30d' }, now).from, '2024-08-12T10:30:00.000+08:00')
 assert.equal(meterPanelQuery({ preset: 'month' }, now).from, '2024-09-01T00:00:00.000+08:00')
 const day = meterPanelQuery({ preset: 'day', date: '2024-09-11' }, now)
 assert.equal(day.from, '2024-09-11T00:00:00.000+08:00')
 assert.equal(day.to, '2024-09-11T10:30:00.000+08:00')
 const past = meterPanelQuery({ preset: 'day', date: '2024-09-09' }, now)
 assert.equal(past.to, '2024-09-10T00:00:00.000+08:00')
 const custom = meterPanelQuery({ preset: 'custom', fromDate: '2024-08-30', toDate: '2024-09-02' }, now)
 assert.equal(custom.from, '2024-08-30T00:00:00.000+08:00')
 assert.equal(custom.to, '2024-09-03T00:00:00.000+08:00')
 const cmp = meterPanelQuery({ preset: '7d', kind: 'comparison', scope: { level: 'floor', floor: '26楼' } }, now)
 assert.equal(cmp.axis, 'time')
 assert.equal(cmp.floor, '26楼')
 assert.equal(cmp.scopeLevel, 'floor')
 const scopes = meterPanelScopes([
  { kind: 'energy', id: 'm1', name: '27楼表', location: '26楼运营部' },
  { kind: 'energy', id: 'm2', name: 'x', location: '27楼展厅' },
  { kind: 'video', id: 'v1', name: '摄像头', location: '99楼' },
 ])
 assert.deepEqual(scopes.map(s => s.key), ['all', 'floor:26楼', 'floor:27楼', 'location:m1', 'location:m2'])
 assert.throws(() => meterPanelQuery({ preset: 'custom', fromDate: '2026-02-29', toDate: '2026-03-01' }, now))
 assert.throws(() => meterPanelQuery({ preset: 'day', date: '2024-09-12' }, now))
 assert.throws(() => meterPanelQuery({ preset: 'custom', fromDate: '2024-09-10', toDate: '2024-09-09' }, now))
})

test('面板加载器：迟到响应不覆盖新请求', async () => {
 const mk = () => { let resolve, reject; const p = new Promise((r, j) => { resolve = r; reject = j }); return { p, resolve, reject } }
 const devices = { devices: [{ kind: 'energy', id: 'm1', name: '运营部电表', location: '26楼运营部' }] }
 const flush = () => new Promise(resolve => setTimeout(resolve, 0))
 const build = (overrides = {}) => {
  const calls = { report: [], devices: [] }
  const states = []
  let scope = 'u1'
  const loader = createMeterPanelLoader({
   fetchReport: () => { const d = mk(); calls.report.push(d); return d.p },
   fetchDevices: () => { const d = mk(); calls.devices.push(d); return d.p },
   getScope: () => { if (scope === 'THROW') throw new Error('客户登录已失效，请重新登录'); return scope },
   waitSession: () => Promise.resolve(),
   onChange: s => states.push(s),
   now: () => Date.parse('2024-09-11T10:30:00+08:00'),
   ...overrides,
  })
  return { calls, states, loader, setScope: v => { scope = v } }
 }

 {
  const { calls, states, loader } = build()
  loader.load({ preset: '7d' })
  await flush()
  loader.load({ preset: '30d' })
  await flush()
  calls.report[1].resolve({ reportId: 'B' })
  calls.devices[1].resolve(devices)
  await flush()
  assert.equal(loader.state.report?.reportId, 'B')
  assert.equal(loader.state.loading, false)
  calls.report[0].resolve({ reportId: 'A' })
  calls.devices[0].resolve(devices)
  await flush()
  assert.equal(loader.state.report?.reportId, 'B')
  assert.equal(loader.state.scopes.length, 3)
  assert.equal(states.at(-1).loading, false)
 }

 {
  const { calls, loader } = build()
  loader.load({ preset: '7d' })
  await flush()
  loader.load({ preset: '30d' })
  await flush()
  calls.report[1].resolve({ reportId: 'B' })
  calls.devices[1].resolve(devices)
  await flush()
  calls.report[0].reject(new Error('上游超时'))
  calls.devices[0].reject(new Error('上游超时'))
  await flush()
  assert.equal(loader.state.report?.reportId, 'B')
  assert.equal(loader.state.error, '')
  assert.equal(loader.state.loading, false)
 }

 {
  const { calls, loader } = build()
  loader.load({ preset: '7d' })
  await flush()
  calls.report[0].resolve({ reportId: 'R1' })
  calls.devices[0].resolve(devices)
  await flush()
  loader.load({ preset: '30d' })
  await flush()
  assert.equal(loader.state.loading, true)
  assert.equal(loader.state.report?.reportId, 'R1')
  calls.report[1].resolve({ reportId: 'R2' })
  calls.devices[1].resolve(devices)
  await flush()
  assert.equal(loader.state.report?.reportId, 'R2')
 }

 {
  const { calls, loader, setScope } = build()
  loader.load({ preset: '7d' })
  await flush()
  calls.report[0].resolve({ reportId: 'R1' })
  calls.devices[0].resolve(devices)
  await flush()
  setScope('u2')
  loader.load({ preset: '7d' })
  await flush()
  assert.equal(loader.state.report, null)
  assert.equal(loader.state.scopes.length, 0)
  calls.report[1].resolve({ reportId: 'R3' })
  calls.devices[1].resolve(devices)
  await flush()
  assert.equal(loader.state.report?.reportId, 'R3')
 }

 {
  const { calls, loader, setScope } = build()
  loader.load({ preset: '7d' })
  await flush()
  setScope('u2')
  calls.report[0].resolve({ reportId: 'R1' })
  calls.devices[0].resolve(devices)
  await flush()
  assert.equal(loader.state.report, null)
  assert.equal(loader.state.loading, false)
  assert.ok(loader.state.error)
 }

 {
  const { calls, loader } = build()
  loader.load({ preset: '7d' })
  await flush()
  calls.report[0].resolve({ reportId: 'R1' })
  calls.devices[0].resolve(devices)
  await flush()
  assert.equal(loader.state.report?.reportId, 'R1')
  loader.load({ preset: '30d' })
  await flush()
  calls.report[1].reject(new Error('网关不可达'))
  calls.devices[1].resolve(devices)
  await flush()
  assert.equal(loader.state.report, null)
  assert.equal(loader.state.loading, false)
  assert.match(loader.state.error, /网关不可达/)
 }

 {
  const { calls, loader, setScope } = build()
  loader.load({ preset: '7d' })
  await flush()
  calls.report[0].resolve({ reportId: 'R1' })
  calls.devices[0].resolve(devices)
  await flush()
  loader.load({ preset: '30d' })
  await flush()
  setScope('THROW')
  calls.report[1].resolve({ reportId: 'R2' })
  calls.devices[1].resolve(devices)
  await flush()
  assert.equal(loader.state.report, null)
  assert.equal(loader.state.loading, false)
  assert.ok(loader.state.error)
 }

 {
  const { calls, loader } = build()
  loader.load({ preset: '7d' })
  await flush()
  loader.load({ preset: 'day', date: '2024-02-30' })
  await flush()
  assert.equal(loader.state.report, null)
  assert.equal(loader.state.loading, false)
  assert.ok(loader.state.error)
  calls.report[0].resolve({ reportId: 'LATE' })
  calls.devices[0].resolve(devices)
  await flush()
  assert.equal(loader.state.report, null)
 }

 {
  const { calls, loader } = build()
  loader.load({ preset: '7d' })
  await flush()
  loader.deactivate()
  assert.equal(loader.state.loading, false)
  calls.report[0].resolve({ reportId: 'X' })
  calls.devices[0].resolve(devices)
  await flush()
  assert.equal(loader.state.report, null)
 }

 {
  const { loader } = build({ getScope: () => { throw new Error('客户登录已失效，请重新登录') } })
  loader.load({ preset: '7d' })
  assert.equal(loader.state.report, null)
  assert.match(loader.state.error, /客户登录已失效/)
 }
})

test('meterReportPowerFactor formats per-meter PF lines: statistics/region single line, time splits current/baseline, legacy omits', () => {
 const meter = (id, pf) => ({ id, name: id, powerFactor: pf })
 const stats = { kind: 'statistics', meters: [meter('m-a', { mean: 0.85, min: 0.8, samples: 2, complete: true })] }
 assert.deepEqual(meterReportPowerFactor(stats, 'm-a'), ['功率因数 采样均值 0.85 · 最低 0.8 · 2 次有效采样'])
 assert.deepEqual(meterReportPowerFactor({ kind: 'statistics', meters: [meter('m-a')] }, 'm-a'), [])
 assert.deepEqual(meterReportPowerFactor(stats, 'm-x'), [])
 assert.deepEqual(meterReportPowerFactor({ kind: 'statistics', meters: [meter('m-a', { mean: null, min: null, samples: 0, complete: true })] }, 'm-a'), ['功率因数 采样均值 — · 最低 —'])
 assert.deepEqual(meterReportPowerFactor({ kind: 'statistics', meters: [meter('m-a', { mean: 0, min: 0, samples: 1, complete: false })] }, 'm-a'), ['功率因数 采样均值 0 · 最低 0 · 1 次有效采样 · 读取不全'])
 const time = { kind: 'comparison', params: { axis: 'time', span: { requested: { from: '2026-10-01T00:00:00+08:00' } }, baseline: { requested: { from: '2026-09-01T00:00:00+08:00' } } }, meters: [{ id: 'm-a', a: { powerFactor: { mean: 0.85, min: 0.8, samples: 2, complete: true } }, b: { powerFactor: { mean: 0.5, min: 0.4, samples: 2, complete: true } } }] }
 assert.deepEqual(meterReportPowerFactor(time, 'm-a'), ['10月功率因数 采样均值 0.85 · 最低 0.8 · 2 次有效采样', '9月功率因数 采样均值 0.5 · 最低 0.4 · 2 次有效采样'])
 assert.deepEqual(meterReportPowerFactor({ kind: 'comparison', params: { axis: 'time' }, meters: [{ id: 'm-a', a: {}, b: {} }] }, 'm-a'), [])
 const region = { kind: 'comparison', params: { axis: 'region' }, sides: { a: { meters: [meter('m-a', { mean: 0.9, min: 0.9, samples: 1, complete: true })] }, b: { meters: [meter('m-c', { mean: 0.5, min: 0.5, samples: 1, complete: true })] } }, meters: [meter('m-a'), meter('m-c')] }
 assert.deepEqual(meterReportPowerFactor(region, 'm-c'), ['功率因数 采样均值 0.5 · 最低 0.5 · 1 次有效采样'])
 assert.deepEqual(meterReportPowerFactor(region, 'm-d'), [])
})

test('08:00计量日说明与历史日历日指标保持各自口径', () => {
 const peak = { key: 'peakDay', value: 300, unit: '度', sub: '2026-10-03', dayWindow: 'previous08:00-08:00' }
 const card = meterReportMetrics({ metrics: [peak] })[0]
 assert.equal(card.sub, '10/03')
 assert.match(card.def, /前日08:00–当日08:00/)
 assert.match(card.def, /结束日/)
 const rows = meterReportMetricTable({ metrics: [{ key: 'weekdayDailyAvg', dayWindow: peak.dayWindow, unit: '度/日', a: { value: 90 }, b: { value: 60 }, change: 30 }] })
 assert.match(rows[0].def, /结束日期取周一至周五/)
 assert.equal(meterReportMetrics({ metrics: [{ ...peak, dayWindow: undefined }] })[0].def, '用电最多的一天（只计数据完整的日子）')
})


test('新夜间占比说明使用20:00–08:00与同批完整计量日，历史占比保持原口径', () => {
 const marked = meterReportMetrics({ metrics: [{ key: 'nightShare', value: 30.77, unit: '%', nightWindow: '20:00-08:00', dayWindow: 'previous08:00-08:00' }] })[0]
 assert.equal(marked.label, '夜间占比')
 assert.equal(marked.valueText, '30.77')
 assert.match(marked.def, /20:00–次日08:00/)
 assert.match(marked.def, /同一批/)
 const legacy = meterReportMetrics({ metrics: [{ key: 'nightShare', value: 15.02, unit: '%' }] })[0]
 assert.match(legacy.def, /00:00–06:00/)
})


test('night-window report keeps its time, ranking metric and partial-day evidence distinct from whole-period usage', () => {
 const night = { ...report, params: { ...report.params, dailyWindow: { from: '20:00', to: '08:00', timezone: 'Asia/Shanghai' } },
  meters: [{ id: 'n', name: '运营部电表', areaName: '26楼运营部', status: 'ok', value: 20, night: { validDays: 1, expectedDays: 2, share: 40, shareDays: 1 } }],
  coverage: { ...report.coverage, partial: [{ id: 'n', through: '2026-10-03T08:00:00+08:00' }] } }
 assert.match(meterReportParamLine(night), /每日20:00–次日08:00/)
 assert.match(meterReportHero(night).label, /夜间/)
 assert.match(meterReportRankingTitle(night), /夜间用电排名/)
 assert.equal(meterReportContext(night), null)
 assert.match(meterReportEvidence(night)[0].bounds, /1\/2/)
 assert.match(meterReportEvidence(night)[0].bounds, /40%/)
 assert.match(meterReportEvidence(night)[0].statusText, /部分/)
 assert.deepEqual(meterReportGrainOptions({ ...night, params: { ...night.params, span: { requested: { from: '2026-10-01T20:00:00+08:00', to: '2026-10-02T08:00:00+08:00' } } } }).map(g => g.key), ['day', 'week', 'month'])
})

test('UTC report periods display the same Shanghai boundary and month as explicit +08 offsets', () => {
 const local = { ...report, params: { ...report.params, span: { requested: { from: '2024-06-01T00:00:00+08:00', to: '2024-07-01T00:00:00+08:00' } } } }
 const utc = { ...local, params: { ...local.params, span: { requested: { from: '2024-05-31T16:00:00.000Z', to: '2024-06-30T16:00:00.000Z' } } } }
 assert.equal(meterReportSpan(utc), meterReportSpan(local))
 assert.equal(meterReportParamLine(utc), meterReportParamLine(local))
 assert.deepEqual(meterReportPeriodLabels(utc), meterReportPeriodLabels(local))
})
