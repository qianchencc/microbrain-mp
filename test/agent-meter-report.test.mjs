import test from 'node:test'
import assert from 'node:assert/strict'
import { meterReportParamLine, meterReportHero, meterReportContext, meterReportMetrics, meterReportMetricTable, meterReportLoadCurve, meterReportBuckets, meterReportCompareBuckets, meterReportGrainOptions, meterReportRankingTitle, meterReportRanking, meterReportContribution, meterReportEvidence, meterReportHistoryQuery, meterReportIsComparison, meterReportSpanText } from '../pages/agent/meter-report-view.mjs'
import { loadShapeChart, contributionChart } from '../pages/agent/energy-chart.mjs'

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

test('对比参数行：本期 vs 基期 · 范围台数 · 覆盖尾注', () => {
 assert.equal(meterReportIsComparison(compare), true)
 assert.equal(meterReportParamLine(compare), '10-01 → 10-08 vs 09-24 → 10-01 · 全部电表 4台 · 1台数据截至10/04 · 1台无数据')
 assert.equal(meterReportSpanText(compare), '本期 10-01 → 10-08 · 上期 09-24 → 10-01')
 assert.equal(meterReportIsComparison(report), false) // 统计报告不走对比分支
})

test('对比主数字：带符号差值 + 环比 + 本期/上期小字；基期为 0 时比例给说明', () => {
 const hero = meterReportHero(compare)
 assert.equal(hero.value, '−35')
 assert.equal(hero.pct, '环比 −16.7%')
 assert.equal(hero.sub, '本期 175 度 · 上期 210 度')
 const flat = { ...compare, diff: { value: 70, pct: null, pctNote: '基期为零' } }
 const hero0 = meterReportHero(flat)
 assert.equal(hero0.value, '+70')
 assert.equal(hero0.pct, '')
 assert.equal(hero0.pctNote, '基期为零')
})

test('对比指标表：指标/本期/上期/变化 四列，变化给涨跌色', () => {
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

test('曲线/分段切换：两种投影视图互不改变主数字与指标', () => {
 const curve = meterReportLoadCurve(compare)
 assert.ok(curve?.hasData)
 const svg = decodeURIComponent(curve.src.slice('data:image/svg+xml;utf8,'.length))
 assert.match(svg, /本期/)
 assert.match(svg, /上期/)
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
 assert.match(ok.bounds, /本期 起 2026-10-01 00:00 · 示数 170 · 止 2026-10-08 00:00 · 示数 275/)
 assert.match(ok.bounds, /上期 起 2026-09-24 00:00 · 示数 100 · 止 2026-10-01 00:00 · 示数 170/)
 const excluded = rows[2]
 assert.equal(excluded.statusText, '未计入（本期数据不全·上期计入）')
 assert.equal(excluded.valueText, '—')
 // 原始采样查询覆盖基期起点 → 本期终点（与周比较卡的含基期窗口一致）
 assert.deepEqual(meterReportHistoryQuery(compare, 'm-a'), { equipmentId: 'm-a', from: '2026-09-24T00:00:00.000+08:00', to: '2026-10-08T00:00:00+08:00' })
})
