// 首页月度同期：每月 1 日 08:00 起算，按上海时间每日 08:00/20:00 的采样截止。
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
 const local = new Date(currentTime + 8 * HOUR)
 const year = local.getUTCFullYear(), month = local.getUTCMonth(), date = local.getUTCDate(), hour = local.getUTCHours()
 const at = (y, m, d, h = 8) => iso(Date.UTC(y, m, d, h - 8))
 const reached = Date.parse(at(year, month, hour < 8 ? date - 1 : date, hour < 8 || hour >= 20 ? 20 : 8))
 const sampleClock = iso(Number.isFinite(sampled) ? sampled : reached).slice(11)
 // 交接时日统计可能仍只有上一周期采样；凌晨前晚 20:00 也是正常边界。
 // 超过一个采样周期的旧值不能把本月悄悄缩短到停更日期。
 const useSample = sampled <= reached && sampled >= reached - 12 * HOUR && ['08:00:00.000+08:00', '20:00:00.000+08:00'].includes(sampleClock)
 const start = at(year, month, 1)
 const time = Math.max(Date.parse(start), useSample ? sampled : reached)
 const end = new Date(time + 8 * HOUR), day = end.getUTCDate(), clock = end.getUTCHours()
 const current = { from: start, to: iso(time) }
 const pairs = [{ key: 'month', title: '环比', label: '上月同期', year, month: month - 1 },
  { key: 'year', title: '同比', label: '去年同期', year: year - 1, month }].map(base => {
  const endDay = Math.min(day, monthLength(base.year, base.month))
  return { key: base.key, title: base.title, label: base.label, shortened: endDay !== day,
   current: { from: current.from, to: at(year, month, endDay, clock) },
   baseline: { from: at(base.year, base.month, 1), to: at(base.year, base.month, endDay, clock) } }
 })
 return { current, pairs }
}

