import test from 'node:test'
import assert from 'node:assert/strict'
import { timelineYOf, localDate } from '../pages/agent/timeline-geometry.mjs'
import { deviceTimelineItems } from '../pages/agent/device-timeline-view.mjs'

test('区域时间轴按上海时间连续映射，午夜无空隙且每小时 34px', () => {
 assert.equal(timelineYOf('2026-09-25T01:00:00+08:00', '2026-09-25') - timelineYOf('2026-09-25T00:00:00+08:00', '2026-09-25'), 34)
 assert.equal(timelineYOf('2026-09-25T00:00:00+08:00', '2026-09-24') - timelineYOf('2026-09-24T23:00:00+08:00', '2026-09-24'), 34)
 assert.equal(timelineYOf('2026-09-24T16:00:00Z', '2026-09-24'), timelineYOf('2026-09-25T00:00:00+08:00', '2026-09-24'))
 assert.equal(localDate('2026-09-24T16:00:00Z'), '2026-09-25')
})

test('设备阶段卡区分待核验、进行中和部分完成', () => {
 const event = (phaseId, outcome, at) => ({ taskId: 'task-1', taskLabel: '会议室任务', sourceType: 'scheduled', creatorName: '成员',
  phaseId, at, outcome, device: { id: 'ac-1', kind: 'ac', name: '空调' }, target: { power: 'on' } })
 const morning = event('start', 'verified', '2026-09-27T01:00:00Z')
 const later = outcome => event('end', outcome, '2026-09-27T06:00:00Z')
 assert.equal(deviceTimelineItems([event('only', 'unconfirmed', morning.at)])[0].resultText, '待核验')
 assert.equal(deviceTimelineItems([morning, later('pending')])[0].resultText, '进行中')
 assert.equal(deviceTimelineItems([morning, later('rejected')])[0].resultText, '部分完成')
})
