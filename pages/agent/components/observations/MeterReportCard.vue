<template>
 <view class="mreport" @tap="closeDef" @keydown.esc="openDef = ''">
  <button class="param" hover-class="param--pressed" @tap="openEvidence">
   <text class="param-text">{{ paramLine }}</text>
   <uni-icons type="right" size="11" color="#8ba091" />
  </button>

  <template v-if="isComparison">
   <view class="hero">
    <text class="hero-label">{{ hero.label || '用电量 · 月份对比' }}</text>
    <view class="number" :class="{ words: hero.value === null }">
     <template v-if="isRegion">
      <text v-if="hero.value !== null">{{ hero.value }}</text>
      <text v-else>暂无可对比的范围用电</text>
     </template>
     <template v-else>
      <text v-if="hero.value !== null">{{ hero.value }}<text class="unit"> {{ hero.unit || '度' }}</text><text v-if="hero.pct" class="pct"> {{ hero.pct }}</text></text>
      <text v-else>暂无可对比的区间用电</text>
     </template>
    </view>
    <text v-if="hero.detail" class="yuan">{{ hero.detail }}</text>
    <text v-if="hero.pctNote" class="pct-note">{{ hero.pctNote }}</text>
    <text v-if="hero.sub" class="yuan">{{ hero.sub }}</text>
   </view>

   <template v-if="!isRegion">
    <image v-if="context?.kind === 'split'" class="split" :src="context.chart.src" mode="widthFix" />
    <text v-else-if="context?.kind === 'line'" class="context-line">{{ context.text }}</text>
   </template>

   <view v-if="metricRows.length" class="mtable">
    <view class="mtr mtr-head"><text class="mt-k">指标</text><text class="mt-v">{{ metricHeads[0] }}</text><text class="mt-v">{{ metricHeads[1] }}</text><text class="mt-v">{{ metricHeads[2] }}</text></view>
    <template v-for="row in metricRows" :key="row.key">
     <view class="mtr">
      <button class="mt-k mt-label" :aria-expanded="openDef === row.key" :aria-describedby="openDef === row.key ? defId : undefined" hover-class="pressed" @tap.stop="toggleDef(row.key)"><text>{{ row.label }}</text><text class="metric-info" aria-hidden="true">ⓘ</text></button>
      <text class="mt-v mtv">{{ row.a.text }}<text v-if="row.a.sub" class="mts"> {{ row.a.sub }}</text></text>
      <text class="mt-v mtv">{{ row.b.text }}<text v-if="row.b.sub" class="mts"> {{ row.b.sub }}</text></text>
      <text class="mt-v mtc" :class="row.change.tone">{{ row.change.text }}</text>
      <text v-if="openDef === row.key" :id="defId" class="metric-def" role="tooltip">{{ row.def }}</text>
     </view>
    </template>
   </view>

   <template v-if="loadCurve || compareBuckets.hasData">
   <view class="shead">
    <text>{{ effectiveCompareView === 'curve' ? `${curveTitle} · 度/时` : '时间分布 · 度' }}</text>
    <view v-if="compareViews.length > 1" class="seg"><button v-for="v in compareViews" :key="v.key" :class="{ on: effectiveCompareView === v.key }" :aria-pressed="effectiveCompareView === v.key" hover-class="pressed" @tap="compareView = v.key">{{ v.label }}</button></view>
   </view>
   <template v-if="effectiveCompareView === 'curve'">
    <image v-if="loadCurve" class="curve" :src="loadCurve.src" mode="scaleToFill" />
    <text v-else class="empty">覆盖不足，两期都画不出负荷曲线</text>
   </template>
   <template v-else-if="compareBuckets.hasData">
    <view class="blegend"><view v-for="item in barLegend" :key="item.label" class="bli"><view class="sw" :style="{ background: item.color }" /><text>{{ item.label }}</text></view></view>
    <scroll-view scroll-x class="chart-wrap" enhanced :show-scrollbar="false">
     <view :style="{ width: compareBuckets.points.length <= 7 ? '100%' : compareBuckets.width + 'px' }"><image class="chart" :src="compareBuckets.src" mode="scaleToFill" /></view>
    </scroll-view>
   </template>
   <text v-else class="empty">区间内没有可分段的有效差值</text>
   </template>

   <template v-if="isRegion">
    <template v-for="(rank, index) in regionRankings" :key="index">
     <view class="shead"><text>{{ rank.title }} · 度</text></view>
     <image v-if="rank.hasData" class="rank" :src="rank.src" mode="widthFix" />
     <text v-else class="empty">本侧没有可排行的有效用电</text>
     <text v-for="(line, i) in rank.excluded" :key="i" class="excluded">{{ line }}</text>
    </template>
   </template>
   <template v-else-if="contribution.hasData">
    <view class="shead shead-help">
     <text>{{ contribution.title }}<text v-if="contribution.sub" class="shead-sub"> · {{ contribution.sub }}</text></text>
     <button class="share" :aria-expanded="openDef === 'topShare'" :aria-describedby="openDef === 'topShare' ? defId : undefined" hover-class="pressed" @tap.stop="toggleDef('topShare')"><text>{{ contribution.shareText }}</text><text class="metric-info" aria-hidden="true">ⓘ</text></button>
     <text v-if="openDef === 'topShare'" :id="defId" class="metric-def" role="tooltip">{{ contribution.shareDef }}</text>
    </view>
    <image class="rank" :src="contribution.src" mode="widthFix" />
   </template>
  </template>

  <template v-else>
   <view class="hero">
    <text class="hero-label">{{ hero.label || '用电量' }}</text>
    <view class="number" :class="{ words: hero.value === null }">
     <text v-if="hero.value !== null">{{ hero.value }}<text class="unit"> 度</text></text>
     <text v-else>暂无可合计的区间用电</text>
    </view>
    <text v-if="hero.yuan" class="yuan">{{ hero.yuan }}</text>
   </view>

   <image v-if="context?.kind === 'split'" class="split" :src="context.chart.src" mode="widthFix" />
   <text v-else-if="context?.kind === 'line'" class="context-line">{{ context.text }}</text>

   <view v-if="metrics.length" class="metrics">
    <view v-for="m in metrics" :key="m.key" class="metric">
     <button class="metric-label" :aria-expanded="openDef === m.key" :aria-describedby="openDef === m.key ? defId : undefined" hover-class="pressed" @tap.stop="toggleDef(m.key)">
      <text>{{ m.label }}</text><text class="metric-info" aria-hidden="true">ⓘ</text>
     </button>
     <view class="metric-line"><text class="mv">{{ m.valueText }}</text><text v-if="m.unit" class="mu"> {{ m.unit }}</text><text v-if="m.sub" class="ms"> {{ m.sub }}</text></view>
     <text v-if="openDef === m.key" :id="defId" class="metric-def" role="tooltip">{{ m.def }}</text>
    </view>
   </view>

   <view class="shead">
    <text>时间分布 · 度</text>
    <view class="seg"><button v-for="g in grainOptions" :key="g.key" :class="{ on: grain === g.key }" :aria-pressed="grain === g.key" hover-class="pressed" @tap="grain = g.key">{{ g.label }}</button></view>
   </view>
   <scroll-view v-if="buckets.hasData" scroll-x class="chart-wrap" enhanced :show-scrollbar="false">
    <view :style="{ width: buckets.points.length <= 7 ? '100%' : buckets.width + 'px' }"><image class="chart" :src="buckets.src" mode="scaleToFill" /></view>
   </scroll-view>
   <text v-else class="empty">区间内没有可分段的有效差值</text>

   <template v-if="loadCurve">
    <view class="shead"><text>{{ loadCurve.title }} · 度/时</text></view>
    <image class="curve" :src="loadCurve.src" mode="scaleToFill" />
   </template>

   <view class="shead"><text>{{ rankingTitle }}</text></view>
   <image v-if="ranking.hasData" class="rank" :src="ranking.src" mode="widthFix" />
   <text v-for="(line, index) in ranking.excluded" :key="index" class="excluded">{{ line }}</text>
  </template>

  <DeviceSheet v-if="!embedded && mounted" :open="sheetOpen" :back="cardBack" :title="detailsNav.title || '计量依据'" :subtitle="sheetSubtitle" tall @close="sheetOpen = false">
   <template #header-left><button v-if="detailsNav.canBack" class="back" aria-label="返回上一层" hover-class="pressed" @tap="detailsRef?.back()"><uni-icons type="left" size="16" color="#315846" /></button></template>
   <MeterReportDetails ref="detailsRef" class="details-host" :report="report" :active="sheetOpen" @navigation="onDetailsNav" />
  </DeviceSheet>
 </view>
