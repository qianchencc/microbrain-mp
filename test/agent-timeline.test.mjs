import test from 'node:test'
import assert from 'node:assert/strict'
import { timelineYOf, localDate } from '../pages/agent/timeline-geometry.mjs'

test('区域时间轴按上海时间连续映射，午夜无空隙且每小时 34px', () => {
 assert.equal(timelineYOf('2026-09-25T01:00:00+08:00', '2026-09-25') - timelineYOf('2026-09-25T00:00:00+08:00', '2026-09-25'), 34)
 assert.equal(timelineYOf('2026-09-25T00:00:00+08:00', '2026-09-24') - timelineYOf('2026-09-24T23:00:00+08:00', '2026-09-24'), 34)
 assert.equal(timelineYOf('2026-09-24T16:00:00Z', '2026-09-24'), timelineYOf('2026-09-25T00:00:00+08:00', '2026-09-24'))
 assert.equal(localDate('2026-09-24T16:00:00Z'), '2026-09-25')
})
