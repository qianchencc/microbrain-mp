import test from 'node:test'
import assert from 'node:assert/strict'
import { taskDate, tasksOnDate, taskCalendarMarks, taskDayTime, agendaGroups, agendaPreview, taskProgressNote, taskSettled, mergeDayTasks, calendarPollDelay, taskPollDelay } from '../pages/agent/lib/tasks.mjs'

const NOW = Date.parse('2026-10-27T10:00:00+08:00')
test('上海自然日包含周期发生、已完成和跨日区间；午夜结束不占次日', () => {
 const tasks = [
  { id: 'recurring', occurrence: { virtual: true }, status: 'scheduled', phases: [{ at: '2026-10-19T16:30:00Z' }] },
  { id: 'done', status: 'completed', phases: [{ at: '2026-10-19T17:00:00Z' }] },
  { id: 'span', status: 'executing', interval: { startsAt: '2026-10-19T23:00:00+08:00', endsAt: '2026-10-21T00:00:00+08:00' }, phases: [] },
 ]
 assert.equal(taskDayTime(tasks[2], '2026-10-20'), '续 · 00:00–24:00')
 assert.equal(taskDayTime(tasks[2], '2026-10-19'), '23:00–24:00')
 assert.equal(taskDate('2026-10-19T16:30:00Z'), '2026-10-20')
 assert.deepEqual(tasksOnDate(tasks, '2026-10-20', true).map(t => t.id), ['span', 'recurring', 'done'])
 assert.deepEqual(tasksOnDate(tasks, '2026-10-21'), [])
 assert.deepEqual(taskCalendarMarks(tasks, '2026-10-19', '2026-10-21'), [{date:'2026-10-19',abnormal:false},{date:'2026-10-20',abnormal:false}])
})

test('议程分组保留全部定时任务：十天日组、更晚去重、已停计划不发生不造行', () => {
 const tasks = [
  { id: 'today', status: 'scheduled', phases: [{ at: '2026-10-22T06:00:00Z' }] },
  { id: 'done', status: 'completed', phases: [{ at: '2026-10-22T09:00:00Z' }] },
  { id: 'virtual', status: 'scheduled', repeat: { frequency: 'daily' }, occurrence: { virtual: true }, phases: [{ at: '2026-10-25T06:00:00Z' }] },
  { id: 'far', status: 'scheduled', nextAt: '2026-12-01T06:00:00Z', phases: [{ at: '2026-12-01T06:00:00Z' }] },
  { id: 'span', status: 'executing', interval: { startsAt: '2026-10-22T23:00:00+08:00', endsAt: '2026-10-25T00:00:00+08:00' }, phases: [] },
 ]
 const { days, later } = agendaGroups(tasks, '2026-10-22', 10)
 assert.equal(days.length, 10)
 assert.deepEqual(days[0].rows.map(task => task.id), ['span', 'today', 'done'])
 assert.deepEqual(days[3].rows.map(task => task.id), ['virtual'])
 assert.deepEqual(later.map(item => `${item.date}:${item.task.id}`), ['2026-12-01:far'])
 assert.equal(taskSettled(tasks[1]), true)
 assert.equal(taskSettled(tasks[0]), false)
})

test('日历只替换今天的行：取消的当天任务移除，跨日任务保留其他日期，月内其他日不动', () => {
 const rows = [
  { taskId: 'gone', status: 'scheduled', phases: [{ at: '2026-10-27T02:00:00Z' }] },
  { taskId: 'keep', status: 'scheduled', phases: [{ at: '2026-10-28T02:00:00Z' }] },
  { taskId: 'span', status: 'executing', interval: { startsAt: '2026-10-26T23:00:00+08:00', endsAt: '2026-10-29T00:00:00+08:00' }, phases: [] },
 ]
 const fresh = [
  { taskId: 'keep', status: 'scheduled', phases: [{ at: '2026-10-28T02:00:00Z' }] },
  { taskId: 'span', status: 'completed', interval: { startsAt: '2026-10-26T23:00:00+08:00', endsAt: '2026-10-29T00:00:00+08:00' }, phases: [] },
  { taskId: 'new', status: 'executing', phases: [{ at: '2026-10-27T05:00:00Z' }] },
 ]
 const merged = mergeDayTasks(rows, fresh, '2026-10-27')
 assert.deepEqual(merged.map(task => task.taskId).sort(), ['keep', 'new', 'span'])
 assert.equal(merged.find(task => task.taskId === 'span').status, 'completed')
 assert.deepEqual(tasksOnDate(merged, '2026-10-28').map(task => task.taskId), ['span', 'keep'])
})

