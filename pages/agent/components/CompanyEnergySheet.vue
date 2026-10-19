<template>
 <view class="epanel">
  <scroll-view class="ebody" scroll-y enhanced :show-scrollbar="false">
   <view v-if="error" class="estate-msg"><text>{{ error }}</text><button class="eretry" @tap="init">重试</button></view>
   <template v-else>
    <view class="calrow">
     <button v-if="!bounded || selected" class="calchip" @tap="calOpen = !calOpen"><uni-icons type="calendar" size="13" color="#37513f" /><text>{{ labelOf(selected) }}</text><uni-icons :type="calOpen ? 'up' : 'down'" size="11" color="#71877a" /></button>
    </view>
    <RegionCalendar v-if="calOpen && selected && (!bounded || bounds)" class="ecal" :date="selected" :today="today" :min-date="bounded ? bounds?.min : undefined" :max-date="bounded ? (bounds?.max || today) : (latestCompleteDay || today)" compact @select="onCalendar" />
    <view class="esec"><text>每日用电</text><text v-if="basisNote">{{ basisNote }}</text></view>
    <CompanyEnergyStrip ref="stripRef" :days="strip" :selected="selected" @select="onSelectDay" @reach-left="loadOlder" />
    <view v-if="loading" class="estate-msg"><text>正在读取逐日能耗…</text></view>
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
      <text v-if="selectedDay && todayInBounds && (selectedDay.elapsedUsage != null || todayUsage != null)" class="edelta">当日同时段 {{ fmtUsage(selectedDay.elapsedUsage, unit) }} · 今日至今 {{ fmtUsage(todayUsage, unit) }}<text v-if="vsToday != null">　今日较当日同时段 <text class="b">{{ pctText(vsToday) }}</text></text></text>
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
import { getCompanyEnergyDaily, getCompanyMeterReport } from '@/apis/agent'
import { getAgentStorageScope, waitForAgentSession } from '@/utils/agent-session'
import RegionCalendar from './RegionCalendar.vue'
import CompanyEnergyStrip from './CompanyEnergyStrip.vue'
import { shiftDate, shanghaiToday, dayLabel, unitOf, unitNote, floorComposition, meterRows, comparePct, statusText, mergeStripDays, padStripDays, markStripFailed, STRIP_PAGE_DAYS, PIE_COLORS, fmtUsage, fixedEnergyContext, fixedEnergyWindow, meterStatisticsDailyView } from '../energy-daily-view.mjs'
import { fmtDateTime } from '../observation-view.mjs'

const props = defineProps({ active: Boolean, focusDate: String, bounded: Boolean, initialQuery: Object })
defineEmits(['refresh'])
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
let boundedJob = null
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
const dod = computed(() => comparePct(selectedUsage.value, usageOf(shiftDate(selected.value, -1))))
const wow = computed(() => comparePct(selectedUsage.value, usageOf(shiftDate(selected.value, -7))))
const labelOf = date => props.bounded ? (date ? `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日` : '') : dayLabel(date, latestCompleteDay.value)
const todayInBounds = computed(() => !props.bounded || Boolean(bounds.value && today >= bounds.value.min && today <= bounds.value.max))
const boundedEmpty = computed(() => Boolean(props.bounded && report.value && bounds.value && !loading.value && !strip.value.some(d => d.pending || d.usage != null)))
// 与今日对比的公平口径：所选日只取与“今日至今”相同的 elapsed 窗口（08:00 → 当前时刻），
// 不拿完整日去比一个未过完的今天；任一侧无实测样本即显示 —。
const todayUsage = computed(() => report.value?.comparison?.currentDay?.usage ?? null)
const vsToday = computed(() => comparePct(todayUsage.value, selectedDay.value?.elapsedUsage))
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
  parts.push(report.value.basis?.cycle || '')
  return parts.filter(Boolean).join(' · ')
 }
 const parts = [`数据截至 ${fmtDateTime(latestSampleTime.value)}`]
 if (report.value.truncated) parts.push('读取窗口被截断')
 parts.push(report.value.basis?.cycle || '')
 if (report.value.aggregation?.note) parts.push(report.value.aggregation.note)
 return parts.filter(Boolean).join(' · ')
})
function pctText(v) { return v == null ? '—' : (v >= 0 ? '+' : '') + v + '%' }

