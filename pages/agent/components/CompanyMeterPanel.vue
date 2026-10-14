<template>
 <view class="mpanel">
  <template v-if="pane === 'report'">
   <view class="ctl">
    <view class="seg">
     <button v-for="p in presets" :key="p.key" :class="{ on: selection.preset === p.key }" :aria-pressed="selection.preset === p.key" hover-class="pressed" @tap="setPreset(p.key)">{{ p.label }}</button>
    </view>
   </view>
   <view class="ctl">
    <view class="seg">
     <button v-for="k in kinds" :key="k.key" :class="{ on: selection.kind === k.key }" :aria-pressed="selection.kind === k.key" hover-class="pressed" @tap="setKind(k.key)">{{ k.label }}</button>
    </view>
    <picker class="scope-pick" mode="selector" :range="scopeOptions" range-key="label" :value="pickerIndex" aria-label="计量范围" @change="setScopeIndex($event.detail.value)">
     <view class="scope-btn"><text class="scope-label">{{ currentScopeLabel }}</text><uni-icons type="bottom" size="11" color="#7b8f71" /></view>
    </picker>
   </view>
   <view v-if="selection.preset === 'day'" class="ctl">
    <picker mode="date" :value="selection.date" :end="today" aria-label="统计日期" @change="setDay($event.detail.value)">
     <view class="date-btn"><text>{{ selection.date }}</text><uni-icons type="bottom" size="11" color="#7b8f71" /></view>
    </picker>
   </view>
   <view v-else-if="selection.preset === 'custom'" class="ctl">
    <picker mode="date" :value="selection.fromDate" :end="selection.toDate" aria-label="开始日期" @change="setFromDate($event.detail.value)">
     <view class="date-btn"><text>{{ selection.fromDate }}</text><uni-icons type="bottom" size="11" color="#7b8f71" /></view>
    </picker>
    <text class="date-sep">至</text>
    <picker mode="date" :value="selection.toDate" :start="selection.fromDate" :end="today" aria-label="结束日期" @change="setToDate($event.detail.value)">
     <view class="date-btn"><text>{{ selection.toDate }}</text><uni-icons type="bottom" size="11" color="#7b8f71" /></view>
    </picker>
   </view>

   <scroll-view scroll-y enhanced :show-scrollbar="false" class="panel-body">
    <MeterReportCard v-if="state.report" :report="state.report" embedded @evidence="openEvidence" />
    <view v-else-if="state.error" class="panel-empty">
     <text class="panel-error">{{ state.error }}</text>
     <button class="retry" hover-class="pressed" @tap="reload">重试</button>
    </view>
    <text v-else class="panel-empty">{{ state.loading ? '正在读取用电统计' : '暂无用电统计' }}</text>
    <text v-if="state.loading && state.report" class="panel-loading">正在更新</text>
   </scroll-view>
  </template>

  <MeterReportDetails v-else ref="detailsRef" class="details-host" :report="frozenReport" :active="active && pane === 'evidence'" @navigation="onDetailsNav" />
 </view>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { onHide, onUnload } from '@dcloudio/uni-app'
import MeterReportCard from './MeterReportCard.vue'
import MeterReportDetails from './MeterReportDetails.vue'
import { createMeterPanelLoader } from '../meter-panel-view.mjs'
import { shanghaiToday, shiftDate } from '../energy-daily-view.mjs'
import { getCompanyDevices, getCompanyMeterReport } from '@/apis/agent'
import { getAgentStorageScope, waitForAgentSession } from '@/utils/agent-session'
import { useUserStoreHook } from '@/store/modules/user'

const props = defineProps({ active: Boolean, focusDate: { type: String, default: '' } })
const emit = defineEmits(['navigation'])

const presets = [
 { key: '7d', label: '近7天' }, { key: '30d', label: '近30天' }, { key: 'month', label: '本月' },
 { key: 'custom', label: '自定义' }, { key: 'day', label: '单日' },
]
const kinds = [{ key: 'statistics', label: '统计' }, { key: 'comparison', label: '时间对比' }]
const today = ref(shanghaiToday())
const minusDays = (iso, days) => shiftDate(iso, -days)

const state = ref({ report: null, scopes: [{ key: 'all', label: '全部电表', scope: { level: 'all' } }], loading: false, error: '' })
const loader = createMeterPanelLoader({
 fetchReport: query => getCompanyMeterReport(query),
 fetchDevices: () => getCompanyDevices(),
 getScope: getAgentStorageScope,
 waitSession: () => waitForAgentSession(),
 onChange: next => { state.value = next },
})

const selection = reactive({ preset: '7d', kind: 'statistics', scope: { level: 'all' }, date: today.value, fromDate: minusDays(today.value, 6), toDate: today.value })
const pane = ref('report'), frozenReport = ref(null), detailsRef = ref(null), detailsNav = ref({ title: '', canBack: false })
const scopeOptions = computed(() => state.value.scopes?.length ? state.value.scopes : [{ key: 'all', label: '全部电表', scope: { level: 'all' } }])
const scopeIndex = computed(() => scopeOptions.value.findIndex(item => item.key === scopeKey(selection.scope)))
const pickerIndex = computed(() => Math.max(0, scopeIndex.value))
const currentScopeLabel = computed(() => scopeIndex.value >= 0 ? scopeOptions.value[scopeIndex.value].label : (selection.scope.floor || selection.scope.meterId || '计量范围不可用'))
const nav = computed(() => pane.value === 'evidence'
 ? { title: detailsNav.value.title || '计量依据', canBack: true, backLabel: detailsNav.value.canBack ? '返回计量依据' : '返回用电统计' }
 : { title: '能耗统计', canBack: false, backLabel: '' })
