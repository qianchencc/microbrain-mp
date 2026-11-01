<template>
 <view class="epanel">
  <scroll-view class="ebody" scroll-y enhanced :show-scrollbar="false">
   <view v-if="error && !report" class="estate-msg"><text>{{ error }}</text><button class="eretry" @tap="init(true)">重试</button></view>
   <view v-if="error && report" class="estale"><text>{{ error }}</text><button class="eretry" @tap="init(true)">重试</button></view>
   <template v-if="report || !error">
    <view class="calrow">
     <button v-if="!bounded || selected" class="calchip" @tap="calOpen = !calOpen"><uni-icons type="calendar" size="13" color="#37513f" /><text>{{ labelOf(selected) }}</text><uni-icons :type="calOpen ? 'up' : 'down'" size="11" color="#71877a" /></button>
    </view>
    <RegionCalendar v-if="calOpen && selected && (!bounded || bounds)" class="ecal" :date="selected" :today="today" :min-date="bounded ? bounds?.min : undefined" :max-date="bounded ? (bounds?.max || today) : today" compact @select="onCalendar" />
    <view class="esec"><text>每日用电</text><text v-if="basisNote">{{ basisNote }}</text></view>
    <CompanyEnergyStrip ref="stripRef" :days="strip" :selected="selected" @select="onSelectDay" @visible-range="onVisibleRange" />
    <EnergySkeleton v-if="loading && !strip.length" :pies="false" />
    <view class="ehero">
     <text class="elabel">{{ labelOf(selected) }} 用电</text>
     <template v-if="dayPending">
      <view class="sk-num" /><view class="sk-delta" />
     </template>
     <view v-else-if="selectedDay?.failed" class="efail"><text class="enum">—</text><view class="efail-row"><text>该日读取失败</text><button class="eretry" @tap="retrySelected">重试</button></view></view>
     <template v-else>
      <text class="enum">{{ selectedDay?.usage == null ? '—' : selectedDay.usage }}<text class="u">{{ unit ? ' ' + unit : '' }}</text></text>
      <text v-if="boundedEmpty" class="edelta">所选统计期间无可计算用电</text>
      <text v-if="selectedDay?.usage != null" class="edelta">较前一日 <text class="b">{{ pctText(dod) }}</text>　较上周同日 <text class="b">{{ pctText(wow) }}</text></text>
      <text v-if="todaySlice && selectedDay && selected !== today && todayInBounds && (selectedDay.elapsedUsage != null || todayUsage != null)" class="edelta">当日同时段 {{ fmtUsage(selectedDay.elapsedUsage, unit) }} · 今日至今 {{ fmtUsage(todayUsage, unit) }}<text v-if="vsToday != null">　今日较当日同时段 <text class="b">{{ pctText(vsToday) }}</text></text></text>
     </template>
    </view>
    <view class="esec"><text>当日构成</text></view>
    <template v-if="dayPending">
     <view v-for="i in 3" :key="'zc' + i" class="zone-row"><view class="sk-zn" /><view class="ztrack"><view class="zfill sk-fill" :style="{ width: (62 - i * 13) + '%' }" /></view></view>
    </template>
    <template v-else-if="composition.items.length">
     <view v-for="(item, i) in composition.items" :key="item.label" class="zone-row">
      <text class="zn">{{ item.label }}</text>
      <view class="ztrack"><view class="zfill" :style="{ width: (item.value / compositionMax * 100) + '%', background: PIE_COLORS[i % PIE_COLORS.length] }" /></view>
      <text class="zv">{{ item.value }}{{ unit ? ' ' + unit : '' }} · {{ Math.round(item.share * 100) }}%</text>
     </view>
    </template>
    <text v-else-if="selectedDay?.failed" class="sec-empty">该日读取失败，可在上方重试</text>
    <text v-else class="sec-empty">当日无可计算的构成</text>
    <view class="esec"><text>电表明细 · {{ labelOf(selected) }}</text><text>{{ meterList.length }} 台</text></view>
    <template v-if="dayPending">
     <view v-for="i in 6" :key="'mk' + i" class="mrow"><view class="mrow-copy"><view class="sk-name" /><view class="sk-loc" /></view><view class="sk-v" /></view>
    </template>
    <text v-else-if="selectedDay?.failed" class="sec-empty">该日明细读取失败，可在上方重试</text>
    <template v-else>
    <view v-for="meter in meterList" :key="meter.id" class="mrow">
     <view class="mrow-copy"><text class="mrow-name">{{ meter.name }}</text><text v-if="meter.location" class="mrow-loc">{{ meter.location }}</text></view>
     <text class="mrow-v">{{ meter.usage == null ? '—' : '用电 ' + meter.usage + (unit ? ' ' + unit : '') }}<text v-if="meter.usage != null && selectedDay?.usage" class="mrow-share">占 {{ Math.round(meter.usage / selectedDay.usage * 100) }}%</text><text v-else-if="meter.status !== 'comparable'" class="mrow-share">{{ statusText(meter.status) }}</text></text>
    </view>
    </template>
    <text class="efoot">{{ footnote }}</text>
   </template>
  </scroll-view>
 </view>
