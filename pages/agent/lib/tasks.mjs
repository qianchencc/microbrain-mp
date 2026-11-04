// Task domain entrypoint. Task projections and navigation stay behind this seam.
export {
  taskDate,
  taskToday,
  taskStart,
  taskLabel,
  taskAbnormal,
  tasksOnDate,
  taskCalendarMarks,
  mergeDayTasks,
  calendarPollDelay,
  taskPollDelay,
  TASK_POLL_FAST_MS,
  TASK_POLL_ACTIVE_MS,
  TASK_POLL_IDLE_MS,
  taskSettled,
  taskListRange,
  agendaGroups,
  agendaPreview,
  taskProgressNote,
  taskDayTime,
  TASK_ALL_CHUNK_DAYS,
  TASK_ALL_MAX_DAYS,
} from '../domains/tasks/task-calendar.mjs'
export { shiftDate } from '../domains/regions/region-calendar.mjs'
export {
  taskDetailView,
  taskExecutionSummaryView,
  taskPlanSnapshot,
  taskNavigation,
  taskTime,
  repeatText,
  taskRequirementsText,
  targetText,
  readTargetText,
  readAgentView,
  readAcView,
  mergeTaskPlan,
  energyImpactView,
} from '../domains/tasks/task-detail-view.mjs'
export {
  taskStatusText,
  taskStatusTone,
  taskNeedsDetails,
  taskResultStatus,
  taskResultLabel,
} from '../domains/tasks/task-presentation.mjs'
export { deviceTimelineItems } from '../domains/tasks/device-timeline-view.mjs'
