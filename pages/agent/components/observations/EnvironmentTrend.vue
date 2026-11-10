<template>
  <view class="trend">
    <SlidingSegments
      :model-value="metricKey"
      tone="glass"
      :options="metricOptions"
      @update:modelValue="
        metricKey = $event;
        selectedId = '';
      "
    />
    <view class="hero"
      ><view
        ><text class="hlabel">{{ metric?.label || '观测' }} · 最新采样</text
        ><text class="number"
          >{{ latest?.value ?? '—' }}<text class="unit">{{ metric?.unit || '' }}</text></text
        ></view
      ><view class="peak"
        ><text>原始峰值 {{ metric?.peak?.value ?? '—' }}{{ metric?.unit || '' }}</text
        ><text>{{ metric?.peak ? fmtDateTime(metric.peak.at) : '暂无有效采样' }}</text></view
      ></view
    >
    <text
      v-if="windowText"
      class="window"
      >{{ windowText }} · {{ resolutionText }}</text
    >
    <view
      class="plot"
      @tap="selectPoint"
      ><image
        class="chart"
        :src="chart.src"
        mode="scaleToFill"
    /></view>
    <view class="axis-time"
      ><text
        v-for="(tick, i) in axisTicks"
        :key="i"
        :class="`tick-${tick.edge}`"
        :style="{ left: tick.left + '%' }"
        >{{ tick.label }}</text
      ></view
    >
    <text
      v-if="qualityNotice"
      class="quality"
      >{{ qualityNotice }}</text
    >
    <view class="foot"
      ><text>{{ selected ? selectedTime : '点击图形查看' + resolutionText }}</text
      ><text>{{
        selected ? (selected.values[metricKey] ?? '缺测') + (metric?.unit || '') : coverageLine
      }}</text></view
    >
    <text
      v-if="selectedDetail"
      class="selected-detail"
      >{{ selectedDetail }}</text
    >
  </view>
</template>
<script setup>
import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue';
import {
  fmtDateTime,
  fmtShanghaiDateTime,
  environmentSampleIdentity,
  environmentChartPoints,
  environmentHistoryNotice,
  environmentWindowLabel,
  environmentTrendTicks,
} from '../../lib/observations.mjs';
import { trendLineChart } from '../../lib/energy.mjs';
import SlidingSegments from '../shared/SlidingSegments.vue';
const props = defineProps({ report: { type: Object, required: true } });
const metricKey = ref('temp'),
  selectedId = ref('');
const metric = computed(
  () => props.report.metrics.find((item) => item.key === metricKey.value) || props.report.metrics[0]
);
const metricOptions = computed(() =>
  props.report.metrics.map((item) => ({ value: item.key, label: item.label }))
);
watch(
  () => props.report.metrics,
  (list) => {
    if (list?.length && !list.some((item) => item.key === metricKey.value))
      metricKey.value = list[0].key;
  }
);
const pointIdentity = (point) =>
  point.from ? `${point.from}/${point.to}` : environmentSampleIdentity(point);
