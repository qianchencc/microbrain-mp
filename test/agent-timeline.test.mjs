import test from 'node:test'
import assert from 'node:assert/strict'
import { createTimeline, timelineYOf, localDate } from '../pages/agent/timeline-geometry.mjs'
import { deviceTimelineItems } from '../pages/agent/device-timeline-view.mjs'
import { regionTimelineItems } from '../pages/agent/region-timeline.mjs'
import { taskDetailView } from '../pages/agent/task-detail-view.mjs'
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

test('设备阶段卡区分已执行、进行中和明确报错', () => {
 const event = (phaseId, outcome, at) => ({ taskId: 'task-1', taskLabel: '会议室任务', sourceType: 'scheduled', creatorName: '成员',
  phaseId, at, outcome, device: { id: 'ac-1', kind: 'ac', name: '空调' }, target: { power: 'on' } })
 const morning = event('start', 'verified', '2026-09-27T01:00:00Z')
 const later = outcome => event('end', outcome, '2026-09-27T06:00:00Z')
 assert.equal(deviceTimelineItems([{ ...event('only', 'unconfirmed', morning.at), details: { receipt: 'ACCEPTED' } }])[0].resultText, '已执行')
 assert.equal(deviceTimelineItems([morning, later('pending')])[0].resultText, '未执行')
 assert.equal(deviceTimelineItems([morning, later('rejected')])[0].resultText, '明确报错')
 assert.equal(deviceTimelineItems([{ ...morning, phaseStatus: 'executing', outcome: 'pending' }])[0].resultText, '执行中')
 assert.equal(deviceTimelineItems([{ ...morning, taskStatus: 'cancelled' },
  { ...later('not_dispatched'), taskStatus: 'cancelled', phaseStatus: 'cancelled' }])[0].resultText, '已执行 · 后续已取消')
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
 const unresolved = { ...tasks[0], status: 'unconfirmed', phases: tasks[0].phases.map(phase => ({
  ...phase, status: 'unconfirmed', devices: phase.devices.map(device => ({ ...device, outcome: 'unconfirmed' })),
 })) }
 assert.equal(taskDetailView(unresolved).statusText, '明确报错')
 assert.equal(regionTimelineItems([unresolved])[0].warning, false)
})