watch(nav, value => emit('navigation', value), { immediate: true })
watch(() => state.value.report, value => { pane.value = 'report'; if (!value) frozenReport.value = null })

const userStore = useUserStoreHook()
let knownScope = null
const storageScope = () => { try { return getAgentStorageScope() } catch { return null } }
watch(() => [userStore.authorized, userStore.getDistrict, userStore.getUserInfo], () => {
 const current = storageScope()
 if (current === knownScope) return
 knownScope = current
 loader.reset()
 selection.scope = { level: 'all' }
 frozenReport.value = null
 pane.value = 'report'
 if (props.active) reload()
})

function scopeKey(scope) {
 if (!scope || scope.level === 'all') return 'all'
 if (scope.level === 'floor') return 'floor:' + scope.floor
 if (scope.level === 'location') return 'location:' + scope.meterId
 return 'all'
}
function reload() { today.value = shanghaiToday(); loader.load({ ...selection, scope: { ...selection.scope } }) }
function setPreset(key) {
 selection.preset = key
 if (key === 'day' && !selection.date) selection.date = props.focusDate || today.value
 if (key === 'custom') {
  if (!selection.fromDate) selection.fromDate = minusDays(selection.toDate || today.value, 6)
  if (!selection.toDate) selection.toDate = today.value
 }
 reload()
}
function setKind(key) { selection.kind = key; reload() }
function setScopeIndex(index) { selection.scope = { ...scopeOptions.value[Number(index)]?.scope || { level: 'all' } }; reload() }
function setDay(value) { selection.date = value; reload() }
function setFromDate(value) { selection.fromDate = value; reload() }
function setToDate(value) { selection.toDate = value; reload() }
function openEvidence() { frozenReport.value = state.value.report; pane.value = 'evidence' }
function onDetailsNav(value) { detailsNav.value = value || { title: '', canBack: false } }
function back() {
 if (pane.value === 'evidence') {
  if (detailsRef.value?.back()) return true
  pane.value = 'report'
  return true
 }
 return false
}
defineExpose({ back })

watch(() => props.active, open => {
 if (open) {
  if (props.focusDate) { selection.preset = 'day'; selection.date = props.focusDate }
  reload()
 } else {
  loader.deactivate()
  pane.value = 'report'
 }
}, { immediate: true })
watch(() => props.focusDate, value => {
 if (props.active && value) { selection.preset = 'day'; selection.date = value; reload() }
})
onHide(() => loader.deactivate())
onUnload(() => loader.deactivate())
onBeforeUnmount(() => loader.deactivate())
</script>

<style scoped>
view, text, input { font-size: inherit; line-height: inherit; }
button { margin: 0; padding: 0; background: transparent; line-height: 1.4; }
button::after { border: 0; }
.mpanel { height: 0; flex: 1; min-height: 0; display: flex; flex-direction: column; color: #35533f; font-size: 12px; }
.details-host { height: 0; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.ctl { display: flex; align-items: center; gap: 8px; padding: 6px 16px 0; flex-wrap: wrap; }
.seg { display: flex; flex-wrap: wrap; gap: 2px; background: #eaf0e4; border-radius: 8px; padding: 3px; }
.seg button { font-size: 10px; min-width: 27px; min-height: 24px; padding: 0 8px; border-radius: 6px; color: #7b8f71; display: flex; align-items: center; justify-content: center; }
.seg button.on { color: #176b54; background: #fafcf6; font-weight: 600; }
.scope-pick { min-width: 0; }
.scope-btn { display: flex; align-items: center; gap: 4px; min-height: 30px; padding: 0 10px; border-radius: 8px; background: #eaf0e4; color: #46604e; }
.scope-label { font-size: 11px; max-width: 160px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.date-btn { display: flex; align-items: center; gap: 4px; min-height: 30px; padding: 0 10px; border-radius: 8px; background: #eaf0e4; font-size: 11px; color: #46604e; }
.date-sep { font-size: 11px; color: #80907f; }
.panel-body { height: 0; flex: 1; min-height: 0; padding: 4px 16px 20px; box-sizing: border-box; }
.panel-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 36px 0; font-size: 12px; color: #72846d; }
.panel-error { font-size: 12px; color: #a8763a; text-align: center; }
.panel-loading { display: block; margin-top: 6px; font-size: 10px; color: #96a491; }
.retry { min-height: 28px; padding: 0 14px; border-radius: 14px; background: #eaf0e4; color: #176b54; font-size: 11px; display: flex; align-items: center; }
.pressed { transform: scale(.97); }
@media (prefers-reduced-motion: reduce) { .pressed { transform: none; } }
</style>