export async function readMonthlyEnergy(windows, request, publish) {
 const spans = [windows.current, ...windows.pairs.flatMap(pair => [pair.current, pair.baseline])]
 const unique = [...new Map(spans.map(span => [span.from + '/' + span.to, span])).values()]
 await Promise.all(unique.map(async span => {
  const key = span.from + '/' + span.to
  // 月初 08:00 尚无用电区间，属于等待采样，不是请求错误。
  if (Date.parse(span.to) <= Date.parse(span.from)) { publish(key, { waiting: true }); return }
  try {
   const report = await request({ kind: 'statistics', scopeLevel: 'all', from: span.from, to: span.to, grain: 'month' })
   publish(key, { report })
  }
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
 const detailLabel = `${monthlyDate(span.from)} ${span.from.slice(11, 16)} → ${monthlyDate(span.to)} ${span.to.slice(11, 16)}`
 // 后端 stale 的刷新失败以 cache.lastError 为准；数据仍按上次完整快照展示。
 const cache = report?.cache
 const cacheNote = cache?.status === 'stale' && cache.lastError?.message ? cache.lastError.message : ''
 return { span, label: periodLabel(span), detailLabel, value, complete, meters: matching ? meters : [], unitValid: report?.total?.unit === '度', truncated: Boolean(coverage?.truncated), pending: !state || Boolean(state?.preparing),
  error: state?.error || '', through: shanghaiTime(report?.params?.span?.observed?.to), cacheNote,
  note: state?.refreshError || state?.error || cacheNote || (state?.waiting ? '本月用电待首个采样区间完成' : state?.preparing ? (state.message || '数据准备中') : state ? (value === null ? (matching && coverage?.dataMeters > 0 && !insideMonth ? '月初缺少准确边界采样' : '暂无有效用电数据') : !complete ? '数据覆盖不完整，显示已取得用电' : '') : '正在读取月度用电') }
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

function meterComparisonRows(a, b) {
 const side = (period, meter) => {
  const from = Date.parse(meter?.observed?.fromSample?.readTime || ''), to = Date.parse(meter?.observed?.toSample?.readTime || '')
  const start = Date.parse(period.span.from), end = Date.parse(period.span.to)
  const value = period.unitValid && ['ok', 'partial'].includes(meter?.status) && finite(meter.value) && meter.value >= 0 && from >= start && to <= end && to > from ? round(meter.value) : null
  const complete = value !== null && meter.status === 'ok' && from === start && to === end && !period.truncated
  const note = period.pending ? '读取中' : period.error ? '读取失败' : !meter ? '未返回该表' : !period.unitValid ? '单位未确认' : complete ? '' : value === null ? '无有效数据' : period.truncated ? '读取不全' : '采样不完整'
  return { value, complete, note }
 }
 const current = new Map(a.meters.map(meter => [meter.id, meter])), baseline = new Map(b.meters.map(meter => [meter.id, meter]))
 return [...new Set([...current.keys(), ...baseline.keys()])].map(id => {
  const meter = current.get(id) || baseline.get(id), x = side(a, current.get(id)), y = side(b, baseline.get(id))
  const delta = x.complete && y.complete ? round(x.value - y.value) : null
  const pct = delta !== null && y.value > 0 ? round(delta / y.value * 100) : null
  const signed = value => value === null ? '—' : `${value > 0 ? '+' : ''}${monthlyNumber(value === 0 ? 0 : value)}`
  return { id, name: meter.name || meter.areaName || '电表', location: meter.areaName || '', a: x, b: y, delta,
   deltaText: signed(delta), pctText: pct === null ? '—' : signed(pct) + '%',
   direction: delta === null || delta === 0 ? '' : delta > 0 ? 'up' : 'down',
   note: delta === null ? [x.note && `本期${x.note}`, y.note && `对照${y.note}`].filter(Boolean).join(' · ') : y.value === 0 ? '基期为零，不计算百分比' : '' }
 }).sort((x, y) => x.delta === null && y.delta !== null ? 1 : x.delta !== null && y.delta === null ? -1 : (y.delta ?? 0) - (x.delta ?? 0) || x.name.localeCompare(y.name, 'zh-CN') || x.id.localeCompare(y.id))
}

// 月度组合缓存聚合各期状态：任一期 stale、请求失败、准备中，或没有可用 report
// （纯 waiting 是正常月初状态，例外）时，整个组合只作非 fresh 占位，下次读取仍问后端；
// 具体哪期更新失败由该期 lastError/error 提示。
export function monthlySnapshotCache(states) {
 const entries = Object.values(states || {})
 const caches = entries.map(state => state?.report?.cache).filter(cache => cache && typeof cache === 'object')
 const stale = caches.filter(cache => cache.status === 'stale')
 const pending = entries.filter(state => state?.error || state?.refreshError || state?.preparing || state?.report?.coverage?.truncated || (!state?.report && !state?.waiting))
 if (!stale.length && !pending.length) return { status: 'fresh' }
 const failure = stale.find(cache => cache.lastError?.message)
 return { status: 'stale', refreshing: stale.some(cache => cache.refreshing) || pending.some(state => state?.preparing), ...(failure ? { lastError: failure.lastError } : {}) }
}

export function monthlyEnergyView(windows, states = {}) {
 const current = periodView(windows.current, states)
 const pairs = windows.pairs.map(pair => {
  const a = periodView(pair.current, states), b = periodView(pair.baseline, states)
  let reason = a.error || b.error || (a.pending || b.pending ? '正在读取同期用电' : Date.parse(pair.current.to) <= Date.parse(pair.current.from) ? '待首个采样区间完成后比较' : !a.complete || !b.complete ? '同期数据不完整，暂不比较' : !sameSampling(a, b) ? '采样时点或电表范围未对齐，暂不比较' : '')
  const delta = reason ? null : round(a.value - b.value)
  const pct = delta !== null && b.value > 0 ? round(delta / b.value * 100) : null
  if (!reason && b.value === 0) reason = '基期为零，不计算百分比'
  const max = Math.max(a.value || 0, b.value || 0)
  const visibleChange = pct ?? delta
  const direction = visibleChange === null || visibleChange === 0 ? '' : visibleChange > 0 ? 'up' : 'down'
  const cacheNotes = [...new Set([a.cacheNote, b.cacheNote].filter(Boolean))]
  return { ...pair, a, b, rows: meterComparisonRows(a, b), direction, pct: pct === null ? '—' : `${pct > 0 ? '↑ ' : pct < 0 ? '↓ ' : ''}${monthlyNumber(Math.abs(pct))}%`,
   aWidth: max && a.value !== null ? a.value / max * 100 : 0, bWidth: max && b.value !== null ? b.value / max * 100 : 0,
   summary: delta === null ? reason : delta === 0 ? `与${pair.label}持平` : `较${pair.label}${delta > 0 ? '多' : '少'}用 ${monthlyNumber(Math.abs(delta))} 度`,
   note: [delta !== null && b.value === 0 ? reason : '', pair.shortened ? '短月按两侧相同日期比较' : '', ...cacheNotes].filter(Boolean).join(' · ') }
 })
 return { current, pairs, title: current.value !== null && !current.complete ? '本月已取得用电' : '本月总用电',
  cutoff: Date.parse(windows.current.to) <= Date.parse(windows.current.from) ? '' : current.through ? `${monthlyDate(current.through)} ${current.through.slice(11, 16)}` : `${monthlyDate(windows.current.to)} ${windows.current.to.slice(11, 16)}` }
}
