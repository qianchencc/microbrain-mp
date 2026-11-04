import { shiftDate } from '../regions/region-calendar.mjs'
import { taskNeedsDetails, taskResultLabel, taskResultStatus, taskStatusTone } from './task-presentation.mjs'

export const taskDate = value => {
 const ms = Date.parse(value)
 return Number.isFinite(ms) ? new Date(ms + 8 * 3600000).toISOString().slice(0, 10) : ''
}
export const taskToday = () => taskDate(new Date().toISOString())
export const taskStart = task => task.interval?.startsAt || task.phases?.[0]?.at || task.at || ''
export { taskStatusText as taskLabel } from './task-presentation.mjs'
export const taskAbnormal = task => taskNeedsDetails(task.status)
export const taskSettled = task => ['completed', 'verified', 'observed', 'cancelled', 'satisfied', 'expired', 'dispatched', 'unconfirmed', 'unknown', 'unavailable'].includes(task.status) || taskNeedsDetails(task.status)
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
// 共享轮询节拍（首页议程与任务日历共用，纯函数，只看后端返回的阶段/区间事实）：
// 到点仍未推进的未完阶段 1 秒快刷；执行中保底 5 秒；否则按最近未来阶段/区间边界 +1 秒内唤醒；
// 全部安静时 30 秒兜底（新任务随时可能出现）。待确认任务在等用户，不按到点快刷。
export const TASK_POLL_FAST_MS = 1000, TASK_POLL_ACTIVE_MS = 5000, TASK_POLL_IDLE_MS = 30000

const phaseOpen = phase => phase?.status == null || ['pending', 'scheduled'].includes(phase.status)

export function taskPollDelay(tasks, now = Date.now()) {
 let nearest = Infinity, live = false
 for (const task of tasks || []) {
  if (taskSettled(task)) continue
  if (task.status === 'executing') live = true
  if (task.status !== 'pending_confirmation') {
   if ((task.phases || []).some(phase => phaseOpen(phase) && Date.parse(phase.at) <= now)) return TASK_POLL_FAST_MS
   if (task.status === 'scheduled' && [task.nextCheckpointAt, task.nextAt].some(value => Date.parse(value) <= now)) return TASK_POLL_FAST_MS
  }
  for (const value of [task.interval?.startsAt, task.interval?.endsAt, task.nextCheckpointAt, task.nextAt, ...(task.phases || []).map(phase => phase.at)]) {
   const at = Date.parse(value)
   if (Number.isFinite(at) && at > now && at - now < nearest) nearest = at - now
  }
 }
 let delay = Number.isFinite(nearest) ? nearest + TASK_POLL_FAST_MS : TASK_POLL_IDLE_MS
 if (live) delay = Math.min(delay, TASK_POLL_ACTIVE_MS)
 return Math.max(TASK_POLL_FAST_MS, Math.min(TASK_POLL_IDLE_MS, delay))
}

// 月格节拍：没有未完任务不定时；其余（含历史/未来月里的未完任务）按共享节拍轮询，
// 历史月不再按「不可变」冻结，跨月未完结果会随节拍推进。
export function calendarPollDelay(rows, from, to, now = Date.now()) {
 if (!from || !to) return 0
 const unfinished = (rows || []).filter(row => !taskSettled(row))
 return unfinished.length ? taskPollDelay(unfinished, now) : 0
}

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

const taskEndedAt = task => (task.phases || []).reduce((latest, phase) => Math.max(latest, Date.parse(phase.endedAt) || 0), 0)
 || Date.parse(task.updatedAt || taskStart(task)) || 0

// 首页议程预览：待执行优先；仅在末尾附当日最多两条已结束结果（完成结果按设备事实桥接），
// 刚结束的任务不无声消失，也不把62天历史灌进预览。
export function agendaPreview(tasks, today, dayCount = 62, maxRows = 4) {
 const groups = agendaGroups(tasks, today, dayCount)
 const days = []
 let total = 0
 for (const day of groups.days) {
  if (total >= maxRows) break
  const rows = day.rows.filter(task => !taskSettled(task))
  if (!rows.length) continue
  const shown = rows.slice(0, Math.min(3, maxRows - total))
  total += shown.length
  days.push({ date: day.date, rows: shown, more: rows.length - shown.length })
 }
 const finished = (groups.days[0]?.rows || []).filter(task => taskSettled(task))
  .sort((a, b) => taskEndedAt(b) - taskEndedAt(a)).slice(0, 2)
  .map(task => ({ ...task, stateLabel: taskResultLabel(task), stateTone: taskStatusTone(taskResultStatus(task)) }))
 if (finished.length) days.push({ date: groups.days[0].date, rows: finished, finished: true })
 return days
}

// 议程行只写后端阶段事实：正在做第几次、或等下一次安排（上海时刻）；未开始/终态交给状态标签。
export function taskProgressNote(task) {
 if (task?.status !== 'executing') return ''
 const phases = task.phases || []
 const active = phases.findIndex(phase => phase.status === 'executing')
 if (active >= 0) return phases.length > 1 ? `正在做第${active + 1}次` : ''
 const next = phases.find(phase => phaseOpen(phase) && phase.at) || ((task.nextCheckpointAt || task.nextAt) ? { at: task.nextCheckpointAt || task.nextAt } : null)
 const ms = next ? Date.parse(next.at) : NaN
 return Number.isFinite(ms) ? `下次 ${new Date(ms + 8 * 3600000).toISOString().slice(11, 16)}` : ''
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
