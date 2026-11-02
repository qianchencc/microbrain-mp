<template>
 <view class="history">
  <view class="filters"><text>历史期间</text><picker mode="date" :value="fromDate" :end="toDate" @change="changeDate('from', $event.detail.value)"><view>{{ fromDate }} <uni-icons type="down" size="10" color="var(--agent-text-muted)" /></view></picker><text>至</text><picker mode="date" :value="toDate" :start="fromDate" :end="today" @change="changeDate('to', $event.detail.value)"><view>{{ toDate }} <uni-icons type="down" size="10" color="var(--agent-text-muted)" /></view></picker></view>
  <scroll-view class="body" scroll-y enhanced :show-scrollbar="false">
   <view class="paper"><EnvironmentTrend v-if="report" :report="report" /><text v-else class="empty">{{ loading ? '正在读取站点历史' : '本次未取得历史采样' }}</text></view>
   <view v-if="error" class="error"><text>{{ error }}</text><button @tap="load(report ? failedPage : 0)">重试</button></view>
   <button v-if="report?.nextPage !== null && report" class="more" :disabled="loading" @tap="loadMore">{{ loading ? '正在读取…' : '继续读取下一批采样' }}</button>
   <text v-if="report && !report.samples.length" class="empty">所选期间没有采样，请选择其他日期；实时读数另见概览。</text>
   <button v-if="report" class="question" hover-class="pressed" @tap="$emit('question', report.window)"><uni-icons type="chatbubble" size="16" color="#fff" /> 向公司 Agent 询问此期间</button>
  </scroll-view>
 </view>
</template>
<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { getEnvironmentHistory } from '@/apis/agent/observations'
import { getAgentStorageScope, isAgentStorageScope } from '@/utils/agent-session'
import EnvironmentTrend from './EnvironmentTrend.vue'
import { fmtDateTime } from '../../lib/observations.mjs'
const props = defineProps({ active: Boolean })
defineEmits(['question'])
const today = fmtDateTime(new Date().toISOString()).slice(0, 10)
const fromDate = ref(today), toDate = ref(today), report = ref(null), loading = ref(false), error = ref(''), failedPage = ref(0)
let generation = 0, scope = '', visible = true
function invalidate() { generation += 1; loading.value = false }
async function load(page = 0) {
 if (!props.active || !visible || loading.value) return
 const current = ++generation; loading.value = true; error.value = ''
 try {
  const identity = getAgentStorageScope(); scope = identity
  const value = await getEnvironmentHistory({ from: page ? report.value.window.from : fromDate.value + 'T00:00:00+08:00', to: page ? report.value.window.to : toDate.value + 'T23:59:59.999+08:00', page }, { isActive: () => current === generation && props.active && visible })
  if (current !== generation || !props.active || !visible || identity !== getAgentStorageScope()) return
  if (page && report.value) {
   const identity = item => item.id + ':' + item.recordedAt + ':' + (item.deviceCode || 'site')
   const seen = new Set(report.value.samples.map(identity))
   value.samples = [...report.value.samples, ...value.samples.filter(item => !seen.has(identity(item)))].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
   value.metrics = value.metrics.map(item => {
    const samples = value.samples.filter(sample => Number.isFinite(sample.values[item.key]))
    const peak = samples.reduce((best, sample) => !best || sample.values[item.key] > best.values[item.key] ? sample : best, null)
    return { ...item, count: samples.length, min: samples.length ? Math.min(...samples.map(sample => sample.values[item.key])) : null, peak: peak ? { value: peak.values[item.key], at: peak.recordedAt } : null }
   })
   value.coverage = { complete: value.nextPage === null, readSamples: value.samples.length, from: value.samples[0]?.recordedAt || null, to: value.samples.at(-1)?.recordedAt || null }
  }
  report.value = value
 } catch (cause) {
  if (current !== generation || !props.active || !visible) return
  failedPage.value = page
  if ([401, 403].includes(cause.status) || ['UNAUTHORIZED', 'FORBIDDEN'].includes(cause.data?.code) || !isAgentStorageScope(scope)) report.value = null
  error.value = cause.message || '环境历史暂不可用'
 } finally { if (current === generation) loading.value = false }
}
function loadMore() { void load(report.value.nextPage) }
function changeDate(field, value) { if (field === 'from') fromDate.value = value; else toDate.value = value; invalidate(); report.value = null; void load() }
function resume() { if (props.active && (!report.value || scope !== getAgentStorageScope())) { invalidate(); report.value = null; void load() } }
watch(() => props.active, active => { if (active) resume(); else invalidate() }, { immediate: true })
onHide(() => { visible = false; invalidate() });onShow(() => { visible = true; resume() });onBeforeUnmount(invalidate)
</script>
<style scoped lang="scss">
@import "../../styles/tokens";
view, text, input { font-size:inherit;line-height:inherit; }
.history { flex:1;min-height:0;height:0;display:flex;flex-direction:column;color:var(--agent-text-secondary);font-size:$agent-font-size-compact; }.filters { display:flex;align-items:center;gap:$agent-space-small;flex-wrap:wrap;padding:4px 20px 16px;font-size:11px;color:var(--agent-text-muted); }.filters picker view { display:flex;align-items:center;gap:4px;min-height:34px;border:1px solid var(--agent-line);border-radius:8px;padding:0 8px;color:var(--agent-text-secondary); }.body { flex:1;min-height:0;height:0; }
.paper { margin:0 20px;padding:18px 15px;background:linear-gradient(145deg,var(--agent-surface),var(--agent-surface-page));border:1px solid var(--agent-line);border-radius:14px;box-shadow:inset 0 1px 0 #fff,0 4px 12px -10px rgba(var(--agent-shadow-rgb),.31); }
button { margin:0;padding:0;background:transparent;line-height:1.3; }button::after { border:0; }.empty { display:block;padding:20px;text-align:center;color:var(--agent-text-muted);font-size:11px; }.error { display:flex;justify-content:space-between;margin:15px 20px;color:var(--agent-warning-deep); }.error button { font-size:$agent-font-size-compact;color:var(--agent-accent-deep); }.question,.more { margin:18px 20px;min-height:44px;display:flex;align-items:center;justify-content:center;gap:$agent-space-small;border-radius:13px;font-size:$agent-font-size-compact; }.question { color:white;background:linear-gradient(155deg,var(--agent-accent),var(--agent-accent-deep));box-shadow:inset 0 1px 0 rgba(255,255,255,.31),0 4px 10px -6px rgba(var(--agent-ink-rgb),.5); }.more { color:var(--agent-accent-deep);background:var(--agent-tint); }.pressed { opacity:.75; }
</style>
