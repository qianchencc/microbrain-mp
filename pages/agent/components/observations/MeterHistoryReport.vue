<template>
  <view class="report">
    <text class="name">{{ report.meter.name }}</text>
    <text class="sub"
      >{{ report.meter.location ? report.meter.location + ' · ' : ''
      }}{{ fmtDateTime(report.window.from) }} — {{ fmtDateTime(report.window.to) }}</text
    >
    <text
      v-if="!report.samples.length"
      class="empty"
      >所选期间未取得采样</text
    >
    <view
      v-for="sample in report.samples"
      :key="sample.id + ':' + sample.readTime"
      class="sample"
    >
      <text class="time">{{ fmtDateTime(sample.readTime) }}</text>
      <view class="values"
        ><view
          v-for="field in report.fields"
          :key="field.key"
          ><text class="value">{{ sample.values[field.key] ?? '—' }}</text
          ><text class="flabel">{{ labels[field.key] || field.key }}</text></view
        ></view
      >
    </view>
  </view>
</template>
<script setup>
import { fmtShanghaiDateTime as fmtDateTime } from '../../lib/observations.mjs';
defineProps({ report: { type: Object, required: true } });
const labels = { epf: '反向累计（epf）', epz: '正向累计（epz）', totalElectric: '平台总示数' };
</script>
<style scoped lang="scss">
@import '../../styles/tokens';
view,
text,
input {
  font-size: inherit;
  line-height: inherit;
}
.report {
  color: var(--agent-text-secondary);
  font-size: $agent-font-size-compact;
  margin-top: 8px;
}
.name,
.sub,
.time {
  display: block;
}
.name {
  font-size: 15px;
  font-weight: 600;
}
.sub {
  font-size: 10px;
  color: var(--agent-text-muted);
  margin-top: 5px;
  line-height: 1.6;
}
.sample {
  margin-top: 10px;
  padding: 12px 13px;
  border: 1px solid var(--agent-line);
  border-radius: $agent-radius-medium;
  background: linear-gradient(145deg, var(--agent-surface), var(--agent-surface-page));
}
.time {
  font-size: 11px;
  color: var(--agent-text-muted);
  font-weight: 600;
  margin-bottom: 9px;
}
.values {
  display: flex;
  gap: $agent-space-small;
}
.values > view {
  flex: 1;
  min-width: 0;
}
.value {
  display: block;
  color: var(--agent-accent-deep);
  font-size: 16px;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.flabel {
  display: block;
  font-size: 9px;
  color: var(--agent-text-muted);
  margin-top: 2px;
}
.empty {
  display: block;
  padding: 25px 0;
  text-align: center;
  color: var(--agent-text-muted);
}
</style>
