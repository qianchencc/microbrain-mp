<template>
 <view class="trend">
  <text class="scope">站点历史观测 · 未确定具体设备归属</text>
  <text class="window">{{ fmtDateTime(report.window.from) }} — {{ fmtDateTime(report.window.to) }}</text>
  <view class="metrics"><button v-for="item in report.metrics" :key="item.key" :class="{ selected: metricKey === item.key }" hover-class="pressed" @tap="metricKey = item.key; selectedId = ''">{{ item.label }}</button></view>
  <view class="summary"><view><text class="number">{{ metric?.peak?.value ?? '—' }}<text class="unit">{{ metric?.unit || '' }}</text></text><text>本次采样峰值</text></view><view class="peak"><text>{{ metric?.peak ? fmtDateTime(metric.peak.at) : '暂无有效采样' }}</text><text>{{ metric?.unit ? '' : '单位尚未确认' }}</text></view></view>
  <view class="plot" @tap="selectPoint"><image class="chart" :src="chart" mode="scaleToFill" /><text class="axis high">{{ bounds.max }}</text><text class="axis low">{{ bounds.min }}</text></view>
  <view class="axis-time"><text>{{ fmtDateTime(report.window.from).slice(11) }}</text><text>{{ fmtDateTime(report.window.to).slice(11) }}</text></view>
  <view class="readout"><text>{{ selected ? fmtDateTime(selected.recordedAt) : '点击图形查看采样' }}</text><text>{{ selected ? (selected.values[metricKey] ?? '缺测') + (metric?.unit || '') : `${metric?.count || 0} 个有效采样` }}</text></view>
  <text class="note">采样点按真实时间定位 · 缺测不补零<text v-if="!report.coverage.complete"> · 查询尚未读完，峰值仅指当前样本</text></text>
  <text class="note">本次读取 {{ report.coverage.readSamples }} 条 · 读取于 {{ fmtDateTime(report.observedAt) }}</text>
 </view>
</template>
<script setup>
import { computed, getCurrentInstance, ref } from 'vue'
import { fmtDateTime } from '../observation-view.mjs'
const props = defineProps({ report: { type: Object, required: true } })
const metricKey = ref('temp'), selectedId = ref('')
const metric = computed(() => props.report.metrics.find(item => item.key === metricKey.value))
const selected = computed(() => props.report.samples.find(item => item.id === selectedId.value))
const points = computed(() => props.report.samples.filter(item => Number.isFinite(item.values[metricKey.value])))
const bounds = computed(() => {
 const values = points.value.map(item => item.values[metricKey.value])
 return { min: values.length ? Math.min(...values) : '—', max: values.length ? Math.max(...values) : '—' }
})
const range = computed(() => ({ start: Date.parse(props.report.window.from), duration: Math.max(1, Date.parse(props.report.window.to) - Date.parse(props.report.window.from)) }))
const xOf = time => 30 + (Date.parse(time) - range.value.start) / range.value.duration * 314
const chart = computed(() => {
 const span = Number(bounds.value.max) - Number(bounds.value.min)
 const grid = [20, 77, 134].map(y => `<path d="M30 ${y}H344" stroke="#e1e9df" stroke-dasharray="3 5"/>`).join('')
 const dots = points.value.map(item => `<circle cx="${xOf(item.recordedAt).toFixed(2)}" cy="${(span ? 134 - (item.values[metricKey.value] - Number(bounds.value.min)) / span * 114 : 77).toFixed(2)}" r="${item.id === selectedId.value ? 5 : 3.5}" fill="${item.id === selectedId.value ? '#b89443' : '#3c8c6b'}" stroke="#fbfdf8" stroke-width="1.5"/>`).join('')
 return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 154">${grid}${dots}</svg>`)
})
const instance = getCurrentInstance()
function selectPoint(event) {
 if (!points.value.length) return
 uni.createSelectorQuery().in(instance).select('.plot').boundingClientRect(rect => {
  if (!rect?.width) return
  const x = (event.detail.x - rect.left) / rect.width * 360
  const nearest = points.value.reduce((best, item) => Math.abs(xOf(item.recordedAt) - x) < Math.abs(xOf(best.recordedAt) - x) ? item : best)
  selectedId.value = nearest.id
 }).exec()
}
</script>
<style scoped>
view, text, input { font-size:inherit;line-height:inherit; }
.trend { color:#35533f;font-size:12px; }.scope,.window { display:block;font-size:11px;color:#859683;line-height:1.6; }.window { margin-top:3px; }
button { margin:0;padding:0;background:transparent;line-height:1.3; }button::after { border:0; }
.metrics { display:flex;gap:5px;flex-wrap:wrap;margin:16px 0; }.metrics button { flex:1;min-width:45px;min-height:36px;display:flex;align-items:center;justify-content:center;border-radius:9px;color:#809181;font-size:11px;background:#edf3e8; }.metrics .selected { color:#21684d;background:#fcfdf8;box-shadow:0 1px 5px #274b3328;font-weight:600; }
.summary { display:flex;justify-content:space-between;align-items:center;margin:5px 0 12px; }.summary>view>text { display:block;color:#8a9c87;font-size:11px; }.summary .number { color:#345640;font-size:32px;line-height:1.3; }.unit { font-size:13px;margin-left:4px; }.peak { text-align:right; }
.plot { position:relative;height:154px; }.chart { width:100%;height:100%; }.axis { position:absolute;left:0;font-size:10px;color:#879b81; }.high { top:12px; }.low { bottom:12px; }.axis-time { display:flex;justify-content:space-between;padding-left:26px;color:#8b9e85;font-size:10px; }
.readout { display:flex;justify-content:space-between;gap:8px;margin:14px 0;padding:11px 0;border-top:1px solid #e0e8db;border-bottom:1px solid #e0e8db;color:#647f68;font-size:11px; }.note { display:block;margin-top:5px;color:#90a08b;font-size:10px;line-height:1.6; }.pressed { opacity:.7; }
</style>
