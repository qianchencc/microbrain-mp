<template>
 <view class="rfs">
  <view class="rfs-head"><text class="rfs-title">{{ title }}</text><button class="rfs-evidence" :aria-label="`${title}计量依据`" @tap="$emit('evidence', report)">计量依据</button></view>
  <text class="rfs-param">{{ paramLine }}</text>
  <view class="rfs-coverage">
   <text v-for="(line, index) in coverageLines" :key="index" class="rfs-cov">{{ line }}</text>
   <text v-if="simulatedNote" class="rfs-cov rfs-cov-warn">{{ simulatedNote }}</text>
  </view>

  <template v-if="isComparison">
   <view class="rfs-hero">
    <text class="rfs-hero-label">{{ hero.label || '用电量 · 与上期相比' }}</text>
    <view class="rfs-number" :class="{ words: hero.value === null }">
     <template v-if="isRegion">
      <text v-if="hero.value !== null">{{ hero.value }}</text>
      <text v-else>暂无可对比的范围用电</text>
     </template>
     <template v-else>
      <text v-if="hero.value !== null">{{ hero.value }}<text class="rfs-unit"> {{ hero.unit || '度' }}</text><text v-if="hero.pct" class="rfs-pct"> {{ hero.pct }}</text></text>
      <text v-else>暂无可对比的区间用电</text>
     </template>
    </view>
    <text v-if="hero.detail" class="rfs-sub">{{ hero.detail }}</text>
    <text v-if="hero.pctNote" class="rfs-note">{{ hero.pctNote }}</text>
    <text v-if="hero.sub" class="rfs-sub">{{ hero.sub }}</text>
   </view>

   <view v-if="metricRows.length" class="rfs-table">
    <view class="rfs-tr rfs-tr-head"><text class="rfs-tk">指标</text><text class="rfs-tv">{{ metricHeads[0] }}</text><text class="rfs-tv">{{ metricHeads[1] }}</text><text class="rfs-tv">{{ metricHeads[2] }}</text></view>
    <view v-for="row in metricRows" :key="row.key" class="rfs-tr">
     <text class="rfs-tk">{{ row.label }}</text>
     <text class="rfs-tv rfs-tvv">{{ row.a.text }}<text v-if="row.a.sub" class="rfs-ts"> {{ row.a.sub }}</text></text>
     <text class="rfs-tv rfs-tvv">{{ row.b.text }}<text v-if="row.b.sub" class="rfs-ts"> {{ row.b.sub }}</text></text>
     <text class="rfs-tv rfs-tc" :class="row.change.tone">{{ row.change.text }}</text>
    </view>
   </view>

   <template v-if="!isRegion && compareBuckets.hasData">
    <text class="rfs-label">时间分布 · 度</text>
    <view class="rfs-legend"><view v-for="item in barLegend" :key="item.label" class="rfs-li"><view class="rfs-sw" :style="{ background: item.color }" /><text>{{ item.label }}</text></view></view>
    <scroll-view scroll-x class="rfs-chart-wrap" enhanced :show-scrollbar="false">
     <view :style="{ width: compareBuckets.points.length <= 7 ? '100%' : compareBuckets.width + 'px' }"><image class="rfs-chart" :src="compareBuckets.src" mode="scaleToFill" /></view>
    </scroll-view>
   </template>

   <template v-if="isRegion">
    <template v-for="(rank, index) in regionRankings" :key="index">
     <text class="rfs-label">{{ rank.title }} · 度</text>
     <image v-if="rank.hasData" class="rfs-rank" :src="rank.src" mode="widthFix" />
     <text v-else class="rfs-empty">本侧没有可排行的有效用电</text>
    </template>
   </template>
   <template v-else-if="contribution.hasData">
    <text class="rfs-label">{{ contribution.title }}<text v-if="contribution.sub" class="rfs-label-sub"> · {{ contribution.sub }}</text></text>
    <image class="rfs-rank" :src="contribution.src" mode="widthFix" />
   </template>
  </template>

  <template v-else>
   <view class="rfs-hero">
    <text class="rfs-hero-label">用电量</text>
    <view class="rfs-number" :class="{ words: hero.value === null }">
     <text v-if="hero.value !== null">{{ hero.value }}<text class="rfs-unit"> 度</text></text>
     <text v-else>暂无可合计的区间用电</text>
    </view>
    <text v-if="hero.yuan" class="rfs-sub">{{ hero.yuan }}</text>
   </view>

   <view v-if="metrics.length" class="rfs-metrics">
    <view v-for="m in metrics" :key="m.key" class="rfs-metric">
     <text class="rfs-metric-label">{{ m.label }}</text>
     <view class="rfs-metric-line"><text class="rfs-mv">{{ m.valueText }}</text><text v-if="m.unit" class="rfs-mu"> {{ m.unit }}</text><text v-if="m.sub" class="rfs-ms"> {{ m.sub }}</text></view>
    </view>
   </view>

   <template v-if="buckets.hasData">
    <view class="rfs-label-row"><text class="rfs-label">时间分布 · 度</text>
     <view class="rfs-seg"><button v-for="g in grainOptions" :key="g.key" :class="{ on: grain === g.key }" :aria-pressed="grain === g.key" @tap="grain = g.key">{{ g.label }}</button></view>
    </view>
    <scroll-view scroll-x class="rfs-chart-wrap" enhanced :show-scrollbar="false">
     <view :style="{ width: buckets.points.length <= 7 ? '100%' : buckets.width + 'px' }"><image class="rfs-chart" :src="buckets.src" mode="scaleToFill" /></view>
    </scroll-view>
   </template>
   <template v-if="ranking.hasData">
    <text class="rfs-label">{{ rankingTitle }}</text>
    <image class="rfs-rank" :src="ranking.src" mode="widthFix" />
   </template>
   <text v-for="(line, index) in ranking.excluded" :key="index" class="rfs-excluded">{{ line }}</text>
  </template>
 </view>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { meterReportIsComparison, meterReportAxis, meterReportGrainOptions, meterReportParamLine, meterReportHero, meterReportMetrics, meterReportMetricTable, meterReportMetricHeads, meterReportBuckets, meterReportCompareBuckets, meterReportBarLegend, meterReportRankingTitle, meterReportRanking, meterReportRegionRankings, meterReportContribution } from '../meter-report-view.mjs'

