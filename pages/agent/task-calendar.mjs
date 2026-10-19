import { shiftDate } from './region-calendar.mjs'

export const taskDate = value => {
 const ms = Date.parse(value)
 return Number.isFinite(ms) ? new Date(ms + 8 * 3600000).toISOString().slice(0, 10) : ''
}
export const taskToday = () => taskDate(new Date().toISOString())
export const taskStart = task => task.interval?.startsAt || task.phases?.[0]?.at || task.at || ''
export const taskLabel = status => ({ scheduled: '待执行', pending: '待确认', executing: '执行中', completed: '已完成', partial: '部分完成', failed: '执行失败', unconfirmed: '待核验', cancelled: '已取消', missed: '已错过', interrupted: '已中断', verified: '已核验', satisfied: '无需执行' })[status] || '状态待更新'
export const taskAbnormal = task => ['failed', 'partial', 'missed', 'interrupted', 'unconfirmed'].includes(task.status)
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