</template>

<script setup>
import { computed, ref, watch, getCurrentInstance } from 'vue'
import DeviceSheet from '../shared/DeviceSheet.vue'
import MeterReportDetails from './MeterReportDetails.vue'
import { meterReportIsComparison, meterReportAxis, meterReportCompareView, meterReportCompareViews, meterReportGrainOptions, meterReportParamLine, meterReportHero, meterReportContext, meterReportMetrics, meterReportMetricTable, meterReportMetricHeads, meterReportLoadCurve, meterReportBuckets, meterReportCompareBuckets, meterReportBarLegend, meterReportRankingTitle, meterReportRanking, meterReportRegionRankings, meterReportContribution } from '../../lib/energy.mjs'

const props = defineProps({ report: { type: Object, required: true }, embedded: Boolean })
const emit = defineEmits(['evidence'])
const isComparison = computed(() => meterReportIsComparison(props.report))
const isRegion = computed(() => meterReportAxis(props.report) === 'region')
const grain = ref(props.report.params?.grain || 'day')
const compareView = ref(meterReportCompareView(props.report))
const mounted = ref(false), sheetOpen = ref(false), detailsRef = ref(null), detailsNav = ref({ title: '', canBack: false }), openDef = ref('')
const defId = `mdef-${getCurrentInstance().uid}`

