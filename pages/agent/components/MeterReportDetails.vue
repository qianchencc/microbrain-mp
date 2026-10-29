<template>
 <view class="mdetails">
  <view v-if="pane === 'history' && selected" class="history-pane">
   <view v-if="powerFactorLines.length" class="pf-notes">
    <text v-for="line in powerFactorLines" :key="line" class="pf-line">{{ line }}</text>
    <text class="pf-hint">功率因数为采样点均值，非时段平均</text>
   </view>
   <MeterHistoryView class="history-host" :active="active" :initial-query="historyQuery" :show-question="false" />
  </view>
  <scroll-view v-else class="details-scroll" scroll-y enhanced :show-scrollbar="false">
   <view class="details">
    <text class="sheet-note">{{ sheetSpan }} · {{ sheetSubtitle }}</text>
    <template v-for="(section, s) in evidenceSections" :key="s">
     <text v-if="section.tag" class="sheet-tag">{{ section.tag }}</text>
     <button v-for="meter in section.rows" :key="meter.id" class="mrow" hover-class="row-pressed" @tap="pushHistory(meter)">
      <view class="mrow-main"><text class="mrow-name">{{ meter.label }}</text><text class="mrow-sub">{{ meter.bounds }}</text></view>
      <view class="mrow-value"><text class="v">{{ meter.valueText }}</text><text class="u">{{ meter.statusText }}</text></view>
      <text class="arrow">›</text>
     </button>
    </template>
   </view>
  </scroll-view>
 </view>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import MeterHistoryView from './MeterHistoryView.vue'
import { meterReportAxis, meterReportEvidence, meterReportEvidenceSections, meterReportHistoryQuery, meterReportPowerFactor, meterReportSpanText } from '../lib/energy.mjs'

const props = defineProps({ report: { type: Object, required: true }, active: Boolean })
const emit = defineEmits(['navigation'])

const pane = ref('meters'), selectedId = ref(''), stack = ref([])
const isRegion = computed(() => meterReportAxis(props.report) === 'region')
const evidence = computed(() => meterReportEvidence(props.report))
const evidenceSections = computed(() => meterReportEvidenceSections(props.report))
const selected = computed(() => evidence.value.find(meter => meter.id === selectedId.value))
const sheetSubtitle = computed(() => isRegion.value
 ? `${props.report.params?.scope?.label || 'A'} vs ${props.report.params?.other?.label || 'B'} · ${props.report.coverage?.meters ?? evidence.value.length} 台`
 : `${props.report.params?.scope?.label || '全部电表'} · ${props.report.coverage?.meters ?? evidence.value.length} 台`)
const sheetSpan = computed(() => meterReportSpanText(props.report))
const historyQuery = computed(() => meterReportHistoryQuery(props.report, selectedId.value))
const powerFactorLines = computed(() => pane.value === 'history' ? meterReportPowerFactor(props.report, selectedId.value) : [])
const navTitle = computed(() => pane.value === 'history' ? '电表统计' : '计量依据')

watch([navTitle, () => stack.value.length], () => emit('navigation', { title: navTitle.value, canBack: stack.value.length > 0 }), { immediate: true })
watch(() => props.report, reset)

function pushHistory(meter) { stack.value.push('meters'); pane.value = 'history'; selectedId.value = meter.id }
function back() {
 if (stack.value.pop() === 'meters') { pane.value = 'meters'; selectedId.value = ''; return true }
 return false
}
function reset() { pane.value = 'meters'; selectedId.value = ''; stack.value = [] }
defineExpose({ back, reset })
</script>

<style scoped>
view, text, input { font-size: inherit; line-height: inherit; }
button { margin: 0; padding: 0; background: transparent; line-height: 1.4; }
button::after { border: 0; }
.mdetails { height: 0; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.history-pane, .history-host { height: 0; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.pf-notes { flex-shrink: 0; padding: 8px 20px 6px; border-bottom: 1px solid #e3e9dc; }
.pf-line { display: block; font-size: 10px; color: #5d6b56; line-height: 1.7; }
.pf-hint { display: block; font-size: 9px; color: #80907f; line-height: 1.7; }
.details-scroll { height: 0; flex: 1; min-height: 0; }
.details { padding: 4px 20px 26px; }
.sheet-note { display: block; font-size: 10px; color: #80907f; line-height: 1.7; margin-bottom: 4px; }
.sheet-tag { display: block; font-size: 10px; color: #7d8f75; font-weight: 600; margin: 10px 0 0; }
.mrow { width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #e3e9dc; text-align: left; }
.mrow-main { flex: 1; min-width: 0; }
.mrow-name { display: block; font-size: 12px; font-weight: 600; line-height: 1.5; }
.mrow-sub { display: block; font-size: 10px; color: #80907f; margin-top: 3px; overflow-wrap: anywhere; }
.mrow-value { flex-shrink: 0; text-align: right; }
.mrow-value .v { display: block; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.mrow-value .u { display: block; font-size: 9px; color: #80907f; margin-top: 2px; }
.arrow { color: #90a18a; flex-shrink: 0; }
.row-pressed { background: #eef3ea; }
</style>