test('独立区间任务使用保存边界，未到终点不淡化', () => {
 const interval = { startsAt: '2026-10-05T06:00:00.000Z', endsAt: '2026-10-05T08:00:00.000Z' }
 const phase = (id, at, status, outcome) => ({ id, at, status, failureReason: null,
  devices: [{ id: 'light-1', kind: 'lighting', name: '数智工程院长室照明', location: '院长室', target: { closeOrOpen: 1 }, outcome, details: { receipt: outcome === 'unconfirmed' ? 'ACCEPTED' : null } }] })
 const running = { id: 'task-1', label: '下午巡检', status: 'executing', executionActive: false, interval,
  createdAt: '2026-10-05T02:00:00.000Z', creator: { id: 'u-1', displayName: '钱晨' }, source: { type: 'scheduled' },
  devices: [{ id: 'light-1', kind: 'lighting', name: '数智工程院长室照明' }],
  phases: [phase('p1', '2026-10-05T06:10:00.000Z', 'completed', 'unconfirmed'), phase('p2', '2026-10-05T07:30:00.000Z', 'pending', 'pending')] }
 const regionCard = regionTimelineItems([running])[0]
 assert.equal(regionCard.at, interval.startsAt, '区域时间轴以区间起点定位')
 assert.equal(regionCard.endAt, interval.endsAt, '区域时间轴以区间终点收尾')
 assert.equal(regionCard.faded, false, '区间进行中不淡化')
 assert.equal(regionTimelineItems([{ ...running, status: 'completed' }])[0].faded, true, '区间终态后淡化')

 const event = (phaseId, at, phaseStatus, outcome, taskStatus = 'executing') => ({ taskId: 'task-1', taskLabel: '下午巡检',
  sourceType: 'scheduled', creatorName: '钱晨', phaseId, at, phaseStatus, taskStatus, interval, outcome,
  details: outcome === 'unconfirmed' ? { receipt: 'ACCEPTED' } : null,
  device: { id: 'light-1', kind: 'lighting', name: '数智工程院长室照明' }, target: { closeOrOpen: 1 } })
 const items = deviceTimelineItems([event('p1', '2026-10-05T06:10:00.000Z', 'completed', 'unconfirmed')])
 assert.equal(items[0].at, interval.startsAt, '设备记录投影完整任务区间')
 assert.equal(items[0].endAt, interval.endsAt)
 assert.equal(items[0].faded, false, '该设备检查点已收口但区间未终态不淡化')
 assert.equal(deviceTimelineItems([event('p1', '2026-10-05T06:10:00.000Z', 'completed', 'unconfirmed', 'completed')])[0].faded, true,
  '任务终态后设备记录才淡化')

 const detail = taskDetailView(running)
 assert.equal(detail.whenText, '2026-10-05 14:00 至 16:00', '区间任务时间按保存边界显示')
 assert.deepEqual(detail.phases.map(item => item.title), ['检查点1', '检查点2'], '检查点不沿用开始/结束命名')
 assert.equal(detail.statusText, '区间进行中')
 assert.equal(taskDetailView({ ...running, executionActive: true }).statusText, '设备执行中')
 assert.equal(detail.phases[0].devices[0].resultText, '已执行')
 assert.equal(detail.phases[0].devices[0].outcome, 'unconfirmed', '受理结果不被改写成物理核验')
 const verified = phase('p3', '2026-10-05T06:45:00.000Z', 'completed', 'verified')
 assert.equal(taskDetailView({ ...running, phases: [verified] }).phases[0].devices[0].outcome, 'verified')
 const report = { generatedAt: '2026-10-05T08:00:12.000Z', outcome: 'completed',
  phases: [phase('p1', '2026-10-05T06:10:00.000Z', 'completed', 'unconfirmed'), phase('p2', '2026-10-05T07:30:00.000Z', 'completed', 'verified')] }
 const terminal = taskDetailView({ ...running, status: 'completed', phases: report.phases, report })
 assert.equal(terminal.report.outcomeText, '已执行')
 assert.equal(terminal.report.checkpoints, 2)
 assert.equal(terminal.report.devicesVisible, 1, '报告台数按授权可见的唯一设备统计，同一设备跨检查点不重复')
 const otherPhase = { ...phase('p2b', '2026-10-05T07:30:00.000Z', 'completed', 'verified'),
  devices: [{ id: 'ac-1', kind: 'ac', name: '数智工程院长室空调', location: '院长室', target: { temperature: 26 }, outcome: 'verified', details: {} }] }
 assert.equal(taskDetailView({ ...running, status: 'completed', phases: [report.phases[0], otherPhase],
  report: { ...report, phases: [report.phases[0], otherPhase] } }).report.devicesVisible, 2, '不同设备仍分别计入报告台数')
 assert.ok(terminal.report.generatedText.startsWith('2026-10-05 16:00'))
})

test('周期安排区分未来发生与实际报告，并导航到同一发生', async () => {
 const { repeatText, taskNavigation, mergeTaskPlan } = await import('../pages/agent/task-detail-view.mjs')
 assert.equal(repeatText({ frequency: 'weekdays' }), '周一至周五 · 不含节假日调整')
 assert.equal(repeatText({ frequency: 'weekly', weekdays: [1, 5], until: '2026-10-16' }), '每周一、五 · 至 2026-10-16')
 const card = { taskId: 'plan-1', repeat: { frequency: 'weekdays' }, phases: [{ at: '2026-10-09T10:00:00Z', actions: [] }], regionIds: ['office-1'] }
 mergeTaskPlan(card, { planId: 'plan-1', nextAt: '2026-10-12T10:00:00Z', nextOccurrenceId: 'occurrence:plan-1:2026-10-12', latestTask: { id: 'actual-1', status: 'completed' } })
 assert.deepEqual(taskNavigation(card), { taskId: 'occurrence:plan-1:2026-10-12', date: '2026-10-12', regionId: 'office-1' })
 assert.equal(card.phases[0].at, '2026-10-09T10:00:00Z', '计划刷新不改写原提案快照')
 const future = { id: 'occurrence:plan-1:2026-10-12', label: '关灯', status: 'scheduled', repeat: card.repeat,
  occurrence: { planId: 'plan-1', date: '2026-10-12', virtual: true }, phases: [{ at: '2026-10-12T10:00:00Z', devices: [] }] }
 assert.equal(taskDetailView(future).statusText, '未来安排')
 const actual = { ...future, id: 'actual-1', status: 'completed', occurrence: { ...future.occurrence, virtual: false },
  nextAt: '2026-10-13T10:00:00Z', report: { generatedAt: '2026-10-12T10:00:12Z', outcome: 'completed', phases: [{ devices: [] }] }, regionIds: ['office-1'] }
 assert.equal(taskDetailView(actual).report.outcomeText, '已执行')
 assert.equal(taskDetailView(actual).repeatText, repeatText(card.repeat))
 assert.deepEqual(taskNavigation(actual), { taskId: 'actual-1', date: '2026-10-12', regionId: 'office-1' })
})