const paramLine = computed(() => meterReportParamLine(props.report))
const hero = computed(() => meterReportHero(props.report))
const context = computed(() => isRegion.value ? null : meterReportContext(props.report))
const metrics = computed(() => meterReportMetrics(props.report))
const metricRows = computed(() => meterReportMetricTable(props.report))
const metricHeads = computed(() => meterReportMetricHeads(props.report))
const loadCurve = computed(() => meterReportLoadCurve(props.report))
const curveTitle = computed(() => loadCurve.value?.title || '24小时负荷')
const compareViews = computed(() => meterReportCompareViews(props.report))
const effectiveCompareView = computed(() => compareViews.value.some(v => v.key === compareView.value) ? compareView.value : meterReportCompareView(props.report))
const grainOptions = computed(() => meterReportGrainOptions(props.report))
const buckets = computed(() => meterReportBuckets(props.report, grain.value))
const compareBuckets = computed(() => meterReportCompareBuckets(props.report))
const barLegend = computed(() => meterReportBarLegend(props.report))
const rankingTitle = computed(() => meterReportRankingTitle(props.report))
const ranking = computed(() => meterReportRanking(props.report))
const regionRankings = computed(() => meterReportRegionRankings(props.report))
const contribution = computed(() => meterReportContribution(props.report))
const sheetSubtitle = computed(() => isRegion.value
 ? `${props.report.params?.scope?.label || 'A'} vs ${props.report.params?.other?.label || 'B'} · ${props.report.coverage?.meters ?? 0} 台`
 : `${props.report.params?.scope?.label || '全部电表'} · ${props.report.coverage?.meters ?? 0} 台`)

watch(() => props.report, () => {
 grain.value = props.report.params?.grain || 'day'
 compareView.value = meterReportCompareView(props.report)
 openDef.value = ''
})

function toggleDef(key) { openDef.value = openDef.value === key ? '' : key }
function closeDef() { openDef.value = '' }
function openEvidence() {
 openDef.value = ''
 if (props.embedded) { emit('evidence'); return }
 detailsRef.value?.reset()
 mounted.value = true; sheetOpen.value = true
}
function cardBack() { if (!detailsRef.value?.back()) sheetOpen.value = false }
function onDetailsNav(nav) { detailsNav.value = nav || { title: '', canBack: false } }
</script>

