import { fmtShanghaiDateTime } from './observation-view.mjs'

export function defaultPlaybackDates(now = Date.now()) {
 const from = fmtShanghaiDateTime(new Date(now - 30 * 60000).toISOString())
 const to = fmtShanghaiDateTime(new Date(now).toISOString())
 return { fromDate: from.slice(0, 10), fromTime: from.slice(11), toDate: to.slice(0, 10), toTime: to.slice(11) }
}
export function playbackDates(values) {
 const beginTime = `${values.fromDate}T${values.fromTime}:00+08:00`, endTime = `${values.toDate}T${values.toTime}:00+08:00`
 const start = Date.parse(beginTime), end = Date.parse(endTime)
 if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('结束时间须晚于开始时间')
 if (end - start > 3 * 86400000) throw new Error('单次最多查看三天，请调整期间')
 return { beginTime, endTime }
}
