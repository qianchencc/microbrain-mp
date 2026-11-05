<template>
 <view class="trend">
  <SlidingSegments :model-value="metricKey" tone="glass" :options="metricOptions" @update:modelValue="metricKey = $event; selectedId = ''" />
  <view class="hero"><view><text class="hlabel">{{ metric?.label || '观测' }}趋势</text><text class="number">{{ latest?.value ?? '—' }}<text class="unit">{{ metric?.unit || '' }}</text></text></view><view class="peak"><text>峰值 {{ metric?.peak?.value ?? '—' }}{{ metric?.unit || '' }}</text><text>{{ metric?.peak ? fmtDateTime(metric.peak.at) : '暂无有效采样' }}</text></view></view>
  <view class="plot" @tap="selectPoint"><image class="chart" :src="chart.src" mode="scaleToFill" /></view>
  <view class="axis-time" :class="{ ticks: axisTicks.length > 2 }"><text v-for="(tick, i) in axisTicks" :key="i" :style="axisTicks.length > 2 ? { left: tick.left + '%' } : {}">{{ tick.label }}</text></view>
  <view class="foot"><text>{{ selected ? fmtDateTime(selected.recordedAt) : '点击图形查看采样' }}</text><text>{{ selected ? (selected.values[metricKey] ?? '缺测') + (metric?.unit || '') : coverageLine }}</text></view>
 </view>
</template>
<script setup>
import { computed, getCurrentInstance, ref, watch } from 'vue'
import { fmtDateTime } from '../../lib/observations.mjs'
import { trendLineChart } from '../../lib/energy.mjs'
import SlidingSegments from '../shared/SlidingSegments.vue'
const props = defineProps({ report: { type: Object, required: true } })
const metricKey = ref('temp'), selectedId = ref('')
const metric = computed(() => props.report.metrics.find(item => item.key === metricKey.value) || props.report.metrics[0])
const metricOptions = computed(() => props.report.metrics.map(item => ({ value: item.key, label: item.label })))
watch(() => props.report.metrics, list => { if (list?.length && !list.some(item => item.key === metricKey.value)) metricKey.value = list[0].key })
const selected = computed(() => props.report.samples.find(item => item.id === selectedId.value))
const points = computed(() => props.report.samples.filter(item => Number.isFinite(item.values[metricKey.value])))
const latest = computed(() => { const last = points.value.at(-1); return last ? { value: last.values[metricKey.value] } : null })
const range = computed(() => ({ start: Date.parse(props.report.window.from), duration: Math.max(1, Date.parse(props.report.window.to) - Date.parse(props.report.window.from)) }))
const coverageLine = computed(() => {
 const cov = props.report.coverage
 const count = cov?.readSamples ?? metric.value?.count ?? 0
 return count ? `已读取 ${count} 条采样${cov ? (cov.complete ? ' · 期间数据完整' : ' · 部分采样未到齐') : ` · ${count} 个有效采样`}` : `${metric.value?.count || 0} 个有效采样`
})
const chart = computed(() => trendLineChart(points.value.map(item => ({ at: item.recordedAt, value: item.values[metricKey.value], ref: item })), {
 from: range.value.start,
 to: range.value.start + range.value.duration,
 selected: selected.value
}))
const axisTicks = computed(() => {
 const DAY = 864e5, { start, duration } = range.value
 const hour = v => String(v).padStart(2, '0') + ':00'
 if (duration <= DAY) return [
  { label: fmtDateTime(props.report.window.from).slice(11) },
  { label: fmtDateTime(props.report.window.to).slice(11) }
 ]
 const ticks = []
 // 北京时间边界：(t + 8h) 对齐 UTC 日界
 for (let t = Math.ceil((start + 8 * 36e5) / DAY) * DAY - 8 * 36e5; t <= start + duration; t += DAY) {
  const d = new Date(t)
  ticks.push({ at: t, label: `${d.getMonth() + 1}/${d.getDate()}` })
  const noon = t + 12 * 36e5
  if (noon < start + duration - 3 * 36e5) ticks.push({ at: noon, label: hour(12) })
 }
 return ticks.filter(t => t.at >= start && t.at <= start + duration).map(t => ({ ...t, left: (chart.value.xOf(t.at) / chart.value.width) * 100 }))
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
.hero { display:flex;justify-content:space-between;align-items:flex-end;gap:10px;margin:16px 0 10px; }.hlabel { display:block;color:var(--agent-text-primary);font-size:14px;font-weight:600; }.number { display:block;margin-top:3px;color:var(--agent-accent-deep);font-size:32px;line-height:1.25;font-weight:600; }.unit { font-size:13px;margin-left:4px;font-weight:400; }.peak { display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0;color:var(--agent-text-muted);font-size:11px;line-height:1.6; }
.plot { position:relative;height:154px; }.chart { width:100%;height:100%; }
.axis-time { display:flex;justify-content:space-between;position:relative;padding-left:32px;min-height:14px;color:var(--agent-text-muted);font-size:10px; }.axis-time.ticks { padding-left:0; }.axis-time.ticks text { position:absolute;transform:translateX(-50%);white-space:nowrap; }
.foot { display:flex;justify-content:space-between;gap:$agent-space-small;margin:14px 0 0;padding:11px 0 0;border-top:1px solid var(--agent-line);color:var(--agent-text-muted);font-size:11px; }.pressed { opacity:.7; }
</style>