<style scoped lang="scss">
@import "../../styles/tokens";
view, text, input { font-size: inherit; line-height: inherit; }
button { margin: 0; padding: 0; background: transparent; line-height: 1.4; }
button::after { border: 0; }
.mreport { color: #35533f; font-size: $agent-font-size-compact; margin-top: 4px; }
.param { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: $agent-space-small; min-height: 30px; text-align: left; }
.param--pressed { opacity: .7; }
.param-text { flex: 1; min-width: 0; font-size: 11px; line-height: 1.4; color: #6d8069; }
.hero { padding: 12px 0 10px; }
.hero-label { color: #71856d; font-size: 11px; }
.number { margin-top: 4px; font-size: 33px; letter-spacing: -1.2px; line-height: 1.25; font-weight: 650; font-variant-numeric: tabular-nums; }
.number.words { font-size: 17px; letter-spacing: 0; }
.unit { font-size: $agent-font-size-compact; font-weight: 400; letter-spacing: 0; margin-left: 6px; color: #788d74; }
.pct { font-size: 13px; font-weight: 500; letter-spacing: 0; margin-left: 8px; color: #71856d; }
.pct-note { display: block; margin-top: 4px; font-size: 10px; color: #a3b09c; }
.yuan { display: block; margin-top: 6px; font-size: 11px; color: #80907f; }
.split { display: block; width: 100%; margin-top: 10px; }
.context-line { display: block; margin-top: 8px; font-size: 11px; color: #80907f; }
.metrics { display: flex; flex-wrap: wrap; margin: 2px -4px 0; }
.metric { position: relative; width: 50%; box-sizing: border-box; padding: 8px 4px 0; }
.metric-label { display: flex; align-items: center; gap: 3px; min-height: 22px; font-size: 10px; color: #7d8f75; text-align: left; }
.metric-info { font-size: 10px; color: #a3b29a; }
.metric-line { margin-top: 2px; font-variant-numeric: tabular-nums; }
.metric-line .mv { font-size: 16px; font-weight: 600; color: #2f4a3a; }
.metric-line .mu { font-size: 10px; color: #80907f; }
.metric-line .ms { font-size: 10px; color: #a3b09c; }
.metric-def { display: block; position: absolute; z-index: 3; pointer-events: none; margin: 0; padding: 9px 11px; font-size: 11px; line-height: 1.5; color: #35533f; background: #fafcf6; border-radius: 8px; box-shadow: 0 4px 14px rgba(30,52,40,.16); white-space: normal; overflow-wrap: break-word; }
.metric .metric-def { bottom: calc(100% - 4px); left: 4px; width: calc(200% - 8px); box-sizing: border-box; }
.metric:nth-child(2n) .metric-def { left: auto; right: 4px; }
.shead-help { position: relative; }
.shead-help .metric-def { left: 0; right: 0; bottom: calc(100% + 6px); width: auto; }
.mtable { margin-top: 6px; border-top: 1px solid #e3e9dc; }
.mtr { position: relative; display: flex; align-items: baseline; gap: $agent-space-small; padding: 7px 0; border-bottom: 1px solid #edf1e6; }
.mtr .metric-def { left: 0; right: 0; bottom: calc(100% - 3px); width: auto; }
.mtr-head { font-size: 10px; color: #8b9c83; border-bottom-color: #e3e9dc; }
.mt-k { flex: 1.3; min-width: 0; }
.mt-v { flex: 1; min-width: 0; text-align: right; font-variant-numeric: tabular-nums; }
.mt-label { display: flex; align-items: center; gap: 3px; min-height: 22px; font-size: 10px; color: #7d8f75; text-align: left; }
.mtv { font-size: $agent-font-size-compact; font-weight: 600; color: #2f4a3a; }
.mts { font-size: 9px; font-weight: 400; color: #a3b09c; }
.mtc { font-size: $agent-font-size-compact; font-weight: 600; color: #8b9c83; }
.mtc.up { color: #2e7d5c; }
.mtc.down { color: #a8763a; }
.shead { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #7d8f75; margin-top: 14px; }
.shead-sub { color: #a3b09c; }
.share { display: flex; align-items: center; gap: 3px; min-height: 22px; font-size: 10px; color: #7d8f75; }
.seg { display: flex; gap: 2px; background: #eaf0e4; border-radius: 8px; padding: 3px; }
.seg button { font-size: 10px; min-width: 27px; min-height: 24px; border-radius: 6px; color: #7b8f71; display: flex; align-items: center; justify-content: center; }
.seg button.on { color: $agent-color-accent; background: #fafcf6; font-weight: 600; }
.chart-wrap { width: 100%; margin-top: 8px; }
.blegend { display: flex; gap: 12px; margin-top: 6px; }
.bli { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #5a6f5b; }
.bli .sw { width: 10px; height: 10px; border-radius: 3px; }
.chart { display: block; width: 100%; height: 172px; }
.curve { display: block; width: 100%; height: 150px; margin-top: 8px; }
.rank { display: block; width: 100%; margin-top: 8px; }
.excluded { display: block; margin-top: 8px; font-size: 10px; color: #96a491; }
.empty { display: block; padding: 14px 0; color: #72846d; font-size: 11px; }
.back { width: 34px; height: 34px; margin-right: 6px; border-radius: 50%; background: #e9f0e2; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pressed { transform: scale(.97); }
.details-host { height: 0; flex: 1; min-height: 0; display: flex; flex-direction: column; }
</style>
