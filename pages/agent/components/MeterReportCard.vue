<template>
 <view class="mreport">
  <button class="param" hover-class="param--pressed" @tap="openSheet">
   <text class="param-text">{{ paramLine }}</text>
   <uni-icons type="right" size="11" color="#8ba091" />
  </button>

  <view class="hero">
   <text class="hero-label">用电量（度）</text>
   <view class="number" :class="{ words: hero.value === null }">
    <text v-if="hero.value !== null">{{ hero.value }}<text class="unit"> 度</text></text>
    <text v-else>暂无可合计的区间用电</text>
   </view>
   <text v-if="hero.yuan" class="yuan">{{ hero.yuan }}</text>
  </view>

  <view class="shead">
   <text>时间分布 · 度</text>
   <view class="seg"><button v-for="g in meterReportGrains" :key="g.key" :class="{ on: grain === g.key }" :aria-pressed="grain === g.key" hover-class="pressed" @tap="grain = g.key">{{ g.label }}</button></view>
  </view>
  <scroll-view v-if="buckets.hasData" scroll-x class="chart-wrap" enhanced :show-scrollbar="false">
   <view :style="{ width: buckets.points.length <= 7 ? '100%' : buckets.width + 'px' }"><image class="chart" :src="buckets.src" mode="scaleToFill" /></view>
  </scroll-view>
  <text v-else class="empty">区间内没有可分段的有效差值</text>

  <view class="shead"><text>位置构成 · 度</text></view>
  <image v-if="ranking.hasData" class="rank" :src="ranking.src" mode="widthFix" />
  <text v-for="(line, index) in ranking.excluded" :key="index" class="excluded">{{ line }}</text>

  <DeviceSheet v-if="mounted" :open="sheetOpen" :title="pane === 'history' ? '原始计量采样' : '计量依据'" :subtitle="sheetSubtitle" tall @close="sheetOpen = false">
   <template #header-left><button v-if="stack.length" class="back" aria-label="返回上一层" hover-class="pressed" @tap="back"><uni-icons type="left" size="16" color="#315846" /></button></template>
   <view v-if="pane === 'history' && selected" class="history-pane"><MeterHistoryView class="history-host" :active="sheetOpen" :initial-query="historyQuery" :show-question="false" /></view>
   <scroll-view v-else class="details-scroll" scroll-y enhanced :show-scrollbar="false">
    <view class="details">
     <text class="sheet-note">{{ meterReportSpan(report) }} · {{ report.params.scope.label }} · {{ report.coverage.meters }} 台 · 起止采样为区间内实际读到的最近示数；两端缺失、回退或过早停报的表不计入合计。</text>
     <button v-for="meter in evidence" :key="meter.id" class="mrow" hover-class="row-pressed" @tap="pushHistory(meter)">
      <view class="mrow-main"><text class="mrow-name">{{ meter.label }}</text><text class="mrow-sub">{{ meter.bounds }}</text></view>
      <view class="mrow-value"><text class="v">{{ meter.valueText }}</text><text class="u">{{ meter.statusText }}</text></view>
      <text class="arrow">›</text>
     </button>
    </view>
   </scroll-view>
  </DeviceSheet>
 </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import DeviceSheet from './DeviceSheet.vue'
import MeterHistoryView from './MeterHistoryView.vue'
import { meterReportGrains, meterReportParamLine, meterReportHero, meterReportBuckets, meterReportRanking, meterReportEvidence, meterReportHistoryQuery, meterReportSpan } from '../meter-report-view.mjs'

const props = defineProps({ report: { type: Object, required: true } })
const grain = ref(props.report.params?.grain || 'day')
const mounted = ref(false), sheetOpen = ref(false), pane = ref('meters'), selectedId = ref(''), stack = ref([])

const paramLine = computed(() => meterReportParamLine(props.report))
const hero = computed(() => meterReportHero(props.report))
const buckets = computed(() => meterReportBuckets(props.report, grain.value))
const ranking = computed(() => meterReportRanking(props.report))
const evidence = computed(() => meterReportEvidence(props.report))
const selected = computed(() => evidence.value.find(meter => meter.id === selectedId.value))
const sheetSubtitle = computed(() => `${props.report.params?.scope?.label || '全部电表'} · ${props.report.coverage?.meters ?? evidence.value.length} 台`)
const historyQuery = computed(() => meterReportHistoryQuery(props.report, selectedId.value))

function openSheet() { pane.value = 'meters'; selectedId.value = ''; stack.value = []; mounted.value = true; sheetOpen.value = true }
function pushHistory(meter) { stack.value.push('meters'); pane.value = 'history'; selectedId.value = meter.id }
function back() { if (stack.value.pop() === 'meters') { pane.value = 'meters'; selectedId.value = '' } }
</script>

<style scoped>
view, text, input { font-size: inherit; line-height: inherit; }
button { margin: 0; padding: 0; background: transparent; line-height: 1.4; }
button::after { border: 0; }
.mreport { color: #35533f; font-size: 12px; margin-top: 4px; }
.param { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 30px; text-align: left; }
.param--pressed { opacity: .7; }
.param-text { flex: 1; min-width: 0; font-size: 11px; color: #6d8069; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.hero { padding: 12px 0 10px; }
.hero-label { color: #71856d; font-size: 11px; }
.number { margin-top: 4px; font-size: 33px; letter-spacing: -1.2px; line-height: 1.25; font-weight: 650; font-variant-numeric: tabular-nums; }
.number.words { font-size: 17px; letter-spacing: 0; }
.unit { font-size: 12px; font-weight: 400; letter-spacing: 0; margin-left: 6px; color: #788d74; }
.yuan { display: block; margin-top: 6px; font-size: 11px; color: #80907f; }
.shead { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #7d8f75; margin-top: 14px; }
.seg { display: flex; gap: 2px; background: #eaf0e4; border-radius: 8px; padding: 3px; }
.seg button { font-size: 10px; min-width: 27px; min-height: 24px; border-radius: 6px; color: #7b8f71; display: flex; align-items: center; justify-content: center; }
.seg button.on { color: #176b54; background: #fafcf6; font-weight: 600; }
.chart-wrap { width: 100%; margin-top: 8px; }
.chart { display: block; width: 100%; height: 172px; }
.rank { display: block; width: 100%; margin-top: 8px; }
.excluded { display: block; margin-top: 8px; font-size: 10px; color: #96a491; }
.empty { display: block; padding: 14px 0; color: #72846d; font-size: 11px; }
.back { width: 34px; height: 34px; margin-right: 6px; border-radius: 50%; background: #e9f0e2; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pressed { transform: scale(.97); }
.row-pressed { background: #eef3ea; }
.history-pane, .history-host { height: 0; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.details-scroll { height: 0; flex: 1; min-height: 0; }
.details { padding: 4px 20px 26px; }
.sheet-note { display: block; font-size: 10px; color: #80907f; line-height: 1.7; margin-bottom: 4px; }
.mrow { width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #e3e9dc; text-align: left; }
.mrow-main { flex: 1; min-width: 0; }
.mrow-name { display: block; font-size: 12px; font-weight: 600; line-height: 1.5; }
.mrow-sub { display: block; font-size: 10px; color: #80907f; margin-top: 3px; overflow-wrap: anywhere; }
.mrow-value { flex-shrink: 0; text-align: right; }
.mrow-value .v { display: block; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.mrow-value .u { display: block; font-size: 9px; color: #80907f; margin-top: 2px; }
.arrow { color: #90a18a; flex-shrink: 0; }
</style>
