import test from 'node:test'
import assert from 'node:assert/strict'
import { taskDate, tasksOnDate, taskCalendarMarks, taskDayTime } from '../pages/agent/task-calendar.mjs'
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
