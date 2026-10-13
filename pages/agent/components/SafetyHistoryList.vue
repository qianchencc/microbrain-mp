<template>
 <view class="history">
  <view class="filters">
   <view class="types"><button v-for="item in types" :key="item.type" :class="{ selected: type === item.type }" hover-class="pressed" @tap="chooseType(item.type)">{{ item.label }}</button></view>
   <view class="dates"><picker mode="date" :value="fromDate || today" :end="endDate" @change="chooseDate('from', $event.detail.value)"><view class="date-button">{{ fromDate || '不限开始日期' }} <uni-icons type="down" size="10" color="#7d9183" /></view></picker><text>至</text><picker mode="date" :value="endDate" :start="fromDate || undefined" :end="today" @change="chooseDate('end', $event.detail.value)"><view class="date-button">{{ endDate }} <uni-icons type="down" size="10" color="#7d9183" /></view></picker><button v-if="fromDate" class="reset" @tap="chooseDate('from', '')">重置</button></view>
   <text class="note">平台历史记录</text>
  </view>
  <scroll-view class="records" scroll-y enhanced :show-scrollbar="false" :scroll-top="scrollTop" @scroll="scrollTop = $event.detail.scrollTop">
   <view class="paper">
    <button v-for="record in records" :key="record.ledger + ':' + record.eventId + ':' + record.deviceId" class="record" hover-class="pressed" @tap="$emit('select', { record, observedAt })">
     <view class="record-copy"><text class="name">{{ record.deviceName }}</text><text class="time">{{ fmtDateTime(record.occurredAt) }}</text><text v-if="record.location && record.location !== record.deviceName" class="location">{{ record.location }}</text></view>
     <uni-icons type="right" size="12" color="#8b9e90" />
    </button>
    <text v-if="!records.length" class="empty">{{ loading ? '正在读取历史记录' : error ? '本次未取得记录' : cursor ? '这一批没有可核实的匹配记录' : '所选期间没有可核实的记录' }}</text>
    <text v-if="records.length" class="summary">已显示 {{ records.length }} 条 · {{ cursor ? '可继续读取' : '当前查询已读完' }}</text>
    <text v-if="excludedCount" class="summary">本次读取排除 {{ excludedCount }} 条不属于当前授权类别的记录</text>
    <text v-if="unknownCount" class="summary">另有 {{ unknownCount }} 条当前设备类别未知的记录，未计入本类</text>
   </view>
   <text v-if="error" class="error" aria-live="polite">{{ error }}</text>
   <button v-if="cursor || error" class="more" :disabled="loading" hover-class="pressed" @tap="load(Boolean(error && !records.length))">{{ loading ? '正在读取…' : error ? '重试读取' : '查看更多记录' }}</button>
   <text v-else-if="loading" class="loading">正在读取…</text>
   <text v-if="observedAt" class="read-time">读取于 {{ fmtDateTime(observedAt) }}</text>
  </scroll-view>
 </view>
</template>
<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { listSafetyHistory } from '@/apis/agent'
import { getAgentStorageScope } from '@/utils/agent-session'
import { fmtDateTime } from '../observation-view.mjs'

