import test from 'node:test'
import assert from 'node:assert/strict'
import { taskDate, tasksOnDate, taskCalendarMarks, taskDayTime, agendaGroups, taskSettled, mergeDayTasks, calendarPollDelay } from '../pages/agent/lib/tasks.mjs'
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

test('网格不含今天不再定时；含今天时执行中 5 秒、其他 30 秒', () => {
 const rows = [{ taskId: 't1', status: 'scheduled', phases: [{ at: '2026-10-27T02:00:00Z' }] }]
 assert.equal(calendarPollDelay(rows, '2026-10-27', '2026-09-28', '2026-11-01'), 30000)
 assert.equal(calendarPollDelay([{ ...rows[0], status: 'executing' }], '2026-10-27', '2026-09-28', '2026-11-01'), 5000)
 assert.equal(calendarPollDelay(rows, '2026-10-27', '2026-08-31', '2026-10-04'), 0)
 assert.equal(calendarPollDelay(rows, '2026-10-27', '2026-11-30', '2027-01-03'), 0)
})
