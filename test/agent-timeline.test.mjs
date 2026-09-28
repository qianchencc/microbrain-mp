import test from 'node:test'
import assert from 'node:assert/strict'
import { createTimeline, timelineYOf, localDate } from '../pages/agent/timeline-geometry.mjs'
import { deviceTimelineItems } from '../pages/agent/device-timeline-view.mjs'
import { deviceSampleEvents, regionSampleTaskDetail, regionSampleTasks } from '../pages/agent/region-sample-tasks.mjs'

test('区域时间轴按上海时间连续映射，午夜无空隙且每小时 34px', () => {
 assert.equal(timelineYOf('2026-09-25T01:00:00+08:00', '2026-09-25') - timelineYOf('2026-09-25T00:00:00+08:00', '2026-09-25'), 34)
 assert.equal(timelineYOf('2026-09-25T00:00:00+08:00', '2026-09-24') - timelineYOf('2026-09-24T23:00:00+08:00', '2026-09-24'), 34)
 assert.equal(timelineYOf('2026-09-24T16:00:00Z', '2026-09-24'), timelineYOf('2026-09-25T00:00:00+08:00', '2026-09-24'))
 assert.equal(localDate('2026-09-24T16:00:00Z'), '2026-09-25')
})

test('跨日任务在中间日期保留可见缎带和卡片，不显示画面外端点', () => {
 const scene = createTimeline({ date: '2026-09-29', now: '2026-09-29T12:00:00+08:00', items: [
  { id: 'task', at: '2026-09-28T14:00:00+08:00', endAt: '2026-09-30T15:00:00+08:00' },
 ] })
 assert.equal(scene.cards.length, 1)
 assert.ok(scene.cards[0].top > 0 && scene.cards[0].top < scene.height)
 assert.equal(scene.labels.filter(label => label.kind === 'event').length, 0)
 assert.ok(scene.shapes.some(shape => shape.fill === 'future'))
})

test('设备阶段卡区分待核验、进行中和部分完成', () => {
 const event = (phaseId, outcome, at) => ({ taskId: 'task-1', taskLabel: '会议室任务', sourceType: 'scheduled', creatorName: '成员',
  phaseId, at, outcome, device: { id: 'ac-1', kind: 'ac', name: '空调' }, target: { power: 'on' } })
 const morning = event('start', 'verified', '2026-09-27T01:00:00Z')
 const later = outcome => event('end', outcome, '2026-09-27T06:00:00Z')
 assert.equal(deviceTimelineItems([event('only', 'unconfirmed', morning.at)])[0].resultText, '待核验')
 assert.equal(deviceTimelineItems([morning, later('pending')])[0].resultText, '进行中')
 assert.equal(deviceTimelineItems([morning, later('rejected')])[0].resultText, '部分完成')
 assert.equal(deviceTimelineItems([{ ...morning, phaseStatus: 'executing', outcome: 'pending' }])[0].resultText, '执行中')
 assert.equal(deviceTimelineItems([{ ...morning, taskStatus: 'cancelled' },
  { ...later('not_dispatched'), taskStatus: 'cancelled', phaseStatus: 'cancelled' }])[0].resultText, '已核验 · 后续已取消')
})

test('本地演示的区域任务与设备记录指向同一任务及目标', () => {
 const devices = [
  { id: 'light-1', kind: 'lighting', name: '会议室格栅灯' },
  { id: 'light-2', kind: 'lighting', name: '会议室灯带' },
  { id: 'ac-1', kind: 'ac', name: '会议室空调' },
 ]
 const tasks = regionSampleTasks('2026-09-28', 'office-1', devices)
 const closing = tasks.find(task => task.id === 'sample-after-hours')
 assert.ok(closing)
 const events = deviceSampleEvents(tasks, 'light-1')
 const record = deviceTimelineItems(events).find(item => item.taskId === closing.id)
 assert.ok(record)
 assert.equal(record.taskId, closing.id)
 assert.equal(record.label, '关闭')
 assert.equal(regionSampleTaskDetail(closing).phases[0].devices[0].target.closeOrOpen, 0)
 assert.ok(tasks.every(task => task.devices.every(device => devices.some(source => source.id === device.id))))
 assert.deepEqual(deviceSampleEvents(tasks, 'unrelated-device'), [])
})