test('schedule→executing：最近未来阶段/区间边界 +1 秒内唤醒，远边界封顶兜底', () => {
 const task = { taskId: 't1', status: 'scheduled', phases: [{ at: '2026-10-27T10:00:10+08:00', status: 'pending' }] }
 assert.equal(taskPollDelay([task], NOW), 11000)
 assert.equal(taskPollDelay([{ taskId: 't2', status: 'scheduled', interval: { startsAt: '2026-10-27T10:00:02+08:00', endsAt: '2026-10-27T20:00:00+08:00' }, phases: [] }], NOW), 3000)
 assert.equal(taskPollDelay([{ taskId: 't3', status: 'scheduled', phases: [{ at: '2026-10-28T10:00:00+08:00', status: 'pending' }] }], NOW), 30000)
})

test('执行中等待下一阶段：保底 5 秒节拍，近边界 +1 秒精确唤醒', () => {
 const waiting = { taskId: 't1', status: 'executing', phases: [{ at: '2026-10-27T08:00:00+08:00', status: 'completed' }, { at: '2026-10-27T11:30:00+08:00', status: 'pending' }] }
 assert.equal(taskPollDelay([waiting], NOW), 5000)
 assert.equal(taskPollDelay([{ ...waiting, phases: [waiting.phases[0], { at: '2026-10-27T10:00:03+08:00', status: 'pending' }] }], NOW), 4000)
})

test('到点未推进的未完阶段 1 秒快刷；待确认任务等用户不快刷', () => {
 assert.equal(taskPollDelay([{ taskId: 't1', status: 'scheduled', phases: [{ at: '2026-10-27T09:59:00+08:00', status: 'pending' }] }], NOW), 1000)
 assert.equal(taskPollDelay([{ taskId: 't2', status: 'scheduled', nextAt: '2026-10-27T09:00:00+08:00', phases: [] }], NOW), 1000)
 assert.equal(taskPollDelay([{ taskId: 't3', status: 'pending_confirmation', phases: [{ at: '2026-10-27T09:00:00+08:00', status: 'pending' }] }], NOW), 30000)
 assert.equal(taskPollDelay([{ taskId: 't4', status: 'executing', phases: [{ at: '2026-10-27T09:59:00+08:00', status: 'executing' }] }], NOW), 5000)
})

test('月格节拍：无未完任务不定时；执行中 5 秒；未来边界 +1 秒', () => {
 const scheduled = [{ taskId: 't1', status: 'scheduled', phases: [{ at: '2026-10-27T10:00:10+08:00' }] }]
 assert.equal(calendarPollDelay(scheduled, '2026-09-28', '2026-11-01', NOW), 11000)
 assert.equal(calendarPollDelay([{ ...scheduled[0], status: 'executing' }], '2026-09-28', '2026-11-01', NOW), 5000)
 assert.equal(calendarPollDelay([{ taskId: 'done', status: 'completed', phases: [{ at: '2026-10-27T02:00:00Z' }] }], '2026-09-28', '2026-11-01', NOW), 0)
 assert.equal(calendarPollDelay([], '2026-09-28', '2026-11-01', NOW), 0)
})

test('历史月结果可刷新：跨月未完任务仍按节拍轮询，整格结束才停', () => {
 const span = { interval: { startsAt: '2026-09-30T23:00:00+08:00', endsAt: '2026-10-02T00:00:00+08:00' }, phases: [] }
 assert.equal(calendarPollDelay([{ taskId: 'live', status: 'executing', ...span }], '2026-08-31', '2026-10-04', NOW), 5000)
 assert.equal(calendarPollDelay([{ taskId: 'done', status: 'completed', ...span }], '2026-08-31', '2026-10-04', NOW), 0)
})

