import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeStripDays, compositionFromUsage, comparePct, unitOf, donutImage, shiftDate } from '../pages/agent/energy-daily-view.mjs'

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

test('构成环与日期偏移的基础事实', () => {
 assert.equal(shiftDate('2026-10-01', -1), '2026-09-30')
 assert.match(donutImage([2, 3]), /^data:image\/svg\+xml/)
 assert.match(decodeURIComponent(donutImage([2, 3]).slice('data:image/svg+xml;utf8,'.length)), /stroke-dasharray/)
})
