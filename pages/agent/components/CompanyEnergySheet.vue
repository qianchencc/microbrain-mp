<template>
 <view class="epanel">
  <scroll-view class="ebody" scroll-y enhanced :show-scrollbar="false">
   <view v-if="error" class="estate-msg"><text>{{ error }}</text><button class="eretry" @tap="init">重试</button></view>
   <template v-else>
    <view class="calrow">
     <button class="calchip" @tap="calOpen = !calOpen"><uni-icons type="calendar" size="13" color="#37513f" /><text>{{ dayLabel(selected, latestCompleteDay) }}</text><uni-icons :type="calOpen ? 'up' : 'down'" size="11" color="#71877a" /></button>
    </view>
    <RegionCalendar v-if="calOpen" class="ecal" :date="selected" :today="today" :max-date="latestCompleteDay || today" compact @select="onCalendar" />
    <view class="esec"><text>每日用电 · 点选查看当日</text><text v-if="basisNote">{{ basisNote }}</text></view>
    <CompanyEnergyStrip ref="stripRef" :days="strip" :selected="selected" @select="onSelectDay" @reach-left="loadOlder" />
    <view v-if="loading" class="estate-msg"><text>正在读取逐日能耗…</text></view>
    <view class="ehero">
     <text class="elabel">{{ dayLabel(selected, latestCompleteDay) }} 用电</text>
     <text class="enum">{{ selectedDay?.usage == null ? '—' : selectedDay.usage }}<text class="u">{{ unit ? ' ' + unit : '' }}</text></text>
     <text v-if="selectedDay?.usage == null" class="edelta warn">当日边界采样不齐或示数回退 · 不估算</text>
     <text v-else class="edelta">较前一日 <text class="b">{{ pctText(dod) }}</text>　较上周同日 <text class="b">{{ pctText(wow) }}</text></text>
     <text v-if="selectedDay" class="edelta muted">覆盖 {{ selectedDay.covered }}/{{ selectedDay.expected }} 台{{ selectedDay.complete ? '' : ' · 部分计量点缺采样' }}</text>
    </view>
    <view class="esec"><text>当日构成</text></view>
    <template v-if="composition.items.length">
     <view v-for="(item, i) in composition.items" :key="item.label" class="zone-row">
      <text class="zn">{{ item.label }}</text>
      <view class="ztrack"><view class="zfill" :style="{ width: (item.value / compositionMax * 100) + '%', background: PIE_COLORS[i % PIE_COLORS.length] }" /></view>
      <text class="zv">{{ item.value }}{{ unit ? ' ' + unit : '' }} · {{ Math.round(item.share * 100) }}%</text>
     </view>
    </template>
    <text v-else class="sec-empty">当日无可计算的构成</text>
    <view class="esec"><text>电表明细 · {{ dayLabel(selected, latestCompleteDay) }}</text><text>{{ meterList.length }} 台</text></view>
    <view v-for="meter in meterList" :key="meter.id" class="mrow">
     <view class="mrow-copy"><text class="mrow-name">{{ meter.name }}</text><text v-if="meter.location" class="mrow-loc">{{ meter.location }}</text></view>
     <text class="mrow-v">{{ meter.usage == null ? '—' : '用电 ' + meter.usage + (unit ? ' ' + unit : '') }}<text v-if="meter.usage != null && selectedDay?.usage" class="mrow-share">占 {{ Math.round(meter.usage / selectedDay.usage * 100) }}%</text><text v-else-if="meter.status !== 'comparable'" class="mrow-share">{{ statusText(meter.status) }}</text></text>
    </view>
    <text class="efoot">{{ footnote }}</text>
    <view class="eactions"><button class="eaction" @tap="$emit('open-meter-history')">查看原始采样</button></view>
   </template>
  </scroll-view>
 </view>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { getCompanyEnergyDaily } from '@/apis/agent'
import { getAgentStorageScope, waitForAgentSession } from '@/utils/agent-session'
import RegionCalendar from './RegionCalendar.vue'
import CompanyEnergyStrip from './CompanyEnergyStrip.vue'
import { shiftDate, shanghaiToday, dayLabel, unitOf, unitNote, floorComposition, meterRows, comparePct, statusText, mergeStripDays, STRIP_PAGE_DAYS, PIE_COLORS } from '../energy-daily-view.mjs'
import { fmtDateTime } from '../observation-view.mjs'

const props = defineProps({ active: Boolean, focusDate: String })
defineEmits(['refresh', 'open-meter-history'])
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
const unit = computed(() => unitOf(report.value))
const basisNote = computed(() => unitNote(report.value))
const selectedDay = computed(() => strip.value.find(d => d.date === selected.value) || null)
const meterList = computed(() => {
 const rows = meterRows({ meters: meterEntries.value }, selected.value)
 return [...rows].sort((a, b) => (b.usage ?? -1) - (a.usage ?? -1))
})
const meterEntries = computed(() => Object.values(meterDaily.value))
const composition = computed(() => floorComposition(meterList.value))
const compositionMax = computed(() => composition.value.items.reduce((m, i) => Math.max(m, i.value), 0) || 1)
const usageOf = date => strip.value.find(d => d.date === date)?.usage
const dod = computed(() => comparePct(selectedDay.value?.usage, usageOf(shiftDate(selected.value, -1))))
const wow = computed(() => comparePct(selectedDay.value?.usage, usageOf(shiftDate(selected.value, -7))))
const footnote = computed(() => {
 if (!report.value) return ''
 const parts = [`数据截至 ${fmtDateTime(latestSampleTime.value)}`]
 if (report.value.truncated) parts.push('读取窗口被截断')
 parts.push(report.value.basis?.cycle || '')
 if (report.value.aggregation?.note) parts.push(report.value.aggregation.note)
 return parts.filter(Boolean).join(' · ')
})
function pctText(v) { return v == null ? '—' : (v >= 0 ? '+' : '') + v + '%' }

let requestId = 0
function mergeReport(next) {
 report.value = next
 latestCompleteDay.value = next.latestCompleteDay || ''
 latestSampleTime.value = next.latestSampleTime || ''
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
async function loadOlder(firstDate) {
 if (!firstDate || loading.value) return
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
 if (strip.value.some(d => d.date === date)) return
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
function onSelectDay(date) { selected.value = date; stripRef.value?.centerOn(date) }
function onCalendar(date) {
 calOpen.value = false
 selected.value = date
 ensureDateLoaded(date).then(() => stripRef.value?.centerOn(date))
}
watch(() => props.active, value => {
 if (value) { scope.value = getAgentStorageScope(); init() }
}, { immediate: true })
watch(() => props.focusDate, date => {
 if (date && props.active) { selected.value = date; ensureDateLoaded(date).then(() => stripRef.value?.centerOn(date)) }
})
</script>
<style scoped>
view,text,input { font-size:inherit; line-height:inherit; }
button { margin:0; padding:0; background:transparent; line-height:1.3; }
button::after { border:0; }
.epanel { flex:1; min-height:0; display:flex; flex-direction:column; color:#35533f; font-size:12px; }
.ebody { flex:1; min-height:0; padding:6px 20px 24px; box-sizing:border-box; }
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
.eactions { display:flex; gap:8px; margin-top:14px; }
.eaction { flex:1; min-height:38px; display:flex; align-items:center; justify-content:center; border:1px solid #dce7d4; background:#eaf1e4; border-radius:12px; color:#4a7751; font-size:11px; font-weight:600; }
@media(prefers-reduced-motion:reduce){.calchip:active{transform:none}}
</style>
