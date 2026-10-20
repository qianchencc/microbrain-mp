<template>
 <view class="monthly">
  <view class="month-head"><text>{{ view.title }}</text><text v-if="view.cutoff" class="cutoff">{{ view.current.through ? '采样截至' : '统计截至' }} {{ view.cutoff }}</text></view>
  <view v-if="view.current.pending" class="skeleton hero-skeleton" />
  <text v-else class="hero">{{ monthlyNumber(view.current.value) }}<text class="unit"> 度</text></text>
  <text class="window">{{ view.current.label }} · 全部授权电表合计</text>
  <text class="window">每月 1 日 08:00 起算 · 每日 08:00 / 20:00 更新</text>
  <text v-if="view.current.note && !view.current.pending" class="data-note">{{ view.current.note }}</text>
  <view class="comparisons">
   <button v-for="pair in view.pairs" :key="pair.key" class="compare" :class="pair.direction" hover-class="compare-pressed" :disabled="pair.a.pending && pair.b.pending" :aria-label="'查看' + pair.title + '逐表对比'" :aria-expanded="detailsOpen && detailsKey === pair.key" @tap="openDetails(pair.key)">
    <view class="compare-heading"><text class="title">{{ pair.title }} · {{ pair.label }}</text><uni-icons type="right" size="11" color="#7d8d78" /></view>
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
   </button>
  </view>
  <button v-if="hasError" class="retry" @tap="load">重新读取月度统计</button>
  <DeviceSheet v-if="detailsMounted" :open="detailsOpen" :title="details ? details.title + ' · 逐表对比' : '逐表对比'" tall compact-header @close="detailsOpen = false">
   <scroll-view v-if="details" :key="details.key" class="details-scroll" scroll-y enhanced :show-scrollbar="false">
    <view class="details-content">
     <view class="detail-periods"><text>本期 {{ details.a.detailLabel }}</text><text>对照 {{ details.b.detailLabel }}</text></view>
     <view class="detail-totals">
      <view><text class="total-label">本月用电 · 度</text><text class="total-number">{{ monthlyNumber(details.a.value) }}</text></view>
      <view><text class="total-label">{{ details.label }} · 度</text><text class="total-number">{{ monthlyNumber(details.b.value) }}</text></view>
     </view>
     <text class="detail-summary" :class="details.direction">{{ details.pct }} · {{ details.summary }}</text>
     <text v-if="details.note" class="data-note">{{ details.note }}</text>
     <view class="list-heading"><text>全部电表 · {{ details.rows.length }} 台</text><text>按增量从高到低 · 度</text></view>
     <view v-for="row in details.rows" :key="row.id" class="meter-row">
      <text class="meter-name">{{ row.name }}</text>
      <text v-if="row.location && row.location !== row.name" class="meter-location">{{ row.location }}</text>
      <view class="meter-values">
       <view><text class="value-label">本月</text><text class="meter-value">{{ monthlyNumber(row.a.value) }}</text></view>
       <view><text class="value-label">{{ details.label }}</text><text class="meter-value">{{ monthlyNumber(row.b.value) }}</text></view>
       <view><text class="value-label">增减</text><text class="meter-value" :class="row.direction">{{ row.deltaText }}</text></view>
       <view><text class="value-label">增减幅度</text><text class="meter-value" :class="row.direction">{{ row.pctText }}</text></view>
      </view>
      <text v-if="row.note" class="row-note">{{ row.note }}</text>
     </view>
     <text v-if="!details.rows.length" class="details-empty">{{ details.a.pending || details.b.pending ? '正在读取电表明细' : '暂无可展示的电表明细' }}</text>
    </view>
   </scroll-view>
  </DeviceSheet>
 </view>
