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

export const taskSettled = task => ['completed', 'verified', 'observed', 'cancelled', 'satisfied', 'expired'].includes(task.status) || taskNeedsDetails(task.status)

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