</template>
<script setup>
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { getCompanyEnergyDaily, getCompanyMeterReport } from '@/apis/agent/energy'
import { getAgentStorageScope, isAgentStorageScope, waitForAgentSession } from '@/utils/agent-session'
import RegionCalendar from '../regions/RegionCalendar.vue'
import CompanyEnergyStrip from './CompanyEnergyStrip.vue'
import EnergySkeleton from './EnergySkeleton.vue'
import { shiftDate, shanghaiToday, dayLabel, unitOf, unitNote, floorComposition, meterRows, comparePct, statusText, mergeStripDays, padStripDays, markStripFailed, STRIP_PAGE_DAYS, PIE_COLORS, fmtUsage, fixedEnergyContext, fixedEnergyWindow, meterStatisticsDailyView, mergeHistoryCache, historyCacheFailure } from '../../lib/energy.mjs'
import { fmtDateTime } from '../../lib/observations.mjs'

const props = defineProps({ active: Boolean, focusDate: String, bounded: Boolean, initialQuery: Object })
defineEmits(['refresh'])
// 刷新失败的真实原因在后端 cache.lastError；业务 message 只是通用提示。
const failureMessage = (cause, fallback) => cause?.data?.cache?.lastError?.message || cause?.data?.message || cause?.message || fallback
const today = shanghaiToday()
const report = ref(null)
const strip = ref([])
const meterDaily = ref({}) // meterId → { name, location, daily: {date: cell} }
const selected = ref('')
const latestCompleteDay = ref('')
const latestSampleTime = ref('')
const error = ref('')
const loading = ref(false)
const calOpen = ref(false)
const stripRef = ref(null)
const bounds = ref(null)
let boundedJob = null, boundedContextKey = ''
let sheetVisible = true
const unit = computed(() => unitOf(report.value))
const basisNote = computed(() => unitNote(report.value))
const selectedDay = computed(() => strip.value.find(d => d.date === selected.value) || null)
const dayPending = computed(() => selectedDay.value?.pending || (props.bounded && loading.value && !selectedDay.value))
const meterList = computed(() => {
 const rows = meterRows({ meters: meterEntries.value }, selected.value)
 return [...rows].sort((a, b) => (b.usage ?? -1) - (a.usage ?? -1))
})
const meterEntries = computed(() => Object.values(meterDaily.value))
const composition = computed(() => floorComposition(meterList.value))
const compositionMax = computed(() => composition.value.items.reduce((m, i) => Math.max(m, i.value), 0) || 1)
const usageOf = date => {
 if (props.bounded) {
  if (!bounds.value || date < bounds.value.min || date > bounds.value.max) return null
  const day = strip.value.find(d => d.date === date)
  return day?.complete ? day.usage : null
 }
 return strip.value.find(d => d.date === date)?.usage
}
const selectedUsage = computed(() => props.bounded ? (selectedDay.value?.complete ? selectedDay.value.usage : null) : selectedDay.value?.usage)
const dod = computed(() => comparePct(selectedUsage.value, !props.bounded && selected.value === today ? report.value?.comparison?.previousDay?.usage : usageOf(shiftDate(selected.value, -1))))
const wow = computed(() => comparePct(selectedUsage.value, !props.bounded && selected.value === today ? report.value?.comparison?.lastWeekSameDay?.usage : usageOf(shiftDate(selected.value, -7))))
const labelOf = date => {
 if (!date) return ''
 const year = date.slice(0, 4) === today.slice(0, 4) ? '' : `${date.slice(0, 4)}年`
 if (props.bounded) return `${year}${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`
 return year + (date === today ? `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日 · 今日至今` : dayLabel(date, latestCompleteDay.value))
}
const todayInBounds = computed(() => !props.bounded || Boolean(bounds.value && today >= bounds.value.min && today <= bounds.value.max))
const boundedEmpty = computed(() => Boolean(props.bounded && report.value && bounds.value && !loading.value && !strip.value.some(d => d.pending || d.usage != null)))
// 与今日对比的公平口径：所选日只取与“今日至今”相同的 elapsed 窗口（08:00 → 当前时刻），
// 不拿完整日去比一个未过完的今天；任一侧无实测样本即显示 —。
const todaySlice = computed(() => report.value?.comparison?.currentDay?.date === today ? report.value.comparison.currentDay : null)
const todayUsage = computed(() => todaySlice.value?.usage ?? null)
const vsToday = computed(() => comparePct(todayUsage.value, selectedDay.value?.elapsedUsage))
// 后端 stale 只说明这是上次完整结果；原始 updatedAt 不清空、不改写。
const cacheNote = computed(() => {
 const cache = report.value?.cache
 if (!cache || cache.status !== 'stale') return ''
 if (cache.lastError?.message) return cache.refreshing ? `${cache.lastError.message}（正在后台重试）` : cache.lastError.message
 if (cache.refreshing) return '正在后台更新'
 return '沿用最近一次完整数据'
})
// 历史补块按日期保留 cache 元数据：完整 stale body 的用量继续显示，但失败与原始
// updatedAt 要提示；同块 fresh 返回时只清掉该块日期上的旧失败。
const historyCache = ref({})
const historyNote = computed(() => {
 const failure = historyCacheFailure(historyCache.value)
 if (!failure) return ''
 const range = failure.from === failure.to ? failure.from : `${failure.from}–${failure.to}`
 const status = failure.messages.length ? `更新失败：${failure.messages.join('；')}` : failure.refreshing ? '正在后台更新' : '沿用上次完整数据'
 const time = failure.updatedAt ? ` · 数据截至 ${fmtDateTime(failure.updatedAt)}` : ''
 return `${range} 历史补块${status}${time}`
})
const footnote = computed(() => {
 if (!report.value) return ''
 if (props.bounded) {
  const meter = meterEntries.value[0]
  const parts = []
  if (props.initialQuery && meter) parts.push([meter.name, meter.location].filter(Boolean).join(' · '))
  else parts.push(report.value.aggregation?.label || '')
  if (props.initialQuery) parts.push(`${fmtDateTime(props.initialQuery.from)} — ${fmtDateTime(props.initialQuery.to)}`)
  else if (bounds.value) parts.push(`${bounds.value.min} — ${bounds.value.max}`)
  if (latestSampleTime.value) parts.push(`数据截至 ${fmtDateTime(latestSampleTime.value)}`)
  if (report.value.truncated) parts.push('读取窗口被截断')
  if (cacheNote.value) parts.push(cacheNote.value)
  if (historyNote.value) parts.push(historyNote.value)
  parts.push(report.value.basis?.cycle || '')
  return parts.filter(Boolean).join(' · ')
 }
 const parts = [`数据截至 ${fmtDateTime(latestSampleTime.value)}`]
 if (report.value.truncated) parts.push('读取窗口被截断')
 else if (strip.value.some(day => day.failed)) parts.push('部分日期读取未完成')
 if (cacheNote.value) parts.push(cacheNote.value)
 if (historyNote.value) parts.push(historyNote.value)
 parts.push(report.value.basis?.cycle || '')
 if (report.value.aggregation?.note) parts.push(report.value.aggregation.note)
 return parts.filter(Boolean).join(' · ')
})
function pctText(v) { return v == null ? '—' : (v >= 0 ? '+' : '') + v + '%' }