const pointTime = (point) => point.at || point.recordedAt;
const chartPoints = computed(() => environmentChartPoints(props.report, metricKey.value));
const selected = computed(
  () => chartPoints.value.find((point) => pointIdentity(point.ref) === selectedId.value)?.ref
);
const points = computed(() =>
  chartPoints.value.filter((point) => point.value !== null).map((point) => point.ref)
);
const resolutionText = computed(
  () =>
    ({ day: '日均值', '3h': '3小时均值', raw: '原始采样' })[props.report.resolution] || '原始采样'
);
const qualityNotice = computed(() => {
  const notes = [environmentHistoryNotice(props.report)];
  const empty = (props.report.buckets || []).filter(
    (bucket) => !bucket.metrics?.[metricKey.value]?.count
  ).length;
  if (empty) notes.push(`${empty}个时段无有效采样，已断开显示`);
  return notes.filter(Boolean).join('；');
});
const latest = computed(() => {
  const raw = props.report.latest?.[metricKey.value];
  if (raw) return raw;
  if (props.report.resolution && props.report.resolution !== 'raw') return null;
  const last = points.value.at(-1);
  return last ? { value: last.values[metricKey.value] } : null;
});
const selectedTime = computed(() =>
  selected.value?.from
    ? fmtShanghaiDateTime(selected.value.from) +
      (props.report.resolution === 'day' ? ' 日均' : ' 起3小时')
    : fmtDateTime(selected.value?.recordedAt)
);
const selectedDetail = computed(() => {
  const detail = selected.value?.metrics?.[metricKey.value];
  if (!detail) return '';
  const unit = metric.value?.unit || '';
  return `最低 ${detail.min}${unit} · 最高 ${detail.max}${unit} · ${detail.count}条有效采样`;
});
const range = computed(() => ({
  start: Date.parse(props.report.window.from),
  duration: Math.max(1, Date.parse(props.report.window.to) - Date.parse(props.report.window.from)),
}));
const coverageLine = computed(() => {
  const cov = props.report.coverage;
  const count = cov?.readSamples ?? metric.value?.count ?? 0;
  const incomplete = cov?.complete === false || props.report.nextPage != null;
  const span =
    incomplete && cov?.from && cov?.to
      ? ` · 覆盖 ${fmtShanghaiDateTime(cov.from)} 至 ${fmtShanghaiDateTime(cov.to)}`
      : '';
  return `已读取 ${count} 条采样${span}`;
});
const chart = computed(() =>
  trendLineChart(chartPoints.value, {
    from: range.value.start,
    to: range.value.start + range.value.duration,
    selected: selected.value,
  })
);
const windowText = computed(() => environmentWindowLabel(props.report.window));
const plotWidth = ref(360);
const axisTicks = computed(() =>
  environmentTrendTicks(props.report.window, { width: plotWidth.value })
);
const instance = getCurrentInstance();
function measurePlot() {
  uni
    .createSelectorQuery()
    .in(instance)
    .select('.plot')
    .boundingClientRect((rect) => {
      if (rect?.width > 0) plotWidth.value = rect.width;
    })
    .exec();
}
onMounted(measurePlot);
watch(() => props.report.window, measurePlot, { flush: 'post' });
function selectPoint(event) {
  if (!points.value.length) return;
  uni
    .createSelectorQuery()
    .in(instance)
    .select('.plot')
    .boundingClientRect((rect) => {
      if (!rect?.width) return;
      const x = ((event.detail.x - rect.left) / rect.width) * chart.value.width;
      const nearest = points.value.reduce((best, item) =>
        Math.abs(chart.value.xOf(pointTime(item)) - x) <
        Math.abs(chart.value.xOf(pointTime(best)) - x)
          ? item
          : best
      );
      selectedId.value = pointIdentity(nearest);
    })
    .exec();
}
</script>
<style scoped lang="scss">
@import '../../styles/tokens';
view,
text,
input {
  font-size: inherit;
  line-height: inherit;
}
.trend {
  color: var(--agent-text-secondary);
  font-size: $agent-font-size-compact;
}
button {
  margin: 0;
  padding: 0;
  background: transparent;
  line-height: 1.3;
}
button::after {
  border: 0;
}
.hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 10px;
  margin: 16px 0 10px;
}
.hlabel {
  display: block;
  color: var(--agent-text-primary);
  font-size: 14px;
  font-weight: 600;
}
.number {
  display: block;
  margin-top: 3px;
  color: var(--agent-accent-deep);
  font-size: 32px;
  line-height: 1.25;
  font-weight: 600;
}
.unit {
  font-size: 13px;
  margin-left: 4px;
  font-weight: 400;
}
.peak {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
  color: var(--agent-text-muted);
  font-size: 11px;
  line-height: 1.6;
}
.plot {
  position: relative;
  height: 154px;
}
.chart {
  width: 100%;
  height: 100%;
}
.window {
  display: block;
  margin: 12px 0 2px;
  color: var(--agent-text-muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.axis-time {
  position: relative;
  min-height: 14px;
  margin-top: 2px;
  color: var(--agent-text-muted);
  font-size: 10px;
}
.axis-time text {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
}
.axis-time .tick-start {
  transform: none;
}
.axis-time .tick-end {
  transform: translateX(-100%);
}
.selected-detail {
  display: block;
  margin-top: 6px;
  color: var(--agent-text-muted);
  font-size: 10px;
}
.foot {
  display: flex;
  justify-content: space-between;
  gap: $agent-space-small;
  margin: 14px 0 0;
  padding: 11px 0 0;
  border-top: 1px solid var(--agent-line);
  color: var(--agent-text-muted);
  font-size: 11px;
}
.quality {
  display: block;
  margin-top: $agent-space-small;
  color: var(--agent-text-muted);
  font-size: 11px;
  line-height: 1.5;
}
.pressed {
  opacity: 0.7;
}
</style>
