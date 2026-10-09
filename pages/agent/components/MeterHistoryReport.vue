<template>
 <view class="report">
  <text class="name">{{ report.meter.name }}</text><text class="location">{{ report.meter.location }}</text>
  <text class="window">{{ fmtDateTime(report.window.from) }} — {{ fmtDateTime(report.window.to) }}</text>
  <text v-if="!report.samples.length" class="empty">所选期间未取得采样</text>
  <view v-for="sample in report.samples" :key="sample.id + ':' + sample.readTime" class="sample"><text class="time">{{ fmtDateTime(sample.readTime) }}</text><view class="values"><view v-for="field in report.fields" :key="field.key"><text class="value">{{ sample.values[field.key] ?? '—' }}</text><text>{{ labels[field.key] || field.key }}</text></view></view></view>
  <text class="note">累计示数 · 非期间耗电 · 单位与倍率尚未确认</text>
  <text class="note">{{ report.samples.length }} 条已显示<text v-if="!report.coverage.complete"> · 本批数据不能代表全部期间</text><text v-else> · 当前查询已读完</text></text>
  <text class="note">{{ report.latestReadTime ? '该计量点最近采样 ' + fmtDateTime(report.latestReadTime) : '未取得最近采样时间' }}</text>
  <text class="note">读取于 {{ fmtDateTime(report.observedAt) }}</text>
 </view>
</template>
<script setup>
import { fmtShanghaiDateTime as fmtDateTime } from '../observation-view.mjs'
defineProps({ report: { type: Object, required: true } })
const labels = { epf: '反向累计（epf）', epz: '正向累计（epz）', totalElectric: '平台总示数' }
</script>
<style scoped>
view, text, input { font-size:inherit;line-height:inherit; }
.report { color:#3b5943;font-size:12px; }.name,.location,.window,.time,.note { display:block; }.name { font-size:14px;font-weight:600; }.location,.window { font-size:10px;color:#8b9b86;margin-top:5px;line-height:1.6; }.sample { padding:15px 0;border-bottom:1px solid #e1e8de; }.time { font-size:11px;color:#81977d;margin-bottom:8px; }.values { display:flex;gap:8px; }.values>view { flex:1;min-width:0; }.values text { display:block;font-size:10px;color:#8b9d84;overflow-wrap:anywhere; }.values .value { color:#345641;font-size:17px;line-height:1.5; }.note { font-size:10px;line-height:1.7;color:#91a08b;margin-top:9px; }.empty { display:block;padding:25px 0;text-align:center;color:#9aa78f; }
</style>
