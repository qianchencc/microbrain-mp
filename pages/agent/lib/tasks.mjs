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
  taskSettled,
  taskListRange,
  agendaGroups,
  taskDayTime,
  TASK_ALL_CHUNK_DAYS,
  TASK_ALL_MAX_DAYS,
} from '../task-calendar.mjs'
export { shiftDate } from '../region-calendar.mjs'
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
} from '../task-detail-view.mjs'
export {
  taskStatusText,
  taskStatusTone,
  taskNeedsDetails,
  taskResultStatus,
} from '../task-presentation.mjs'
export { deviceTimelineItems } from '../device-timeline-view.mjs'
