import { shiftDate } from './region-calendar.mjs'
import { taskNeedsDetails } from './task-presentation.mjs'

export const taskDate = value => {
 const ms = Date.parse(value)
 return Number.isFinite(ms) ? new Date(ms + 8 * 3600000).toISOString().slice(0, 10) : ''
}
export const taskToday = () => taskDate(new Date().toISOString())
export const taskStart = task => task.interval?.startsAt || task.phases?.[0]?.at || task.at || ''
export { taskStatusText as taskLabel } from './task-presentation.mjs'
export const taskAbnormal = task => taskNeedsDetails(task.status)
export function tasksOnDate(tasks, date, priority = false) {
 const from = Date.parse(`${date}T00:00:00+08:00`), to = from + 86400000
 const rank = task => task.status === 'executing' ? 0 : task.status === 'scheduled' ? 1 : 2
 return tasks.filter(task => {
  if (task.interval && Date.parse(task.interval.startsAt) < to && Date.parse(task.interval.endsAt) > from) return true
  return (task.phases || []).some(phase => taskDate(phase.at) === date) || taskDate(task.at) === date
 }).sort((a, b) => (priority ? rank(a) - rank(b) : 0) || Date.parse(taskStart(a)) - Date.parse(taskStart(b)))
}
export function taskCalendarMarks(tasks, from, to) {
 const marks = []
 for (let date = from; date <= to; date = shiftDate(date, 1)) {
  const rows = tasksOnDate(tasks, date)
  if (rows.length) marks.push({ date, abnormal: rows.some(taskAbnormal) })
 }
 return marks
}

// 日历只刷新今天：按任务身份替换当天行，其余日期保留已读结果，不重取整格。
export function mergeDayTasks(rows, fresh, date) {
 const merged = new Map(rows.map(row => [row.taskId, row])), todayIds = new Set(fresh.map(row => row.taskId))
 for (const row of rows) if (!todayIds.has(row.taskId) && tasksOnDate([row], date).length) merged.delete(row.taskId)
 for (const row of fresh) merged.set(row.taskId, row)
 return [...merged.values()]
}
// 过去日不会新增任务：网格不含今天时不再定时；含今天时只监视今天（执行中 5 秒，其他 30 秒）。
export function calendarPollDelay(rows, today, from, to) {
 if (!from || !to || today < from || today > to) return 0
 return rows.some(row => row.status === 'executing' && tasksOnDate([row], today).length) ? 5000 : 30000
}

export const taskSettled = task => ['completed', 'verified', 'observed', 'cancelled', 'satisfied', 'expired'].includes(task.status) || taskNeedsDetails(task.status)

// 任务列表窗口按上海自然日划分，与首页议程同键：进入 Agent 时预取，打开 Sheet 直接命中。
// 执行结果到期取今天结束而不是 now，否则毫秒级时间戳会让每次打开的键都不同、快照永不命中。
export const TASK_ALL_CHUNK_DAYS = 62, TASK_ALL_MAX_DAYS = 371
export function taskListRange(kind, today = taskToday()) {
 if (kind === 'all') return { from: `${today}T00:00:00+08:00`, to: `${shiftDate(today, TASK_ALL_CHUNK_DAYS)}T00:00:00+08:00` }
 if (kind === 'upcoming') return { from: `${today}T00:00:00+08:00`, to: `${shiftDate(today, 31)}T00:00:00+08:00` }
 return { from: `${shiftDate(today, -30)}T00:00:00+08:00`, to: `${shiftDate(today, 1)}T00:00:00+08:00` }
}

function occurrenceDates(task) {
 const dates = []
 if (task.interval) {
  const starts = taskDate(task.interval.startsAt), ends = taskDate(task.interval.endsAt)
  if (starts) dates.push(starts)
  if (ends && ends > starts) dates.push(ends)
 }
 for (const phase of task.phases || []) dates.push(taskDate(phase.at))
 dates.push(taskDate(task.at), taskDate(task.nextCheckpointAt || task.nextAt))
 return dates.filter(Boolean)
}

export function agendaGroups(tasks, today, dayCount = 10) {
 const days = []
 for (let i = 0; i < dayCount; i += 1) {
  const date = shiftDate(today, i)
  days.push({ date, rows: tasksOnDate(tasks, date, true) })
 }
 const shown = new Set(days.flatMap(day => day.rows))
 const lastDate = days.at(-1)?.date || today
 const later = []
 for (const task of tasks) {
  if (shown.has(task)) continue
  const date = occurrenceDates(task).filter(value => value > lastDate).sort()[0]
  if (date) later.push({ date, task })
 }
 later.sort((a, b) => a.date === b.date ? Date.parse(taskStart(a.task) || '') - Date.parse(taskStart(b.task) || '') : a.date < b.date ? -1 : 1)
 return { days, later }
}

export function taskDayTime(task, date) {
 const clock = value => new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(11, 16)
 if (task.interval) {
  const { startsAt, endsAt } = task.interval
  const continues = taskDate(startsAt) < date
  const endDate = taskDate(endsAt)
  return `${continues ? '续 · 00:00' : clock(startsAt)}–${endDate > date ? '24:00' : clock(endsAt)}`
 }
 const at = (task.phases || []).find(phase => taskDate(phase.at) === date)?.at || taskStart(task)
 return Number.isFinite(Date.parse(at)) ? clock(at) : '—'
}
