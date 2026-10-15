import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeStripDays, padStripDays, markStripFailed, compositionFromUsage, comparePct, unitOf, donutImage, shiftDate, fixedEnergyContext, fixedEnergyWindow, meterStatisticsDailyView } from '../pages/agent/energy-daily-view.mjs'

test('日期条窗口合并：左端拼接保持升序、同日去重', () => {
 const current = [{ date: '2026-10-01', usage: 10 }, { date: '2026-10-02', usage: 11 }]
 const merged = mergeStripDays(current, [{ date: '2026-09-30', usage: 9 }, { date: '2026-10-01', usage: 10.5 }])
 assert.deepEqual(merged.map(d => d.date), ['2026-09-30', '2026-10-01', '2026-10-02'])
 assert.equal(merged[1].usage, 10.5)
})

test('对比百分比：缺基期或基期为 0 时不给数字，不伪造增减', () => {
 assert.equal(comparePct(10, 8), 25)
 assert.equal(comparePct(10, null), null)
 assert.equal(comparePct(10, 0), null)
 assert.equal(comparePct(null, 8), null)
})

test('能耗单位只在已确认 kWh 口径时显示“度”', () => {
 assert.equal(unitOf({ basis: { unit: 'kWh' } }), '度')
 assert.equal(unitOf({ basis: { unit: null } }), '')
 assert.equal(unitOf(null), '')
})

test('同期对比构成按表名楼层归组', () => {
 const nameOf = id => ({ m1: '26楼运营部电表', m2: '27楼茶水间电表', m3: '农旅办公室电表' })[id]
 const items = compositionFromUsage({ m1: 3, m2: 5, m3: 2, m9: 1 }, nameOf)
 assert.deepEqual(items.map(i => i.label), ['27楼', '26楼', '农旅', '其他'])
 assert.equal(items[0].value, 5)
})

