<template>
 <view class="trend">
  <text class="scope">站点历史观测</text>
  <text class="window">{{ fmtDateTime(report.window.from) }} — {{ fmtDateTime(report.window.to) }}</text>
  <view class="metrics"><button v-for="item in report.metrics" :key="item.key" :class="{ selected: metricKey === item.key }" hover-class="pressed" @tap="metricKey = item.key; selectedId = ''">{{ item.label }}</button></view>
  <view class="summary"><view><text class="number">{{ metric?.peak?.value ?? '—' }}<text class="unit">{{ metric?.unit || '' }}</text></text><text>本次采样峰值</text></view><view class="peak"><text>{{ metric?.peak ? fmtDateTime(metric.peak.at) : '暂无有效采样' }}</text><text>{{ metric?.unit ? '' : '单位尚未确认' }}</text></view></view>
  <view class="plot" @tap="selectPoint"><image class="chart" :src="chart.src" mode="scaleToFill" /></view>
  <view class="axis-time"><text>{{ fmtDateTime(report.window.from).slice(11) }}</text><text>{{ fmtDateTime(report.window.to).slice(11) }}</text></view>
  <view class="readout"><text>{{ selected ? fmtDateTime(selected.recordedAt) : '点击图形查看采样' }}</text><text>{{ selected ? (selected.values[metricKey] ?? '缺测') + (metric?.unit || '') : `${metric?.count || 0} 个有效采样` }}</text></view>
 </view>
</template>
<script setup>
import { computed, getCurrentInstance, ref } from 'vue'
import { fmtDateTime } from '../../lib/observations.mjs'
import { trendLineChart } from '../../lib/energy.mjs'
const props = defineProps({ report: { type: Object, required: true } })
const metricKey = ref('temp'), selectedId = ref('')
const metric = computed(() => props.report.metrics.find(item => item.key === metricKey.value))
const selected = computed(() => props.report.samples.find(item => item.id === selectedId.value))
const points = computed(() => props.report.samples.filter(item => Number.isFinite(item.values[metricKey.value])))
const range = computed(() => ({ start: Date.parse(props.report.window.from), duration: Math.max(1, Date.parse(props.report.window.to) - Date.parse(props.report.window.from)) }))
const chart = computed(() => trendLineChart(points.value.map(item => ({ at: item.recordedAt, value: item.values[metricKey.value], ref: item })), {
 from: range.value.start,
 to: range.value.start + range.value.duration,
 selected: selected.value
}))
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
.trend { color:#35533f;font-size:$agent-font-size-compact; }.scope,.window { display:block;font-size:11px;color:#859683;line-height:1.6; }.window { margin-top:3px; }
button { margin:0;padding:0;background:transparent;line-height:1.3; }button::after { border:0; }
.metrics { display:flex;gap:5px;flex-wrap:wrap;margin:16px 0; }.metrics button { flex:1;min-width:45px;min-height:36px;display:flex;align-items:center;justify-content:center;border-radius:9px;color:#809181;font-size:11px;background:#edf3e8; }.metrics .selected { color:#21684d;background:#fcfdf8;box-shadow:0 1px 5px #274b3328;font-weight:600; }
.summary { display:flex;justify-content:space-between;align-items:center;margin:5px 0 12px; }.summary>view>text { display:block;color:#8a9c87;font-size:11px; }.summary .number { color:#345640;font-size:32px;line-height:1.3; }.unit { font-size:13px;margin-left:4px; }.peak { text-align:right; }
.plot { position:relative;height:154px; }.chart { width:100%;height:100%; }.axis-time { display:flex;justify-content:space-between;padding-left:32px;color:#8b9e85;font-size:10px; }
.readout { display:flex;justify-content:space-between;gap:$agent-space-small;margin:14px 0;padding:11px 0;border-top:1px solid #e0e8db;border-bottom:1px solid #e0e8db;color:#647f68;font-size:11px; }.pressed { opacity:.7; }
</style>
