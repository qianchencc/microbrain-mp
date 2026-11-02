<template>
 <view class="report">
  <text class="name">{{ report.meter.name }}</text>
  <text class="sub">{{ report.meter.location ? report.meter.location + ' · ' : '' }}{{ fmtDateTime(report.window.from) }} — {{ fmtDateTime(report.window.to) }}</text>
  <text v-if="!report.samples.length" class="empty">所选期间未取得采样</text>
  <view v-for="sample in report.samples" :key="sample.id + ':' + sample.readTime" class="sample">
   <text class="time">{{ fmtDateTime(sample.readTime) }}</text>
   <view class="values"><view v-for="field in report.fields" :key="field.key"><text class="value">{{ sample.values[field.key] ?? '—' }}</text><text class="flabel">{{ labels[field.key] || field.key }}</text></view></view>
  </view>
 </view>
</template>
<script setup>
import { fmtShanghaiDateTime as fmtDateTime } from '../../lib/observations.mjs'
defineProps({ report: { type: Object, required: true } })
const labels = { epf: '反向累计（epf）', epz: '正向累计（epz）', totalElectric: '平台总示数' }
</script>
<style scoped lang="scss">
@import "../../styles/tokens";
view, text, input { font-size: inherit; line-height: inherit; }
.report { color: #3b5943; font-size: $agent-font-size-compact; margin-top: 8px; }
.name, .sub, .time { display: block; }
.name { font-size: 15px; font-weight: 600; }
.sub { font-size: 10px; color: #80907f; margin-top: 5px; line-height: 1.6; }
.sample { margin-top: 10px; padding: 12px 13px; border: 1px solid #e3e9dc; border-radius: $agent-radius-medium; background: linear-gradient(145deg, #fcfdf9, #f5f8f0); }
.time { font-size: 11px; color: #6b8069; font-weight: 600; margin-bottom: 9px; }
.values { display: flex; gap: $agent-space-small; }
.values > view { flex: 1; min-width: 0; }
.value { display: block; color: #345641; font-size: 16px; line-height: 1.5; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.flabel { display: block; font-size: 9px; color: #8b9d84; margin-top: 2px; }
.empty { display: block; padding: 25px 0; text-align: center; color: #9aa78f; }
</style>