const props = defineProps({ report: { type: Object, required: true } })
const emit = defineEmits(['evidence'])
const isComparison = computed(() => meterReportIsComparison(props.report))
const isRegion = computed(() => meterReportAxis(props.report) === 'region')
const title = computed(() => {
 if (!isComparison.value) return '用电统计'
 if (isRegion.value) return '用电区域对比'
 const relation = props.report?.params?.relation
 return ({ yearOverYear: '用电同比', previousPeriod: '用电环比', custom: '用电时间对比' })[relation] || '用电时间对比'
})
const grain = ref(props.report.params?.grain || 'day')
const paramLine = computed(() => meterReportParamLine(props.report))
const hero = computed(() => meterReportHero(props.report))
const metrics = computed(() => meterReportMetrics(props.report))
const metricRows = computed(() => meterReportMetricTable(props.report))
const metricHeads = computed(() => meterReportMetricHeads(props.report))
const grainOptions = computed(() => meterReportGrainOptions(props.report))
const buckets = computed(() => meterReportBuckets(props.report, grain.value))
const compareBuckets = computed(() => meterReportCompareBuckets(props.report))
const barLegend = computed(() => meterReportBarLegend(props.report))
const rankingTitle = computed(() => meterReportRankingTitle(props.report))
const ranking = computed(() => meterReportRanking(props.report))
const regionRankings = computed(() => meterReportRegionRankings(props.report))
const contribution = computed(() => meterReportContribution(props.report))
const coverageLines = computed(() => {
 const report = props.report, coverage = report?.coverage
 if (!coverage) return []
 const lines = []
 if (isComparison.value && !isRegion.value) {
  lines.push(`计量范围：${report?.params?.scope?.label || '全部电表'} ${report?.params?.scope?.meterCount ?? coverage.meters ?? 0}台`)
  lines.push(`两期共同可比 ${coverage.dataMeters ?? 0} 台 · 本期有效 ${report?.sides?.a?.dataMeters ?? 0} 台 · 基期有效 ${report?.sides?.b?.dataMeters ?? 0} 台`)
 } else if (isRegion.value) {
  const a = report?.sides?.a?.coverage, b = report?.sides?.b?.coverage
  lines.push(`计量范围：${report?.params?.scope?.label || '全部电表'} vs ${report?.params?.other?.label || '全部电表'}`)
  lines.push(`A 有效 ${a?.dataMeters ?? 0}/${a?.meters ?? 0} 台 · B 有效 ${b?.dataMeters ?? 0}/${b?.meters ?? 0} 台`)
  const excluded = (side, tag) => (side?.noData?.length || 0) + (side?.partial?.length || 0) ? `${tag} ${(side?.noData?.length || 0) + (side?.partial?.length || 0)} 台未计入` : ''
  for (const line of [excluded(a, 'A'), excluded(b, 'B')]) if (line) lines.push(line)
  return lines
 } else {
  lines.push(`计量范围：${report?.params?.scope?.label || '全部电表'} ${report?.params?.scope?.meterCount ?? coverage.meters ?? 0}台`)
  lines.push(`有效采样 ${coverage.dataMeters ?? 0}/${coverage.meters ?? 0} 台`)
 }
 if (coverage.noData?.length) lines.push(`无有效数据 ${coverage.noData.length} 台`)
 if (coverage.partial?.length) lines.push('部分电表采样不全')
 if (coverage.truncated) lines.push('读取不完整')
 return lines
})
const simulatedNote = computed(() => {
 const boundary = Date.parse('2025-01-01T00:00:00+08:00')
 const spanTo = Date.parse(props.report?.params?.span?.requested?.to || '')
 const baselineTo = Date.parse(props.report?.params?.baseline?.requested?.to || '')
 return (spanTo > boundary || baselineTo > boundary) ? '所选期间包含客户模拟补数，不作为真实运行或节能证据' : ''
})
watch(() => props.report, () => { grain.value = props.report.params?.grain || 'day' })
</script>
<style scoped>
view, text, input { font-size: inherit; line-height: inherit; }
button { margin: 0; padding: 0; background: transparent; }
button::after { border: 0; }
.rfs { color: #35533f; font-size: 12px; }
.rfs-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.rfs-title { color: #263c2e; font-size: 14px; font-weight: 700; }
.rfs-evidence { flex-shrink: 0; min-height: 30px; padding: 0 4px; color: #176b54; font-size: 11px; }
.rfs-param { display: block; margin-top: 5px; color: #6d8069; font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
.rfs-coverage { display: block; margin-top: 4px; }
.rfs-cov { display: block; margin-top: 2px; color: #8b998d; font-size: 10px; line-height: 1.5; }
.rfs-cov-warn { color: #936527; }
.rfs-hero { padding: 10px 0 6px; }
.rfs-hero-label { color: #71856d; font-size: 11px; }
.rfs-number { margin-top: 3px; font-size: 28px; letter-spacing: 0; line-height: 1.25; font-weight: 650; font-variant-numeric: tabular-nums; }
.rfs-number.words { font-size: 15px; letter-spacing: 0; }
.rfs-unit { font-size: 12px; font-weight: 400; margin-left: 5px; color: #788d74; }
.rfs-pct { font-size: 12px; font-weight: 500; margin-left: 7px; color: #71856d; }
.rfs-sub { display: block; margin-top: 5px; font-size: 11px; color: #80907f; }
.rfs-note { display: block; margin-top: 4px; font-size: 10px; color: #a3b09c; }
.rfs-metrics { display: flex; flex-wrap: wrap; margin: 2px -4px 0; }
.rfs-metric { width: 50%; box-sizing: border-box; padding: 8px 4px 0; }
.rfs-metric-label { display: block; font-size: 10px; color: #7d8f75; }
.rfs-metric-line { margin-top: 2px; font-variant-numeric: tabular-nums; }
.rfs-mv { font-size: 15px; font-weight: 600; color: #2f4a3a; }
.rfs-mu { font-size: 10px; color: #80907f; }
.rfs-ms { font-size: 10px; color: #a3b09c; }
.rfs-table { margin-top: 6px; border-top: 1px solid #e3e9dc; }
.rfs-tr { display: flex; align-items: baseline; gap: 8px; padding: 7px 0; border-bottom: 1px solid #edf1e6; }
.rfs-tr-head { font-size: 10px; color: #8b9c83; border-bottom-color: #e3e9dc; }
.rfs-tk { flex: 1.3; min-width: 0; font-size: 10px; color: #7d8f75; }
.rfs-tv { flex: 1; min-width: 0; text-align: right; font-variant-numeric: tabular-nums; }
.rfs-tvv { font-size: 12px; font-weight: 600; color: #2f4a3a; }
.rfs-ts { font-size: 9px; font-weight: 400; color: #a3b09c; }
.rfs-tc { font-size: 12px; font-weight: 600; color: #8b9c83; }
.rfs-tc.up { color: #2e7d5c; }
.rfs-tc.down { color: #a8763a; }
.rfs-label-row { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
.rfs-label { display: block; margin-top: 14px; font-size: 11px; color: #7d8f75; }
.rfs-label-row .rfs-label { margin-top: 0; }
.rfs-label-sub { color: #a3b09c; }
.rfs-seg { display: flex; gap: 2px; background: #eaf0e4; border-radius: 8px; padding: 3px; }
.rfs-seg button { font-size: 10px; min-width: 27px; min-height: 24px; border-radius: 6px; color: #7b8f71; display: flex; align-items: center; justify-content: center; }
.rfs-seg button.on { color: #176b54; background: #fafcf6; font-weight: 600; }
.rfs-legend { display: flex; gap: 12px; margin-top: 8px; }
.rfs-li { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #5a6f5b; }
.rfs-sw { width: 10px; height: 10px; border-radius: 3px; }
.rfs-chart-wrap { width: 100%; margin-top: 8px; }
.rfs-chart { display: block; width: 100%; height: 160px; }
.rfs-rank { display: block; width: 100%; margin-top: 8px; }
.rfs-excluded { display: block; margin-top: 8px; font-size: 10px; color: #96a491; }
.rfs-empty { display: block; padding: 12px 0; color: #72846d; font-size: 11px; }
</style>
