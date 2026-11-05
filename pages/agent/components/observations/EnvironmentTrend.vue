<template>
 <view class="trend">
  <SlidingSegments class="metrics" tone="glass" :options="metricOptions" :model-value="metricKey" @update:model-value="metricKey = $event; selectedId = ''" />
  <view class="hero">
   <view><text class="hero-label">{{ metric?.label || '读数' }}</text><text class="hero-value">{{ latest ? latest.value : '—' }}<text class="hero-unit">{{ metric?.unit || '' }}</text></text></view>
   <view class="peak"><text v-if="metric?.peak">峰值 {{ metric.peak.value }}{{ metric?.unit || '' }}</text><text>{{ metric?.peak ? fmtDateTime(metric.peak.at) : '暂无有效采样' }}</text></view>
  </view>
  <view class="plot" @tap="selectPoint"><image class="chart" :src="chart.src" mode="scaleToFill" /></view>
  <view class="axis"><text v-for="tick in axisTicks" :key="tick.at" :style="{ left: tick.x + '%' }">{{ tick.label }}</text></view>
  <view v-if="secondaries.length" class="side-cards">
   <view v-for="item in secondaries" :key="item.key" class="side-card"><text class="side-label">{{ item.label }}</text><text class="side-value">{{ item.value }}<text v-if="item.unit" class="side-unit">{{ item.unit }}</text></text></view>
  </view>
  <view class="readout"><text>{{ selected ? fmtDateTime(selected.recordedAt) : '点击图形查看采样' }}</text><text>{{ selected ? (selected.values[metricKey] ?? '缺测') + (metric?.unit || '') : coverageText }}</text></view>
 </view>
</template>
<script setup>
import { computed, getCurrentInstance, ref } from 'vue'
import { fmtDateTime } from '../../lib/observations.mjs'
import { trendLineChart } from '../../lib/energy.mjs'
import SlidingSegments from '../shared/SlidingSegments.vue'
const props = defineProps({ report: { type: Object, required: true } })
const metricKey = ref('temp'), selectedId = ref('')
const metric = computed(() => props.report.metrics.find(item => item.key === metricKey.value))
const metricOptions = computed(() => props.report.metrics.map(item => ({ value: item.key, label: item.label })))
const selected = computed(() => props.report.samples.find(item => item.id === selectedId.value))
const points = computed(() => props.report.samples.filter(item => Number.isFinite(item.values[metricKey.value])))
const range = computed(() => ({ start: Date.parse(props.report.window.from), duration: Math.max(1, Date.parse(props.report.window.to) - Date.parse(props.report.window.from)) }))
const latest = computed(() => points.value.length ? { value: points.value.at(-1).values[metricKey.value], at: points.value.at(-1).recordedAt } : null)
const latestOf = key => {
 const list = props.report.samples.filter(item => Number.isFinite(item.values[key]))
 return list.length ? { value: list.at(-1).values[key], unit: props.report.metrics.find(m => m.key === key)?.unit || '' } : null
}
const secondaries = computed(() => props.report.metrics.filter(item => item.key !== metricKey.value).map(item => { const last = latestOf(item.key); return { key: item.key, label: item.label, value: last?.value ?? '—', unit: last?.unit || item.unit || '' } }))
const coverageText = computed(() => {
 const coverage = props.report.coverage
 if (!coverage?.readSamples) return `${metric.value?.count || 0} 个有效采样`
 return `已读取 ${coverage.readSamples} 条采样${coverage.complete ? ' · 期间数据完整' : ''}`
})
const chart = computed(() => trendLineChart(points.value.map(item => ({ at: item.recordedAt, value: item.values[metricKey.value], ref: item })), {
 from: range.value.start,
 to: range.value.start + range.value.duration,
 selected: selected.value
}))
/* x 轴刻度：跨天按自然日「M/D + 12:00」、短窗按四分点 HH:mm；位置复用图表 xOf 几何。 */
const axisTicks = computed(() => {
 const { start, duration } = range.value
 const xPct = at => Math.max(0, Math.min(100, (chart.value.xOf(at) / chart.value.width) * 100))
 const DAY = 86400000
 if (duration > DAY * 1.5) {
  const ticks = []
  for (let t = start; t <= start + duration; t += DAY / 2) {
   const d = new Date(t)
   const hour = d.getHours()
   ticks.push({ at: t, x: xPct(d.toISOString()), label: hour < 12 ? `${d.getMonth() + 1}/${d.getDate()}` : '12:00' })
  }
  return ticks.filter(t => t.x > 4 && t.x < 96)
 }
 return [0, 1, 2, 3, 4].map(i => { const t = start + duration * i / 4; const d = new Date(t); return { at: t, x: i * 25, label: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` } })
})
const instance = getCurrentInstance()
function selectPoint(event) {
 if (!points.value.length) return
 uni.createSelectorQuery().in(instance).select('.plot').boundingClientRect(rect => {
  if (!rect?.width) return
  const x = (event.detail.x - rect.left) / rect.width * chart.value.width
  const nearest = points.value.reduce((best, item) => Math.abs(chart.value.xOf(item.recordedAt) - x) < Math.abs(chart.value.xOf(best.recordedAt) - x) ? item : best)
  selectedId.value = nearest.id
 }).exec()
}
</script>
<style scoped lang="scss">
@import "../../styles/tokens";
view, text, input { font-size:inherit;line-height:inherit; }
.trend { color:var(--agent-text-secondary);font-size:$agent-font-size-compact; }
button { margin:0;padding:0;background:transparent;line-height:1.3; }button::after { border:0; }
.metrics { margin:14px 0 16px; }
.hero { display:flex;justify-content:space-between;align-items:flex-end;margin:2px 0 12px; }
.hero-label { display:block;font-size:11px;color:var(--agent-text-muted); }
.hero-value { display:block;color:var(--agent-accent-deep);font-size:32px;line-height:1.2;font-weight:650;font-variant-numeric:tabular-nums; }
.hero-unit { font-size:14px;font-weight:400;margin-left:4px;color:var(--agent-text-muted); }
.peak { text-align:right;color:var(--agent-text-muted);font-size:10.5px;line-height:1.7; }
.plot { position:relative;height:154px; }.chart { width:100%;height:100%; }
.axis { position:relative;height:16px;margin:2px 0 4px;padding-left:32px; }
.axis text { position:absolute;transform:translateX(-50%);color:var(--agent-text-muted);font-size:9.5px;white-space:nowrap; }
.side-cards { display:flex;gap:9px;margin-top:12px; }
.side-card { flex:1;min-width:0;padding:11px 12px;border:1px solid var(--agent-line);border-radius:12px;background:var(--agent-surface); }
.side-label { display:block;font-size:10px;color:var(--agent-text-muted); }
.side-value { display:block;margin-top:3px;color:var(--agent-accent-deep);font-size:20px;font-weight:600;font-variant-numeric:tabular-nums; }
.side-unit { font-size:10px;font-weight:400;margin-left:3px;color:var(--agent-text-muted); }
.readout { display:flex;justify-content:space-between;gap:$agent-space-small;margin:12px 0 2px;padding-top:10px;border-top:1px solid var(--agent-line);color:var(--agent-text-secondary);font-size:11px; }
.pressed { opacity:.7; }
</style>