let requestId = 0
function mergeReport(next, replace = true) {
 if (replace || !report.value) {
  report.value = next
  latestCompleteDay.value = next.latestCompleteDay || ''
  latestSampleTime.value = next.latestSampleTime || ''
 } else {
  const meters = (report.value.meters || []).map(m => {
   const extra = (next.meters || []).find(x => x.id === m.id)
   return extra ? { ...m, daily: { ...(extra.daily || {}), ...(m.daily || {}) } } : m
  })
  report.value = { ...report.value, meters }
 }
 strip.value = mergeStripDays(strip.value, next.days || [])
 const md = { ...meterDaily.value }
 ;(next.meters || []).forEach(meter => {
  md[meter.id] = { id: meter.id, name: meter.name, location: meter.location, daily: { ...(md[meter.id]?.daily || {}), ...(meter.daily || {}) } }
 })
 meterDaily.value = md
}
async function fetchWindow(end) {
 await waitForAgentSession()
 return getCompanyEnergyDaily({ days: STRIP_PAGE_DAYS, ...(end ? { end } : {}) })
}
async function init() {
 const current = ++requestId
 const scope = getAgentStorageScope()
 loading.value = true; error.value = ''
 try {
  if (props.bounded) { await initBounded(current); return }
  const next = await fetchWindow()
  if (current !== requestId || !props.active || scope !== getAgentStorageScope()) return
  strip.value = []; meterDaily.value = {}
  mergeReport(next)
  selected.value = props.focusDate || latestCompleteDay.value || next.days?.at(-1)?.date || today
  if (props.focusDate) await ensureDateLoaded(props.focusDate)
 } catch (cause) {
  if (current === requestId) error.value = cause?.data?.message || cause.message || '逐日能耗暂不可用'
 } finally { if (current === requestId) loading.value = false }
}
function clearBoundedData() {
 report.value = null; strip.value = []; meterDaily.value = {}; selected.value = ''; bounds.value = null
}
async function initBounded(current) {
 clearBoundedData()
 const job = { ctx: null, scope: '', queue: [], requested: new Set(), pumping: false }
 boundedJob = job
 await waitForAgentSession()
 if (current !== requestId || job !== boundedJob || !sheetVisible) return
 job.scope = getAgentStorageScope()
 scope.value = job.scope
 if (props.initialQuery) {
  job.ctx = fixedEnergyContext(props.initialQuery)
  if (!job.ctx) { error.value = '该计量对象的统计范围无效'; return }
  bounds.value = { min: job.ctx.minDate, max: job.ctx.maxDate }
  strip.value = padStripDays([], job.ctx.minDate, job.ctx.maxDate)
  const span = Math.round((Date.parse(job.ctx.maxDate) - Date.parse(job.ctx.minDate)) / 864e5) + 1
  const request = fixedEnergyWindow(job.ctx, span <= 90 ? span : STRIP_PAGE_DAYS)
  const next = meterStatisticsDailyView(await getCompanyMeterReport(request), job.ctx)
  if (current !== requestId || job !== boundedJob || !props.active || !sheetVisible || job.scope !== getAgentStorageScope()) return
  mergeReport(next)
  if (span <= 90) resolveBoundedPending(job.ctx.minDate, job.ctx.maxDate)
 } else {
  const next = await getCompanyEnergyDaily({ days: STRIP_PAGE_DAYS })
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
   const next = meterStatisticsDailyView(await getCompanyMeterReport(request), job.ctx)
   if (current !== requestId || job !== boundedJob || !sheetVisible || job.scope !== getAgentStorageScope()) break
   mergeReport(next, false)
   resolveBoundedPending(boundedChunkFrom(end), end)
  } catch (cause) {
   if (current !== requestId || job !== boundedJob || !sheetVisible || job.scope !== getAgentStorageScope()) break
   if (cause?.data) {
    boundedJob = null
    clearBoundedData()
    error.value = cause.data?.message || cause.message || '电表统计暂不可用'
    break
   }
   const from = boundedChunkFrom(end)
   for (let x = from; x <= end; x = shiftDate(x, 1)) job.requested.delete(x)
   strip.value = markStripFailed(strip.value, from, end)
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
 const scopeNow = getAgentStorageScope()
 if (report.value && bounds.value && scope.value === scopeNow) {
  boundedJob = { ctx: props.initialQuery ? fixedEnergyContext(props.initialQuery) : null, scope: scopeNow, queue: [], requested: new Set(), pumping: false }
  if (selected.value) ensureBoundedDay(selected.value)
  return
 }
 void init()
}
function retrySelected() {
 if (!props.bounded || !bounds.value || !selected.value || !boundedJob) return
 const end = boundedChunkEnd(selected.value), from = boundedChunkFrom(end)
 strip.value = strip.value.map(d => d.failed && d.date >= from && d.date <= end ? { ...d, failed: false, pending: true } : d)
 for (let x = from; x <= end; x = shiftDate(x, 1)) boundedJob.requested.delete(x)
 ensureBoundedDay(selected.value)
}
async function loadOlder(firstDate) {
 if (props.bounded || !firstDate || loading.value) return
 const current = ++requestId
 loading.value = true
 try {
  const next = await fetchWindow(shiftDate(firstDate, -1))
  if (current !== requestId || scope.value !== getAgentStorageScope()) return
  const before = strip.value.length
  mergeReport(next)
  const added = strip.value.length - before
  if (added) stripRef.value?.didPrepend(added)
 } catch { /* 旧的窗口读取失败不破坏当前视图 */ } finally { if (current === requestId) loading.value = false }
}
const scope = ref('')
async function ensureDateLoaded(date) {
 if (props.bounded || strip.value.some(d => d.date === date)) return
 const edge = latestCompleteDay.value || today
 const end = shiftDate(date, 15) > edge ? edge : shiftDate(date, 15)
 const current = ++requestId
 try {
  const next = await fetchWindow(end)
  if (current !== requestId) return
  const firstBefore = strip.value[0]?.date
  mergeReport(next)
  // 新窗口在现有条带左侧拼接时做位移补偿，随后由调用方 centerOn 选中日。
  if (firstBefore && strip.value[0]?.date < firstBefore) {
   const added = strip.value.findIndex(d => d.date === firstBefore)
   if (added > 0) stripRef.value?.didPrepend(added)
  }
 } catch { /* 日期窗口读取失败，条上保持缺省 */ }
}
function onSelectDay(date) {
 if (props.bounded) { selectBounded(date); return }
 selected.value = date; stripRef.value?.centerOn(date)
}
function onCalendar(date) {
 calOpen.value = false
 if (props.bounded) { selectBounded(date); return }
 selected.value = date
 ensureDateLoaded(date).then(() => stripRef.value?.centerOn(date))
}
watch([() => props.active, () => props.initialQuery], ([active]) => {
 if (!props.bounded) { if (active) { scope.value = getAgentStorageScope(); init() } return }
 if (active && sheetVisible) { void init(); return }
 requestId++; boundedJob = null; loading.value = false
 if (active) clearBoundedData()
}, { immediate: true })
onHide(() => { if (props.bounded) { sheetVisible = false; requestId++; boundedJob = null; loading.value = false } })
onShow(() => { if (!props.bounded) return; sheetVisible = true; resumeBounded() })
onBeforeUnmount(() => { if (props.bounded) { requestId++; boundedJob = null } })
watch(() => props.focusDate, date => {
 if (!date || !props.active) return
 if (props.bounded) { selectBounded(date); return }
 selected.value = date; ensureDateLoaded(date).then(() => stripRef.value?.centerOn(date))
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
@media(prefers-reduced-motion:reduce){.calchip:active{transform:none} .sk-num,.sk-delta,.sk-zn,.sk-fill,.sk-name,.sk-loc,.sk-v{animation:none;opacity:.6}}
</style>