</template>
<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { getCompanyMeterReport } from '@/apis/agent'
import { getAgentStorageScope, waitForAgentSession } from '@/utils/agent-session'
import { useUserStoreHook } from '@/store/modules/user'
import { monthlyEnergyWindows, monthlyEnergyView, readMonthlyEnergy, monthlyNumber } from '../monthly-energy-view.mjs'
import DeviceSheet from './DeviceSheet.vue'
const props = defineProps({ active: Boolean, refreshKey: Number, cutoff: String })
const windows = ref(monthlyEnergyWindows()), states = ref({})
const view = computed(() => monthlyEnergyView(windows.value, states.value))
const hasError = computed(() => Object.values(states.value).some(state => state.error))
const detailsMounted = ref(false), detailsOpen = ref(false), detailsKey = ref('')
const details = computed(() => view.value.pairs.find(pair => pair.key === detailsKey.value))
const user = useUserStoreHook()
let requestId = 0, scope = ''
watch(() => [user.token, user.getDistrict?.id, user.authorized], () => {
 if (!scope) return
 try { if (scope === getAgentStorageScope()) return } catch { /* 登录失效也使旧统计不可再见。 */ }
 ++requestId; failAll('登录身份已变化，请重新读取')
}, { flush: 'post' })
function openDetails(key) {
 if (!props.active) return
 let sameScope = false
 try { sameScope = scope === getAgentStorageScope() } catch { /* 会话失效时清空已有统计。 */ }
 if (!sameScope) { ++requestId; failAll('登录身份已变化，请重新读取'); return }
 detailsKey.value = key; detailsMounted.value = true; detailsOpen.value = true
}
function failAll(error) {
 detailsOpen.value = false
 states.value = Object.fromEntries([windows.value.current, ...windows.value.pairs.flatMap(pair => [pair.current, pair.baseline])].map(span => [span.from + '/' + span.to, { error }]))
}
async function load() {
 const id = ++requestId
 detailsOpen.value = false
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
 else { ++requestId; detailsOpen.value = false; states.value = {} }
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
.compare { flex:1; width:0; min-width:0; margin:0; padding:0 16px 0 0; border-radius:0; background:transparent; line-height:inherit; text-align:left; color:inherit; }
.compare::after { border:0; }.compare-pressed { opacity:.65; }
.compare + .compare { border-left:1px solid #dce4d9; padding-right:0; padding-left:16px; }
.compare-heading { display:flex; align-items:center; justify-content:space-between; gap:4px; }
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
.details-scroll { height:0; flex:1; min-height:0; }
.details-content { padding:6px 20px 28px; color:#293f31; }
.detail-periods { font-size:10px; line-height:1.8; color:#7d8d78; }.detail-periods text { display:block; }
.detail-totals { display:flex; gap:16px; margin-top:16px; }.detail-totals > view { flex:1; min-width:0; }
.total-label { display:block; color:#7d8d78; font-size:10px; }
.total-number { display:block; font:25px/1.4 Georgia,"Songti SC",serif; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
.detail-summary { display:block; margin-top:8px; color:#687b68; font-size:11px; line-height:1.7; overflow-wrap:anywhere; }.detail-summary.up,.meter-value.up { color:#9c742d; }.detail-summary.down,.meter-value.down { color:#176b54; }
.list-heading { display:flex; flex-wrap:wrap; justify-content:space-between; gap:4px; margin-top:22px; padding-bottom:10px; border-bottom:1px solid #dce4d9; color:#7d8d78; font-size:10px; }
.meter-row { padding:14px 0; border-bottom:1px solid #e5eae1; }
.meter-name { display:block; font-size:12px; font-weight:500; line-height:1.5; overflow-wrap:anywhere; }
.meter-location { display:block; margin-top:2px; font-size:10px; color:#7d8d78; line-height:1.5; }
.meter-values { display:flex; gap:8px; margin-top:10px; }.meter-values > view { flex:1; min-width:0; }
.value-label { display:block; font-size:9px; line-height:1.6; color:#7d8d78; }
.meter-value { display:block; font-size:12px; line-height:1.6; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
.row-note,.details-empty { display:block; margin-top:7px; color:#8c774d; font-size:10px; line-height:1.6; overflow-wrap:anywhere; }
</style>
