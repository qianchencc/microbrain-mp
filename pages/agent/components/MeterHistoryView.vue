<template>
 <view class="history">
  <view class="filters"><picker :range="meters" range-key="name" :value="meterIndex" @change="chooseMeter($event.detail.value)"><view class="meter">{{ selectedMeter?.name || (loading ? '正在读取计量点' : '请选择计量点') }} <uni-icons type="down" size="12" color="#6d8b73" /></view></picker><view class="dates"><picker mode="date" :value="fromDate" :end="toDate" @change="chooseDate('from', $event.detail.value)"><view>{{ fromDate }} <uni-icons type="down" size="10" color="#80947d" /></view></picker><text>至</text><picker mode="date" :value="toDate" :start="fromDate" :end="today" @change="chooseDate('to', $event.detail.value)"><view>{{ toDate }} <uni-icons type="down" size="10" color="#80947d" /></view></picker></view></view>
  <scroll-view class="body" scroll-y enhanced :show-scrollbar="false">
   <view class="paper"><MeterHistoryReport v-if="report" :report="report" /><text v-else class="empty">{{ loading ? '正在读取原始示数' : meters.length ? '请选择期间读取' : '当前没有可用计量点' }}</text></view>
   <view v-if="error" class="error"><text>{{ error }}</text><button @tap="load(report ? failedPage : 0)">重试</button></view>
   <button v-if="report?.latestReadTime && !report.samples.length" class="more" hover-class="pressed" @tap="showLatestDay">查看最近采样日 {{ fmtDateTime(report.latestReadTime).slice(0, 10) }}</button>
   <button v-if="report?.nextPage != null" class="more" :disabled="loading" @tap="load(report.nextPage)">{{ loading ? '正在读取…' : '查看更多采样' }}</button>
   <button v-if="report" class="question" hover-class="pressed" @tap="$emit('question', { ...report.window, meter: report.meter })"><uni-icons type="chatbubble" size="16" color="#fff" /> 向公司 Agent 询问此计量点</button>
  </scroll-view>
 </view>
</template>
<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { getEnergyHistory } from '@/apis/agent'
import { getAgentStorageScope } from '@/utils/agent-session'
import { fmtShanghaiDateTime as fmtDateTime } from '../observation-view.mjs'
import MeterHistoryReport from './MeterHistoryReport.vue'
const props = defineProps({ active: Boolean })
defineEmits(['question'])
const today = fmtDateTime(new Date().toISOString()).slice(0, 10)
const meters = ref([]), meterId = ref(''), fromDate = ref(today), toDate = ref(today), report = ref(null), loading = ref(false), error = ref(''), failedPage = ref(0)
const meterIndex = computed(() => Math.max(0, meters.value.findIndex(item => item.id === meterId.value)))
const selectedMeter = computed(() => meters.value.find(item => item.id === meterId.value))
let generation = 0, visible = true, scope = ''
function invalidate() { generation += 1; loading.value = false }
async function load(page = 0) {
 if (!props.active || !visible || loading.value) return
 const current = ++generation; loading.value = true; error.value = ''
 try {
  const identity = getAgentStorageScope(); scope = identity
  if (!meters.value.length) {
   const directory = await getEnergyHistory()
   if (current !== generation || !props.active || !visible || identity !== getAgentStorageScope()) return
   meters.value = directory.meters || []; meterId.value = meters.value[0]?.id || ''
  }
  if (!meterId.value) return
  const value = await getEnergyHistory({ equipmentId: meterId.value, from: fromDate.value + 'T00:00:00+08:00', to: toDate.value + 'T23:59:59.999+08:00', page })
  if (current !== generation || !props.active || !visible || identity !== getAgentStorageScope()) return
  if (page && report.value) {
   const seen = new Set(report.value.samples.map(item => item.id + ':' + item.readTime))
   value.samples = [...report.value.samples, ...value.samples.filter(item => !seen.has(item.id + ':' + item.readTime))]
   value.coverage = { complete: value.nextPage === null, returned: value.samples.length }
  }
  report.value = value
 } catch (cause) {
  if (current !== generation || !props.active || !visible) return
  failedPage.value = page
  if (['UNAUTHORIZED', 'FORBIDDEN'].includes(cause.data?.code) || scope !== getAgentStorageScope()) { meters.value = []; meterId.value = ''; report.value = null }
  error.value = cause.message || '计量历史暂不可用'
 } finally { if (current === generation) loading.value = false }
}
function resetWindow() { invalidate(); report.value = null; void load() }
function chooseMeter(index) { meterId.value = meters.value[Number(index)]?.id || ''; resetWindow() }
function chooseDate(field, value) { if (field === 'from') fromDate.value = value; else toDate.value = value; resetWindow() }
function showLatestDay() { const date = fmtDateTime(report.value.latestReadTime).slice(0, 10); fromDate.value = date; toDate.value = date; resetWindow() }
function resume() { if (props.active && (!report.value || scope !== getAgentStorageScope())) { invalidate(); if (scope !== getAgentStorageScope()) { meters.value = []; meterId.value = ''; report.value = null }; void load() } }
watch(() => props.active, active => { if (active) resume(); else invalidate() }, { immediate: true })
onHide(() => { visible = false; invalidate() });onShow(() => { visible = true; resume() });onBeforeUnmount(invalidate)
</script>
<style scoped>
view, text, input { font-size:inherit;line-height:inherit; }
.history { flex:1;min-height:0;height:0;display:flex;flex-direction:column;font-size:12px;color:#466b50; }.filters { padding:4px 20px 16px; }.meter { display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border:1px solid #dde6d8;border-radius:9px;background:#f5f9f0;font-size:13px; }.dates { display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:#8c9c88; }.dates picker view { display:flex;align-items:center;gap:4px;min-height:34px;border:1px solid #dce6d7;border-radius:8px;padding:0 8px;color:#5f7c65; }.body { flex:1;min-height:0;height:0; }.paper { margin:0 20px;padding:18px 15px;background:linear-gradient(145deg,#fcfdf8,#f4f8f0);border:1px solid #dce5d8;border-radius:14px;box-shadow:inset 0 1px 0 #fff,0 4px 12px -10px #234b3350; }
button { margin:0;padding:0;background:transparent;line-height:1.3; }button::after { border:0; }.empty { display:block;padding:20px;text-align:center;color:#91a08c;font-size:11px; }.error { display:flex;justify-content:space-between;margin:15px 20px;color:#a17c38; }.error button { font-size:12px;color:#287652; }.question,.more { margin:18px 20px;min-height:44px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:13px;font-size:12px; }.question { color:white;background:linear-gradient(155deg,#2c8367,#16583f);box-shadow:inset 0 1px 0 #91b3a050,0 4px 10px -6px #1b573d80; }.more { color:#2c7052;background:#edf4e8; }.pressed { opacity:.75; }
</style>
