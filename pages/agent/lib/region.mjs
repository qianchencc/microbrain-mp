// Region projection entrypoint. Pure grouping and development fixtures stay separate from Vue/session adapters.
export { calendarDates, calendarWindow, shiftDate, validCalendarDate } from '../domains/regions/region-calendar.mjs'
export { localDate } from '../domains/regions/timeline-geometry.mjs'
export { regionDeviceGroups, isObservationKind } from '../domains/regions/region-device-view.mjs'
export { regionTimelineItems } from '../domains/regions/region-timeline.mjs'
export { regionSampleTasks, regionSampleTaskDetail, deviceSampleEvents } from '../domains/regions/region-sample-tasks.mjs'