test('议程预览：待执行优先，仅附当日最多两条已结束结果，完成结果按设备事实桥接', () => {
 const tasks = [
  { id: 'run', status: 'executing', phases: [{ at: '2026-10-22T06:00:00Z', status: 'executing' }, { at: '2026-10-22T04:00:00Z', status: 'pending' }] },
  { id: 'await', status: 'scheduled', phases: [{ at: '2026-10-23T06:00:00Z' }] },
  { id: 'far', status: 'scheduled', nextAt: '2026-11-20T02:00:00Z', phases: [{ at: '2026-11-20T02:00:00Z' }] },
  { id: 'done-verified', status: 'completed', phases: [{ at: '2026-10-22T02:00:00Z', status: 'completed', devices: [{ id: 'd1', outcome: 'verified' }] }] },
  { id: 'done-dispatched', status: 'completed', phases: [{ at: '2026-10-22T03:00:00Z', status: 'completed', devices: [{ id: 'd2', outcome: 'unconfirmed' }] }] },
  { id: 'done-third', status: 'completed', phases: [{ at: '2026-10-22T01:00:00Z', status: 'completed', devices: [{ id: 'd3', outcome: 'verified' }] }] },
  { id: 'done-yesterday', status: 'completed', phases: [{ at: '2026-10-21T02:00:00Z', status: 'completed' }] },
 ]
 const days = agendaPreview(tasks, '2026-10-22', 62)
 assert.deepEqual(days.map(day => day.date), ['2026-10-22', '2026-10-23', '2026-11-20', '2026-10-22'])
 assert.deepEqual(days[0].rows.map(task => task.id), ['run'])
 assert.deepEqual(days[1].rows.map(task => task.id), ['await'])
 const finished = days.at(-1)
 assert.equal(finished.finished, true)
 assert.deepEqual(new Set(finished.rows.map(row => row.id)), new Set(['done-verified', 'done-dispatched']))
 assert.deepEqual(Object.fromEntries(finished.rows.map(row => [row.id, row.stateLabel])), { 'done-dispatched': '已下发', 'done-verified': '已完成' })
 assert.ok(!days.some(day => day.rows.some(task => ['done-third', 'done-yesterday'].includes(task.id))))
})

test('刚结束的长任务按实际结束时间进入最近结果，不被较晚开始的旧结果挤掉', () => {
 const tasks = [
  { id: 'long', status: 'completed', phases: [{ at: '2026-10-22T09:00:00+08:00', endedAt: '2026-10-22T12:05:00+08:00' }] },
  { id: 'old-short', status: 'completed', phases: [{ at: '2026-10-22T10:00:00+08:00', endedAt: '2026-10-22T11:00:00+08:00' }] },
  { id: 'recent', status: 'completed', phases: [{ at: '2026-10-22T11:00:00+08:00', endedAt: '2026-10-22T12:00:00+08:00' }] },
 ]
 assert.deepEqual(agendaPreview(tasks, '2026-10-22').at(-1).rows.map(task => task.id), ['long', 'recent'])
})

test('议程阶段进度来自后端阶段事实：正在做第几次/等待下一次', () => {
 const running = { status: 'executing', phases: [{ at: '2026-10-22T02:00:00Z', status: 'completed' }, { at: '2026-10-22T04:00:00Z', status: 'executing' }, { at: '2026-10-22T06:00:00Z', status: 'pending' }] }
 assert.equal(taskProgressNote(running), '正在做第2次')
 const waiting = { status: 'executing', phases: [{ at: '2026-10-22T02:00:00Z', status: 'completed' }, { at: '2026-10-22T06:00:00Z', status: 'pending' }] }
 assert.equal(taskProgressNote(waiting), '下次 14:00')
 assert.equal(taskProgressNote({ status: 'executing', phases: [{ at: '2026-10-22T02:00:00Z', status: 'executing' }] }), '')
 assert.equal(taskProgressNote({ status: 'scheduled', phases: [{ at: '2026-10-22T06:00:00Z' }] }), '')
})