test('padStripDays 只补缺、升序、不覆盖已有日', () => {
 const current = [{ date: '2026-10-02', usage: 11, pending: false }]
 const padded = padStripDays(current, '2026-09-30', '2026-10-04')
 assert.deepEqual(padded.map(d => d.date), ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
 assert.equal(padded.find(d => d.date === '2026-10-02').usage, 11)
 assert.equal(padded.find(d => d.date === '2026-10-01').pending, true)
 // 跨年边界连续
 assert.deepEqual(padStripDays([], '2025-12-30', '2026-01-02').map(d => d.date), ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'])
})

test('真实数据补进占位原位：merge 后 pending 消失', () => {
 const padded = padStripDays([], '2026-10-01', '2026-10-03')
 const merged = mergeStripDays(padded, [{ date: '2026-10-02', usage: 42 }])
 assert.equal(merged.length, 3)
 assert.equal(merged[1].usage, 42)
 assert.equal(merged[1].pending, false)
 assert.equal(merged[0].pending, true)
})

test('markStripFailed 只标仍 pending 的日，真实数据不动', () => {
 const strip = mergeStripDays(padStripDays([], '2026-10-01', '2026-10-04'), [{ date: '2026-10-02', usage: 7 }])
 const marked = markStripFailed(strip, '2026-10-01', '2026-10-03')
 assert.equal(marked[0].failed, true)
 assert.equal(marked[1].failed, false)
 assert.equal(marked[1].usage, 7)
 assert.equal(marked[3].pending, true) // 区间外不受影响
})

test('固定计量对象与时间跨度：日期仅定位，分块请求不越界且结束时刻保持排他', () => {
 const context = fixedEnergyContext({ equipmentId: 'm-a', from: '2024-08-12T08:00:00+08:00', to: '2024-08-15T00:00:00+08:00' })
 assert.deepEqual(context, { equipmentId: 'm-a', from: '2024-08-12T08:00:00+08:00', to: '2024-08-15T00:00:00+08:00', minDate: '2024-08-12', maxDate: '2024-08-14' })
 assert.deepEqual(fixedEnergyWindow(context, 90), { kind: 'statistics', scopeLevel: 'location', meterId: 'm-a', from: context.from, to: context.to, grain: 'day' })
 assert.deepEqual(fixedEnergyWindow(context, 2, '2024-08-14'), { kind: 'statistics', scopeLevel: 'location', meterId: 'm-a', from: '2024-08-13T00:00:00.000+08:00', to: context.to, grain: 'day' })
 assert.equal(fixedEnergyWindow(context, 2, '2024-08-15'), null)
 assert.equal(fixedEnergyWindow(context, 2, '2024-08-11'), null)
 const offset = fixedEnergyContext({ equipmentId: 'm-a', from: '2024-08-11T20:00:00Z', to: '2024-08-14T16:00:00Z' })
 assert.equal(offset.minDate, '2024-08-12')
 assert.equal(offset.maxDate, '2024-08-14')
 assert.throws(() => fixedEnergyContext({ equipmentId: 'm-a', from: context.to, to: context.from }))
 assert.throws(() => fixedEnergyContext({ from: context.from, to: context.to }))
 assert.equal(fixedEnergyContext(null), null)
 assert.throws(() => fixedEnergyContext({ equipmentId: 'm-a', from: '2024-08-12', to: context.to }))
 assert.throws(() => fixedEnergyContext({ equipmentId: 'm-a', from: '2024-02-30T00:00:00+08:00', to: context.to }))
 const long = fixedEnergyContext({ equipmentId: 'm-a', from: '2024-01-01T00:00:00+08:00', to: '2024-12-01T00:00:00+08:00' })
 assert.equal(fixedEnergyWindow(long, 90, '2024-02-30'), null)
 assert.equal(fixedEnergyWindow(long, 90, '2024-03-00'), null)
})

test('单表统计复用抽屉：只投影服务端日分段，保留零、缺数及原始范围', () => {
 const context = fixedEnergyContext({ equipmentId: 'm-a', from: '2024-08-12T08:00:00+08:00', to: '2024-08-15T00:00:00+08:00' })
 const report = { kind: 'statistics', observedAt: '2024-08-16T00:00:00+08:00',
  params: { scope: { label: '26楼运营部', meterCount: 1 }, span: { requested: { from: context.from, to: context.to }, observed: { to: '2024-08-14T20:00:00+08:00' } } },
  coverage: { dataMeters: 1, truncated: false },
  meters: [{ id: 'm-a', name: '运营部电表', areaName: '26楼运营部', status: 'ok', observed: { toSample: { readTime: '2024-08-14T20:00:00+08:00' } } }],
  bucketsAll: { day: [
   { from: context.from, to: '2024-08-13T00:00:00+08:00', value: 1.25, partial: true },
   { from: '2024-08-13T00:00:00+08:00', to: '2024-08-14T00:00:00+08:00', value: 0, partial: false },
   { from: '2024-08-14T00:00:00+08:00', to: context.to, value: null, partial: true },
  ] } }
 const view = meterStatisticsDailyView(report, context)
 assert.deepEqual(view.days.map(day => day.usage), [1.25, 0, null])
 assert.deepEqual(view.days.map(day => day.complete), [false, true, false])
 assert.equal(view.meters.length, 1)
 assert.equal(view.meters[0].id, 'm-a')
 assert.deepEqual(view.meters[0].daily['2024-08-12'], { usage: 1.25, status: 'partial' })
 assert.deepEqual(view.meters[0].daily['2024-08-13'], { usage: 0, status: 'comparable' })
 assert.deepEqual(view.meters[0].daily['2024-08-14'], { usage: null, status: 'not_computable' })
 assert.deepEqual(view.window, report.params.span.requested)
 assert.equal(view.basis.unit, 'kWh')
 assert.equal(view.aggregation.label, '26楼运营部')
 assert.equal(view.latestSampleTime, '2024-08-14T20:00:00+08:00')
 const noObserved = { ...report, params: { ...report.params, span: { requested: report.params.span.requested } }, coverage: { ...report.coverage, latestSampleAt: '2026-10-10T08:00:00+08:00' } }
 assert.equal(meterStatisticsDailyView(noObserved, context).latestSampleTime, '2024-08-14T20:00:00+08:00')
 assert.equal(meterStatisticsDailyView({ ...noObserved, meters: [{ ...report.meters[0], observed: {} }] }, context).latestSampleTime, null)
 assert.throws(() => meterStatisticsDailyView({ ...report, meters: [{ ...report.meters[0], id: 'm-other' }] }, context))
 assert.throws(() => meterStatisticsDailyView({ ...report, params: { ...report.params, span: { requested: { from: '2024-08-11T00:00:00+08:00', to: context.to } } } }, context))
})

test('构成环与日期偏移的基础事实', () => {
 assert.equal(shiftDate('2026-10-01', -1), '2026-09-30')
 assert.match(donutImage([2, 3]), /^data:image\/svg\+xml/)
 assert.match(decodeURIComponent(donutImage([2, 3]).slice('data:image/svg+xml;utf8,'.length)), /stroke-dasharray/)
})