// 条带是整段日期铺开的占位（pending 柱），数据按 90 天一块补进原位——
// 滚动没有拼接点，日历跳任何日期都有目标列；补块串行，一次一个在途。
const SPAN_DAYS = 180, CHUNK_DAYS = 90
let queue = [], requested = new Set(), pumping = 0

let requestId = 0
function mergeReport(next, replace = true) {
 if (replace || !report.value) {
  report.value = next
  latestCompleteDay.value = next.latestCompleteDay || ''
  latestSampleTime.value = next.latestSampleTime || ''
 } else {
  // 旧窗口只补 days 与逐表 daily；latestCompleteDay/latestSampleTime/basis/cache 保持最新窗口，
  // 左滑历史不冲掉对比，也不让历史块元数据覆盖当前期的 stale/lastError；块失败仍由下面的
  // truncated 标记落在日柱上，只更新本次实际收到的日期。
  const meters = (report.value.meters || []).map(m => {
   const extra = (next.meters || []).find(x => x.id === m.id)
   return extra ? { ...m, daily: { ...(extra.daily || {}), ...(m.daily || {}) } } : m
  })
  report.value = { ...report.value, meters }
 }
 strip.value = mergeStripDays(strip.value, next.days || [])
 if (!replace) historyCache.value = mergeHistoryCache(historyCache.value, next.days, next.cache)
 if (next.truncated) {
  const missing = new Set((next.days || []).filter(day => day.usage == null).map(day => day.date))
  strip.value = strip.value.map(day => missing.has(day.date) ? { ...day, failed: true } : day)
 }
 const currentDay = !props.bounded && replace && next.comparison?.currentDay?.date === today ? next.comparison.currentDay : null
 if (!props.bounded && replace) {
  // 今天尚未形成完整采样日，独立使用今日至今；不能把“现在”禁用或补成零用电。
  strip.value = mergeStripDays(strip.value, [{ date: today, usage: currentDay?.usage ?? null, complete: false,
   coveredMeters: currentDay?.coveredMeters ?? 0, expectedMeters: currentDay?.expectedMeters ?? 0 }])
 }
 const md = { ...meterDaily.value }
 ;(next.meters || []).forEach(meter => {
  md[meter.id] = { id: meter.id, name: meter.name, location: meter.location, daily: { ...(md[meter.id]?.daily || {}), ...(meter.daily || {}) } }
  if (!props.bounded && replace) {
   const usage = currentDay?.meterUsage?.[meter.id] ?? null
   md[meter.id].daily[today] = { usage, status: usage == null ? 'not_computable' : 'comparable' }
  }
 })
 meterDaily.value = md
}
async function fetchWindow(days, end, force = false) {
 const current = requestId
 await waitForAgentSession()
 return getCompanyEnergyDaily({ days, ...(end ? { end } : {}) }, { force: force === true, isActive: () => current === requestId && props.active && sheetVisible })
}
async function fetchMeterReport(request, force = false) {
 const current = requestId
 await waitForAgentSession()
 return getCompanyMeterReport(request, { force: force === true, isActive: () => current === requestId && props.active && sheetVisible })
}
async function init(force = false) {
 const current = ++requestId
 queue = []; requested = new Set()
 loading.value = true; error.value = ''
 try {
  await waitForAgentSession()
  if (current !== requestId || !props.active || !sheetVisible) return
  if (!props.bounded) {
   const nextScope = getAgentStorageScope()
   if (scope.value !== nextScope) clearBoundedData()
   scope.value = nextScope
  }
  const scopeNow = scope.value
  if (props.bounded) { await initBounded(current, force); return }
  // 首块沿用 30 天窗口：命中首屏已暖的报告缓存，面板基本秒开；更早的由补块队列后台填。
  const next = await fetchWindow(STRIP_PAGE_DAYS, undefined, force)
  if (current !== requestId || !props.active || scopeNow !== getAgentStorageScope()) return
  strip.value = []; meterDaily.value = {}; historyCache.value = {}
  mergeReport(next)
  const edge = latestCompleteDay.value || today
  strip.value = padStripDays(strip.value, shiftDate(edge, -(SPAN_DAYS - 1)), edge)
  if (selected.value) jumpToDate(selected.value)
  else if (props.focusDate) jumpToDate(props.focusDate)
  else {
   selected.value = edge || next.days?.at(-1)?.date || today
   nextTick(() => stripRef.value?.centerOn(selected.value))
  }
  needRange(shiftDate(selected.value || edge, -45), shiftDate(selected.value || edge, 15))
 } catch (cause) {
  if (current === requestId) {
   if (!isAgentStorageScope(scope.value) || [401, 403].includes(cause.status)) clearBoundedData()
   error.value = failureMessage(cause, '逐日能耗暂不可用')
  }
 } finally { if (current === requestId) loading.value = false }
}
function clearBoundedData() {
 report.value = null; strip.value = []; meterDaily.value = {}; historyCache.value = {}; selected.value = ''; bounds.value = null
}
async function initBounded(current, force = false) {
 const job = { ctx: null, scope: '', queue: [], requested: new Set(), pumping: false }
 boundedJob = job
 await waitForAgentSession()
 if (current !== requestId || job !== boundedJob || !sheetVisible) return
 job.scope = getAgentStorageScope()
 const contextKey = JSON.stringify(props.initialQuery || null)
 if (boundedContextKey !== contextKey || scope.value !== job.scope) clearBoundedData()
 boundedContextKey = contextKey
 scope.value = job.scope
 if (props.initialQuery) {
  job.ctx = fixedEnergyContext(props.initialQuery)
  if (!job.ctx) { error.value = '该计量对象的统计范围无效'; return }
  bounds.value = { min: job.ctx.minDate, max: job.ctx.maxDate }
  strip.value = padStripDays(strip.value, job.ctx.minDate, job.ctx.maxDate)
  const span = Math.round((Date.parse(job.ctx.maxDate) - Date.parse(job.ctx.minDate)) / 864e5) + 1
  const request = fixedEnergyWindow(job.ctx, span <= 90 ? span : STRIP_PAGE_DAYS)
  const raw = await fetchMeterReport(request, force)
  const next = meterStatisticsDailyView(raw, job.ctx)
  if (current !== requestId || job !== boundedJob || !props.active || !sheetVisible || job.scope !== getAgentStorageScope()) return
  mergeReport(next)
  if (span <= 90) resolveBoundedPending(job.ctx.minDate, job.ctx.maxDate)
 } else {
  const next = await fetchWindow(STRIP_PAGE_DAYS, undefined, force)
  if (current !== requestId || job !== boundedJob || !props.active || !sheetVisible || job.scope !== getAgentStorageScope()) return
  bounds.value = { min: next.days?.[0]?.date || '', max: next.days?.at(-1)?.date || '' }
  mergeReport(next)
  if (bounds.value.min) { strip.value = padStripDays(strip.value, bounds.value.min, bounds.value.max); resolveBoundedPending(bounds.value.min, bounds.value.max) }
 }
 const loaded = [...strip.value].reverse().find(d => !d.pending && !d.failed && d.usage != null)
 selected.value = loaded?.date || bounds.value?.max || ''
 nextTick(() => stripRef.value?.centerOn(selected.value))
}
function boundedChunkEnd(date) {
 const diff = Math.round((Date.parse(bounds.value.max) - Date.parse(date)) / 864e5)
 return shiftDate(bounds.value.max, -90 * Math.floor(diff / 90))
}
function boundedChunkFrom(end) {
 const start = shiftDate(end, -89)
 return start < bounds.value.min ? bounds.value.min : start
}
function resolveBoundedPending(from, to) {
 strip.value = strip.value.map(d => d.pending && d.date >= from && d.date <= to ? { ...d, pending: false } : d)
}
function ensureBoundedDay(date) {
 const job = boundedJob
 if (!job?.ctx || !bounds.value || job.requested.has(date)) return
 if (!strip.value.find(d => d.date === date)?.pending) return
 const end = boundedChunkEnd(date)
 for (let x = boundedChunkFrom(end); x <= end; x = shiftDate(x, 1)) job.requested.add(x)
 job.queue.push(end)
 void pumpBounded(job)
}
async function pumpBounded(job) {
 if (job.pumping) return
 job.pumping = true
 const current = requestId
 while (job.queue.length && sheetVisible) {
  const end = job.queue.shift()
  const request = fixedEnergyWindow(job.ctx, 90, end)
  if (!request) continue
  try {
   const raw = await fetchMeterReport(request)
   const next = meterStatisticsDailyView(raw, job.ctx)
   if (current !== requestId || job !== boundedJob || !sheetVisible || job.scope !== getAgentStorageScope()) break
   mergeReport(next, false)
   resolveBoundedPending(boundedChunkFrom(end), end)
   if (!strip.value.some(day => day.failed)) error.value = ''
  } catch (cause) {
   if (current !== requestId || job !== boundedJob || !sheetVisible) break
   if (!isAgentStorageScope(job.scope) || [401, 403].includes(cause.status)) {
    boundedJob = null; clearBoundedData()
    error.value = failureMessage(cause, '电表统计暂不可用')
    break
   }
   const from = boundedChunkFrom(end)
   for (let x = from; x <= end; x = shiftDate(x, 1)) job.requested.delete(x)
   strip.value = markStripFailed(strip.value, from, end)
   error.value = failureMessage(cause, '电表统计暂不可用')
   if (['AGENT_READ_PREPARING', 'ACCOUNT_IDENTITY_PREPARING'].includes(cause.code)) { job.queue = []; break }
  }
 }
 job.pumping = false
}
function selectBounded(date) {
 if (!bounds.value || date < bounds.value.min || date > bounds.value.max) return
 selected.value = date
 ensureBoundedDay(date)
 nextTick(() => stripRef.value?.centerOn(date))
}
function resumeBounded() {
 if (!props.active || !sheetVisible || boundedJob) return
 if (!isAgentStorageScope(scope.value)) { clearBoundedData(); void init(); return }
 const scopeNow = getAgentStorageScope()
 if (report.value && bounds.value && scope.value === scopeNow) {
  boundedJob = { ctx: props.initialQuery ? fixedEnergyContext(props.initialQuery) : null, scope: scopeNow, queue: [], requested: new Set(), pumping: false }
  if (selected.value) ensureBoundedDay(selected.value)
  return
 }
 void init()
}
const scope = ref('')
// 为 [from,to] 内仍 pending 且未申请的日期排队补块：新→旧扫描，
// 遇到连续 pending 段的最新日即以它为 end 申请一整块 CHUNK_DAYS。
function needRange(from, to) {
 const edge = latestCompleteDay.value || today
 if (!edge || to < from) return
 if (to > edge) to = edge
 const byDate = new Map(strip.value.map(d => [d.date, d]))
 let d = to
 while (d >= from) {
  const day = byDate.get(d)
  if (day?.pending && !requested.has(d)) {
   for (let x = shiftDate(d, -(CHUNK_DAYS - 1)); x <= d; x = shiftDate(x, 1)) requested.add(x)
   queue.push(d)
   d = shiftDate(d, -CHUNK_DAYS)
   continue
  }
  d = shiftDate(d, -1)
 }
 pump()
}
async function pump() {
 const current = requestId
 if (pumping === current) return
 pumping = current
 while (queue.length) {
  const end = queue.shift()
  try {
   const next = await fetchWindow(CHUNK_DAYS, end)
   if (current !== requestId || scope.value !== getAgentStorageScope()) break
   mergeReport(next, false)
   if (!strip.value.some(day => day.failed)) error.value = ''
  } catch (cause) {
   if (current !== requestId) break
   if (!isAgentStorageScope(scope.value) || [401, 403].includes(cause.status)) { clearBoundedData(); error.value = failureMessage(cause, '逐日能耗暂不可用'); queue = []; break }
   // 该块标失败：柱变灰、选中该段日期时给重试；不阻塞后续块。
   for (let x = shiftDate(end, -(CHUNK_DAYS - 1)); x <= end; x = shiftDate(x, 1)) requested.delete(x)
   strip.value = markStripFailed(strip.value, shiftDate(end, -(CHUNK_DAYS - 1)), end)
   if (['AGENT_READ_PREPARING', 'ACCOUNT_IDENTITY_PREPARING'].includes(cause.code)) { error.value = failureMessage(cause, '逐日能耗暂不可用'); queue = []; break }
  }
 }
 if (pumping === current) pumping = 0
}
// 可视区间变化：左看 15 天预取；逼近条带左端 20 天时再向左铺 90 天占位（唯一的 prepend 路径）。
function onVisibleRange(r) {
 if (props.bounded || !r?.first || !strip.value.length) return
 const first = strip.value[0].date
 if (r.first < shiftDate(first, 20)) {
  const newFrom = shiftDate(first, -CHUNK_DAYS)
  strip.value = padStripDays(strip.value, newFrom, shiftDate(first, -1))
  const added = strip.value.findIndex(d => d.date === first)
  if (added > 0) stripRef.value?.didPrepend(added)
 }
 needRange(shiftDate(r.first, -15), r.last)
}
function retrySelected() {
 if (props.bounded) {
  if (!bounds.value || !selected.value || !boundedJob) return
  const end = boundedChunkEnd(selected.value), from = boundedChunkFrom(end)
  strip.value = strip.value.map(d => d.failed && d.date >= from && d.date <= end ? { ...d, failed: false, pending: true } : d)
  for (let x = from; x <= end; x = shiftDate(x, 1)) boundedJob.requested.delete(x)
  ensureBoundedDay(selected.value)
  return
 }
 const from = shiftDate(selected.value, -15), to = shiftDate(selected.value, 15)
 strip.value = strip.value.map(d => d.failed && d.date >= from && d.date <= to ? { ...d, failed: false, pending: true } : d)
 for (let date = from; date <= to; date = shiftDate(date, 1)) requested.delete(date)
 needRange(from, to)
}
function jumpToDate(date) {
 if (props.bounded) { selectBounded(date); return }
 if (date > today) return
 const first = strip.value[0]?.date
 if (first && date < first) {
  strip.value = padStripDays(strip.value, shiftDate(date, -15), shiftDate(first, -1))
  const added = strip.value.findIndex(d => d.date === first)
  if (added > 0) stripRef.value?.didPrepend(added)
 }
 selected.value = date
 needRange(shiftDate(date, -15), shiftDate(date, 15))
 nextTick(() => stripRef.value?.centerOn(date))
}
function onSelectDay(date) {
 if (props.bounded) { selectBounded(date); return }
 selected.value = date
 needRange(shiftDate(date, -15), shiftDate(date, 15))
}
function onCalendar(date) {
 calOpen.value = false
 jumpToDate(date)
}
watch([() => props.active, () => props.initialQuery], ([active]) => {
 if (!props.bounded) { if (active && sheetVisible) void init(); else { ++requestId; queue = []; loading.value = false }; return }
 if (active && sheetVisible) { void init(); return }
 requestId++; boundedJob = null; loading.value = false
 if (active) clearBoundedData()
}, { immediate: true })
onHide(() => { sheetVisible = false; requestId++; boundedJob = null; queue = []; loading.value = false })
onShow(() => { sheetVisible = true; if (props.bounded) resumeBounded(); else if (props.active) void init() })
onBeforeUnmount(() => { sheetVisible = false; requestId++; boundedJob = null; queue = [] })
watch(() => props.focusDate, date => {
 if (date && !props.bounded) selected.value = date
 if (date && props.active) jumpToDate(date)
})
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
button { margin:0; padding:0; background:transparent; line-height:1.3; }
button::after { border:0; }
.epanel { flex:1; min-height:0; display:flex; flex-direction:column; color:#35533f; font-size:12px; }
.ebody { flex:1; min-height:0; height:0; padding:6px 20px 24px; box-sizing:border-box; }
.estate-msg { display:flex; flex-direction:column; align-items:center; gap:10px; padding:30px 0; color:#839189; font-size:12px; }
.eretry { font-size:11px; color:#176b54; border:1px solid #dce4da; border-radius:999px; padding:7px 16px; background:#fcfdf8; }
.estale { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-top:8px; font-size:10.5px; color:#a27128; }
.calrow { display:flex; margin:8px 0 2px; }
.calchip { display:flex; align-items:center; gap:6px; height:30px; padding:0 11px; border-radius:15px; background:linear-gradient(#fefffe,#eef3ef); color:#37513f; font-size:11.5px; font-weight:650; box-shadow:inset 0 0 0 .5px rgba(26,55,43,.16),inset 0 1px 0 #fff,0 4px 12px rgba(28,57,42,.16); }
.calchip:active { transform:scale(.95); }
.ecal { margin:8px -8px 4px; }
.esec { display:flex; align-items:baseline; justify-content:space-between; font-size:10px; letter-spacing:2px; color:#94a08b; padding-bottom:8px; border-bottom:1px solid #e0e8db; margin-top:24px; }
.esec > text:last-child { letter-spacing:0; font-size:9px; }
.ehero { margin-top:14px; }
.elabel { display:block; font-size:10px; letter-spacing:2px; color:#94a08b; }
.enum { display:block; font-family:Georgia,"Songti SC",serif; font-size:40px; color:#2e4a38; letter-spacing:-.5px; margin-top:2px; }
.enum .u { font-size:13px; color:#6b8069; }
.edelta { display:block; font-size:10.5px; color:#8fa08c; margin-top:6px; }
.edelta .b { color:#176b54; font-weight:600; }
.edelta.warn { color:#a27128; }
.edelta.muted { color:#a0ab95; }
.zone-row { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid #ece8d9; font-size:12px; }
.zn { width:56px; flex-shrink:0; color:#3c4a3e; }
.ztrack { flex:1; height:3px; border-radius:2px; background:#e9efe4; }
.zfill { display:block; height:3px; border-radius:2px; }
.zv { flex-shrink:0; font-size:10.5px; color:#97917e; font-variant-numeric:tabular-nums; }
.sec-empty { display:block; padding:14px 0; font-size:11px; color:#a0ab95; }
.mrow { display:flex; align-items:center; gap:10px; width:100%; padding:10px 0; border-bottom:1px solid #ece8d9; font-size:12px; }
.mrow:last-of-type { border-bottom:0; }
.mrow-copy { flex:1; min-width:0; }
.mrow-name { display:block; color:#3c4a3e; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mrow-loc { display:block; font-size:10px; color:#8fa08c; margin-top:2px; }
.mrow-v { flex-shrink:0; font-variant-numeric:tabular-nums; color:#345640; font-size:11.5px; }
.mrow-share { font-style:normal; font-size:10px; color:#a0ab95; margin-left:6px; }
.efoot { display:block; font-size:9.5px; color:#a0ab95; line-height:1.8; margin-top:16px; }
/* 所选日补块中：数值/构成/明细原位骨架；失败给重试（同 EnergySkeleton 的呼吸）。 */
.efail-row { display:flex; align-items:center; gap:10px; margin-top:8px; font-size:10.5px; color:#a27128; }
.sk-num,.sk-delta,.sk-zn,.sk-fill,.sk-name,.sk-loc,.sk-v { background:#e2eadf; border-radius:4px; animation:sk-pulse 1.4s ease-in-out infinite; }
.sk-num { display:block; width:150px; height:38px; margin-top:4px; border-radius:8px; }
.sk-delta { display:block; width:220px; max-width:80%; height:10px; margin-top:10px; }
.sk-zn { width:56px; height:12px; flex-shrink:0; }
.sk-fill { background:#e2eadf; }
.sk-name { display:block; width:62%; height:12px; }
.sk-loc { display:block; width:38%; height:9px; margin-top:6px; }
.sk-v { width:64px; height:12px; flex-shrink:0; }
@keyframes sk-pulse { 0%,100% { opacity:.45 } 50% { opacity:.9 } }
@media(prefers-reduced-motion:reduce){ .calchip:active{transform:none} .sk-num,.sk-delta,.sk-zn,.sk-fill,.sk-name,.sk-loc,.sk-v{animation:none;opacity:.6} }
</style>