const props = defineProps({ active: Boolean })
defineEmits(['select'])
const types = [{ type: 'gas', label: '燃气' }, { type: 'smoke', label: '烟感' }, { type: 'water', label: '水浸' }]
const today = fmtDateTime(new Date().toISOString()).slice(0, 10)
const type = ref('gas'), fromDate = ref(''), endDate = ref(today), scrollTop = ref(0)
const records = ref([]), observedAt = ref(''), cursor = ref(null), loading = ref(false), error = ref(''), excludedCount = ref(0), unknownCount = ref(0)
let generation = 0, visible = true, scope = '', window = null
function invalidate() { generation += 1; loading.value = false }
function reset() { invalidate(); records.value = []; cursor.value = null; observedAt.value = ''; error.value = ''; excludedCount.value = 0; unknownCount.value = 0; scrollTop.value = 0; window = null }
async function load(first = true) {
 if (!props.active || !visible || loading.value) return
 const current = ++generation
 loading.value = true; error.value = ''
 try {
  const identity = getAgentStorageScope()
  if (identity !== scope) { records.value = []; cursor.value = null; window = null; scope = identity }
  const query = { type: type.value, limit: 20,
   from: first || !window ? fromDate.value ? `${fromDate.value}T00:00:00+08:00` : undefined : window.from,
   to: first || !window ? `${endDate.value}T23:59:59.999+08:00` : window.to,
   cursor: first ? undefined : cursor.value }
  const result = await listSafetyHistory(query)
  if (current !== generation || !props.active || !visible || identity !== getAgentStorageScope()) return
  const existing = first ? [] : records.value
  const seen = new Set(existing.map(record => record.ledger + ':' + record.eventId + ':' + record.deviceId))
  records.value = [...existing, ...(result.items || []).filter(record => !seen.has(record.ledger + ':' + record.eventId + ':' + record.deviceId))]
  cursor.value = result.nextCursor; observedAt.value = result.observedAt; window = result.window
  excludedCount.value = (first ? 0 : excludedCount.value) + (result.excludedCount || 0)
  unknownCount.value = (first ? 0 : unknownCount.value) + (result.unknownCount || 0)
 } catch (cause) {
  if (current !== generation || !props.active || !visible) return
  if (scope !== getAgentStorageScope() || cause.data?.code === 'UNAUTHORIZED') { records.value = []; cursor.value = null; observedAt.value = '' }
  if (cause.data?.code === 'INVALID_SAFETY_CURSOR') { records.value = []; cursor.value = null; window = null; observedAt.value = '' }
  error.value = cause.message || '安全历史暂不可用，请稍后重试'
 } finally { if (current === generation) loading.value = false }
}
function chooseType(next) { if (type.value === next) return; type.value = next; reset(); void load() }
function chooseDate(field, value) { if (field === 'from') fromDate.value = value; else endDate.value = value; reset(); void load() }
function resume() { if (props.active && (!observedAt.value || scope !== getAgentStorageScope())) { reset(); void load() } }
watch(() => props.active, active => { if (active) resume(); else invalidate() }, { immediate: true })
onHide(() => { visible = false; invalidate() })
onShow(() => { visible = true; resume() })
onBeforeUnmount(invalidate)
</script>
<style scoped>
view, text, input { font-size:inherit; line-height:inherit; }
.history { flex:1; min-height:0; height:0; display:flex; flex-direction:column; color:#274635; font-size:13px; }
button { margin:0; padding:0; background:transparent; line-height:1.4; } button::after { border:0; }
.filters { flex-shrink:0; padding:4px 20px 14px; border-bottom:1px solid #e5ece4; }
.types { display:flex; gap:6px; padding:3px; border-radius:12px; background:#eef3eb; }
.types button { flex:1; min-height:38px; display:flex; align-items:center; justify-content:center; color:#809181; border-radius:9px; font-size:13px; }
.types .selected { background:#fcfdf9; color:#21664c; font-weight:600; box-shadow:0 1px 4px #264b3320; }
.dates { display:flex; align-items:center; gap:8px; margin-top:10px; font-size:11px; color:#809383; flex-wrap:wrap; }
.date-button { display:flex; align-items:center; gap:5px; min-height:32px; padding:0 8px; border:1px solid #e0e7dc; border-radius:7px; color:#5c7664; }.reset { color:#256d50; min-height:32px; padding:0 6px; font-size:11px; display:flex; align-items:center; justify-content:center; }
.note { display:block; margin-top:8px; color:#899a8b; font-size:11px; }
.records { flex:1; height:0; min-height:0; }.paper { margin:14px 20px 0; padding:0 14px; background:linear-gradient(145deg,#fcfdf8,#f4f8f0); border:1px solid #dce5d8; border-radius:14px; box-shadow:inset 0 1px 0 #fff,0 4px 12px -10px #234b3350; }
.record { display:flex; align-items:center; gap:10px; width:100%; min-height:75px; padding:13px 0; border-bottom:1px solid #e1e8de; text-align:left; }.record-copy { flex:1; min-width:0; }.name { display:block; color:#304d3b; font-size:13px; font-weight:600; line-height:1.5; overflow-wrap:anywhere; }.time,.location { display:block; margin-top:4px; color:#899889; font-size:11px; }
.summary { display:block; padding:10px 0; color:#899b8b; font-size:11px; line-height:1.5; }.empty { display:block; padding:35px 0; text-align:center; color:#94a193; }.more { margin:14px 20px; min-height:40px; width:calc(100% - 40px); display:flex; align-items:center; justify-content:center; color:#2f7355; background:#eef4e9; border-radius:10px; font-size:12px; }.error { display:block; margin:12px 20px; color:#a17c3a; font-size:12px; }.loading,.read-time { display:block; margin:12px 20px 18px; text-align:center; color:#91a08e; font-size:11px; }.pressed { opacity:.7; }
</style>
