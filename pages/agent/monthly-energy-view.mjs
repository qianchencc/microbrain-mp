// 首页月度同期：自然月从 1 日零点起，上海时间下同日同刻；短月两侧共同截到较短月份同日。
const HOUR = 3600000
const round = value => Math.round((value + Number.EPSILON) * 100) / 100
const finite = value => typeof value === 'number' && Number.isFinite(value)
const iso = ms => new Date(ms + 8 * HOUR).toISOString().replace('Z', '+08:00')
const shanghaiTime = value => Number.isFinite(Date.parse(value)) ? iso(Date.parse(value)) : ''
const monthLength = (year, month) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
export const monthlyNumber = value => finite(value) ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '—'
export const monthlyDate = value => value ? `${value.slice(0, 4)}.${Number(value.slice(5, 7))}.${Number(value.slice(8, 10))}` : ''
const periodLabel = span => `${monthlyDate(span.from)}–${Number(span.to.slice(5, 7))}.${Number(span.to.slice(8, 10))}`

export function monthlyEnergyWindows(now = new Date(), sampleTime = '') {
 const sampled = Date.parse(sampleTime), currentTime = now.getTime()
 // 只采用今天已有的最新采样作为截止点；旧日期不能替代用户要求的本月至今日。
 const time = Number.isFinite(sampled) && sampled <= currentTime && iso(sampled).slice(0, 10) === iso(currentTime).slice(0, 10) ? sampled : currentTime
 const local = new Date(time + 8 * HOUR)
 const year = local.getUTCFullYear(), month = local.getUTCMonth(), day = local.getUTCDate()
 const clock = [local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds(), local.getUTCMilliseconds()]
 const at = (y, m, d, h = 0, min = 0, s = 0, ms = 0) => iso(Date.UTC(y, m, d, h - 8, min, s, ms))
 const current = { from: at(year, month, 1), to: iso(time) }
 const pairs = [{ key: 'month', title: '环比', label: '上月同期', year, month: month - 1 },
  { key: 'year', title: '同比', label: '去年同期', year: year - 1, month }].map(base => {
  const endDay = Math.min(day, monthLength(base.year, base.month))
  return { key: base.key, title: base.title, label: base.label, shortened: endDay !== day,
   current: { from: current.from, to: at(year, month, endDay, ...clock) },
   baseline: { from: at(base.year, base.month, 1), to: at(base.year, base.month, endDay, ...clock) } }
 })
 return { current, pairs }
}

export async function readMonthlyEnergy(windows, request, publish) {
 const spans = [windows.current, ...windows.pairs.flatMap(pair => [pair.current, pair.baseline])]
 const unique = [...new Map(spans.map(span => [span.from + '/' + span.to, span])).values()]
 await Promise.all(unique.map(async span => {
  const key = span.from + '/' + span.to
  // 月初零点无有效时长，不发反向或空区间请求。
  if (Date.parse(span.to) <= Date.parse(span.from)) { publish(key, { error: '本月尚无有效统计时长' }); return }
  try { publish(key, { report: await request({ kind: 'statistics', scopeLevel: 'all', from: span.from, to: span.to, grain: 'month' }) }) }
  catch (error) { publish(key, { error: error.message || '月度统计读取失败', denied: [401, 403].includes(error.statusCode ?? error.status) || ['UNAUTHORIZED', 'FORBIDDEN'].includes(error.data?.code) }) }
 }))
}

function periodView(span, states) {
 const state = states[span.from + '/' + span.to]
 const report = state?.report, coverage = report?.coverage, meters = report?.meters || []
 const matching = report?.kind === 'statistics' && report.params?.span?.requested?.from === span.from && report.params?.span?.requested?.to === span.to
 const insideMonth = meters.length > 0 && meters.filter(m => m.status === 'ok').every(m => Date.parse(m.observed?.fromSample?.readTime || '') >= Date.parse(span.from) && Date.parse(m.observed?.toSample?.readTime || '') <= Date.parse(span.to))
 const value = matching && insideMonth && report.total?.unit === '度' && coverage?.dataMeters > 0 && finite(report.total.value) && report.total.value >= 0 ? round(report.total.value) : null
 const boundaryComplete = meters.every(m => Date.parse(m.observed?.fromSample?.readTime || '') === Date.parse(span.from) && Date.parse(m.observed?.toSample?.readTime || '') === Date.parse(span.to))
 const complete = boundaryComplete && value !== null && coverage?.meters > 0 && coverage.dataMeters === coverage.meters && !coverage.truncated
  && !coverage.noData?.length && !coverage.partial?.length && meters.length === coverage.meters && meters.every(m => m.status === 'ok')
 return { span, label: periodLabel(span), value, complete, meters, pending: !state,
  error: state?.error || '', through: shanghaiTime(report?.params?.span?.observed?.to),
  note: state?.error || (state ? (value === null ? (matching && coverage?.dataMeters > 0 && !insideMonth ? '月初缺少准确边界采样' : '暂无有效用电数据') : !complete ? '数据覆盖不完整，显示已取得用电' : '') : '正在读取月度用电') }
}
// 比较原始采样的相对月初偏移，避免以本月 10 日的旧采样对比基期 25 日。
function sameSampling(a, b) {
 const byId = new Map(b.meters.map(meter => [meter.id, meter]))
 const offset = (period, row, key) => Date.parse(row.observed?.[key]?.readTime || '') - Date.parse(period.span.from)
 return a.meters.length === byId.size && a.meters.every(row => {
  const other = byId.get(row.id)
  return other && ['fromSample', 'toSample'].every(key => {
   const x = offset(a, row, key), y = offset(b, other, key)
   return Number.isFinite(x) && x === y
  })
 })
}

export function monthlyEnergyView(windows, states = {}) {
 const current = periodView(windows.current, states)
 const pairs = windows.pairs.map(pair => {
  const a = periodView(pair.current, states), b = periodView(pair.baseline, states)
  let reason = a.error || b.error || (a.pending || b.pending ? '正在读取同期用电' : !a.complete || !b.complete ? '同期数据不完整，暂不比较' : !sameSampling(a, b) ? '采样时点或电表范围未对齐，暂不比较' : '')
  const delta = reason ? null : round(a.value - b.value)
  const pct = delta !== null && b.value > 0 ? round(delta / b.value * 100) : null
  if (!reason && b.value === 0) reason = '基期为零，不计算百分比'
  const max = Math.max(a.value || 0, b.value || 0)
  const visibleChange = pct ?? delta
  const direction = visibleChange === null || visibleChange === 0 ? '' : visibleChange > 0 ? 'up' : 'down'
  return { ...pair, a, b, direction, pct: pct === null ? '—' : `${pct > 0 ? '↑ ' : pct < 0 ? '↓ ' : ''}${monthlyNumber(Math.abs(pct))}%`,
   aWidth: max && a.value !== null ? a.value / max * 100 : 0, bWidth: max && b.value !== null ? b.value / max * 100 : 0,
   summary: delta === null ? reason : delta === 0 ? `与${pair.label}持平` : `较${pair.label}${delta > 0 ? '多' : '少'}用 ${monthlyNumber(Math.abs(delta))} 度`,
   note: delta !== null && b.value === 0 ? reason : pair.shortened ? '短月按两侧相同日期比较' : '' }
 })
 return { current, pairs, title: current.value !== null && !current.complete ? '本月已取得用电' : '本月总用电',
  cutoff: current.through ? `${monthlyDate(current.through)} ${current.through.slice(11, 16)}` : `${monthlyDate(windows.current.to)} ${windows.current.to.slice(11, 16)}` }
}
