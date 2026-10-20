<template>
 <view class="monthly">
  <view class="month-head"><text>{{ view.title }}</text><text v-if="view.cutoff" class="cutoff">{{ view.current.through ? '采样截至' : '统计截至' }} {{ view.cutoff }}</text></view>
  <view v-if="view.current.pending" class="skeleton hero-skeleton" />
  <text v-else class="hero">{{ monthlyNumber(view.current.value) }}<text class="unit"> 度</text></text>
  <text class="window">{{ view.current.label }} · 全部授权电表合计</text>
  <text class="window">每月 1 日 08:00 起算 · 每日 08:00 / 20:00 更新</text>
  <text v-if="view.current.note && !view.current.pending" class="data-note">{{ view.current.note }}</text>
  <view class="comparisons">
   <view v-for="pair in view.pairs" :key="pair.key" class="compare" :class="pair.direction">
    <text class="title">{{ pair.title }} · {{ pair.label }}</text>
    <view v-if="pair.a.pending || pair.b.pending" class="skeleton pct-skeleton" />
    <text v-else class="pct">{{ pair.pct }}</text>
    <view class="bar-row">
     <view class="bar-values"><text>本月</text><text class="amount">{{ monthlyNumber(pair.a.value) }} 度</text></view>
     <view class="track" :class="{ missing: pair.a.value == null }"><view class="fill" :style="{ width: pair.aWidth + '%' }" /></view>
    </view>
    <view class="bar-row">
     <view class="bar-values"><text>{{ pair.label }}</text><text class="amount">{{ monthlyNumber(pair.b.value) }} 度</text></view>
     <view class="track base" :class="{ missing: pair.b.value == null }"><view class="fill" :style="{ width: pair.bWidth + '%' }" /></view>
    </view>
    <text class="summary">{{ pair.summary }}</text>
    <view class="periods"><text>本期 {{ pair.a.label }}</text><text>对照 {{ pair.b.label }}</text></view>
    <text v-if="pair.note" class="data-note">{{ pair.note }}</text>
   </view>
  </view>
  <button v-if="hasError" class="retry" @tap="load">重新读取月度统计</button>
 </view>
</template>
<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { getCompanyMeterReport } from '@/apis/agent'
import { getAgentStorageScope, waitForAgentSession } from '@/utils/agent-session'
import { monthlyEnergyWindows, monthlyEnergyView, readMonthlyEnergy, monthlyNumber } from '../monthly-energy-view.mjs'
const props = defineProps({ active: Boolean, refreshKey: Number, cutoff: String })
const windows = ref(monthlyEnergyWindows()), states = ref({})
const view = computed(() => monthlyEnergyView(windows.value, states.value))
const hasError = computed(() => Object.values(states.value).some(state => state.error))
let requestId = 0, scope = ''
function failAll(error) {
 states.value = Object.fromEntries([windows.value.current, ...windows.value.pairs.flatMap(pair => [pair.current, pair.baseline])].map(span => [span.from + '/' + span.to, { error }]))
}
async function load() {
 const id = ++requestId
 windows.value = monthlyEnergyWindows(new Date(), props.cutoff); states.value = {}
 try {
  await waitForAgentSession()
  if (id !== requestId || !props.active) return
  scope = getAgentStorageScope()
  const active = () => {
   if (id !== requestId || !props.active) return false
   let sameScope = false
   try { sameScope = scope === getAgentStorageScope() } catch { /* 会话失效后清空整组读数。 */ }
   if (!sameScope) { ++requestId; failAll('登录身份已变化，请重新读取'); return false }
   return true
  }
  await readMonthlyEnergy(windows.value, getCompanyMeterReport, (key, result) => {
   if (!active()) return
   if (result.denied) {
    // 任一期撤权时整组清空，不能继续保留其他请求已取得的总量。
    ++requestId; failAll(result.error)
   } else states.value = { ...states.value, [key]: result }
  })
 } catch (error) {
  if (id === requestId && props.active) failAll(error.message || '月度统计读取失败')
 }
}
watch([() => props.active, () => props.refreshKey, () => props.cutoff], ([active]) => {
 if (active) void load()
 else { ++requestId; states.value = {} }
}, { immediate: true })
onBeforeUnmount(() => { ++requestId })
</script>
<style scoped>
view, text, input { font-size:inherit; line-height:inherit; }
.monthly { margin-top:20px; color:#293f31; }
.month-head { display:flex; align-items:baseline; justify-content:space-between; gap:8px; font-size:12px; font-weight:500; }
.cutoff { font-size:9px; color:#7d8d78; font-weight:400; text-align:right; }
.hero { display:block; margin-top:7px; font:34px/1.2 Georgia,"Songti SC",serif; letter-spacing:-1px; font-variant-numeric:tabular-nums; }
.unit { font:11px sans-serif; letter-spacing:0; }
.window { display:block; font-size:9px; color:#7d8d78; margin-top:7px; }
.comparisons { display:flex; margin-top:18px; padding-top:17px; border-top:1px solid #dce4d9; }
.compare { flex:1; min-width:0; padding-right:16px; }
.compare + .compare { border-left:1px solid #dce4d9; padding-right:0; padding-left:16px; }
.title { display:block; font-size:10px; color:#6e816d; }
.pct { display:block; margin:7px 0 13px; font:28px/1.2 Georgia,serif; color:#6e816d; letter-spacing:-.8px; }
.up .pct { color:#9c742d; }.down .pct { color:#176b54; }
.bar-row { margin-top:10px; }
.bar-values { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:baseline; gap:2px 4px; margin-bottom:5px; font-size:9px; color:#7d8d78; }
.amount { font-size:10px; color:#3a533e; font-variant-numeric:tabular-nums; white-space:nowrap; }
.track { height:5px; border-radius:3px; background:#dfe6da; overflow:hidden; }.fill { height:100%; border-radius:3px; background:#267655; }.base .fill { background:#b4bfa9; }
.missing { background:repeating-linear-gradient(120deg,#dfe6da 0 3px,transparent 3px 6px); }
.summary { display:block; font-size:10px; color:#687b68; line-height:1.6; margin-top:12px; overflow-wrap:anywhere; }
.periods { margin-top:10px; font-size:9px; color:#7d8d78; line-height:1.8; }.periods text { display:block; }
.data-note { display:block; font-size:10px; color:#8c774d; margin-top:7px; line-height:1.5; overflow-wrap:anywhere; }
.retry { display:block; margin:12px 0 0; padding:5px 0; font-size:11px; color:#176b54; background:transparent; line-height:1.6; }.retry::after { border:0; }
.skeleton { background:#dfe6da; border-radius:5px; }.hero-skeleton { width:150px; height:40px; margin-top:7px; }.pct-skeleton { width:70px; height:34px; margin:7px 0 13px; }
</style>
